from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.views import APIView
from django.db.models import Q
from .models import JobOffer, Application
from .serializers import (
    JobOfferSerializer,
    ApplicationSerializer,
    UserRegistrationSerializer,
    UserSerializer,
    UserUpdateSerializer,
)
import logging

logger = logging.getLogger(__name__)
from .permissions import IsRHUser, IsAdminUser, IsRHOrAdmin
from django.contrib.auth import get_user_model
User = get_user_model()

# recruitment/views.py
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from .models import RHAvailability, Interview, RHSettings, Application
from .serializers import RHAvailabilitySerializer, InterviewSerializer, RHSettingsSerializer
from .permissions import IsRHUser
from .models import RHAvailabilityException
from .serializers import RHAvailabilityExceptionSerializer

# ... vos views existantes ...

# ===================== AVAILABILITY MANAGEMENT =====================
class RHExceptionDestroyView(generics.DestroyAPIView):
    serializer_class = RHAvailabilityExceptionSerializer

    def get_queryset(self):
        # Sécurité : on ne peut supprimer que ses propres exceptions
        return RHAvailabilityException.objects.filter(rh_user=self.request.user)
class RHExceptionCreateView(generics.ListCreateAPIView):
    serializer_class = RHAvailabilityExceptionSerializer

    def get_queryset(self):
        # On ne récupère que les exceptions de l'utilisateur connecté
        return RHAvailabilityException.objects.filter(rh_user=self.request.user)

    def perform_create(self, serializer):
        # On lie l'exception à l'utilisateur connecté automatiquement
        serializer.save(rh_user=self.request.user)
class RHCalendarDataView(APIView):
    def get(self, request):
        user = request.user
        availabilities = RHAvailability.objects.filter(rh_user=user)
        exceptions = RHAvailabilityException.objects.filter(rh_user=user)

        return Response({
            "availabilities": RHAvailabilitySerializer(availabilities, many=True).data,
            "exceptions": RHAvailabilityExceptionSerializer(exceptions, many=True).data
        })

class ApplicationDetailView(generics.RetrieveAPIView):
        """
        GET: Récupérer les détails enrichis d'une seule candidature (pour la page RH)
        """
        queryset = Application.objects.select_related('job_offer').all()
        serializer_class = ApplicationSerializer
        permission_classes = [permissions.IsAuthenticated, IsRHOrAdmin]
        lookup_field = 'pk'
class RHAvailabilityListCreateView(generics.ListCreateAPIView):
    """Liste et création des disponibilités RH"""
    serializer_class = RHAvailabilitySerializer
    permission_classes = [IsAuthenticated, IsRHUser]

    def get_queryset(self):
        return RHAvailability.objects.filter(rh_user=self.request.user, is_active=True)

    def perform_create(self, serializer):
        serializer.save(rh_user=self.request.user)


class RHAvailabilityDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Détail, modification et suppression d'une disponibilité"""
    serializer_class = RHAvailabilitySerializer
    permission_classes = [IsAuthenticated, IsRHUser]

    def get_queryset(self):
        return RHAvailability.objects.filter(rh_user=self.request.user)

    def perform_destroy(self, instance):
        # Soft delete
        instance.is_active = False
        instance.save()


# ===================== INTERVIEW MANAGEMENT =====================

class InterviewListCreateView(generics.ListCreateAPIView):
    """Liste et création des entretiens"""
    serializer_class = InterviewSerializer
    permission_classes = [IsAuthenticated, IsRHUser]

    def get_queryset(self):
        queryset = Interview.objects.filter(rh_user=self.request.user)

        # Filtres optionnels
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        date_from = self.request.query_params.get('date_from', None)
        if date_from:
            queryset = queryset.filter(scheduled_date__gte=date_from)

        date_to = self.request.query_params.get('date_to', None)
        if date_to:
            queryset = queryset.filter(scheduled_date__lte=date_to)

        return queryset


class InterviewDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Détail, modification et suppression d'un entretien"""
    serializer_class = InterviewSerializer
    permission_classes = [IsAuthenticated, IsRHUser]

    def get_queryset(self):
        return Interview.objects.filter(rh_user=self.request.user)


class InterviewCancelView(APIView):
    """Annuler un entretien"""
    permission_classes = [IsAuthenticated, IsRHUser]

    def post(self, request, pk):
        interview = get_object_or_404(Interview, pk=pk, rh_user=request.user)
        interview.status = 'cancelled'
        interview.save()

        return Response({
            'message': 'Entretien annulé avec succès',
            'interview': InterviewSerializer(interview).data
        })


class InterviewConfirmView(APIView):
    """Confirmer un entretien"""
    permission_classes = [IsAuthenticated, IsRHUser]

    def post(self, request, pk):
        interview = get_object_or_404(Interview, pk=pk, rh_user=request.user)
        interview.status = 'confirmed'
        interview.save()

        return Response({
            'message': 'Entretien confirmé avec succès',
            'interview': InterviewSerializer(interview).data
        })


# ===================== RH SETTINGS =====================

