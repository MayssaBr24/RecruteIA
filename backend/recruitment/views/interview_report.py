"""
==============
Vue Django REST Framework pour le rapport RH complet.

Endpoint : GET /api/recruitment/ai-interview/<token>/report/

Permissions : IsAuthenticated + IsRHOrAdmin
              + appartenance du poste au RH connecté
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.shortcuts import get_object_or_404

from ..models import AIInterview
from ..permissions import IsRHOrAdmin
from services.profile_warnings import detect_profile_inconsistencies
from services.report_pdf import build_report_data
from django.http import JsonResponse

class DebugRouteView(APIView):
    def get(self, request, token):
        return JsonResponse({"status": "ok", "token": str(token)})


class AIInterviewReportView(APIView):
    """
    GET /api/recruitment/ai-interview/<token>/report/

    Retourne le rapport RH complet de l'entretien.
    Disponible uniquement pour les entretiens completed ou fraud_terminated.
    """
    permission_classes = [permissions.IsAuthenticated, IsRHOrAdmin]

    def get(self, request, token):
        try:
            interview = AIInterview.objects.select_related(
                "application__job_offer"
            ).prefetch_related("warnings").get(token=token)
        except AIInterview.DoesNotExist:
            return Response(
                {"error": "Entretien introuvable"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Vérification ownership
        if interview.application.job_offer.created_by != request.user:
            return Response(
                {"error": "Accès non autorisé"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Entretien doit être terminé (ou fraud_terminated)
        if interview.status not in ("completed", "fraud_terminated"):
            return Response(
                {
                    "error": "Rapport disponible uniquement pour les entretiens terminés",
                    "current_status": interview.status,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Détection des incohérences de profil (non pénalisantes)
        try:
            profile_inconsistencies = detect_profile_inconsistencies(interview.application)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"[Report] Erreur détection incohérences: {e}")
            profile_inconsistencies = []

        # Construction du rapport
        report_data = build_report_data(interview, profile_inconsistencies)

        # Ajout URL vidéo si disponible
        if interview.video_recording:
            report_data["video_url"] = request.build_absolute_uri(
                interview.video_recording.url
            )

        return Response(report_data)


