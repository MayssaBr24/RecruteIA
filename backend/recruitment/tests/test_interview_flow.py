
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from datetime import timedelta
import uuid

from recruitment.models import (
    JobOffer, Application, AIInterview, InterviewWarning
)
from django.contrib.auth import get_user_model

User = get_user_model()


class AIInterviewFlowTest(TestCase):
    """
    Test complet du flow entretien IA
    """

    def setUp(self):
        self.client = APIClient()

        # Créer utilisateur RH
        self.rh_user = User.objects.create_user(
            username='rh_test',
            email='rh@test.com',
            password='test1234',
            role='RH'
        )

        # Créer offre
        self.job = JobOffer.objects.create(
            title='Développeur Python Senior',
            description='Développement backend avec Django et FastAPI',
            requirements='Python, Django, PostgreSQL, Docker, Redis',
            created_by=self.rh_user,
            offer_deadline=timezone.now().date() - timedelta(days=1),
            agents_needed=1,
            interview_type='AI',
            weight_cv=0.50,
            weight_motivation=0.15,
            weight_softskills=0.10,
            weight_github=0.25,
        )

        # Créer candidature
        self.application = Application.objects.create(
            job_offer=self.job,
            full_name='Alice Martin',
            email='alice@test.com',
            phone='+33612345678',
            ai_score=78,
            ai_decision='VALIDATED',
            ai_summary='Développeuse expérimentée avec solide background Python',
            ai_strengths=['Python expert', 'Bonne communication', 'Autonomie'],
            ai_weaknesses=['Kubernetes peu maîtrisé'],
            ai_missing_skills=['Kubernetes', 'Terraform'],
            status='shortlisted'
        )

        # Créer entretien
        self.interview = AIInterview.objects.create(
            application=self.application
        )

    # ──────────────────────────────────────────────────
    # TEST 1 : Démarrage entretien
    # ──────────────────────────────────────────────────

    def test_start_interview_valid_token(self):
        """Token valide → entretien démarré"""
        response = self.client.get(
            f'/api/recruitment/interview/{self.interview.token}/start/'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['candidate_name'], 'Alice Martin')
        self.assertEqual(response.data['current_phase'], 'communication')
        self.assertIn('first_question', response.data)
        self.assertIsNotNone(response.data['first_question'])

        # Vérifier que l'entretien est bien en cours
        self.interview.refresh_from_db()
        self.assertEqual(self.interview.status, 'in_progress')
        self.assertIsNotNone(self.interview.started_at)

    def test_start_interview_invalid_token(self):
        """Token invalide → 404"""
        response = self.client.get(
            f'/api/recruitment/interview/{uuid.uuid4()}/start/'
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_start_interview_expired_token(self):
        """Token expiré → 410"""
        self.interview.expires_at = timezone.now() - timedelta(hours=1)
        self.interview.save()

        response = self.client.get(
            f'/api/recruitment/interview/{self.interview.token}/start/'
        )
        self.assertEqual(response.status_code, status.HTTP_410_GONE)

    def test_start_interview_already_started(self):
        """Entretien déjà en cours → 403"""
        self.interview.status = 'in_progress'
        self.interview.started_at = timezone.now()
        self.interview.save()

        response = self.client.get(
            f'/api/recruitment/interview/{self.interview.token}/start/'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # ──────────────────────────────────────────────────
    # TEST 2 : Soumission de réponses
    # ──────────────────────────────────────────────────

    def _start_interview(self):
        """Helper — démarre l'entretien"""
        self.client.get(
            f'/api/recruitment/interview/{self.interview.token}/start/'
        )
        self.interview.refresh_from_db()

    def test_answer_communication_phase(self):
        """Réponse phase communication — question suivante retournée"""
        self._start_interview()

        response = self.client.post(
            f'/api/recruitment/interview/{self.interview.token}/answer/',
            {
                'answer': 'Je suis développeuse Python depuis 5 ans, '
                          'passionnée par les architectures microservices.',
                'question_index': 0,
                'phase': 'communication',
                'current_question': 'Présentez-vous',
                'response_time_seconds': 45,
            },
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('next_question', response.data)
        self.assertEqual(response.data['question_index'], 1)
        self.assertEqual(response.data['phase'], 'communication')

        # Vérifier transcript
        self.interview.refresh_from_db()
        self.assertEqual(len(self.interview.transcript), 1)
        self.assertEqual(
            self.interview.transcript[0]['phase'], 'communication'
        )

    def test_answer_empty_rejected(self):
        """Réponse vide → 400"""
        self._start_interview()

        response = self.client.post(
            f'/api/recruitment/interview/{self.interview.token}/answer/',
            {
                'answer': '',
                'question_index': 0,
                'phase': 'communication',
            },
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_phase_transition_communication_to_clarification(self):
        """Fin phase communication → transition vers cv_clarification"""
        self._start_interview()

        # Simuler 4 réponses (questions 0 à 3)
        for i in range(4):
            self.client.post(
                f'/api/recruitment/interview/{self.interview.token}/answer/',
                {
                    'answer': f'Réponse détaillée pour la question {i+1} '
                              f'avec exemples concrets et contexte professionnel.',
                    'question_index': i,
                    'phase': 'communication',
                    'current_question': f'Question {i+1}',
                    'response_time_seconds': 60,
                },
                format='json'
            )

        # La 4ème réponse doit déclencher la transition
        self.interview.refresh_from_db()
        self.assertEqual(self.interview.current_phase, 'cv_clarification')
        self.assertIsNotNone(self.interview.communication_score)
        self.assertGreaterEqual(self.interview.communication_score, 0)
        self.assertLessEqual(self.interview.communication_score, 100)

    # ──────────────────────────────────────────────────
    # TEST 3 : Anti-fraude
    # ──────────────────────────────────────────────────

    def test_warning_recorded(self):
        """Warning enregistré correctement"""
        self._start_interview()

        response = self.client.post(
            f'/api/recruitment/interview/{self.interview.token}/warning/',
            {
                'warning_type': 'tab_switch',
                'details': 'Changement onglet détecté'
            },
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['warning_count'], 1)
        self.assertFalse(response.data['terminated'])
        self.assertEqual(response.data['remaining_before_termination'], 2)

        # Vérifier en DB
        self.assertEqual(
            InterviewWarning.objects.filter(interview=self.interview).count(), 1
        )

    def test_fraud_termination_after_3_warnings(self):
        """3 warnings → entretien terminé automatiquement"""
        self._start_interview()

        warning_types = ['tab_switch', 'copy_paste', 'fullscreen_exit']

        for i, w_type in enumerate(warning_types):
            response = self.client.post(
                f'/api/recruitment/interview/{self.interview.token}/warning/',
                {'warning_type': w_type, 'details': f'Warning {i+1}'},
                format='json'
            )

        # Au 3ème warning → terminé
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['terminated'])

        self.interview.refresh_from_db()
        self.assertEqual(self.interview.status, 'fraud_terminated')
        self.assertEqual(self.interview.ai_interview_score, 0)

    def test_invalid_warning_type_rejected(self):
        """Type de warning invalide → 400"""
        self._start_interview()

        response = self.client.post(
            f'/api/recruitment/interview/{self.interview.token}/warning/',
            {'warning_type': 'invalid_type', 'details': 'Test'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ──────────────────────────────────────────────────
    # TEST 4 : QCM
    # ──────────────────────────────────────────────────

    def test_qcm_score_calculation(self):
        """Score QCM calculé correctement"""
        self._start_interview()

        # Injecter des questions QCM
        self.interview.qcm_questions = [
            {
                'question': 'Qu\'est-ce qu\'un decorator en Python ?',
                'options': ['Option A', 'Option B', 'Option C', 'Option D'],
                'correct': 1,
                'difficulty': 'medium',
                'technology': 'Python'
            },
            {
                'question': 'Quelle commande crée une migration Django ?',
                'options': ['Option A', 'Option B', 'Option C', 'Option D'],
                'correct': 2,
                'difficulty': 'easy',
                'technology': 'Django'
            },
        ]
        self.interview.current_phase = 'technical'
        self.interview.save()

        # Soumettre avec 1 bonne réponse sur 2
        response = self.client.post(
            f'/api/recruitment/interview/{self.interview.token}/answer/',
            {
                'answer': 'QCM soumis',
                'question_index': 0,
                'phase': 'technical',
                'qcm_answers': {'0': 1, '1': 0},  # Q1 correcte, Q2 incorrecte
            },
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['qcm_score'], 50)  # 1/2 = 50%
        self.assertEqual(response.data['correct_answers'], 1)

    # ──────────────────────────────────────────────────
    # TEST 5 : Finalisation
    # ──────────────────────────────────────────────────

    def test_finalize_interview(self):
        """Finalisation — score calculé et statut mis à jour"""
        self._start_interview()

        # Injecter des scores de phases
        self.interview.communication_score = 80
        self.interview.clarification_score = 70
        self.interview.qcm_score = 90
        self.interview.save()

        response = self.client.post(
            f'/api/recruitment/interview/{self.interview.token}/finalize/'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('final_score', response.data)
        self.assertIn('breakdown', response.data)

        # Score attendu : 80*0.30 + 70*0.20 + 90*0.50 = 24+14+45 = 83
        self.assertEqual(response.data['final_score'], 83)

        self.interview.refresh_from_db()
        self.assertEqual(self.interview.status, 'completed')
        self.assertIsNotNone(self.interview.completed_at)

    def test_finalize_applies_fraud_penalty(self):
        """Pénalité fraude appliquée au score final"""
        self._start_interview()

        self.interview.communication_score = 80
        self.interview.clarification_score = 80
        self.interview.qcm_score = 80
        self.interview.save()

        # Ajouter 2 warnings
        InterviewWarning.objects.create(
            interview=self.interview,
            warning_type='tab_switch'
        )
        InterviewWarning.objects.create(
            interview=self.interview,
            warning_type='copy_paste'
        )

        response = self.client.post(
            f'/api/recruitment/interview/{self.interview.token}/finalize/'
        )

        # Score sans pénalité : 80*0.30 + 80*0.20 + 80*0.50 = 80
        # Pénalité : 2 warnings × 10 = -20
        # Score final attendu : 60
        self.assertEqual(response.data['final_score'], 60)
        self.assertEqual(response.data['breakdown']['warnings_penalty'], 20)