class RHSettingsView(APIView):
    """Paramètres du RH"""
    permission_classes = [IsAuthenticated, IsRHUser]

    def get(self, request):
        settings, created = RHSettings.objects.get_or_create(rh_user=request.user)
        serializer = RHSettingsSerializer(settings)
        return Response(serializer.data)

    def put(self, request):
        settings, created = RHSettings.objects.get_or_create(rh_user=request.user)
        serializer = RHSettingsSerializer(settings, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ===================== AVAILABLE SLOTS =====================

class AvailableSlotsView(APIView):
    """Récupérer les créneaux disponibles pour une date donnée"""
    permission_classes = [IsAuthenticated, IsRHUser]

    def get(self, request):
        from datetime import datetime, timedelta

        date_str = request.query_params.get('date')
        if not date_str:
            return Response({'error': 'Date requise'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Format de date invalide (YYYY-MM-DD)'}, status=status.HTTP_400_BAD_REQUEST)

        day_of_week = target_date.weekday()

        # Récupérer les disponibilités pour ce jour
        availabilities = RHAvailability.objects.filter(
            rh_user=request.user,
            day_of_week=day_of_week,
            is_active=True
        )

        # Récupérer les entretiens déjà planifiés
        scheduled_interviews = Interview.objects.filter(
            rh_user=request.user,
            scheduled_date=target_date,
            status__in=['pending', 'confirmed']
        )

        # Paramètres RH
        settings, _ = RHSettings.objects.get_or_create(rh_user=request.user)

        available_slots = []

        for availability in availabilities:
            current_time = datetime.combine(target_date, availability.start_time)
            end_time = datetime.combine(target_date, availability.end_time)

            while current_time < end_time:
                slot_start = current_time.time()
                slot_end = (current_time + timedelta(minutes=settings.default_interview_duration)).time()

                # Vérifier pause déjeuner
                if settings.enable_lunch_break:
                    if not (slot_start >= settings.lunch_break_end or slot_end <= settings.lunch_break_start):
                        current_time += timedelta(minutes=30)
                        continue

                # Vérifier si le créneau est déjà occupé
                is_occupied = scheduled_interviews.filter(
                    scheduled_time__lt=slot_end,
                    scheduled_time__gte=slot_start
                ).exists()

                if not is_occupied:
                    available_slots.append({
                        'start_time': slot_start.strftime('%H:%M'),
                        'end_time': slot_end.strftime('%H:%M'),
                        'available': True
                    })

                current_time += timedelta(minutes=30)  # Slots de 30 minutes

        return Response({
            'date': date_str,
            'slots': available_slots
        })
class JobOfferListCreateView(generics.ListCreateAPIView):
    """
    GET: Liste publique de toutes les offres actives
    POST: Création d'offre (RH seulement)
    """
    queryset = JobOffer.objects.filter(is_active=True)
    serializer_class = JobOfferSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), IsRHUser()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class JobOfferDetailView(generics.RetrieveAPIView):
    """
    GET: Détail public d'une offre
    """
    queryset = JobOffer.objects.filter(is_active=True)
    serializer_class = JobOfferSerializer
    permission_classes = [permissions.AllowAny]


class ApplicationCreateView(generics.CreateAPIView):
    """
    POST: Soumettre une candidature (Public - Pas de JWT requis)
    Avec analyse IA automatique du CV
    """
    queryset = Application.objects.all()
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def create(self, request, *args, **kwargs):
        """
        Création de la candidature avec analyse IA automatique
        """
        # Étape 1: Validation des données
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Étape 2: Sauvegarde de la candidature
        self.perform_create(serializer)
        application = serializer.instance

        logger.info(f"Nouvelle candidature créée: #{application.id} - {application.full_name}")

        # Étape 3: Analyse IA automatique du CV
        ai_result = self._analyze_cv_with_ai(application)

        # Étape 4: Préparation de la réponse
        response_data = {
            'message': 'Votre candidature a été soumise avec succès',
            'data': serializer.data,
            'ai_analysis': ai_result
        }



        return Response(response_data, status=status.HTTP_201_CREATED)

    def _analyze_cv_with_ai(self, application):
        """
        Effectue l'analyse IA du CV du candidat

        Args:
            application: Instance de Application fraîchement créée

        Returns:
            dict: Résultat de l'analyse IA pour informer le candidat
        """
        try:
            # Initialisation du service d'analyse
            service = RecruitmentService()

            # Lancement de l'analyse complète
            result = service.process_new_application(
                application=application,
                auto_analyze=True
            )

            if result['success']:
                logger.info(
                    f"✅ Analyse IA réussie pour #{application.id} - "
                    f"Score: {result['analysis']['score']}/100 - "
                    f"Décision: {result['analysis']['decision']}"
                )

                # Retour d'information pour le candidat
                return {
                    'status': 'completed',
                    'score': result['analysis']['score'],
                    'message': 'Votre CV a été analysé automatiquement par notre système IA',
                    'next_steps': self._get_next_steps_message(result['analysis']['decision'])
                }
            else:
                logger.warning(
                    f"⚠️ Analyse IA échouée pour #{application.id}: {result['message']}"
                )

                return {
                    'status': 'pending',
                    'message': 'Votre candidature sera examinée manuellement par notre équipe',
                    'note': result['message']
                }

        except Exception as e:
            logger.error(f"❌ Erreur lors de l'analyse IA pour #{application.id}: {e}")

            return {
                'status': 'error',
                'message': 'Votre candidature a été enregistrée et sera examinée par notre équipe RH',
                'note': 'L\'analyse automatique est temporairement indisponible'
            }

    def _get_next_steps_message(self, ai_decision):
        """
        Retourne un message personnalisé selon la décision IA
        """
        if ai_decision == 'VALIDATED':
            return "Excellent profil ! Notre équipe RH prendra contact avec vous très prochainement."
        elif ai_decision == 'TO_REVIEW':
            return "Votre profil correspond partiellement. Nous examinerons votre candidature en détail."
        elif ai_decision == 'REJECTED':
            return "Nous vous remercions pour votre intérêt. Votre profil ne correspond pas exactement aux critères recherchés pour ce poste."
        else:
            return "Nous examinerons votre candidature et vous tiendrons informé."


class RHJobOfferListView(generics.ListCreateAPIView):
    """
    GET: Liste des offres créées par le RH connecté
    POST: Créer une nouvelle offre (RH connecté)
    """
    serializer_class = JobOfferSerializer
    permission_classes = [permissions.IsAuthenticated, IsRHUser]

    def get_queryset(self):
        return JobOffer.objects.filter(created_by=self.request.user)

    # Ajout de la logique de création automatique de l'auteur
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
class ApplicationListView(generics.ListAPIView):
    """
    GET: Liste des candidatures pour les offres du RH connecté
    """
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated, IsRHOrAdmin]

    def get_queryset(self):
        if self.request.user.is_staff or self.request.user.groups.filter(name='ADMIN').exists():
            # Admin voit toutes les candidatures
            return Application.objects.all()
        else:
            # RH voit seulement les candidatures pour ses offres
            return Application.objects.filter(job_offer__created_by=self.request.user)


class UserRegistrationView(generics.CreateAPIView):
    """
    POST: Créer un utilisateur Admin ou RH (Admin seulement)
    """
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]


