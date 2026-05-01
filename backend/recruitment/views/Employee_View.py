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
    """GET: Tous les employés recrutés"""
    serializer_class = ApplicationSerializer
    permission_classes = [IsAuthenticated, IsRHOrAdmin]

    def get_queryset(self):
        return Application.objects.filter(
            status='hired'
        ).select_related('job_offer').order_by('-hired_at')


class EmployeeDocumentView(APIView):
    """PATCH: Upload documents d'un employé"""
    permission_classes = [IsAuthenticated, IsRHOrAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def patch(self, request, pk):
        try:
            app = Application.objects.get(pk=pk, status='hired')
        except Application.DoesNotExist:
            return Response({'error': 'Employé introuvable'}, status=404)

        for field in ['contract_file', 'cin_file', 'rib_file', 'photo_file',
                      'diplomas_file', 'criminal_record_file', 'medical_file']:
            if field in request.FILES:
                setattr(app, field, request.FILES[field])
        app.save()
        return Response(ApplicationSerializer(app).data)


class EmployeeUpdateView(generics.UpdateAPIView):
    """PATCH: Mettre à jour infos RH d'un employé"""
    queryset = Application.objects.filter(status='hired')
    serializer_class = ApplicationSerializer
    permission_classes = [IsAuthenticated, IsRHOrAdmin]
    http_method_names = ['patch']


class AddManualEmployeeView(APIView):
    """POST: Ajouter un employé manuellement"""
    permission_classes = [IsAuthenticated, IsRHOrAdmin]

    def post(self, request):
        from django.utils import timezone
        app = Application.objects.create(
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