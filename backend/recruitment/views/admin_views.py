from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Q, Count, Avg
from django.utils import timezone
from datetime import timedelta, datetime
from django.contrib.auth import get_user_model
User = get_user_model()
from recruitment.models import (
    JobOffer, Application, Interview,
    SystemSettings, AuditLog, SupportTicket, ActivityLog
)
from ..serializers import (
    UserRegistrationSerializer, UserSerializer, AdminUserDetailSerializer,
    SystemSettingsSerializer, AuditLogSerializer, SupportTicketSerializer,
    ActivityLogSerializer, AdminOfferSerializer, AdminApplicationSerializer
)
from ..permissions import IsAdminUser


# ==================== DASHBOARD & STATS ====================

class AdminDashboardStatsView(APIView):
    """KPIs principaux du dashboard admin"""
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        try:
            # Users stats
            total_users = User.objects.count()
            total_rh = User.objects.filter(role='RH').count()
            total_admins = User.objects.filter(Q(is_staff=True) | Q(role='ADMIN')).distinct().count()
            active_users = User.objects.filter(is_active=True).count()

            # Offers stats
            total_offers = JobOffer.objects.count()
            active_offers = JobOffer.objects.filter(is_active=True).count()
            offers_this_month = JobOffer.objects.filter(
                created_at__gte=timezone.now() - timedelta(days=30)
            ).count()

            # Applications stats
            total_applications = Application.objects.count()
            pending_applications = Application.objects.filter(status='pending').count()
            applications_this_month = Application.objects.filter(
                created_at__gte=timezone.now() - timedelta(days=30)
            ).count()

            # Interviews stats
            total_interviews = Interview.objects.count()
            upcoming_interviews = Interview.objects.filter(
                scheduled_date__gte=timezone.now().date(),
                status__in=['pending', 'confirmed']
            ).count()

            # Conversion rates
            conversion_rate = 0
            if total_applications > 0:
                conversion_rate = round((total_interviews / total_applications) * 100, 2)

            stats = {
                'users': {
                    'total': total_users,
                    'rh': total_rh,
                    'admins': total_admins,
                    'active': active_users,
                },
                'offers': {
                    'total': total_offers,
                    'active': active_offers,
                    'this_month': offers_this_month,
                },
                'applications': {
                    'total': total_applications,
                    'pending': pending_applications,
                    'this_month': applications_this_month,
                },
                'interviews': {
                    'total': total_interviews,
                    'upcoming': upcoming_interviews,
                },
                'conversion_rate': conversion_rate,
                'system_status': 'operational',
            }

            return Response(stats)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class AdminDashboardChartsView(APIView):
    """Données pour les graphiques du dashboard"""
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        try:
            # Applications trend (6 derniers mois)
            applications_trend = []
            for i in range(6, 0, -1):
                month_start = timezone.now() - timedelta(days=30 * i)
                month_end = timezone.now() - timedelta(days=30 * (i - 1))
                count = Application.objects.filter(
                    created_at__gte=month_start,
                    created_at__lt=month_end
                ).count()
                applications_trend.append({
                    'month': month_start.strftime('%b %Y'),
                    'count': count
                })

            # Offers by RH
            offers_by_rh = list(
                JobOffer.objects.values('created_by__username')
                .annotate(count=Count('id'))
                .order_by('-count')[:5]
            )

            # Applications by status
            applications_by_status = list(
                Application.objects.values('status')
                .annotate(count=Count('id'))
            )

            # Interviews by status
            interviews_by_status = list(
                Interview.objects.values('status')
                .annotate(count=Count('id'))
            )

            data = {
                'applications_trend': applications_trend,
                'offers_by_rh': offers_by_rh,
                'applications_by_status': applications_by_status,
                'interviews_by_status': interviews_by_status,
            }

            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


# recruitment/admin_views.py - CORRECTION

class AdminRecentActivityView(APIView):
    """Activités récentes sur la plateforme"""
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        try:
            limit = int(request.query_params.get('limit', 20))

            # Si pas d'activities, créer des exemples
            activities = ActivityLog.objects.select_related('user').all()[:limit]

            if not activities.exists():
                # Créer une activité exemple si vide
                ActivityLog.objects.create(
                    user=request.user,
                    activity_type='login',
                    description=f'{request.user.username} s\'est connecté au dashboard admin',
                    ip_address=request.META.get('REMOTE_ADDR')
                )
                activities = ActivityLog.objects.select_related('user').all()[:limit]

            serializer = ActivityLogSerializer(activities, many=True)
            return Response(serializer.data)

        except Exception as e:
            return Response({'error': str(e)}, status=500)

# ==================== USERS MANAGEMENT ====================

class AdminUserListView(generics.ListAPIView):
    """Liste des utilisateurs avec filtres avancés"""
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    serializer_class = AdminUserDetailSerializer

    def get_queryset(self):
        queryset = User.objects.all().order_by('-date_joined')

        # Filtres
        role = self.request.query_params.get('role', None)
        is_active = self.request.query_params.get('is_active', None)
        search = self.request.query_params.get('search', None)

        if role:
            if role.upper() == 'ADMIN':
                queryset = queryset.filter(Q(is_staff=True) | Q(role='ADMIN'))
            else:
                queryset = queryset.filter(role=role.upper())
        if is_active is not None:
            queryset = queryset.filter(is_active=(is_active.lower() == 'true'))
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) |
                Q(email__icontains=search)
            )

        return queryset


class AdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Détail d'un utilisateur"""
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    serializer_class = AdminUserDetailSerializer

    def get_queryset(self):
        return User.objects.all()

class AdminUserToggleActiveView(APIView):
    """Activer/Désactiver un utilisateur"""
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
            user.is_active = not user.is_active
            user.save()

            # Log audit
            AuditLog.objects.create(
                user=request.user,
                action='update',
                model_name='User',
                object_id=user.id,
                description=f"{'Activé' if user.is_active else 'Désactivé'} l'utilisateur {user.username}",
                ip_address=request.META.get('REMOTE_ADDR')
            )

            return Response({
                'message': f"Utilisateur {'activé' if user.is_active else 'désactivé'}",
                'is_active': user.is_active
            })
        except User.DoesNotExist:
            return Response({'error': 'Utilisateur non trouvé'}, status=404)


class AdminUserCreateView(generics.CreateAPIView):
    """Créer un nouvel utilisateur"""
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    serializer_class = UserRegistrationSerializer


# ==================== OFFERS SUPERVISION ====================

class AdminOffersListView(generics.ListAPIView):
    """Liste toutes les offres (tous RH)"""
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    serializer_class = AdminOfferSerializer

    def get_queryset(self):
        queryset = JobOffer.objects.all().order_by('-created_at')

        # Filtres
        rh_id = self.request.query_params.get('rh_id', None)
        is_active = self.request.query_params.get('is_active', None)
        search = self.request.query_params.get('search', None)

        if rh_id:
            queryset = queryset.filter(created_by_id=rh_id)

        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(description__icontains=search)
            )

        return queryset


class AdminOfferArchiveView(APIView):
    """Archiver une offre"""
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def post(self, request, pk):
        try:
            offer = JobOffer.objects.get(pk=pk)
            offer.is_active = False
            offer.save()

            # Log audit
            AuditLog.objects.create(
                user=request.user,
                action='update',
                model_name='JobOffer',
                object_id=offer.id,
                description=f"Archivé l'offre: {offer.title}",
                ip_address=request.META.get('REMOTE_ADDR')
            )

            return Response({'message': 'Offre archivée avec succès'})
        except JobOffer.DoesNotExist:
            return Response({'error': 'Offre non trouvée'}, status=404)


# ==================== APPLICATIONS SUPERVISION ====================

class AdminApplicationsListView(generics.ListAPIView):
    """Liste toutes les candidatures"""
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    serializer_class = AdminApplicationSerializer

    def get_queryset(self):
        queryset = Application.objects.all().order_by('-created_at')

        # Filtres
        status_filter = self.request.query_params.get('status', None)
        rh_id = self.request.query_params.get('rh_id', None)
        offer_id = self.request.query_params.get('offer_id', None)

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        if rh_id:
            queryset = queryset.filter(job_offer__created_by_id=rh_id)

        if offer_id:
            queryset = queryset.filter(job_offer_id=offer_id)

        return queryset


# ==================== SYSTEM SETTINGS ====================

class AdminSystemSettingsView(APIView):
    """Paramètres système"""
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        settings, created = SystemSettings.objects.get_or_create(id=1)
        serializer = SystemSettingsSerializer(settings)
        return Response(serializer.data)

    def put(self, request):
        settings, created = SystemSettings.objects.get_or_create(id=1)
        serializer = SystemSettingsSerializer(settings, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()

            # Log audit
            AuditLog.objects.create(
                user=request.user,
                action='update',
                model_name='SystemSettings',
                object_id=settings.id,
                description="Mise à jour des paramètres système",
                ip_address=request.META.get('REMOTE_ADDR')
            )

            return Response(serializer.data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ==================== AUDIT LOGS ====================

class AdminAuditLogsView(generics.ListAPIView):
    """Logs d'audit"""
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    serializer_class = AuditLogSerializer

    def get_queryset(self):
        queryset = AuditLog.objects.all()

        # Filtres
        user_id = self.request.query_params.get('user_id', None)
        action = self.request.query_params.get('action', None)
        model_name = self.request.query_params.get('model_name', None)

        if user_id:
            queryset = queryset.filter(user_id=user_id)

        if action:
            queryset = queryset.filter(action=action)

        if model_name:
            queryset = queryset.filter(model_name=model_name)

        return queryset[:100]  # Limiter à 100 derniers logs


# ==================== SUPPORT TICKETS ====================

class AdminSupportTicketsView(generics.ListCreateAPIView):
    """Liste et création de tickets support"""
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    serializer_class = SupportTicketSerializer

    def get_queryset(self):
        queryset = SupportTicket.objects.all()

        # Filtres
        status_filter = self.request.query_params.get('status', None)
        priority = self.request.query_params.get('priority', None)

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        if priority:
            queryset = queryset.filter(priority=priority)

        return queryset


class AdminSupportTicketDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Détail d'un ticket support"""
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    serializer_class = SupportTicketSerializer
    queryset = SupportTicket.objects.all()
