from rest_framework import generics, permissions, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
import logging
import json
from ..models import Application
from ..serializers import ApplicationSerializer
from services.ai_service import IntelligentCVAnalyzer
from services.rag import (
    delete_candidate_documents,
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
        cache.delete(f'email_verified_{email}')

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
            "full_name": application.full_name,

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
                "cv": float(getattr(job, "weight_cv", 0.50)),
                "motivation": float(getattr(job, "weight_motivation", 0.15)),
                "softskills": float(getattr(job, "weight_softskills", 0.10)),
                "github": float(getattr(job, "weight_github", 0.25)),
                "coherence": 0.0,  # cohérence = bonus/malus post-calcul, pas un poids
            }
            required_skills = []
            requirements_raw = getattr(job, "requirements", "") or ""
            if requirements_raw.strip():
                required_skills = [s.strip() for s in requirements_raw.split(",") if s.strip()]

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

            certification_texts = []
            certification_files = []  # ← AJOUT : vrais fichiers PDF pour la couche 1 (intégrité)
            credential_urls = []

            if hasattr(application, 'certifications'):
                for cert in application.certifications.all():

                    # 1. Collecter les URLs Credly pour vérification
                    if getattr(cert, 'credential_url', ''):
                        credential_urls.append(cert.credential_url)

                    # 2. Extraire le texte du PDF si disponible
                    if getattr(cert, 'file', None) and cert.file:
                        try:
                            certification_files.append(cert.file.path)  # ← AJOUT : on garde le chemin du fichier
                            pdf_text = analyzer.extract_text_from_pdf(cert.file.path)
                            if pdf_text and "[Erreur" not in pdf_text and len(pdf_text.strip()) > 10:
                                # Préfixer avec les métadonnées disponibles
                                meta_header = f"Nom: {cert.name or 'Inconnu'}"
                                if getattr(cert, 'issuing_organization', ''):
                                    meta_header += f" | Organisme: {cert.issuing_organization}"
                                if getattr(cert, 'issue_date', None):
                                    meta_header += f" | Date: {cert.issue_date}"

                                certification_texts.append(
                                    f"{meta_header}\n\n{pdf_text}"
                                )
                                logger.info("[Cert] PDF extrait: %s (%d chars)", cert.name, len(pdf_text))
                            else:
                                logger.warning("[Cert] PDF vide ou illisible: %s", cert.name)
                        except Exception as e:
                            logger.warning("[Cert] Erreur lecture PDF %s: %s", cert.name, e)

                    # 3. Fallback si pas de PDF — texte depuis les métadonnées
                    elif cert.name:
                        fallback = f"Nom: {cert.name}"
                        if getattr(cert, 'issuing_organization', ''):
                            fallback += f" | Organisme: {cert.issuing_organization}"
                        if getattr(cert, 'issue_date', None):
                            fallback += f" | Date: {cert.issue_date}"
                        certification_texts.append(fallback)
                        logger.info("[Cert] Fallback métadonnées: %s", cert.name)
            # Texte libre formulaire
            extra_certif = raw_data.get("extra_certif", "")
            if extra_certif and extra_certif.strip():
                certification_texts.append(f"[Certifications déclarées]\n{extra_certif.strip()}")

            logger.info("[Cert] %d certification(s) préparées — %d URLs Credly",
                        len(certification_texts), len(credential_urls))
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
                company_name=(
                    job.company.name
                    if job.company and hasattr(job.company, "name")
                    else job.title
                ),                weights=weights,
                candidate_form_data=candidate_form_data,
                recommendation_files=recommendation_files,
                certification_texts=certification_texts,
                certification_files=certification_files,
                candidate_id=str(application.id),
                credential_url=credential_urls,

            )

            self._update_application_with_analysis(application, final_analysis)
            if application.github_url:
                from recruitment.tasks import fetch_github_code_samples_task
                fetch_github_code_samples_task.delay(application.id)

            # Github metrics — construit depuis l'objet GitHubAnalysis retourné
            github_metrics = None
            if final_analysis.github_analysis:
                gh = final_analysis.github_analysis
                stack = getattr(gh, "stack_detail", {}) or {}
                github_metrics = {
                    "score": gh.score,
                    "total_repos": gh.total_repos,
                    "main_languages": gh.main_languages,
                    "activity_score": gh.activity_score,
                    "activity_score_pts": getattr(gh, "activity_score_pts", 0),
                    "project_quality": gh.project_quality,
                    "project_quality_pts": getattr(gh, "project_quality_pts", 0),
                    "documentation_score": gh.documentation_score,
                    "last_activity": gh.last_activity,
                    "relevance_score": gh.relevance_score,
                    "penalty_gh": getattr(gh, "penalty_gh", 0),
                    "top_repos": gh.top_repos,
                    "stack_matches": stack.get("matches", []),
                    "stack_misses": stack.get("misses", []),
                    "stack_langs_found": stack.get("langs_found", []),
                    "stack_detail_text": stack.get("detail", ""),
                }

            return {
                "status": "completed",
                "score": final_analysis.final_score,
                "decision": final_analysis.decision,
                "message": final_analysis.candidate_message,
                "next_steps": final_analysis.next_steps,
                "cv_score": final_analysis.cv_analysis.score,
                "motivation_score": (
                    final_analysis.motivation_analysis.score if final_analysis.motivation_analysis else None),
                "github_score": (final_analysis.github_analysis.score if final_analysis.github_analysis else None),
                "github_relevance": (
                    final_analysis.github_analysis.relevance_score if final_analysis.github_analysis else None),
                "coherence_score": final_analysis.coherence_check.overall_score,
                "coherence_flags": final_analysis.coherence_check.flags,
                "breakdown": final_analysis.detailed_breakdown,
                "github_metrics": github_metrics,
            }

        except Exception as e:
            logger.error(f"Erreur analyse IA candidature #{application.id}: {e}", exc_info=True)
            return {
                "status": "error",
                "message": "Candidature enregistree. L'analyse IA sera effectuee sous peu."
            }

    def _update_application_with_analysis(self, application, analysis) -> None:
        try:
            application.ai_score = analysis.final_score
            application.ai_decision = analysis.decision
            application.ai_summary = analysis.cv_analysis.summary
            application.ai_missing_skills = analysis.cv_analysis.missing_skills
            application.ai_strengths = analysis.cv_analysis.strengths
            application.ai_weaknesses = analysis.cv_analysis.weaknesses
            application.ai_recommendations = analysis.recommendations
            application.ai_coherence_flags = analysis.coherence_check.flags
            application.ai_score_rationale = getattr(analysis, 'score_rationale', None)
            application.ai_notes = getattr(analysis, 'notes', None)
            application.ai_detailed_justification = getattr(analysis, 'detailed_justification', {})

            # ── BREAKDOWN avec poids ──────────────────────────────────
            breakdown = analysis.detailed_breakdown or {}
            if analysis.weights_used:
                breakdown["weight_cv"] = analysis.weights_used.get("cv", 0.50)
                breakdown["weight_motivation"] = analysis.weights_used.get("motivation", 0.15)
                breakdown["weight_softskills"] = analysis.weights_used.get("softskills", 0.10)
                breakdown["weight_github"] = analysis.weights_used.get("github", 0.25)
                breakdown["weight_coherence"] = 0.0
                if "raw_score" not in breakdown:
                    breakdown["raw_score"] = round(
                        breakdown.get("weighted_cv", 0) +
                        breakdown.get("weighted_motivation", 0) +
                        breakdown.get("weighted_softskills", 0) +
                        breakdown.get("weighted_github", 0) +
                        breakdown.get("weighted_coherence", 0),
                        1
                    )
            application.ai_breakdown = breakdown

            # ── GITHUB METRICS ────────────────────────────────────────
            # Dans _update_application_with_analysis, remplace le bloc GitHub METRICS
            if analysis.github_analysis:
                gh = analysis.github_analysis
                stack = getattr(gh, "stack_detail", {}) or {}
                application.ai_github_metrics = {
                    "score": gh.score,
                    "total_repos": gh.total_repos,
                    "main_languages": gh.main_languages,
                    "activity_score": gh.activity_score,
                    "activity_score_pts": getattr(gh, "activity_score_pts", 0),
                    "project_quality": gh.project_quality,
                    "project_quality_pts": getattr(gh, "project_quality_pts", 0),
                    "documentation_score": gh.documentation_score,
                    "last_activity": gh.last_activity,
                    "relevance_score": gh.relevance_score,
                    "penalty_gh": getattr(gh, "penalty_gh", 0),
                    "top_repos": gh.top_repos,
                    "stack_matches": stack.get("matches", []),
                    "stack_misses": stack.get("misses", []),
                    "stack_langs_found": stack.get("langs_found", []),
                    "stack_detail_text": stack.get("detail", ""),
                }
            else:
                application.ai_github_metrics = None
            if hasattr(application, "ai_certifications"):
                application.ai_certifications = [
                    {"name": c.get("name"), "issuer": c.get("issuer"), "year": c.get("year"),
                     "level": c.get("level"), "relevance": c.get("relevance"),
                     "suspicious": c.get("suspicious", False),
                     "suspicion_reason": c.get("suspicion_reason", ""),
                     "credibility_score": c.get("credibility_score", 100)}
                    for c in (analysis.certifications or [])
                ]
            application.ai_cert_verifications = getattr(analysis, "cert_verifications", []) or []
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
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated, IsRHOrAdmin]

    def get_queryset(self):
        user = self.request.user

        # SUPERADMIN voit tout
        if user.role == 'SUPERADMIN' or user.is_superuser:
            return Application.objects.all().order_by("-applied_date")

        if user.company:
            # ADMIN_RH voit toutes les candidatures de sa company
            if user.role == 'ADMIN_RH':
                return Application.objects.filter(
                    job_offer__company=user.company
                ).order_by("-applied_date")

            # RH voit uniquement les candidatures de SES offres
            if user.role == 'RH':
                return Application.objects.filter(
                    job_offer__created_by=user  # ← clé du fix
                ).order_by("-applied_date")

        return Application.objects.none()


