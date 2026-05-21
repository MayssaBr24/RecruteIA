from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils.text import slugify

from ..models import Company, User, JobOffer, Application
from ..serializers import (
    CompanySerializer,
    CompanyRegistrationSerializer,
    UserSerializer
)
from ..permissions import IsSuperAdmin, IsAdminRH, CompanyObjectPermission


class CompanyRegistrationView(APIView):
    """
    POST: Inscription d'une nouvelle entreprise
    Crée la company + le premier ADMIN_RH + retourne le token JWT
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = CompanyRegistrationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.save()
        company = result['company']
        user = result['user']

        # Générer JWT directement pour auto-login
        refresh = RefreshToken.for_user(user)

        return Response({
            'message': f'Entreprise "{company.name}" créée avec succès',
            'company': {
                'id': company.id,
                'name': company.name,
                'slug': company.slug,
                'plan': company.plan,
            },
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': user.role,
            },
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            }
        }, status=201)


class CompanyDetailView(generics.RetrieveUpdateAPIView):
    """GET/PUT: Détail et modification de sa propre company"""
    serializer_class = CompanySerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRH]

    def get_object(self):
        user = self.request.user
        # SUPERADMIN peut voir n'importe quelle company via pk
        if user.role == 'SUPERADMIN':
            return Company.objects.get(pk=self.kwargs.get('pk'))
        # ADMIN voit uniquement sa company
        return user.company


class CompanyRHListView(generics.ListCreateAPIView):
    """
    GET: Liste des RH de la company
    POST: Ajouter un RH à la company
    """
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRH]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'SUPERADMIN':
            company_id = self.kwargs.get('pk')
            return User.objects.filter(
                company_id=company_id,
                role__in=['RH', 'ADMIN']
            )
        return User.objects.filter(
            company=user.company,
            role__in=['RH', 'ADMIN']
        )

    def perform_create(self, serializer):
        """Créer un nouveau RH dans la company"""
        serializer.save(
            company=self.request.user.company,
            role='RH'
        )


class CompanyStatsView(APIView):
    """GET: Stats globales de la company pour le dashboard"""
    permission_classes = [permissions.IsAuthenticated, IsAdminRH]

    def get(self, request):
        company = request.user.company
        if not company:
            return Response({'error': 'Aucune entreprise associée'}, status=400)

        offers = JobOffer.objects.filter(company=company)
        applications = Application.objects.filter(job_offer__company=company)

        return Response({
            'company': company.name,
            'plan': company.plan,
            'total_rh': company.users.filter(role__in=['RH', 'ADMIN']).count(),
            'max_rh_users': company.max_rh_users,
            'total_offers': offers.count(),
            'active_offers': offers.filter(is_active=True).count(),
            'max_active_offers': company.max_active_offers,
            'total_applications': applications.count(),
            'hired': applications.filter(status='hired').count(),
            'pending': applications.filter(status='pending').count(),
        })


class SuperAdminCompanyListView(generics.ListAPIView):
    serializer_class = CompanySerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def get_queryset(self):
        return Company.objects.all().order_by('-created_at')


class SuperAdminCompanyToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def post(self, request, pk):
        try:
            company = Company.objects.get(pk=pk)
            company.is_active = not company.is_active
            company.save()
            return Response({'is_active': company.is_active})
        except Company.DoesNotExist:
            return Response({'error': 'Company non trouvée'}, status=404)


class SuperAdminCompanyResetPasswordView(APIView):
    """Reset password de l'ADMIN_RH d'une company"""
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def post(self, request, pk):
        try:
            company = Company.objects.get(pk=pk)
            admin = User.objects.filter(
                company=company,
                role='ADMIN_RH'
            ).first()
            if not admin:
                return Response({'error': 'Aucun admin trouvé'}, status=404)

            new_password = request.data.get('new_password')
            if not new_password or len(new_password) < 8:
                return Response({'error': 'Mot de passe trop court (8 min)'}, status=400)

            admin.set_password(new_password)
            admin.save()
            return Response({'message': f'Mot de passe de {admin.username} réinitialisé'})
        except Company.DoesNotExist:
            return Response({'error': 'Company non trouvée'}, status=404)