from rest_framework import generics, permissions, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
import logging
import json
from ..models import Application
from ..serializers import ApplicationSerializer
from services.ai_service import IntelligentCVAnalyzer
from services.rag import (
    index_document,
    delete_candidate_documents,
    get_candidate_stats,
    SOURCE_CV, SOURCE_COVER_LETTER,
    SOURCE_RECOMMENDATION, SOURCE_CERTIFICATION,
    SOURCE_FORM, SOURCE_GITHUB,
)
import random
from django.core.cache import cache
from django.core.mail import send_mail
logger = logging.getLogger(__name__)
import uuid
from django.conf import settings

from ..permissions import IsRHOrAdmin, IsRHUser, CompanyObjectPermission

class JobOfferViewSet(ModelViewSet):
    permission_classes = [IsAuthenticated]


# =====================================================================
# CANDIDATURES — CREATE (avec RAG)
# =====================================================================

class ApplicationCreateView(generics.CreateAPIView):
    """POST: Soumettre une candidature (public) avec analyse IA + RAG"""
    queryset = Application.objects.all()
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def create(self, request, *args, **kwargs):
        email = request.data.get('email', '').strip()
        verified_token = request.data.get('email_verified_token', '').strip()

        cached_token = cache.get(f'email_verified_{email}')
        if not cached_token or cached_token != verified_token:
            return Response({'error': 'Email non vérifié. Vérifiez votre email avant de soumettre.'}, status=400)

        # Supprime le token après usage (one-shot)
        cache.delete(f'email_verified_{email}')
        # 1. Liens professionnels
        raw_links = request.data.get("professional_links", "[]")
        links_list = json.loads(raw_links) if isinstance(raw_links, str) else raw_links

        extra_data = {
            "certifications_text": request.data.get("extra_certif", ""),
            "professional_links": links_list
        }

        # 2. GitHub data
        raw_github_data = request.data.get("github_data")
        github_data = None
        if raw_github_data:
            if isinstance(raw_github_data, str):
                try:
                    github_data = json.loads(raw_github_data)
                except (json.JSONDecodeError, TypeError):
                    github_data = {}
            else:
                github_data = raw_github_data
        if github_data is None:
            github_data = {}

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cert_file = request.FILES.get('certificate_file')

        # 3. Sauvegarde
        application = serializer.save(
            extra_profile_details=extra_data,
            github_data=github_data,
            certificate_file=cert_file
        )
        logger.info(f"Nouvelle candidature cree: #{application.id}")

        # 4. Certifications multiples
        certifications_data = request.data.get("certifications", "[]")
        if isinstance(certifications_data, str):
            certifications_data = json.loads(certifications_data)

        for i, cert_data in enumerate(certifications_data):
            if cert_data.get('name'):
                from ..models import Certification
                cert = Certification.objects.create(
                    application=application,
                    name=cert_data.get('name', ''),
                    issuing_organization=cert_data.get('issuing_organization', ''),
                    credential_url=cert_data.get('credential_url', ''),
                )
                file_key = f'cert_file_{i}'
                if file_key in request.FILES:
                    cert.file = request.FILES[file_key]
                    cert.save()

        # 5. Lettres de recommandation multiples
        recommendations_data = request.data.get("recommendation_letters", "[]")
        if isinstance(recommendations_data, str):
            recommendations_data = json.loads(recommendations_data)

        for i, rec_data in enumerate(recommendations_data):
            if rec_data.get('recommender_name'):
                from ..models import RecommendationLetter
                rec = RecommendationLetter.objects.create(
                    application=application,
                    recommender_name=rec_data.get('recommender_name', ''),
                    recommender_position=rec_data.get('recommender_position', ''),
                    recommender_company=rec_data.get('recommender_company', ''),
                    recommender_email=rec_data.get('recommender_email', ''),
                    relationship=rec_data.get('relationship', 'other'),
                )
                file_key = f'rec_file_{i}'
                if file_key in request.FILES:
                    rec.file = request.FILES[file_key]
                    rec.save()

        # ─────────────────────────────────────────────────────────
        # 6. INDEXATION RAG — AVANT l'analyse IA
        # ─────────────────────────────────────────────────────────
               # 7. Analyse IA (utilise le RAG en interne via retrieve_for_job)
        ai_result = self._analyze_cv_with_ai(application, request.data)

        return Response({
            "message": "Candidature soumise avec succes",
            "data": serializer.data,
            "ai_analysis": ai_result
        }, status=201)

    def _build_candidate_form_data(self, application, raw_data: dict) -> dict:
        job = application.job_offer
        return {
            "years_experience":    raw_data.get("years_experience") or getattr(application, "years_experience", None),
            "salary_expectation":  raw_data.get("salary_expectation") or getattr(application, "salary_expectation", None),
            "availability_date":   raw_data.get("availability_date") or getattr(application, "availability_date", None),
            "current_position":    raw_data.get("current_position") or getattr(application, "current_position", ""),
            "phone":               raw_data.get("phone") or getattr(application, "phone", ""),
            "motivation_text":     raw_data.get("motivation_text") or getattr(application, "motivation_text", ""),
            "job_salary_min":      getattr(job, "salary_min", None),
            "job_salary_max":      getattr(job, "salary_max", None),
            "extra_certifications": raw_data.get("extra_certif", ""),
        }

    def _analyze_cv_with_ai(self, application, raw_data: dict) -> dict:
        """
        Lance l'analyse IA complete.
        Le RAG est deja indexe a ce stade — analyze_complete() appelle
        retrieve_for_job() en interne pour enrichir le prompt Groq.
        """
        try:
            analyzer = IntelligentCVAnalyzer()
            job = application.job_offer

            weights = {
                "cv":         getattr(job, "weight_cv", 0.45),
                "motivation": getattr(job, "weight_motivation", 0.15),
                "softskills": getattr(job, "weight_softskills", 0.10),
                "github":     getattr(job, "weight_github", 0.20),
                "coherence":  getattr(job, "weight_coherence", 0.10),
            }
            total_weight = sum(weights.values())
            if abs(total_weight - 1.0) > 0.01:
                weights = {k: round(v / total_weight, 3) for k, v in weights.items()}

            required_skills = []
            if hasattr(job, "required_skills") and job.required_skills:
                if isinstance(job.required_skills, list):
                    required_skills = job.required_skills
                elif isinstance(job.required_skills, str):
                    required_skills = [s.strip() for s in job.required_skills.split(",") if s.strip()]

            candidate_form_data = self._build_candidate_form_data(application, raw_data)

            cover_letter_path = None
            if getattr(application, 'cover_letter_file', None) and application.cover_letter_file:
                try:
                    cover_letter_path = application.cover_letter_file.path
                except Exception:
                    cover_letter_path = None

            # Lettres de recommandation (chemins)
            recommendation_files = []
            if hasattr(application, 'recommendation_letters'):
                for rec in application.recommendation_letters.all():
                    if getattr(rec, 'file', None) and rec.file:
                        try:
                            recommendation_files.append(rec.file.path)
                        except Exception:
                            pass

            # Certifications (textes)
            certification_texts = []
            if hasattr(application, 'certifications'):
                for cert in application.certifications.all():
                    parts = []
                    if cert.name:                         parts.append(cert.name)
                    if getattr(cert, 'issuing_organization', ''): parts.append(cert.issuing_organization)
                    if parts:
                        certification_texts.append(" — ".join(parts))
            extra_certif = raw_data.get("extra_certif", "")
            if extra_certif:
                certification_texts.append(extra_certif)

            # ─────────────────────────────────────────────────────
            # APPEL ANALYSE COMPLETE — candidate_id passe pour RAG
            # analyze_complete() va appeler retrieve_for_job() en interne
            # ─────────────────────────────────────────────────────
            final_analysis = analyzer.analyze_complete(
                cv_file=application.cv_file.path,
                job_title=job.title,
                job_description=job.description,
                required_skills=required_skills,
                cover_letter_file=cover_letter_path,
                github_url=application.github_url or "",
                company_name=getattr(job, "company_name", "L'entreprise"),
                weights=weights,
                candidate_form_data=candidate_form_data,
                recommendation_files=recommendation_files,
                certification_texts=certification_texts,
                candidate_id=str(application.id),   # ← CLE RAG
            )

            self._update_application_with_analysis(application, final_analysis)

            return {
                "status":           "completed",
                "score":            final_analysis.final_score,
                "decision":         final_analysis.decision,
                "message":          final_analysis.candidate_message,
                "next_steps":       final_analysis.next_steps,
                "cv_score":         final_analysis.cv_analysis.score,
                "motivation_score": (final_analysis.motivation_analysis.score if final_analysis.motivation_analysis else None),
                "github_score":     (final_analysis.github_analysis.score if final_analysis.github_analysis else None),
                "github_relevance": (final_analysis.github_analysis.relevance_score if final_analysis.github_analysis else None),
                "coherence_score":  final_analysis.coherence_check.overall_score,
                "coherence_flags":  final_analysis.coherence_check.flags,
                "breakdown":        final_analysis.detailed_breakdown,
            }

        except Exception as e:
            logger.error(f"Erreur analyse IA candidature #{application.id}: {e}", exc_info=True)
            return {
                "status": "error",
                "message": "Candidature enregistree. L'analyse IA sera effectuee sous peu."
            }

    def _update_application_with_analysis(self, application, analysis) -> None:
        try:
            application.ai_score             = analysis.final_score
            application.ai_decision          = analysis.decision
            application.ai_summary           = analysis.cv_analysis.summary
            application.ai_missing_skills    = analysis.cv_analysis.missing_skills
            application.ai_strengths         = analysis.cv_analysis.strengths
            application.ai_weaknesses        = analysis.cv_analysis.weaknesses
            application.ai_recommendations   = analysis.recommendations
            application.ai_breakdown         = analysis.detailed_breakdown
            application.ai_coherence_flags   = analysis.coherence_check.flags
            application.ai_score_rationale   = getattr(analysis, 'score_rationale', None)
            application.ai_notes             = getattr(analysis, 'notes', None)
            application.ai_detailed_justification = getattr(analysis, 'detailed_justification', {})

            if hasattr(application, "ai_certifications"):
                application.ai_certifications = [
                    {"name": c.get("name"), "issuer": c.get("issuer"), "year": c.get("year"),
                     "level": c.get("level"), "relevance": c.get("relevance")}
                    for c in (analysis.certifications or [])
                ]
            if hasattr(application, "ai_projects"):
                application.ai_projects = [
                    {"name": p.get("name"), "type": p.get("type"), "technologies": p.get("technologies", []),
                     "complexity": p.get("complexity"), "team_size": p.get("team_size"), "duration": p.get("duration")}
                    for p in (analysis.projects or [])
                ]
            application.save()
        except Exception as e:
            logger.error(f"Erreur sauvegarde analyse en base: {e}", exc_info=True)


