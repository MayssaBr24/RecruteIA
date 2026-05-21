from rest_framework import generics
from ..models import Application
from rest_framework import generics
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from ..serializers import ApplicationSerializer
from ..permissions import IsRHOrAdmin

class EmployeeListView(generics.ListAPIView):
    serializer_class = ApplicationSerializer
    permission_classes = [IsAuthenticated, IsRHOrAdmin]

    def get_queryset(self):
        user = self.request.user
        qs = Application.objects.filter(status='hired').select_related('job_offer').order_by('-hired_at')

        # SUPERADMIN n'a pas accès
        if user.role == 'SUPERADMIN':
            return qs.none()

        # RH et ADMIN — uniquement leur company
        if user.company:
            return qs.filter(job_offer__company=user.company)
        return qs.none()


class EmployeeDocumentView(APIView):
    permission_classes = [IsAuthenticated, IsRHOrAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def patch(self, request, pk):
        user = request.user

        if user.role == 'SUPERADMIN':
            return Response({'error': 'Accès refusé'}, status=403)

        try:
            qs = Application.objects.filter(status='hired')
            if user.company:
                qs = qs.filter(job_offer__company=user.company)
            app = qs.get(pk=pk)
        except Application.DoesNotExist:
            return Response({'error': 'Employé introuvable'}, status=404)

        for field in ['contract_file', 'cin_file', 'rib_file', 'photo_file',
                      'diplomas_file', 'criminal_record_file', 'medical_file']:
            if field in request.FILES:
                setattr(app, field, request.FILES[field])
        app.save()
        return Response(ApplicationSerializer(app).data)

class EmployeeUpdateView(generics.UpdateAPIView):
    serializer_class = ApplicationSerializer
    permission_classes = [IsAuthenticated, IsRHOrAdmin]
    http_method_names = ['patch']

    def get_queryset(self):
        user = self.request.user
        qs = Application.objects.filter(status='hired')

        if user.role == 'SUPERADMIN':
            return qs.none()

        if user.company:
            return qs.filter(job_offer__company=user.company)
        return qs.none()


class AddManualEmployeeView(APIView):
    permission_classes = [IsAuthenticated, IsRHOrAdmin]

    def post(self, request):
        from django.utils import timezone

        # Trouver une offre de la company pour lier l'employé
        user = request.user
        job_offer = None
        if user.company:
            job_offer = JobOffer.objects.filter(company=user.company).first()

        if not job_offer:
            return Response({'error': 'Aucune offre trouvée pour cette entreprise'}, status=400)

        app = Application.objects.create(
            job_offer=job_offer,  # ← AJOUT — lien obligatoire pour l'isolation
            full_name=request.data.get('full_name'),
            email=request.data.get('email'),
            phone=request.data.get('phone', ''),
            nationality=request.data.get('nationality', ''),
            current_location=request.data.get('current_location', ''),
            salary_expectation=request.data.get('salary_expectation'),
            position_title=request.data.get('position_title', ''),
            department=request.data.get('department', ''),
            employee_id=request.data.get('employee_id', ''),
            start_date=request.data.get('start_date') or None,
            status='hired',
            hired_at=timezone.now().date(),
            ai_decision='VALIDATED',
        )
        return Response(ApplicationSerializer(app).data, status=201)