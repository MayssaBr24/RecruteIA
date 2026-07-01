from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Q, Count
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth import get_user_model
User = get_user_model()
from recruitment.models import (
    JobOffer, Application, Interview,
    SystemSettings, AuditLog, SupportTicket, ActivityLog
)
from ..serializers import (
    UserRegistrationSerializer, AdminUserDetailSerializer,
    SystemSettingsSerializer, AuditLogSerializer, SupportTicketSerializer,
    ActivityLogSerializer, AdminOfferSerializer, AdminApplicationSerializer
)
from ..permissions import IsAdminUser

# ==================== DASHBOARD & STATS ====================
class AdminDashboardStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        user = request.user
        is_super = user.role == 'SUPERADMIN'
        company = user.company

        try:
            # Filtrer par company sauf SUPERADMIN
            users_qs = User.objects.all() if is_super else User.objects.filter(company=company)
            offers_qs = JobOffer.objects.all() if is_super else JobOffer.objects.filter(company=company)
            apps_qs = Application.objects.all() if is_super else Application.objects.filter(job_offer__company=company)
            interviews_qs = Interview.objects.all() if is_super else Interview.objects.filter(rh_user__company=company)

            total_applications = apps_qs.count()
            total_interviews = interviews_qs.count()

            stats = {
                'users': {
                    'total': users_qs.count(),
                    'rh': users_qs.filter(role='RH').count(),
                    'admins': users_qs.filter(role='ADMIN').count(),
                    'active': users_qs.filter(is_active=True).count(),
                },
                'offers': {
                    'total': offers_qs.count(),
                    'active': offers_qs.filter(is_active=True).count(),
                    'this_month': offers_qs.filter(
                        created_at__gte=timezone.now() - timedelta(days=30)
                    ).count(),
                },
                'applications': {
                    'total': total_applications,
                    'pending': apps_qs.filter(status='pending').count(),
                    'this_month': apps_qs.filter(
                        created_at__gte=timezone.now() - timedelta(days=30)
                    ).count(),
                },
                'interviews': {
                    'total': total_interviews,
                    'upcoming': interviews_qs.filter(
                        scheduled_date__gte=timezone.now().date(),
                        status__in=['pending', 'confirmed']
                    ).count(),
                },
                'conversion_rate': round((total_interviews / total_applications) * 100, 2) if total_applications > 0 else 0,
                'system_status': 'operational',
            }
            return Response(stats)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
class AdminDashboardChartsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        user = request.user
        is_super = user.role == 'SUPERADMIN'
        company = user.company

        try:
            apps_qs = Application.objects.all() if is_super else Application.objects.filter(job_offer__company=company)
            offers_qs = JobOffer.objects.all() if is_super else JobOffer.objects.filter(company=company)
            interviews_qs = Interview.objects.all() if is_super else Interview.objects.filter(rh_user__company=company)

            applications_trend = []
            for i in range(6, 0, -1):
                month_start = timezone.now() - timedelta(days=30 * i)
                month_end = timezone.now() - timedelta(days=30 * (i - 1))
                count = apps_qs.filter(created_at__gte=month_start, created_at__lt=month_end).count()
                applications_trend.append({'month': month_start.strftime('%b %Y'), 'count': count})

            return Response({
                'applications_trend': applications_trend,
                'offers_by_rh': list(offers_qs.values('created_by__username').annotate(count=Count('id')).order_by('-count')[:5]),
                'applications_by_status': list(apps_qs.values('status').annotate(count=Count('id'))),
                'interviews_by_status': list(interviews_qs.values('status').annotate(count=Count('id'))),
            })
        except Exception as e:
            return Response({'error': str(e)}, status=500)

class AdminRecentActivityView(APIView):
    """Activités récentes sur la plateforme"""
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        try:
            limit = int(request.query_params.get('limit', 20))
            user = request.user

            if user.role == 'SUPERADMIN':
                # Vrai superadmin plateforme - voit tout
                activities = ActivityLog.objects.select_related('user').filter(
                    user__role__in=['ADMIN', 'RH']
                )

            elif user.role == 'ADMIN':
                company = getattr(user, 'company', None)
                if not company:
                    return Response({'error': 'Admin sans entreprise assignée'}, status=400)

                activities = ActivityLog.objects.select_related('user').filter(
                    user__company=company,
                    user__role='RH'
                )

            else:
                activities = ActivityLog.objects.none()
            activities = activities.order_by('-created_at')[:limit]

            # Création d'activité si aucune n'existe
            if not activities.exists() and user.role in ['ADMIN', 'RH']:
                ActivityLog.objects.create(
                    user=user,
                    activity_type='dashboard_view',
                    description=f"{user.get_full_name() or user.username} a consulté le tableau de bord",
                    ip_address=request.META.get('REMOTE_ADDR')
                )
                # Recharger
                activities = ActivityLog.objects.filter(user=user).order_by('-created_at')[:limit]

            serializer = ActivityLogSerializer(activities, many=True)
            return Response({
                'activities': serializer.data,
                'total': activities.count(),
                'role': user.role,
                'company_id': user.company_id,  # ← vérifie que c'est pas None
                'is_superuser': user.is_superuser,
                'debug_query': str(activities.query)  # ← voir le SQL exact
            })

        except Exception as e:
            return Response({'error': str(e)}, status=500)
class AdminUserListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    serializer_class = AdminUserDetailSerializer

    def get_queryset(self):
        user = self.request.user
        is_super = user.role == 'SUPERADMIN'

        # SUPERADMIN voit tout, ADMIN voit uniquement sa company
        queryset = User.objects.all() if is_super else User.objects.filter(
            company=user.company,
            role='RH'  # ADMIN voit uniquement ses RH
        ).order_by('-date_joined')

        role = self.request.query_params.get('role')
        is_active = self.request.query_params.get('is_active')
        search = self.request.query_params.get('search')

        if role:
            queryset = queryset.filter(role=role.upper())
        if is_active is not None:
            queryset = queryset.filter(is_active=(is_active.lower() == 'true'))
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) | Q(email__icontains=search)
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
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    serializer_class = UserRegistrationSerializer

    def perform_create(self, serializer):
        # Nouveau RH appartient à la même company que l'ADMIN
        serializer.save(
            company=self.request.user.company,
            role='RH'
        )
# ==================== OFFERS SUPERVISION ====================
class AdminOffersListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    serializer_class = AdminOfferSerializer

    def get_queryset(self):
        user = self.request.user
        is_super = user.role == 'SUPERADMIN'

        queryset = JobOffer.objects.all() if is_super else JobOffer.objects.filter(
            company=user.company
        ).order_by('-created_at')

        rh_id = self.request.query_params.get('rh_id')
        is_active = self.request.query_params.get('is_active')
        search = self.request.query_params.get('search')

        if rh_id:
            queryset = queryset.filter(created_by_id=rh_id)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(description__icontains=search)
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
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    serializer_class = AdminApplicationSerializer

    def get_queryset(self):
        user = self.request.user
        is_super = user.role == 'SUPERADMIN'

        queryset = Application.objects.all() if is_super else Application.objects.filter(
            job_offer__company=user.company
        ).order_by('-created_at')

        status_filter = self.request.query_params.get('status')
        rh_id = self.request.query_params.get('rh_id')
        offer_id = self.request.query_params.get('offer_id')

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
