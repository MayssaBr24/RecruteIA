"""
views.py — Entretiens IA + Candidatures avec RAG integre
CORRECTIONS :
  ✅ Phase 'technical' = questions orales générées par generate_technical_questions()
  ✅ Phase 'qcm'       = QCM seulement (après technical complétée)
  ✅ Ajout du bloc elif phase == 'technical' (oral) dans AIInterviewAnswerView
  ✅ Transition scenario → technical (oral) → qcm correctement chaînée
  ✅ interview.technical_questions stocké sur le modèle (JSONField comme scenario_questions)
"""

import json
import uuid
import logging
from datetime import timedelta

from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Avg, Count, Q

from ..models import Interview, AIInterview, InterviewWarning, Application
from ..serializers import InterviewSerializer, AIInterviewSerializer
from ..permissions import IsRHUser, IsRHOrAdmin

# ── Services ──────────────────────────────────────────────────────────────────
from services.ai_interview_service import (
    generate_first_question,
    generate_next_question,
    generate_scenario_questions,
    generate_technical_questions,   # ← AJOUT : questions orales
    generate_qcm,
    _build_candidate_profile,
)
from services.ai_service import IntelligentCVAnalyzer
from services.groq_client import _call_groq_json, _call_groq_text
from services.audio_service import analyze_audio_response
from services.scoring import (
    analyze_phase_score,
    analyze_scenario_score,
    compute_final_score,
    _extract_vocal_score,
)
from services.feedback import (
    generate_final_feedback,
    generate_candidate_feedback,
    generate_termination_report,
)
from services.profile_warnings import (
    detect_profile_inconsistencies,
    ProfileInconsistency,
)

from services.rag import (
    index_document,
    delete_candidate_documents,
    get_candidate_stats,
    SOURCE_CV, SOURCE_COVER_LETTER,
    SOURCE_RECOMMENDATION, SOURCE_CERTIFICATION,
    SOURCE_FORM, SOURCE_GITHUB,
)

logger = logging.getLogger(__name__)


# =====================================================================
# INTERVIEW RH CLASSIQUE
# =====================================================================

class InterviewCancelView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsRHUser]

    def post(self, request, pk):
        interview = get_object_or_404(Interview, pk=pk, rh_user=request.user)
        interview.status = 'cancelled'
        interview.save()
        from ..tasks import notify_rh_interview_completed
        notify_rh_interview_completed.delay(interview.id)
        return Response({'message': 'Entretien annule avec succes', 'interview': InterviewSerializer(interview).data})


class InterviewConfirmView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsRHUser]

    def post(self, request, pk):
        interview = get_object_or_404(Interview, pk=pk, rh_user=request.user)
        interview.status = 'confirmed'
        interview.save()
        return Response({'message': 'Entretien confirme avec succes', 'interview': InterviewSerializer(interview).data})


class InterviewListCreateView(generics.ListCreateAPIView):
    serializer_class = InterviewSerializer
    permission_classes = [permissions.IsAuthenticated, IsRHUser]

    def get_queryset(self):
        qs = Interview.objects.filter(rh_user=self.request.user)
        if s := self.request.query_params.get('status'):
            qs = qs.filter(status=s)
        if d := self.request.query_params.get('date_from'):
            qs = qs.filter(scheduled_date__gte=d)
        if d := self.request.query_params.get('date_to'):
            qs = qs.filter(scheduled_date__lte=d)
        return qs


class InterviewDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = InterviewSerializer
    permission_classes = [permissions.IsAuthenticated, IsRHUser]

    def get_queryset(self):
        return Interview.objects.filter(rh_user=self.request.user)


# =====================================================================
# HELPER RAG
# =====================================================================

