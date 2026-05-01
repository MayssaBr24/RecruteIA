from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from django.db.models import Count, Avg
from collections import Counter
from ..models import Application, JobOffer
from ..models import AIInterview
from ..permissions import IsRHUser
from django.db.models import F
from rest_framework.permissions import IsAuthenticated
# views.py

class RHGlobalAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        interviews = AIInterview.objects.filter(
            application__job_offer__created_by=request.user,
            status='completed'
        ).annotate(
            candidate_name=F('application__full_name')
        )

        # Données pour Timeline
        timeline_data = list(interviews.values(
            'candidate_name',
            'communication_score',
            'clarification_score',
            'qcm_score',
            'coding_score'
        ))

        # Données pour Matrice de Croissance
        matrix_data = list(interviews.values(
            'candidate_name',
            'communication_score',
            'qcm_score',
            'ai_interview_score'
        ))

        # Moyennes globales
        avg_scores = interviews.aggregate(
            avg_comm=Avg('communication_score'),
            avg_clarif=Avg('clarification_score'),
            avg_qcm=Avg('qcm_score'),
            avg_code=Avg('coding_score')
        )

        return Response({
            'timeline': timeline_data,
            'matrix': matrix_data,
            'averages': avg_scores
        })
class AIAnalyticsView(APIView):
    """Statistiques IA pour le dashboard RH"""
    permission_classes = [permissions.IsAuthenticated, IsRHUser]

    def get(self, request):
        try:
            applications = Application.objects.filter(job_offer__created_by=request.user)

            # Décisions IA
            decisions_data = applications.values('ai_decision').annotate(count=Count('ai_decision'))
            decisions = {item['ai_decision']: item['count'] for item in decisions_data}

            # Compétences
            all_skills, all_missing, all_strengths, all_weaknesses = [], [], [], []

            for app in applications:
                if app.ai_strengths and isinstance(app.ai_strengths, list):
                    all_skills.extend(app.ai_strengths)
                    all_strengths.extend(app.ai_strengths)
                if app.ai_missing_skills and isinstance(app.ai_missing_skills, list):
                    all_missing.extend(app.ai_missing_skills)
                if app.ai_weaknesses and isinstance(app.ai_weaknesses, list):
                    all_weaknesses.extend(app.ai_weaknesses)

            # Statistiques
            total = applications.count()
            analyzed = applications.exclude(ai_score=0).count()
            avg_score = applications.aggregate(Avg('ai_score'))['ai_score__avg'] or 0

            return Response({
                'decisions': decisions,
                'topSkills': [s for s, _ in Counter(all_skills).most_common(10)],
                'missingSkillsTrends': [s for s, _ in Counter(all_missing).most_common(10)],
                'topStrengths': [s for s, _ in Counter(all_strengths).most_common(5)],
                'topWeaknesses': [w for w, _ in Counter(all_weaknesses).most_common(5)],
                'totalAnalyzed': analyzed,
                'totalApplications': total,
                'averageScore': round(avg_score, 2),
            })
        except Exception as e:
            print(f"❌ Erreur analytics: {e}")
            return Response({
                'decisions': {}, 'topSkills': [], 'missingSkillsTrends': [],
                'topStrengths': [], 'topWeaknesses': [], 'totalAnalyzed': 0,
                'totalApplications': 0, 'averageScore': 0
            })


from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
# ✅ On importe uniquement ce qui existe réellement dans cv_matching_service.py
from ..cv_matching_service import match_cv_preview
from ..forecasting_service import generate_forecasting
from ..turnover_service import generate_turnover_analysis
from ..models import JobOffer


class CVMatchView(APIView):
    """
    POST /recruitment/rh/cv-match/<offer_id>/
    Lance le matching IA entre une offre existante et les anciens CVs
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, offer_id):
        try:
            offer = JobOffer.objects.get(
                id=offer_id,
                created_by=request.user
            )
        except JobOffer.DoesNotExist:
            return Response({'error': 'Offre introuvable'}, status=404)

        # ✅ On utilise match_cv_preview en lui passant les données de l'offre
        results = match_cv_preview(
            title=offer.title,
            requirements=offer.requirements,
            soft_skills=offer.soft_skills or '',
            experience_years=getattr(offer, 'experience_years', 0),
            education_level=getattr(offer, 'education_level', ''),
            rh_user=request.user
        )

        # On ajoute le titre de l'offre à la réponse pour le frontend
        results['offer_title'] = offer.title
        return Response(results)


class ForecastingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        data = generate_forecasting(rh_user=request.user)
        return Response(data)


class TurnoverView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        data = generate_turnover_analysis(rh_user=request.user)
        return Response(data)


class MarkHiredView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, app_id):
        from ..models import Application
        from django.utils import timezone
        try:
            app = Application.objects.get(id=app_id, job_offer__created_by=request.user)
        except Application.DoesNotExist:
            return Response({'error': 'Candidature introuvable'}, status=404)
        app.hired_at = timezone.now().date()
        app.status = 'hired'
        offer = app.job_offer
        offer.filled_at = timezone.now().date()
        offer.save()
        app.save()
        return Response({'success': True, 'candidate': app.full_name})


class CVMatchPreviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        title = request.data.get('title', '')
        requirements = request.data.get('requirements', '')
        if not title or not requirements:
            return Response({'error': 'Titre et compétences requis'}, status=400)

        results = match_cv_preview(
            title=title,
            requirements=requirements,
            soft_skills=request.data.get('soft_skills', ''),
            experience_years=request.data.get('experience_years', 0),
            education_level=request.data.get('education_level', ''),
            rh_user=request.user
        )
        return Response(results)


class IncrementViewsView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, offer_id):
        try:
            offer = JobOffer.objects.get(id=offer_id)
            offer.views_count += 1
            offer.save(update_fields=['views_count'])
            return Response({'views_count': offer.views_count})
        except JobOffer.DoesNotExist:
            return Response({'error': 'Offre introuvable'}, status=404)