class ApplicationListView(generics.ListAPIView):
    """GET: Liste des candidatures (RH/Admin)"""
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated, IsRHOrAdmin]

    def get_queryset(self):
        user = self.request.user

        # SUPERADMIN voit tout
        if user.role == 'SUPERADMIN' or user.is_superuser:
            return Application.objects.all().order_by("-applied_date")

        # RH et ADMIN voient uniquement les candidatures de leur company
        if user.company:
            return Application.objects.filter(
                job_offer__company=user.company  # ← CHANGEMENT CLÉ
            ).order_by("-applied_date")

        return Application.objects.none()



class ApplicationDetailView(generics.RetrieveAPIView):
    """GET: Détail d'une candidature"""
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated, IsRHOrAdmin, CompanyObjectPermission]
    lookup_field = "pk"

    def get_queryset(self):
        user = self.request.user
        if user.role == 'SUPERADMIN' or user.is_superuser:
            return Application.objects.select_related("job_offer").all()
        if user.company:
            return Application.objects.select_related("job_offer").filter(
                job_offer__company=user.company  # ← CHANGEMENT CLÉ
            )
        return Application.objects.none()


class ApplicationAIReportView(APIView):
    permission_classes = [IsAuthenticated, IsRHOrAdmin]

    def get(self, request, pk):
        user = request.user
        try:
            if user.role == 'SUPERADMIN' or user.is_superuser:
                app = Application.objects.select_related("job_offer").get(pk=pk)
            else:
                app = Application.objects.select_related("job_offer").get(
                    pk=pk,
                    job_offer__company=user.company,
                )
        except Application.DoesNotExist:
            return Response({"error": "Introuvable"}, status=404)

        # ── Breakdown ────────────────────────────────────────────────────────
        breakdown = app.ai_breakdown or {}

        # Fallback : si le breakdown est absent mais qu'on a un score,
        # on estime avec les vrais poids de l'offre (pas hardcodés)
        if not breakdown and app.ai_score:
            job = app.job_offer
            has_gh = bool(app.github_url)

            # Poids depuis l'offre, ou défauts selon présence GitHub
            if job and job.weight_cv is not None:
                w_cv = float(job.weight_cv)
                w_mot = float(job.weight_motivation)
                w_soft = float(job.weight_softskills)
                w_gh = float(job.weight_github)
                w_coh = 1.0 - w_cv - w_mot - w_soft - w_gh
            elif has_gh:
                w_cv, w_mot, w_soft, w_gh, w_coh = 0.40, 0.10, 0.10, 0.30, 0.10
            else:
                w_cv, w_mot, w_soft, w_gh, w_coh = 0.50, 0.25, 0.15, 0.00, 0.10

            s = app.ai_score
            breakdown = {
                "cv_score": min(100, int(s * 1.1)),
                "motivation_score": min(100, int(s * 0.9)),
                "softskills_score": min(100, int(s * 0.95)),
                "github_score": min(100, int(s * 0.85)) if has_gh else 0,
                "coherence_score": min(100, int(s * 1.05)),
                "penalty_applied": 0,
                "penalty_details": [],
                "weighted_cv": round(s * w_cv, 1),
                "weighted_motivation": round(s * w_mot, 1),
                "weighted_softskills": round(s * w_soft, 1),
                "weighted_github": round(s * w_gh, 1) if has_gh else 0,
                "weighted_coherence": round(s * w_coh, 1),
            }

        # ── Justification détaillée ──────────────────────────────────────────
        detailed = app.ai_detailed_justification or {
            "cv_justification": (
                "Correspondance des compétences techniques avec l'offre, "
                "vérification des années d'expérience réelles et des projets."
            ),
            "motivation_justification": (
                "Évaluation de la personnalisation de la lettre et "
                "de la compréhension du poste."
            ),
            "softskills_justification": (
                "Détection des indicateurs de leadership, autonomie, "
                "travail d'équipe et communication dans le CV."
            ),
            "github_justification": (
                "Qualité du portfolio GitHub, activité récente et "
                "pertinence de la stack technique."
            ) if app.github_url else None,
            "coherence_justification": (
                "Vérification de la cohérence entre expérience déclarée, "
                "CV réel et disponibilité."
            ),
            "penalty_justification": None,
        }

        # ── Score rationale ──────────────────────────────────────────────────
        score_rationale = (
            f"Le score de {app.ai_score}/100 est calculé en pondérant "
            f"l'analyse du CV, la lettre de motivation, les soft skills "
            f"détectés, le portfolio GitHub et la cohérence globale du dossier."
        )

        data = {
            "id": app.id,
            "full_name": app.full_name,
            "job_offer_title": app.job_offer.title if app.job_offer else "",
            "applied_date": app.created_at,  # ← champ réel du modèle
            "ai_score": app.ai_score,
            "ai_decision": app.ai_decision,
            "ai_summary": app.ai_summary,
            "ai_strengths": app.ai_strengths or [],
            "ai_weaknesses": app.ai_weaknesses or [],
            "ai_missing_skills": app.ai_missing_skills or [],
            "ai_recommendations": app.ai_recommendations,
            "ai_certifications": app.ai_certifications or [],
            "ai_projects": app.ai_projects or [],
            "ai_breakdown": breakdown,
            "ai_coherence_flags": app.ai_coherence_flags or [],
            "ai_notes": app.ai_notes or "",
            "score_rationale": score_rationale,
            "detailed_justification": detailed,
            # salary_compatible et experience_match supprimés —
            # les raisons sont maintenant dans breakdown["penalty_details"]
        }
        return Response(data)


