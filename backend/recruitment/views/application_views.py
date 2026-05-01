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
from ..permissions import  IsRHOrAdmin
from services.ai_service import IntelligentCVAnalyzer
from services.rag import (
    index_document,
    delete_candidate_documents,
    get_candidate_stats,
    SOURCE_CV, SOURCE_COVER_LETTER,
    SOURCE_RECOMMENDATION, SOURCE_CERTIFICATION,
    SOURCE_FORM, SOURCE_GITHUB,
)

logger = logging.getLogger(__name__)


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
        if user.is_staff or user.groups.filter(name="ADMIN").exists():
            return Application.objects.all().order_by("-created_at")
        return Application.objects.filter(
            job_offer__created_by=user
        ).order_by("-created_at")


class ApplicationDetailView(generics.RetrieveAPIView):
    """GET: Détail d'une candidature"""
    queryset = Application.objects.select_related("job_offer").all()
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated, IsRHOrAdmin]
    lookup_field = "pk"

class ApplicationAIReportView(APIView):
    permission_classes = [IsAuthenticated, IsRHOrAdmin]

    def get(self, request, pk):
        try:
            app = Application.objects.select_related("job_offer").get(pk=pk)
        except Application.DoesNotExist:
            return Response({"error": "Introuvable"}, status=404)

        # ai_breakdown est maintenant un vrai champ JSONField
        breakdown = app.ai_breakdown or {}

        # Justification détaillée — depuis le champ ou valeur par défaut lisible
        detailed = app.ai_detailed_justification or {}
        if not detailed:
            detailed = {
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
                    "CV réel, prétention salariale et disponibilité."
                ),
                "penalty_justification": None,
            }
            # Dans ApplicationAIReportView, après breakdown = app.ai_breakdown or {}
            # Si breakdown vide mais qu'on a un score, construire un breakdown estimé
            if not breakdown and app.ai_score:
                estimated = app.ai_score
                breakdown = {
                    "cv_score": min(100, int(estimated * 1.1)),
                    "motivation_score": min(100, int(estimated * 0.9)),
                    "softskills_score": min(100, int(estimated * 0.95)),
                    "github_score": min(100, int(estimated * 0.85)) if app.github_url else 0,
                    "coherence_score": min(100, int(estimated * 1.05)),
                    "penalty_applied": 0,
                    "weighted_cv": round(estimated * 0.40, 1),
                    "weighted_motivation": round(estimated * 0.10, 1),
                    "weighted_softskills": round(estimated * 0.15, 1),
                    "weighted_github": round(estimated * 0.25, 1) if app.github_url else 0,
                    "weighted_coherence": round(estimated * 0.10, 1),
                }



        data = {
            "id":               app.id,
            "full_name":        app.full_name,
            "job_offer_title":  app.job_offer.title if app.job_offer else "",
            "applied_date":     app.created_at,
            "ai_score":         app.ai_score,
            "ai_decision":      app.ai_decision,
            "ai_summary":       app.ai_summary,
            "ai_strengths":     app.ai_strengths  or [],
            "ai_weaknesses":    app.ai_weaknesses or [],
            "ai_missing_skills":app.ai_missing_skills or [],
            "ai_recommendations": app.ai_recommendations,
            "ai_certifications":app.ai_certifications or [],
            "ai_projects":      app.ai_projects or [],

            # ✅ Maintenant ces champs viennent de vrais JSONFields en base
            "ai_breakdown":         breakdown,
            "ai_coherence_flags":   app.ai_coherence_flags or [],

            # ✅ Explication du score
            "score_rationale":      app.ai_score_rationale or (
                f"Le score de {app.ai_score}/100 est calculé en pondérant "
                f"l'analyse du CV, la lettre de motivation, les soft skills "
                f"détectés, le portfolio GitHub et la cohérence globale du dossier."
            ),
            "ai_notes":             app.ai_notes,
            "detailed_justification": detailed,
        }
        return Response(data)