class ApplicationDetailView(generics.RetrieveAPIView):
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated, IsRHOrAdmin, CompanyObjectPermission]
    lookup_field = "pk"

    def get_queryset(self):
        user = self.request.user

        if user.role == 'SUPERADMIN' or user.is_superuser:
            return Application.objects.select_related("job_offer").all()

        if user.company:
            if user.role == 'ADMIN_RH':
                return Application.objects.select_related("job_offer").filter(
                    job_offer__company=user.company
                )
            if user.role == 'RH':
                return Application.objects.select_related("job_offer").filter(
                    job_offer__created_by=user  # ← même logique
                )

        return Application.objects.none()

class ApplicationAIReportView(APIView):
    permission_classes = [IsAuthenticated, IsRHOrAdmin]

    def get(self, request, pk):
        user = request.user
        try:
            if user.role == "SUPERADMIN" or user.is_superuser:
                app = Application.objects.select_related("job_offer").get(pk=pk)
            else:
                app = Application.objects.select_related("job_offer").get(
                    pk=pk,
                    job_offer__company=user.company,
                )
        except Application.DoesNotExist:
            return Response({"error": "Introuvable"}, status=404)

        job     = app.job_offer
        has_gh  = bool(app.github_url)
        score   = app.ai_score or 0

        # ── 1. BREAKDOWN ──────────────────────────────────────────────────────
        # On utilise d'abord le breakdown stocké (produit par calculate_final_score).
        # S'il est absent (anciennes candidatures), on le reconstitue proprement.
        stored_bd = app.ai_breakdown or {}

        if stored_bd and all(
            k in stored_bd
            for k in ("cv_score", "weighted_cv", "raw_score", "penalty_applied")
        ):
            # Breakdown complet déjà stocké — on l'utilise tel quel
            breakdown = stored_bd
        else:
            # Reconstruction pour les anciennes candidatures sans breakdown
            if job and job.weight_cv is not None:
                w_cv = float(job.weight_cv)
                w_mot = float(job.weight_motivation)
                w_soft = float(job.weight_softskills)
                w_gh = float(job.weight_github) if has_gh else 0.0
            elif has_gh:
                w_cv, w_mot, w_soft, w_gh = 0.40, 0.10, 0.10, 0.30
            else:
                w_cv, w_mot, w_soft, w_gh = 0.50, 0.25, 0.15, 0.00

            cv_score = stored_bd.get("cv_score", min(100, int(score * 1.10)))
            mot_score = stored_bd.get("motivation_score", min(100, int(score * 0.90)))
            soft_score = stored_bd.get("softskills_score", min(100, int(score * 0.95)))
            gh_score = stored_bd.get("github_score", min(100, int(score * 0.85))) if has_gh else 0
            coh_score = stored_bd.get("coherence_score", min(100, int(score * 1.05)))
            penalty = stored_bd.get("penalty_applied", 0)

            # Cohérence : bonus/malus post-calcul
            if coh_score >= 70:
                coherence_bonus = 0.005 * coh_score
            else:
                coherence_bonus = -0.05 * (70 - coh_score)

            raw = round(
                w_cv * cv_score +
                w_mot * mot_score +
                w_soft * soft_score +
                w_gh * gh_score +
                coherence_bonus,
                1,
            )

            breakdown = {
                "cv_score": cv_score,
                "motivation_score": mot_score,
                "softskills_score": soft_score,
                "github_score": gh_score,
                "coherence_score": coh_score,
                "raw_score": raw,
                "penalty_applied": penalty,
                "penalty_details": stored_bd.get("penalty_details", []),
                "weighted_cv": round(w_cv * cv_score, 1),
                "weighted_motivation": round(w_mot * mot_score, 1),
                "weighted_softskills": round(w_soft * soft_score, 1),
                "weighted_github": round(w_gh * gh_score, 1),
                "weighted_coherence": round(coherence_bonus, 2),
                "weight_cv": w_cv,
                "weight_motivation": w_mot,
                "weight_softskills": w_soft,
                "weight_github": w_gh,
                "weight_coherence": 0.0,
                "coherence_floor_applied": False,
                "coherence_floor_bonus": round(coherence_bonus, 2),
            }
        # Assurer que les poids sont toujours présents (breakdown stocké peut ne pas les avoir)
        if "weight_cv" not in breakdown:
            # Recalcule les poids depuis les scores pondérés si disponibles
            cv_s  = breakdown.get("cv_score", 1) or 1
            breakdown.setdefault("weight_cv",           round(breakdown.get("weighted_cv",   0) / cv_s, 4))
            mot_s = breakdown.get("motivation_score", 1) or 1
            breakdown.setdefault("weight_motivation",   round(breakdown.get("weighted_motivation", 0) / mot_s, 4))
            soft_s = breakdown.get("softskills_score", 1) or 1
            breakdown.setdefault("weight_softskills",   round(breakdown.get("weighted_softskills", 0) / soft_s, 4))
            gh_s  = breakdown.get("github_score", 1) or 1
            breakdown.setdefault("weight_github",       round(breakdown.get("weighted_github", 0) / gh_s, 4) if has_gh else 0.0)
            coh_s = breakdown.get("coherence_score", 1) or 1
            breakdown.setdefault("weight_coherence",    round(breakdown.get("weighted_coherence", 0) / coh_s, 4))

        # ── 2. GITHUB METRICS ─────────────────────────────────────────────────
        # Stocké dans app.ai_github_metrics (JSONField) par le pipeline analyze_complete.
        # Si absent, on retourne None — le frontend affichera le fallback texte.
        github_metrics = None
        raw_gh = getattr(app, "ai_github_metrics", None)
        if raw_gh and isinstance(raw_gh, dict):
            github_metrics = raw_gh  # déjà sérialisable

        # ── 3. SCORE RATIONALE DYNAMIQUE ─────────────────────────────────────
        bd = breakdown
        COHERENCE_FLOOR = 0.05
        w_cv_pct = int(round(bd.get("weight_cv", 0.40) * 100))
        w_mot_pct = int(round(bd.get("weight_motivation", 0.10) * 100))
        w_soft_pct = int(round(bd.get("weight_softskills", 0.10) * 100))
        w_gh_pct = int(round(bd.get("weight_github", 0.30) * 100))

        # Cohérence — afficher le poids effectif si floor appliqué
        coherence_floor_applied = bd.get("coherence_floor_applied", False)
        coherence_bonus = bd.get("coherence_floor_bonus", 0)
        w_coh_pct = int(round(
            COHERENCE_FLOOR * 100 if coherence_floor_applied
            else bd.get("weight_coherence", 0.05) * 100
        ))
        penalty_txt = (
            f" Après déduction de {bd.get('penalty_applied', 0)} points de pénalités,"
            if bd.get("penalty_applied", 0) > 0
            else ""
        )

        if coherence_floor_applied:
            if coherence_bonus < 0:
                floor_note = f" ⚠ cohérence faible ({bd.get('coherence_score', 0)}/100) → {coherence_bonus:+.1f} pts"
            else:
                floor_note = f" ⚡ plancher système 5% → +{coherence_bonus:.1f} pts"
        else:
            floor_note = ""

        coh_score_val = bd.get("coherence_score", 0)
        coh_bonus_val = bd.get("weighted_coherence", 0)
        coh_sign = "+" if coh_bonus_val >= 0 else ""
        score_rationale = (
            f"Le score de {score}/100 est calculé par pondération : "
            f"CV ({w_cv_pct}%) + Motivation ({w_mot_pct}%) + "
            f"Soft skills ({w_soft_pct}%) + GitHub ({w_gh_pct}%) + "
            f"Cohérence (score {coh_score_val}/100 → {coh_sign}{coh_bonus_val:.2f} pts bonus/malus)."
            f"{penalty_txt} "
            f"Score brut = {bd.get('raw_score', score):.1f} pts."
        )

        # ── 4. JUSTIFICATION DÉTAILLÉE ────────────────────────────────────────
        strengths      = app.ai_strengths       or []
        weaknesses     = app.ai_weaknesses      or []
        missing        = app.ai_missing_skills  or []
        coh_flags      = app.ai_coherence_flags or []
        cv_score_val   = bd.get("cv_score", score)
        mot_score_val  = bd.get("motivation_score", score)
        soft_score_val = bd.get("softskills_score", score)
        gh_score_val   = bd.get("github_score", 0)
        coh_score_val  = bd.get("coherence_score", score)
        penalty_val    = bd.get("penalty_applied", 0)

        # CV justification
        cv_parts = ["Correspondance compétences/offre, expérience réelle et projets analysés par RAG."]
        if strengths:
            cv_parts.append(f"Forces : {', '.join(strengths[:3])}.")
        if missing:
            cv_parts.append(f"Compétences absentes : {', '.join(missing[:3])}.")
        if weaknesses:
            cv_parts.append(f"Points d'attention : {', '.join(weaknesses[:2])}.")

        # Motivation justification
        mot_parts = ["Personnalisation, compréhension du poste et qualité rédactionnelle évaluées."]
        if mot_score_val >= 75:
            mot_parts.append("Lettre personnalisée avec références explicites à l'entreprise.")
        elif mot_score_val < 55:
            mot_parts.append("Lettre peu différenciée — motivation réelle à vérifier en entretien.")

        # Soft skills justification
        soft_parts = ["Mots-clés comportementaux extraits du CV et de la lettre de motivation."]
        if soft_score_val >= 70:
            soft_parts.append("Indicateurs de leadership, autonomie et collaboration bien présents.")
        else:
            soft_parts.append("Peu d'indicateurs comportementaux concrets dans le dossier.")

        # GitHub justification
        if has_gh and github_metrics:
            gh_parts = [
                f"{github_metrics.get('total_repos', '?')} repos publics analysés "
                f"(originaux uniquement, forks exclus).",
                f"Activité : {github_metrics.get('activity_score', '?')}/5. "
                f"Qualité : {github_metrics.get('project_quality', '?')}/5.",
            ]
            if github_metrics.get("relevance_score", 0) >= 60:
                gh_parts.append(
                    f"Stack technique à {github_metrics['relevance_score']}% compatible avec le poste."
                )
        elif has_gh:
            gh_parts = ["Portfolio GitHub fourni et analysé objectivement (sans LLM)."]
        else:
            gh_parts = None

        # Cohérence justification
        coh_parts = ["Vérification de la cohérence entre expérience déclarée, CV et disponibilité."]
        if coh_flags:
            coh_parts.append(f"Alertes : {'; '.join(coh_flags[:2])}.")
        else:
            coh_parts.append("Aucune incohérence majeure détectée.")

        # Pénalités justification
        penalty_details = bd.get("penalty_details", [])
        if penalty_val > 0 and penalty_details:
            pen_just = f"−{penalty_val} pts pour : {' | '.join(penalty_details)}."
        elif penalty_val > 0:
            pen_just = f"−{penalty_val} pts suite à des incohérences détectées dans le dossier."
        else:
            pen_just = None

        detailed_justification = {
            "cv_justification":         " ".join(cv_parts),
            "motivation_justification": " ".join(mot_parts),
            "softskills_justification": " ".join(soft_parts),
            "github_justification":     " ".join(gh_parts) if gh_parts else None,
            "coherence_justification":  " ".join(coh_parts),
            "penalty_justification":    pen_just,
        }

        # ── 5. RÉPONSE FINALE ─────────────────────────────────────────────────
        data = {
            "id":               app.id,
            "full_name":        app.full_name,
            "job_offer_title":  app.job_offer.title if app.job_offer else "",
            "applied_date":     app.created_at,
            "ai_score":         score,
            "ai_decision":      app.ai_decision,
            "ai_summary":       app.ai_summary,
            "ai_strengths":     strengths,
            "ai_weaknesses":    weaknesses,
            "ai_missing_skills": missing,
            "ai_recommendations": app.ai_recommendations,
            "ai_certifications":  app.ai_certifications or [],
            "ai_cert_verifications": getattr(app, "ai_cert_verifications", None) or [],

            "ai_projects":        app.ai_projects or [],
            "ai_breakdown":       breakdown,
            "coherence_floor_applied": coherence_floor_applied,
            "coherence_floor_bonus": coherence_bonus,
            "ai_coherence_flags": coh_flags,
            "ai_notes":           app.ai_notes or "",
            "score_rationale":    score_rationale,
            "detailed_justification": detailed_justification,
            "github_metrics":     github_metrics,
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
            <div style="font-family:Arial,Helvetica,sans-serif;background:#f4f6f8;padding:40px 0;">
                <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;
                            overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.08);">

                    <!-- HEADER -->
                    <div style="background:linear-gradient(135deg,#2563eb,#4f46e5);
                                padding:28px;text-align:center;">
                        <h1 style="color:#ffffff;margin:0;font-size:20px;letter-spacing:0.5px;">
                            Plateforme de Recrutement Intelligent
                        </h1>
                        <p style="color:#dbeafe;margin:8px 0 0;font-size:13px;">
                            Vérification sécurisée de votre compte
                        </p>
                    </div>

                    <!-- BODY -->
                    <div style="padding:32px 28px;text-align:center;">

                        <h2 style="margin:0 0 10px;color:#111827;font-size:18px;">
                            Code de vérification
                        </h2>

                        <p style="color:#6b7280;font-size:14px;margin-bottom:24px;">
                            Utilisez ce code pour activer votre compte candidat.
                        </p>

                        <!-- CODE BOX -->
                        <div style="font-size:34px;font-weight:700;letter-spacing:10px;
                                    color:#2563eb;background:#f3f4f6;
                                    display:inline-block;padding:16px 28px;
                                    border-radius:10px;border:1px dashed #c7d2fe;">
                            {code}
                        </div>

                        <!-- INFO -->
                        <div style="margin-top:28px;text-align:left;background:#f9fafb;
                                    padding:16px;border-radius:10px;border:1px solid #eef2f7;">

                            <p style="margin:0;font-size:13px;color:#374151;">
                                ⏱ <strong>Expiration :</strong> 10 minutes
                            </p>

                            <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">
                                🔒 Pour votre sécurité, ne partagez jamais ce code.
                            </p>

                            <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">
                                Si vous n’êtes pas à l’origine de cette demande, ignorez simplement cet email.
                            </p>
                        </div>

                    </div>

                    <!-- FOOTER -->
                    <div style="text-align:center;padding:18px;font-size:11px;
                                color:#9ca3af;border-top:1px solid #eef2f7;">
                        © 2026 Plateforme de Recrutement Intelligent — Tous droits réservés
                    </div>

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


class ApplicationDeleteView(APIView):
    permission_classes = [IsAuthenticated, IsRHOrAdmin]

    def delete(self, request, pk):
        try:
            app = Application.objects.get(pk=pk)
            delete_candidate_documents(str(app.id))  # RAG cleanup
            app.delete()
            return Response(status=204)
        except Application.DoesNotExist:
            return Response({"error": "Introuvable"}, status=404)