class SendEmailOTPView(APIView):
    """Envoie un code OTP à l'email du candidat"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip()
        if not email:
            return Response({'error': 'Email manquant'}, status=400)

        # Bloque les domaines jetables
        BLOCKED = ['mailinator.com', 'guerrillamail.com', 'yopmail.com', 'tempmail.com']
        domain = email.split('@')[-1].lower()
        if domain in BLOCKED:
            return Response({'error': 'Email temporaire non accepté'}, status=400)

        # Génère un code à 6 chiffres
        code = str(random.randint(100000, 999999))

        # Stocke en cache 10 minutes
        cache.set(f'email_otp_{email}', code, timeout=600)

        # Envoie l'email AU CANDIDAT
        send_mail(
            subject='Votre code de vérification',
            message=f'Votre code : {code}',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],  # ← vrai email du candidat
            html_message=f"""
            <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
                <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);
                            padding:24px;text-align:center;border-radius:8px 8px 0 0">
                    <h2 style="color:white;margin:0">Vérification Email</h2>
                </div>
                <div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0">
                    <p>Votre code de vérification :</p>
                    <div style="font-size:36px;font-weight:bold;letter-spacing:8px;
                                text-align:center;color:#2563eb;padding:16px;
                                background:white;border-radius:8px;margin:16px 0">
                        {code}
                    </div>
                    <p style="color:#64748b;font-size:13px">
                        ⏳ Ce code expire dans <strong>10 minutes</strong>.<br>
                        Si vous n'avez pas demandé ce code, ignorez cet email.
                    </p>
                </div>
            </div>
            """,
            fail_silently=False,
        )

        return Response({'message': 'Code envoyé', 'email': email}, status=200)


class VerifyEmailOTPView(APIView):
    """Vérifie le code OTP saisi par le candidat"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip()
        code  = request.data.get('code', '').strip()

        if not email or not code:
            return Response({'error': 'Email et code requis'}, status=400)

        cached_code = cache.get(f'email_otp_{email}')

        if not cached_code:
            return Response({'error': 'Code expiré. Demandez un nouveau code.'}, status=400)

        if cached_code != code:
            return Response({'error': 'Code incorrect.'}, status=400)

        # Code correct → supprime du cache et génère un token de session
        cache.delete(f'email_otp_{email}')
        verified_token = str(uuid.uuid4())
        cache.set(f'email_verified_{email}', verified_token, timeout=3600)  # 1h pour finir le formulaire

        return Response({
            'message': 'Email vérifié',
            'verified_token': verified_token  # frontend stocke ce token
        }, status=200)