def _index_application_documents(application) -> int:
    candidate_id = str(application.id)
    total_chunks = 0

    try:
        analyzer = IntelligentCVAnalyzer()

        if application.cv_file:
            try:
                cv_text = analyzer.extract_text_from_pdf(application.cv_file.path)
                if cv_text and "[Erreur" not in cv_text and "[PDF vide" not in cv_text:
                    total_chunks += index_document(cv_text, SOURCE_CV, candidate_id)
            except Exception as e:
                logger.warning(f"[RAG] Erreur indexation CV: {e}")

        if getattr(application, 'cover_letter_file', None) and application.cover_letter_file:
            try:
                letter_text = analyzer.extract_text_from_pdf(application.cover_letter_file.path)
                if letter_text and "[Erreur" not in letter_text:
                    total_chunks += index_document(letter_text, SOURCE_COVER_LETTER, candidate_id)
            except Exception as e:
                logger.warning(f"[RAG] Erreur indexation lettre: {e}")

        recommendations = getattr(application, 'recommendation_letters', None)
        if recommendations:
            for i, rec in enumerate(recommendations.all()):
                if getattr(rec, 'file', None) and rec.file:
                    try:
                        rec_text = analyzer.extract_text_from_pdf(rec.file.path)
                        if rec_text and "[Erreur" not in rec_text and len(rec_text.strip()) > 30:
                            meta = {
                                "rec_index": i,
                                "recommender_name": rec.recommender_name or "",
                                "recommender_company": rec.recommender_company or "",
                            }
                            total_chunks += index_document(rec_text, SOURCE_RECOMMENDATION, candidate_id, meta)
                    except Exception as e:
                        logger.warning(f"[RAG] Erreur indexation recommandation {i}: {e}")

        certifications = getattr(application, 'certifications', None)
        if certifications:
            for i, cert in enumerate(certifications.all()):
                cert_parts = []
                if cert.name:
                    cert_parts.append(f"Certification: {cert.name}")
                if getattr(cert, 'issuing_organization', ''):
                    cert_parts.append(f"Organisme: {cert.issuing_organization}")
                if getattr(cert, 'credential_url', ''):
                    cert_parts.append(f"URL: {cert.credential_url}")
                if getattr(cert, 'file', None) and cert.file:
                    try:
                        cert_pdf_text = analyzer.extract_text_from_pdf(cert.file.path)
                        if cert_pdf_text and "[Erreur" not in cert_pdf_text:
                            cert_parts.append(cert_pdf_text)
                    except Exception as e:
                        logger.warning(f"[RAG] Erreur indexation cert PDF {i}: {e}")
                if cert_parts:
                    total_chunks += index_document(
                        "\n".join(cert_parts), SOURCE_CERTIFICATION, candidate_id,
                        {"cert_index": i, "cert_name": cert.name or ""}
                    )

        extra_certif = ""
        if hasattr(application, 'extra_profile_details') and application.extra_profile_details:
            extra_certif = application.extra_profile_details.get("certifications_text", "")
        if extra_certif and len(extra_certif.strip()) > 5:
            total_chunks += index_document(extra_certif, SOURCE_CERTIFICATION, candidate_id, {"source_type": "free_text"})

        form_parts = []
        for field in ['years_experience', 'salary_expectation', 'current_position',
                      'availability_date', 'phone', 'motivation_text']:
            val = getattr(application, field, None)
            if val:
                form_parts.append(f"{field}: {val}")
        if form_parts:
            total_chunks += index_document("\n".join(form_parts), SOURCE_FORM, candidate_id)

        github_data = getattr(application, 'github_data', None)
        if github_data and isinstance(github_data, dict):
            gh_parts = []
            if github_data.get('login'):
                gh_parts.append(f"GitHub username: {github_data['login']}")
            if github_data.get('languages'):
                gh_parts.append(f"Langages: {', '.join(github_data.get('languages', []))}")
            for repo in github_data.get('repos', [])[:5]:
                gh_parts.append(
                    f"Repo: {repo.get('name','')} — {repo.get('description','') or ''} ({repo.get('language','')})"
                )
            if gh_parts:
                total_chunks += index_document("\n".join(gh_parts), SOURCE_GITHUB, candidate_id)

        logger.info(f"[RAG] Indexation complete candidat={candidate_id}: {total_chunks} chunks")
        return total_chunks

    except Exception as e:
        logger.error(f"[RAG] Erreur indexation globale candidat={candidate_id}: {e}", exc_info=True)
        return 0


# =====================================================================
# HELPER — charge les incohérences de profil une seule fois
# =====================================================================

def _get_profile_inconsistencies(application) -> list:
    try:
        job = application.job_offer

        # GitHub repos
        github_data = getattr(application, 'github_data', {}) or {}
        repos_names = [r.get('name', '') for r in (github_data.get('top_repos') or [])[:5]]

        # Certifications
        cert_names = []
        if hasattr(application, 'certifications'):
            cert_names = [c.name for c in application.certifications.all() if c.name]

        profile = {
            # Localisation ✅
            "city": application.current_location or '',
            "job_city": getattr(job, 'location', '') or '',
            "same_city": False,

            # Nationalité — country n'existe pas sur JobOffer → vérification ignorée
            "nationality": application.nationality or '',
            "job_country": 'Tunisie',  # valeur fixe cohérente avec location default

            # Diplôme — domain n'existe pas sur JobOffer → vérification ignorée
            "diploma": application.degree_level or '',
            "diploma_domain": application.degree_level or '',
            "university": application.university or '',
            "graduation_year": application.graduation_year,
            "job_domain": '',  # pas de champ domain sur JobOffer
            "job_title": getattr(job, 'title', '') or '',

            # Expérience
            "experience_years": application.experience_years or None,
            "current_position": application.current_position or '',

            # Salaire supprimé
            "salary_monthly": None,

            # Certifications
            "certifications": cert_names,

            # Projets lettre
            "cover_letter_projects": [],

            # GitHub
            "github_repos_names": repos_names,
        }

        return detect_profile_inconsistencies(profile)

    except Exception as e:
        logger.warning(f"[ProfileInconsistencies] Erreur détection : {e}")
        return []


# =====================================================================
# ENTRETIEN IA — DEMARRAGE
# =====================================================================

class AIInterviewStartView(APIView):
    """GET /ai-interview/<token>/start/"""
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        try:
            interview = AIInterview.objects.select_related('application__job_offer').get(token=token)
        except AIInterview.DoesNotExist:
            return Response({'error': 'Lien invalide ou inexistant'}, status=status.HTTP_404_NOT_FOUND)

        if timezone.now() > interview.expires_at:
            interview.status = 'expired'
            interview.save()
            return Response({'error': 'Ce lien a expire.'}, status=status.HTTP_410_GONE)

        if interview.status in ['completed', 'fraud_terminated', 'expired']:
            return Response({'error': 'Cet entretien est termine.'}, status=status.HTTP_403_FORBIDDEN)

        interview.status           = 'in_progress'
        interview.started_at       = timezone.now()
        interview.current_phase    = 'communication'
        interview.phase_started_at = timezone.now()
        interview.save()

        application    = interview.application
        first_question = generate_first_question(application)

        return Response({
            'interview_id':   interview.id,
            'candidate_name': application.full_name,
            'job_title':      application.job_offer.title,
            'current_phase':  'communication',
            'phase_info': {
                'communication':    {'duration_minutes': 15, 'questions': 4,  'description': 'Questions comportementales et motivationnelles'},
                'cv_clarification': {'duration_minutes': 10, 'questions': 3,  'description': 'Clarification de votre parcours'},
                'scenario':         {'duration_minutes': 15, 'questions': 2,  'description': 'Mises en situation professionnelles'},
                # ↓ NOUVELLES PHASES EXPLICITES
                'technical':        {'duration_minutes': 20, 'questions': 4,  'description': 'Questions techniques orales (réponse détaillée)'},
                'qcm':              {'duration_minutes': 15, 'questions': 10, 'description': 'QCM technique / métier'},
            },
            'first_question': first_question,
            'question_index': 0,
        })