# views.py - AJOUTEZ CES NOUVELLES VIEWS

from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta
from .models import User, JobOffer, Application  # Importez votre User personnalisé


class AdminStatsView(APIView):
    """
    GET: Statistiques pour le dashboard admin
    Accessible uniquement aux administrateurs
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        try:
            # Statistiques utilisateurs
            total_users = User.objects.count()
            total_rh = User.objects.filter(role='RH').count()
            total_admins = User.objects.filter(role='ADMIN').count()
            total_candidates = User.objects.filter(role='CANDIDATE').count()

            # Statistiques offres
            active_offers = JobOffer.objects.filter(
                is_active=True
            ).count()

            # Statistiques candidatures
            total_applications = Application.objects.count()

            # Statut du système
            system_status = 'OPERATIONAL'

            # Vérification DB
            try:
                User.objects.exists()
                db_status = 'healthy'
            except Exception:
                db_status = 'unhealthy'
                system_status = 'DEGRADED'

            stats = {
                'total_users': total_users,
                'total_rh': total_rh,
                'total_admins': total_admins,
                'total_candidates': total_candidates,
                'active_offers': active_offers,
                'total_applications': total_applications,
                'system_status': system_status,
                'db_status': db_status,
            }

            return Response(stats, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class AdminUserListView(generics.ListAPIView):
    """
    GET: Liste des utilisateurs ayant le groupe RH ou ADMIN
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    serializer_class = UserSerializer

    def get_queryset(self):
        # On filtre les utilisateurs qui appartiennent aux groupes 'RH' ou 'ADMIN'
        # On utilise distinct() pour éviter les doublons si un utilisateur est dans les deux
        return User.objects.filter(
            Q(groups__name__in=['RH', 'ADMIN']) | Q(is_staff=True)
        ).distinct().order_by('-date_joined')

class AdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET/PUT/PATCH/DELETE: Détail d'un utilisateur RH/ADMIN
    Accessible uniquement aux administrateurs
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    serializer_class = UserSerializer
    queryset = User.objects.filter(role__in=['RH', 'ADMIN'])


class AdminUserToggleActiveView(APIView):
    """
    POST: Activer/Désactiver un utilisateur
    Accessible uniquement aux administrateurs
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk, role__in=['RH', 'ADMIN'])
            user.is_active = not user.is_active
            user.save()

            return Response({
                'message': f"Utilisateur {'activé' if user.is_active else 'désactivé'} avec succès",
                'is_active': user.is_active
            })
        except User.DoesNotExist:
            return Response(
                {'error': 'Utilisateur non trouvé'},
                status=status.HTTP_404_NOT_FOUND
            )