# =====================================================================
# ENTRETIEN IA — RECEPTION DES REPONSES
# =====================================================================

class AIInterviewAnswerView(APIView):
    """POST /ai-interview/<token>/answer/"""
    permission_classes = [permissions.AllowAny]

    PHASE_TIME_LIMITS = {
        'communication':    20 * 60,
        'cv_clarification': 15 * 60,
        'scenario':         20 * 60,
        'technical':        30 * 60,   # questions orales
        'qcm':              30 * 60,   # QCM
    }

    def post(self, request, token):
        try:
            interview = AIInterview.objects.select_related('application__job_offer').get(
                token=token, status='in_progress'
            )
        except AIInterview.DoesNotExist:
            return Response({'error': 'Entretien introuvable ou non actif'}, status=status.HTTP_404_NOT_FOUND)

        answer           = request.data.get('answer', '')
        if answer is None:
            answer = ''
        answer = str(answer).strip()

        question_index   = int(request.data.get('question_index', 0))
        phase            = request.data.get('phase', 'communication')
        response_time    = int(request.data.get('response_time_seconds', 0))
        current_question = request.data.get('current_question', '')

        if phase != interview.current_phase:
            return Response(
                {'error': f'Phase invalide. Attendue : {interview.current_phase}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not answer and phase not in ('technical', 'qcm'):
            return Response({'error': 'La reponse ne peut pas etre vide'}, status=status.HTTP_400_BAD_REQUEST)

        # Anti-triche chrono
        if getattr(interview, 'phase_started_at', None):
            elapsed = (timezone.now() - interview.phase_started_at).total_seconds()
            limit   = self.PHASE_TIME_LIMITS.get(phase, 30 * 60)
            if elapsed > limit + 60:
                InterviewWarning.objects.create(
                    interview=interview, warning_type='time_exceeded',
                    details=f'{phase} : {int(elapsed/60)} min (limite {int(limit/60)} min)'
                )

        # Enregistrement transcript (sauf QCM)
        if phase not in ('qcm',):
            interview.transcript.append({
                'phase': phase, 'question_index': question_index,
                'question': current_question, 'answer': answer,
                'response_time_seconds': response_time,
                'timestamp': timezone.now().isoformat(),
            })
            interview.save()

        application = interview.application
        profile_inconsistencies = _get_profile_inconsistencies(application)

        # ── COMMUNICATION ──────────────────────────────────────────────
        if phase == 'communication':
            if question_index < 3:
                next_q = generate_next_question(
                    application=application,
                    phase='communication',
                    question_index=question_index + 1,
                    transcript=interview.transcript,
                    last_answer=answer,
                    last_question=current_question,
                    profile_inconsistencies=profile_inconsistencies,
                )
                return Response({
                    'next_question': next_q,
                    'question_index': question_index + 1,
                    'phase': 'communication',
                    'is_phase_end': False,
                    'questions_remaining': 3 - question_index,
                })
            else:
                comm_score = analyze_phase_score(
                    interview.transcript, 'communication', application.job_offer.title
                )
                interview.communication_score = comm_score
                interview.current_phase       = 'cv_clarification'
                interview.phase_started_at    = timezone.now()
                interview.save()

                next_q = generate_next_question(
                    application=application,
                    phase='cv_clarification',
                    question_index=0,
                    transcript=interview.transcript,
                    last_answer=answer,
                    last_question=current_question,
                    profile_inconsistencies=profile_inconsistencies,
                )
                return Response({
                    'next_question': next_q,
                    'question_index': 0,
                    'phase': 'cv_clarification',
                    'is_phase_end': True,
                    'phase_score': comm_score,
                    'next_phase': 'cv_clarification',
                    'next_phase_info': 'Nous allons maintenant parcourir votre parcours professionnel.',
                })

        # ── CV CLARIFICATION ────────────────────────────────────────────
        elif phase == 'cv_clarification':
            if question_index < 2:
                next_q = generate_next_question(
                    application=application,
                    phase='cv_clarification',
                    question_index=question_index + 1,
                    transcript=interview.transcript,
                    last_answer=answer,
                    last_question=current_question,
                    profile_inconsistencies=profile_inconsistencies,
                )
                return Response({
                    'next_question': next_q,
                    'question_index': question_index + 1,
                    'phase': 'cv_clarification',
                    'is_phase_end': False,
                    'questions_remaining': 2 - question_index,
                })
            else:
                clarif_score = analyze_phase_score(
                    interview.transcript, 'cv_clarification', application.job_offer.title
                )
                interview.clarification_score = clarif_score

                # ── CORRECTION PRINCIPALE : Transition → 'scenario' (pas 'technical' ici)
                if not getattr(interview, 'scenario_questions', None):
                    interview.scenario_questions = generate_scenario_questions(application)

                interview.current_phase    = 'scenario'
                interview.phase_started_at = timezone.now()
                interview.save()

                first_scenario = interview.scenario_questions[0]
                return Response({
                    'phase': 'scenario',
                    'is_phase_end': True,
                    'phase_score': clarif_score,
                    'next_phase': 'scenario',
                    'next_phase_info': 'Vous allez maintenant répondre à des mises en situation.',
                    'next_question':  first_scenario['question'],
                    'question_index': 0,
                    'scenario_theme': first_scenario.get('theme', ''),
                    'total_scenarios': len(interview.scenario_questions),
                })

        # ── SCENARIO ────────────────────────────────────────────────────
        elif phase == 'scenario':
            total_scenarios = len(interview.scenario_questions or [])

            contradiction_q = _detect_contradiction_for_view(
                transcript=interview.transcript,
                last_answer=answer,
                last_question=current_question,
                application=application,
            )

            if contradiction_q:
                return Response({
                    'next_question': contradiction_q,
                    'question_index': question_index,
                    'phase': 'scenario',
                    'is_phase_end': False,
                    'scenario_theme': (
                        interview.scenario_questions[question_index].get('theme', '')
                        if question_index < total_scenarios else ''
                    ),
                    'is_contradiction_followup': True,
                    'questions_remaining': total_scenarios - question_index,
                })

            next_index = question_index + 1

            if next_index < total_scenarios:
                next_scenario = interview.scenario_questions[next_index]
                next_q = generate_next_question(
                    application=application,
                    phase='scenario',
                    question_index=next_index,
                    transcript=interview.transcript,
                    last_answer=answer,
                    last_question=current_question,
                    profile_inconsistencies=profile_inconsistencies,
                )
                return Response({
                    'next_question': next_q,
                    'question_index': next_index,
                    'phase': 'scenario',
                    'is_phase_end': False,
                    'scenario_theme': next_scenario.get('theme', ''),
                    'is_contradiction_followup': False,
                    'questions_remaining': total_scenarios - next_index,
                })

            else:
                # ════════════════════════════════════════════════════
                # FIN SCENARIO → Transition vers TECHNICAL (oral)
                # ════════════════════════════════════════════════════
                scenario_score = analyze_scenario_score(
                    transcript=interview.transcript,
                    scenario_questions=interview.scenario_questions,
                    job_title=application.job_offer.title,
                )
                interview.scenario_score = scenario_score

                # Génération des questions techniques orales (pré-chargées)
                if not getattr(interview, 'technical_questions', None):
                    interview.technical_questions = generate_technical_questions(application)

                interview.current_phase    = 'technical'
                interview.phase_started_at = timezone.now()
                interview.save()

                first_tech = interview.technical_questions[0]
                return Response({
                    'phase': 'technical',
                    'is_phase_end': True,
                    'phase_score': scenario_score,
                    'next_phase': 'technical',
                    'next_phase_info': 'Questions techniques orales — Développez vos réponses en détail (méthode STAR).',
                    # ↓ Champs attendus par TechnicalQuestionCard
                    'next_question':   first_tech['question'],
                    'question_index':  0,
                    'current_angle':   first_tech.get('angle', ''),
                    'time_limit_seconds': first_tech.get('time_limit_seconds', 10 * 60),
                    'total_technical': len(interview.technical_questions),
                })

        # ── TECHNICAL (questions orales) ────────────────────────────────
        # ════════════════════════════════════════════════════════════════
        # BLOC MANQUANT dans le code original — cause principale du bug
        # ════════════════════════════════════════════════════════════════
        elif phase == 'technical':
            tech_questions = getattr(interview, 'technical_questions', None) or []
            total_tech = len(tech_questions)

            # Enregistrement de la réponse dans le transcript (déjà fait plus haut)
            # Passage à la question suivante
            next_index = question_index + 1

            if next_index < total_tech:
                next_tech = tech_questions[next_index]
                return Response({
                    'next_question': next_tech['question'],
                    'question_index': next_index,
                    'phase': 'technical',
                    'is_phase_end': False,
                    'current_angle': next_tech.get('angle', ''),
                    'time_limit_seconds': next_tech.get('time_limit_seconds', 10 * 60),
                    'questions_remaining': total_tech - next_index,
                    'total_technical': total_tech,
                })
            else:
                # ── Toutes les questions techniques orales sont terminées
                # Calcul du score technique oral
                technical_score = analyze_phase_score(
                    interview.transcript, 'technical', application.job_offer.title
                )
                interview.technical_score = technical_score

                # Génération du QCM
                if not interview.qcm_questions:
                    qcm_result = generate_qcm(
                        job_title=application.job_offer.title,
                        requirements=getattr(application.job_offer, 'requirements', ''),
                        num_questions=20,
                        candidate_id=str(application.id),
                    )
                    interview.qcm_questions = (
                        qcm_result.get("questions", qcm_result)
                        if isinstance(qcm_result, dict)
                        else qcm_result
                    )

                interview.current_phase    = 'qcm'
                interview.phase_started_at = timezone.now()
                interview.qcm_started_at   = timezone.now()
                interview.save()

                return Response({
                    'phase': 'qcm',
                    'is_phase_end': True,
                    'phase_score': technical_score,
                    'next_phase': 'qcm',
                    'next_phase_info': 'Dernière étape : un QCM technique/métier (15 min).',
                    'qcm_questions': [
                        {
                            'question':    q['question'],
                            'options':     q['options'],
                            'difficulty':  q.get('difficulty', 'medium'),
                            'domain':      q.get('domain', ''),
                        }
                        for q in interview.qcm_questions
                        if isinstance(q, dict)
                    ],
                    'qcm_time_limit_seconds': 15 * 60,
                })

        # ── QCM ─────────────────────────────────────────────────────────
        elif phase == 'qcm':
            qcm_answers = request.data.get('qcm_answers', {})


            if getattr(interview, 'qcm_started_at', None):
                elapsed = (timezone.now() - interview.qcm_started_at).total_seconds()
                if elapsed > 15 * 60 + 60:
                    InterviewWarning.objects.create(
                        interview=interview,
                        warning_type='time_exceeded',
                        details=f'QCM : {int(elapsed / 60)} min (limite 15 min)'
                    )

            interview.qcm_answers = qcm_answers

            # ── Calcul score — fonctionne aussi avec qcm_answers={} → score 0
            correct = sum(
                1 for i, q in enumerate(interview.qcm_questions or [])
                if str(i) in qcm_answers and qcm_answers.get(str(i)) == q.get('correct')
            )
            total = len(interview.qcm_questions or [])
            qcm_score = int(correct / max(total, 1) * 100)

            interview.qcm_score = qcm_score
            interview.current_phase = 'completed'
            interview.save()

            return Response({
                'phase': 'qcm',
                'is_phase_end': True,
                'qcm_score': qcm_score,
                'correct_answers': correct,
                'total_questions': total,
                'next_step': 'finalize',
                'message': f'QCM terminé : {correct}/{total} bonnes réponses.',
            })


def _detect_contradiction_for_view(transcript, last_answer, last_question, application) -> None:
    if not last_answer or len(last_answer.strip()) < 30:
        return None

    vague_patterns = ['je ne sais pas', 'ca depend', 'peut-etre', "j'essaierais", 'normalement', 'en general', 'bof']
    is_vague = sum(1 for p in vague_patterns if p in last_answer.lower()) >= 2

    if not is_vague:
        return None

    try:
        followup = generate_next_question(
            application=application,
            phase='scenario',
            question_index=-1,
            transcript=transcript,
            last_answer=last_answer,
            last_question=last_question,
            profile_inconsistencies=[],
        )
        return followup
    except Exception:
        return None


# =====================================================================
# ENTRETIEN IA — FINALISATION
# =====================================================================

class AIInterviewFinalizeView(APIView):
    """POST /ai-interview/<token>/finalize/"""
    permission_classes = [permissions.AllowAny]

    def post(self, request, token):
        try:
            interview = AIInterview.objects.select_related('application__job_offer').get(
                token=token, status='in_progress'
            )
        except AIInterview.DoesNotExist:
            return Response({'error': 'Entretien introuvable ou deja finalise'}, status=status.HTTP_404_NOT_FOUND)

        application    = interview.application
        vocal_score    = _extract_vocal_score(interview.transcript)
        scenario_score = getattr(interview, 'scenario_score', None) or 0
        # ↓ Score oral technique (nouvelle phase)
        technical_score = getattr(interview, 'technical_score', None) or 0

        from services.security_warnings import SecurityWarningState, SecurityWarningEvent, SecurityWarningType
        security_state = SecurityWarningState()
        for w in interview.warnings.all():
            try:
                wtype = SecurityWarningType(w.warning_type)
                security_state.events.append(SecurityWarningEvent(type=wtype))
            except ValueError:
                pass

        final_score_result = compute_final_score(
            communication_score=interview.communication_score or 0,
            clarification_score=interview.clarification_score or 0,
            technical_score=technical_score,          # ← score oral
            scenario_score=scenario_score,
            qcm_score=interview.qcm_score or 0,
            security_state=security_state,
            vocal_score=vocal_score,
            has_technical_phase=True,
        )
        final_score = final_score_result["final_score"]

        profile_inconsistencies = _get_profile_inconsistencies(application)

        rh_feedback        = generate_final_feedback(interview, final_score_result, profile_inconsistencies, security_state)
        candidate_feedback = generate_candidate_feedback(interview, final_score)

        interview.ai_interview_score    = final_score
        interview.ai_interview_feedback = rh_feedback
        interview.status                = 'completed'
        interview.completed_at          = timezone.now()
        interview.save()

        old_score             = application.ai_score or 0
        application.ai_score  = int(old_score * 0.5 + final_score * 0.5)
        application.status    = 'interview_completed'
        application.save()

        from recruitment.tasks import send_interview_completion_email
        send_interview_completion_email.delay(interview.id)

        return Response({
            'status': 'completed',
            'final_score': final_score,
            'breakdown': final_score_result["breakdown"],
            'security_penalty': final_score_result["security_penalty"],
            'candidate_feedback': candidate_feedback,
            'message': 'Entretien terminé. Merci pour votre participation !',
        })


# =====================================================================
# ENTRETIEN IA — ANTI-FRAUDE
# =====================================================================

class AIInterviewWarningView(APIView):
    permission_classes = [permissions.AllowAny]

    VALID_TYPES = {
        'face_not_visible', 'multiple_faces', 'face_not_centered',
        'tab_switch', 'window_blur', 'fullscreen_exit',
        'copy_paste', 'double_voice',
        'remote_access', 'anydesk_teamviewer', 'multi_screen',
        'vm_detected', 'robot_mouse',
        'time_exceeded', 'screen_share_stopped', 'phone_detected',
    }

    def post(self, request, token):
        try:
            interview = AIInterview.objects.get(token=token, status='in_progress')
        except AIInterview.DoesNotExist:
            return Response({'error': 'Entretien introuvable'}, status=status.HTTP_404_NOT_FOUND)

        warning_type   = request.data.get('warning_type', '')
        screenshot_url = request.data.get('screenshot_url')
        details        = request.data.get('details', '')

        if warning_type not in self.VALID_TYPES:
            return Response(
                {'error': f'Type invalide. Acceptes : {", ".join(sorted(self.VALID_TYPES))}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        InterviewWarning.objects.create(
            interview=interview,
            warning_type=warning_type,
            details=details,
        )

        total        = interview.warnings.count()
        PENALTY_PER  = 5
        MAX_WARNINGS = 3
        penalty      = min(total * PENALTY_PER, MAX_WARNINGS * PENALTY_PER)

        if total >= MAX_WARNINGS:
            interview.status               = 'fraud_terminated'
            interview.completed_at         = timezone.now()
            interview.ai_interview_score   = 0
            interview.ai_interview_feedback = (
                f"⛔ Entretien interrompu automatiquement : "
                f"{MAX_WARNINGS} incidents de sécurité détectés.\n"
                f"Dernier incident : {warning_type}.\n"
                f"Pénalité totale : -{penalty} pts."
            )
            interview.save()
            return Response({
                'warning_count':  total,
                'penalty_points': penalty,
                'terminated':     True,
                'message':        "Entretien terminé — 3 incidents de sécurité détectés.",
            })

        remaining = MAX_WARNINGS - total
        return Response({
            'warning_count':                total,
            'penalty_points':               penalty,
            'terminated':                   False,
            'remaining_before_termination': remaining,
            'warning_type_registered':      warning_type,
            'message': (
                f"⚠️ Incident détecté ({warning_type}). "
                f"{total}/{MAX_WARNINGS} — encore {remaining} avant arrêt."
            ),
        })


# =====================================================================
# ENTRETIEN IA — AUDIO
# =====================================================================

class AIInterviewAudioView(APIView):
    permission_classes = [permissions.AllowAny]
    parser_classes     = [MultiPartParser]

    def post(self, request, token):
        try:
            interview = AIInterview.objects.get(token=token, status='in_progress')
        except AIInterview.DoesNotExist:
            return Response({'error': 'Entretien introuvable'}, status=status.HTTP_404_NOT_FOUND)

        audio_file = request.FILES.get('audio')
        if not audio_file:
            return Response({'error': 'Fichier audio manquant'}, status=status.HTTP_400_BAD_REQUEST)

        audio_bytes = audio_file.read()
        result = analyze_audio_response(audio_file=(audio_file.name, audio_bytes), audio_bytes=audio_bytes)

        if not result['success']:
            return Response(
                {'error': 'Transcription echouee', 'details': result.get('error', '')},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        interview.transcript.append({
            'type': 'voice_analysis', 'phase': interview.current_phase,
            'vocal_score': result['vocal_score'], 'voice_metrics': result['voice_metrics'],
            'word_count': result.get('word_count', 0), 'duration_seconds': result.get('duration_seconds', 0),
            'timestamp': timezone.now().isoformat(),
        })
        interview.save()

        return Response({
            'text': result['text'], 'word_count': result['word_count'],
            'duration_seconds': result['duration_seconds'],
            'voice_metrics': result['voice_metrics'], 'vocal_score': result['vocal_score'],
        })


# =====================================================================
# ENTRETIEN IA — VIDEO
# =====================================================================

class AIInterviewVideoUploadView(APIView):
    permission_classes = [permissions.AllowAny]
    parser_classes     = [MultiPartParser, FormParser]
    ALLOWED_MIME_TYPES = ['video/webm', 'video/mp4', 'video/ogg', 'video/x-matroska']
    MAX_SIZE_BYTES     = 500 * 1024 * 1024

    def post(self, request, token):
        try:
            interview = AIInterview.objects.get(token=token)
        except AIInterview.DoesNotExist:
            return Response({'error': 'Entretien introuvable'}, status=status.HTTP_404_NOT_FOUND)

        if interview.status not in ['in_progress', 'completed', 'fraud_terminated']:
            return Response({'error': 'Statut invalide pour upload video'}, status=status.HTTP_400_BAD_REQUEST)

        video_file = request.FILES.get('video')
        if not video_file:
            return Response({'error': 'Fichier video manquant'}, status=status.HTTP_400_BAD_REQUEST)
        if video_file.content_type not in self.ALLOWED_MIME_TYPES:
            return Response({'error': f'Format non supporte : {video_file.content_type}'}, status=status.HTTP_400_BAD_REQUEST)
        if video_file.size > self.MAX_SIZE_BYTES:
            return Response({'error': 'Fichier trop volumineux (max 500 Mo)'}, status=status.HTTP_400_BAD_REQUEST)

        if interview.video_recording:
            interview.video_recording.delete(save=False)
        interview.video_recording = video_file
        interview.save()

        return Response({
            'success': True,
            'video_url': request.build_absolute_uri(interview.video_recording.url),
            'message': 'Video enregistree avec succes',
        }, status=status.HTTP_201_CREATED)


class AIInterviewVideoView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsRHOrAdmin]

    def get(self, request, token):
        try:
            interview = AIInterview.objects.select_related('application__job_offer').get(token=token)
        except AIInterview.DoesNotExist:
            return Response({'error': 'Entretien introuvable'}, status=status.HTTP_404_NOT_FOUND)

        if interview.application.job_offer.created_by != request.user:
            return Response({'error': 'Acces non autorise'}, status=status.HTTP_403_FORBIDDEN)

        if not interview.video_recording:
            return Response({'has_video': False, 'message': 'Aucune video disponible'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'has_video': True,
            'video_url': request.build_absolute_uri(interview.video_recording.url),
            'candidate_name': interview.application.full_name,
            'job_title': interview.application.job_offer.title,
            'completed_at': interview.completed_at,
            'duration_minutes': interview.duration_minutes,
        })


# =====================================================================
# DASHBOARD RH — STATUT
# =====================================================================

class AIInterviewStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsRHOrAdmin]

    def get(self, request, token):
        try:
            interview = AIInterview.objects.select_related('application__job_offer').get(token=token)
        except AIInterview.DoesNotExist:
            return Response({'error': 'Introuvable'}, status=status.HTTP_404_NOT_FOUND)
        return Response(AIInterviewSerializer(interview).data)


# =====================================================================
# DASHBOARD RH — LISTE + COMPARAISON
# =====================================================================

class RHInterviewListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    SORT_MAP = {
        'global_score':        'ai_interview_score',
        'communication_score': 'communication_score',
        'clarification_score': 'clarification_score',
        'scenario_score':      'scenario_score',
        'qcm_score':           'qcm_score',
        'completed_at':        'completed_at',
        'created_at':          'created_at',
    }

    def get(self, request):
        interviews = AIInterview.objects.select_related('application__job_offer').filter(
            application__job_offer__created_by=request.user
        )
        if v := request.query_params.get('job_offer_id'):
            interviews = interviews.filter(application__job_offer_id=v)
        if v := request.query_params.get('status'):
            interviews = interviews.filter(status=v)
        if v := request.query_params.get('min_score'):
            interviews = interviews.filter(ai_interview_score__gte=int(v))
        if v := request.query_params.get('recommendation'):
            interviews = interviews.filter(ai_interview_feedback__icontains=f'[{v.upper()}]')

        sort_field = self.SORT_MAP.get(request.query_params.get('sort_by', 'completed_at'), 'completed_at')
        prefix     = '' if request.query_params.get('order') == 'asc' else '-'
        interviews = interviews.order_by(f'{prefix}{sort_field}')

        data = []
        for i in interviews:
            vocal     = _extract_vocal_score(i.transcript)
            video_url = request.build_absolute_uri(i.video_recording.url) if i.video_recording else None
            reco      = self._extract_reco(i.ai_interview_feedback)
            data.append({
                'id': i.id, 'token': str(i.token),
                'status': i.status, 'current_phase': i.current_phase,
                'recommendation': reco,
                'final_recommendation': (getattr(i, 'override_recommendation', None) or reco),
                'scores': {
                    'communication': i.communication_score,
                    'clarification': i.clarification_score,
                    'scenario':      getattr(i, 'scenario_score', None),
                    'technical':     getattr(i, 'technical_score', None),   # ← NOUVEAU
                    'qcm':           i.qcm_score,
                    'vocal':         vocal,
                    'global':        i.ai_interview_score,
                },
                'ai_interview_feedback': i.ai_interview_feedback,
                'rh_annotation': getattr(i, 'rh_annotation', None),
                'rh_rating':     getattr(i, 'rh_rating', None),
                'started_at': i.started_at, 'completed_at': i.completed_at,
                'warnings_count': i.warnings.count(),
                'video_url': video_url,
                'application': {
                    'id': i.application.id, 'full_name': i.application.full_name,
                    'email': i.application.email,
                    'job_offer_id':    i.application.job_offer_id,
                    'job_offer_title': i.application.job_offer.title,
                    'ai_score':        i.application.ai_score,
                }
            })

        completed = [d for d in data if d['status'] == 'completed']
        stats = {}
        if completed:
            def avg(key):
                vals = [d['scores'][key] for d in completed if d['scores'].get(key) is not None]
                return round(sum(vals) / len(vals), 1) if vals else None
            stats = {
                'total_candidates':  len(data),
                'completed_count':   len(completed),
                'avg_global':        avg('global'),
                'avg_communication': avg('communication'),
                'avg_scenario':      avg('scenario'),
                'avg_technical':     avg('technical'),   # ← NOUVEAU
                'avg_qcm':           avg('qcm'),
                'validated_count':   sum(1 for d in completed if d['final_recommendation'] == 'VALIDATED'),
                'to_review_count':   sum(1 for d in completed if d['final_recommendation'] == 'TO_REVIEW'),
                'rejected_count':    sum(1 for d in completed if d['final_recommendation'] == 'REJECTED'),
            }
        return Response({'interviews': data, 'stats': stats})

    @staticmethod
    def _extract_reco(feedback_text):
        if not feedback_text: return 'PENDING'
        for tag in ['VALIDATED', 'TO_REVIEW', 'REJECTED']:
            if f'[{tag}]' in feedback_text: return tag
        return 'PENDING'


# =====================================================================
# ANNOTATIONS RH
# =====================================================================

class RHInterviewAnnotationView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsRHOrAdmin]

    def _get_owned_interview(self, token, user):
        try:
            i = AIInterview.objects.select_related('application__job_offer').get(token=token)
            if i.application.job_offer.created_by == user:
                return i
        except AIInterview.DoesNotExist:
            pass
        return None

    def get(self, request, token):
        i = self._get_owned_interview(token, request.user)
        if not i:
            return Response({'error': 'Introuvable ou acces non autorise'}, status=status.HTTP_404_NOT_FOUND)
        ai_reco  = RHInterviewListView._extract_reco(i.ai_interview_feedback)
        override = getattr(i, 'override_recommendation', None)
        return Response({
            'token': str(i.token), 'candidate_name': i.application.full_name,
            'rh_annotation': getattr(i, 'rh_annotation', None),
            'rh_rating': getattr(i, 'rh_rating', None),
            'override_recommendation': override,
            'ai_recommendation': ai_reco,
            'final_recommendation': override or ai_reco,
            'last_annotated_at': getattr(i, 'rh_annotated_at', None),
        })

    def post(self, request, token):
        i = self._get_owned_interview(token, request.user)
        if not i:
            return Response({'error': 'Introuvable ou acces non autorise'}, status=status.HTTP_404_NOT_FOUND)

        annotation    = request.data.get('rh_annotation', '').strip() or None
        rating        = request.data.get('rh_rating')
        override_reco = (request.data.get('override_recommendation') or '').strip().upper() or None

        if rating is not None:
            try:
                rating = int(rating)
                assert 1 <= rating <= 5
            except (ValueError, TypeError, AssertionError):
                return Response({'error': 'rh_rating doit etre un entier entre 1 et 5'}, status=status.HTTP_400_BAD_REQUEST)

        if override_reco and override_reco not in {'VALIDATED', 'TO_REVIEW', 'REJECTED'}:
            return Response({'error': 'override_recommendation invalide'}, status=status.HTTP_400_BAD_REQUEST)

        i.rh_annotation           = annotation
        i.rh_rating               = rating
        i.override_recommendation = override_reco
        i.rh_annotated_at         = timezone.now()
        i.save(update_fields=['rh_annotation', 'rh_rating', 'override_recommendation', 'rh_annotated_at'])

        ai_reco = RHInterviewListView._extract_reco(i.ai_interview_feedback)
        return Response({
            'success': True,
            'rh_annotation': i.rh_annotation, 'rh_rating': i.rh_rating,
            'override_recommendation': i.override_recommendation,
            'final_recommendation': i.override_recommendation or ai_reco,
            'message': 'Annotation enregistree avec succes.',
        })


# =====================================================================
# COMPARAISON PAR POSTE (RADAR)
# =====================================================================

class RHJobOfferComparisonView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsRHOrAdmin]

    def get(self, request, job_offer_id):
        interviews = AIInterview.objects.select_related('application__job_offer').filter(
            application__job_offer_id=job_offer_id,
            application__job_offer__created_by=request.user,
            status='completed',
        ).order_by('-ai_interview_score')

        if not interviews.exists():
            return Response({'job_offer_id': job_offer_id, 'candidates': [], 'stats': {},
                             'message': 'Aucun entretien complete pour ce poste.'})

        candidates = []
        for rank, i in enumerate(interviews, start=1):
            vocal    = _extract_vocal_score(i.transcript) or 0
            ai_reco  = RHInterviewListView._extract_reco(i.ai_interview_feedback)
            override = getattr(i, 'override_recommendation', None)
            candidates.append({
                'rank': rank, 'token': str(i.token),
                'candidate': {'id': i.application.id, 'full_name': i.application.full_name, 'email': i.application.email},
                'score_radar': {
                    'communication': i.communication_score or 0,
                    'clarification': i.clarification_score or 0,
                    'scenario':      getattr(i, 'scenario_score', None) or 0,
                    'technical':     getattr(i, 'technical_score', None) or 0,   # ← NOUVEAU
                    'qcm':           i.qcm_score or 0,
                    'vocal':         vocal,
                    'global':        i.ai_interview_score or 0,
                },
                'ai_recommendation': ai_reco,
                'override_recommendation': override,
                'final_recommendation': override or ai_reco,
                'rh_rating': getattr(i, 'rh_rating', None),
                'rh_annotation': getattr(i, 'rh_annotation', None),
                'warnings_count': i.warnings.count(),
                'completed_at': i.completed_at,
                'has_video': bool(i.video_recording),
            })

        scores = [c['score_radar']['global'] for c in candidates if c['score_radar']['global'] > 0]
        def avg(key):
            vals = [c['score_radar'][key] for c in candidates if c['score_radar'].get(key, 0) > 0]
            return round(sum(vals) / len(vals), 1) if vals else 0

        stats = {
            'total_completed': len(candidates),
            'avg_global_score': round(sum(scores)/len(scores), 1) if scores else 0,
            'top_score': max(scores) if scores else 0,
            'validated_count': sum(1 for c in candidates if c['final_recommendation'] == 'VALIDATED'),
            'to_review_count': sum(1 for c in candidates if c['final_recommendation'] == 'TO_REVIEW'),
            'rejected_count':  sum(1 for c in candidates if c['final_recommendation'] == 'REJECTED'),
            'avg_per_phase': {
                'communication': avg('communication'),
                'clarification': avg('clarification'),
                'scenario':      avg('scenario'),
                'technical':     avg('technical'),   # ← NOUVEAU
                'qcm':           avg('qcm'),
            }
        }
        return Response({'job_offer_id': job_offer_id, 'candidates': candidates, 'stats': stats})


# =====================================================================
# LANCEMENT MANUEL ENTRETIEN IA (RH)
# =====================================================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def launchAInterview(request, application_id):
    try:
        application = get_object_or_404(Application, id=application_id)

        if application.job_offer.created_by != request.user:
            return Response({'error': "Vous n'etes pas autorise a lancer cet entretien"}, status=403)
        if not application.job_offer.is_active:
            return Response({'error': "Cette offre n'est plus active"}, status=400)
        if application.job_offer.interview_type != 'AI':
            return Response({'error': "Cette offre n'est pas configuree pour un entretien IA"}, status=400)

        if hasattr(application, 'ai_interview'):
            existing = application.ai_interview
            if existing.status in ['pending', 'expired']:
                existing.token      = uuid.uuid4().hex
                existing.status     = 'pending'
                existing.expires_at = timezone.now() + timedelta(hours=24)
                existing.save()
                from recruitment.tasks import send_interview_invitation_email
                send_interview_invitation_email.delay(existing.id)
                return Response({
                    'success': True,
                    'message': 'Nouvelle invitation envoyee au candidat',
                    'interview_id': existing.id,
                    'token': existing.token,
                })
            else:
                return Response({'error': f'Un entretien est deja en cours (statut: {existing.status})'}, status=400)

        application.status = 'shortlisted'
        application.save()

        interview = AIInterview.objects.create(application=application)

        from recruitment.tasks import send_interview_invitation_email
        send_interview_invitation_email.delay(interview.id)

        return Response({
            'success': True,
            'message': 'Entretien IA cree avec succes',
            'interview_id': interview.id,
            'token': interview.token,
            'expires_at': interview.expires_at,
        }, status=201)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({'error': f'Erreur lors de la creation de l entretien: {str(e)}'}, status=500)


# =====================================================================
# RGPD — SUPPRESSION DONNEES RAG
# =====================================================================

@api_view(['DELETE'])
@permission_classes([IsAuthenticated, IsRHOrAdmin])
def delete_candidate_rag_data(request, application_id):
    application = get_object_or_404(Application, id=application_id)
    if application.job_offer.created_by != request.user:
        return Response({'error': 'Acces non autorise'}, status=403)

    deleted = delete_candidate_documents(str(application_id))
    return Response({
        'success': True,
        'candidate_id': application_id,
        'chunks_deleted': deleted,
        'message': f'{deleted} chunks RAG supprimes pour ce candidat.'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsRHOrAdmin])
def get_candidate_rag_stats(request, application_id):
    application = get_object_or_404(Application, id=application_id)
    if application.job_offer.created_by != request.user:
        return Response({'error': 'Acces non autorise'}, status=403)

    stats = get_candidate_stats(str(application_id))
    return Response(stats)