# =====================================================================
# IMPORTS - Réorganisés et nettoyés
# =====================================================================
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from datetime import datetime, timedelta

User = get_user_model()

# Imports des modèles - regroupés par catégorie
from .models import (
    # RH & Disponibilités
    Interview, RHSettings, RHAvailability, RHAvailabilityException,
    # Candidatures
    Application, JobOffer,
    # IA Interviews
    AIInterview, InterviewWarning, InterviewInvitation,
    # Système & Logs
    SystemSettings, AuditLog, SupportTicket, ActivityLog,Company
)


# =====================================================================
# SERIALIZERS DISPONIBILITÉS
# =====================================================================

class RHAvailabilityExceptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RHAvailabilityException
        fields = ['id', 'date']


class RHAvailabilitySerializer(serializers.ModelSerializer):
    day_name = serializers.SerializerMethodField()

    class Meta:
        model = RHAvailability
        fields = [
            'id', 'rh_user', 'day_of_week', 'specific_date',
            'start_time', 'end_time', 'is_active', 'day_name'
        ]
        read_only_fields = ['id', 'rh_user']

    def get_day_name(self, obj):
        return "Test"

    def validate(self, data):
        if data['start_time'] >= data['end_time']:
            raise serializers.ValidationError(
                "L'heure de début doit être avant l'heure de fin"
            )
        return data


# =====================================================================
# SERIALIZERS INTERVIEWS RH
# =====================================================================

class InterviewSerializer(serializers.ModelSerializer):
    candidate_name = serializers.CharField(
        source='application.full_name', read_only=True
    )
    candidate_email = serializers.CharField(
        source='application.email', read_only=True
    )
    candidate_phone = serializers.CharField(
        source='application.phone', read_only=True
    )
    job_title = serializers.CharField(
        source='application.job_offer.title', read_only=True
    )
    application_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = Interview
        fields = [
            'id', 'application_id', 'candidate_name', 'candidate_email',
            'candidate_phone', 'job_title', 'scheduled_date', 'scheduled_time',
            'duration_minutes', 'meeting_link', 'status', 'notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        application_id = validated_data.pop('application_id')
        validated_data['application_id'] = application_id
        validated_data['rh_user'] = self.context['request'].user
        return super().create(validated_data)


class RHSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = RHSettings
        fields = [
            'lunch_break_start', 'lunch_break_end',
            'enable_lunch_break', 'default_interview_duration'
        ]
        read_only_fields = ['id']


# =====================================================================
# AUTHENTIFICATION JWT
# =====================================================================

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)

        # ✅ Lire directement le rôle depuis la base
        role = getattr(self.user, 'role', 'CANDIDATE')

        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'role': role,
        }
        return data

class CustomTokenObtainPairView(TokenObtainPairView):
    """Vue personnalisée pour le login"""
    serializer_class = CustomTokenObtainPairSerializer


# =====================================================================
# SERIALIZERS IA INTERVIEWS
# =====================================================================

class AIInterviewSerializer(serializers.ModelSerializer):
    candidate_name = serializers.CharField(
        source='application.full_name', read_only=True
    )
    job_title = serializers.CharField(
        source='application.job_offer.title', read_only=True
    )
    warnings_count = serializers.SerializerMethodField()
    final_recommendation = serializers.SerializerMethodField()
    ai_recommendation = serializers.SerializerMethodField()

    class Meta:
        model = AIInterview
        fields = [
            'id', 'token', 'status', 'current_phase',
            'candidate_name', 'job_title',
            'created_at', 'started_at', 'completed_at', 'expires_at',
            # Scores par phase
            'communication_score', 'clarification_score', 'scenario_score',
            'qcm_score', 'coding_score', 'ai_interview_score',
            # Feedback & recommandation
            'ai_interview_feedback', 'ai_recommendation', 'final_recommendation',
            # Annotations RH
            'rh_annotation', 'rh_rating', 'override_recommendation', 'rh_annotated_at',
            # Méta
            'duration_minutes', 'warnings_count',
        ]
        read_only_fields = ['token', 'expires_at', 'created_at']

    def get_warnings_count(self, obj):
        return obj.warnings.count()

    def get_ai_recommendation(self, obj):
        if not obj.ai_interview_feedback:
            return 'PENDING'
        for tag in ['VALIDATED', 'TO_REVIEW', 'REJECTED']:
            if f'[{tag}]' in obj.ai_interview_feedback:
                return tag
        return 'PENDING'

    def get_final_recommendation(self, obj):
        if obj.override_recommendation:
            return obj.override_recommendation
        return self.get_ai_recommendation(obj)


class InterviewWarningSerializer(serializers.ModelSerializer):
    class Meta:
        model = InterviewWarning
        fields = ['id', 'warning_type', 'timestamp', 'details']


# =====================================================================
# SERIALIZERS OFFRES D'EMPLOI
# =====================================================================

class JobOfferSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(
        source='created_by.get_full_name', read_only=True
    )
    applications_count = serializers.IntegerField(
        source='applications.count', read_only=True
    )
    company_name = serializers.CharField(      # ← AJOUTER
        source='company.name', read_only=True
    )

    class Meta:
        model = JobOffer
        fields = [
            'id', 'title', 'description', 'requirements',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'is_active', 'applications_count', 'location', 'contract_type',
            'weight_cv', 'weight_motivation', 'weight_softskills', 'weight_github',
            'offer_deadline', 'agents_needed',
            'experience_years', 'education_level', 'soft_skills','company_name',
            'salary_min', 'salary_max', 'salary_currency'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']

        def validate(self, data):
            # Validation du salaire
            salary_min = data.get('salary_min')
            salary_max = data.get('salary_max')

            if salary_min is not None and salary_max is not None:
                if salary_min > salary_max:
                    raise serializers.ValidationError({
                        'salary_min': 'Le salaire minimum ne peut pas être supérieur au salaire maximum'
                    })


# =====================================================================
# SERIALIZERS CANDIDATURES
# =====================================================================

class ApplicationSerializer(serializers.ModelSerializer):
    job_offer_title = serializers.CharField(
        source='job_offer.title', read_only=True
    )
    ai_score = serializers.IntegerField(read_only=True)
    ai_summary = serializers.CharField(read_only=True, allow_blank=True)
    ai_decision = serializers.CharField(read_only=True, allow_blank=True)
    github_data = serializers.JSONField(default=dict, required=False)

    class Meta:
        model = Application
        fields = [
            'id', 'job_offer', 'job_offer_title',
            'full_name', 'email', 'phone',
            'cv_file', 'cover_letter_file',
            'created_at', 'status',  # ← created_at (pas applied_date)
            'nationality', 'university', 'degree_level', 'graduation_year',
            'experience_years', 'linkedin_url', 'github_url',
            'current_location', 'availability_date',  # ← salary_expectation supprimé
            'ai_score', 'ai_summary', 'ai_decision',
            'ai_missing_skills', 'ai_strengths', 'ai_weaknesses',
            'ai_recommendations', 'ai_certifications', 'ai_projects',
            'extra_profile_details', 'github_data',
        ]
        read_only_fields = [
            'id', 'created_at', 'status',
            'ai_score', 'ai_summary', 'ai_decision',
            'ai_missing_skills', 'ai_strengths', 'ai_weaknesses',
            'ai_recommendations', 'ai_certifications', 'ai_projects',
            'job_offer_title',
        ]
        extra_kwargs = {
            'nationality': {'required': False, 'allow_blank': True},
            'university': {'required': False, 'allow_blank': True},
            'degree_level': {'required': False, 'allow_blank': True},
            'graduation_year': {'required': False, 'allow_null': True},
            'experience_years': {'required': False, 'default': 0},
            'linkedin_url': {'required': False, 'allow_blank': True},
            'github_url': {'required': False, 'allow_blank': True},
            'current_location': {'required': False, 'allow_blank': True},
            'availability_date': {'required': False, 'allow_null': True},
            'extra_profile_details': {'required': False},
        }

    def validate_cv_file(self, value):
        if not value.name.endswith('.pdf'):
            raise serializers.ValidationError("Le CV doit être un fichier PDF")
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Le fichier CV ne doit pas dépasser 5MB")
        return value

    def validate_cover_letter_file(self, value):
        if value and not value.name.endswith('.pdf'):
            raise serializers.ValidationError(
                "La lettre de motivation doit être un fichier PDF"
            )
        if value and value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError(
                "La lettre de motivation ne doit pas dépasser 5MB"
            )
        return value

    def validate_email(self, value):
        job_offer_id = self.initial_data.get('job_offer')
        if not self.instance and job_offer_id:
            exists = Application.objects.filter(
                job_offer_id=job_offer_id, email=value
            ).exists()
            if exists:
                raise serializers.ValidationError(
                    "Vous avez déjà postulé à cette offre avec cet email"
                )
        return value


# =====================================================================
# SERIALIZERS UTILISATEURS
# =====================================================================

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=['ADMIN', 'RH'], write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'password', 'role']

    def create(self, validated_data):
        role = validated_data.pop('role')
        user = User.objects.create_user(**validated_data)
        user.role = role
        user.is_staff = (role == 'ADMIN')
        user.save()
        return user


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'is_active', 'first_name', 'last_name']

    def get_role(self, obj):

        return obj.role


class UserUpdateSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(choices=['ADMIN', 'RH'], required=False)

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'is_active', 'role']

    def update(self, instance, validated_data):
        role = validated_data.pop('role', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if role:
            instance.role = role
            instance.is_staff = (role == 'ADMIN')
            instance.save()
        return instance


# =====================================================================
# SERIALIZERS INVITATIONS
# =====================================================================

class InterviewInvitationSerializer(serializers.ModelSerializer):
    candidate_name = serializers.CharField(
        source='application.full_name', read_only=True
    )
    candidate_email = serializers.CharField(
        source='application.email', read_only=True
    )
    job_title = serializers.CharField(
        source='application.job_offer.title', read_only=True
    )
    invited_by_name = serializers.CharField(
        source='invited_by.get_full_name', read_only=True
    )

    class Meta:
        model = InterviewInvitation
        fields = [
            'id', 'application', 'candidate_name', 'candidate_email',
            'job_title', 'invited_by', 'invited_by_name',
            'interview_date', 'interview_time', 'meeting_link',
            'interviewer_name', 'status', 'sent_at',
            'created_at', 'updated_at', 'candidate_response', 'responded_at',
        ]
        read_only_fields = ['id', 'invited_by', 'sent_at', 'created_at', 'updated_at']


# =====================================================================
# SERIALIZERS SYSTEME & LOGS
# =====================================================================

class SystemSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSettings
        fields = '__all__'


class AuditLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'username', 'action', 'model_name', 'object_id',
            'description', 'ip_address', 'user_agent', 'timestamp'
        ]
        read_only_fields = ['id', 'timestamp']


class SupportTicketSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(
        source='created_by.username', read_only=True
    )
    assigned_to_name = serializers.CharField(
        source='assigned_to.username', read_only=True, allow_null=True
    )

    class Meta:
        model = SupportTicket
        fields = [
            'id', 'created_by', 'created_by_name', 'subject', 'description',
            'status', 'priority', 'assigned_to', 'assigned_to_name',
            'created_at', 'updated_at', 'resolved_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ActivityLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = ActivityLog
        fields = [
            'id', 'user', 'username', 'activity_type', 'description',
            'ip_address', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


# =====================================================================
# SERIALIZERS ADMIN
# =====================================================================

class AdminUserDetailSerializer(serializers.ModelSerializer):
    total_offers = serializers.SerializerMethodField()
    total_applications = serializers.SerializerMethodField()
    total_interviews = serializers.SerializerMethodField()
    last_login_formatted = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'is_active', 'is_staff', 'date_joined', 'last_login',
            'last_login_formatted', 'total_offers', 'total_applications',
            'total_interviews'
        ]
        read_only_fields = ['id', 'date_joined']

    def get_total_offers(self, obj):
        return JobOffer.objects.filter(created_by=obj).count()

    def get_total_applications(self, obj):
        return Application.objects.filter(job_offer__created_by=obj).count()

    def get_total_interviews(self, obj):
        if hasattr(obj, 'interviews'):
            return Interview.objects.filter(rh_user=obj).count()
        return 0

    def get_last_login_formatted(self, obj):
        if obj.last_login:
            return obj.last_login.strftime('%d/%m/%Y %H:%M')
        return 'Jamais'


class AdminOfferSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(
        source='created_by.username', read_only=True
    )
    applications_count = serializers.SerializerMethodField()

    class Meta:
        model = JobOffer
        fields = [
            'id', 'title', 'description', 'requirements', 'created_by',
            'created_by_name', 'is_active', 'created_at', 'updated_at',
            'applications_count'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_applications_count(self, obj):
        return obj.applications.count()


class AdminApplicationSerializer(serializers.ModelSerializer):
    job_title = serializers.CharField(
        source='job_offer.title', read_only=True
    )
    rh_name = serializers.CharField(
        source='job_offer.created_by.username', read_only=True
    )

    class Meta:
        model = Application
        fields = [
            'id', 'full_name', 'email', 'phone', 'job_offer', 'job_title',
            'rh_name', 'status', 'created_at', 'cv_file', 'cover_letter_file'
        ]
        read_only_fields = ['id', 'created_at']


from django.utils.text import slugify
class CompanySerializer(serializers.ModelSerializer):
    total_rh = serializers.SerializerMethodField()
    total_offers = serializers.SerializerMethodField()
    total_applications = serializers.SerializerMethodField()
    users_count = serializers.SerializerMethodField()
    admin_user = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            'id', 'name', 'slug', 'logo', 'email_domain',
            'is_active', 'plan', 'max_rh_users', 'max_active_offers',
            'created_at', 'total_rh', 'total_offers', 'total_applications',
            'users_count', 'admin_user',
        ]
        read_only_fields = ['id', 'slug', 'created_at']

    def get_users_count(self, obj):
        return obj.users.count()

    def get_total_rh(self, obj):
        return obj.users.filter(role__in=['RH', 'ADMIN']).count()

    def get_total_offers(self, obj):
        return obj.job_offers.count()

    def get_total_applications(self, obj):
        from .models import Application
        return Application.objects.filter(job_offer__company=obj).count()

    def get_admin_user(self, obj):
        admin = obj.users.filter(role='ADMIN').first()
        if not admin:
            # fallback si le role est 'ADMIN'
            admin = obj.users.filter(role='ADMIN').first()
        if admin:
            return {
                'id': admin.id,
                'username': admin.username,
                'email': admin.email,
                'is_active': admin.is_active,
                'last_login': admin.last_login.strftime('%d/%m/%Y %H:%M') if admin.last_login else 'Jamais'
            }
        return None

class CompanyRegistrationSerializer(serializers.Serializer):
    """Inscription d'une nouvelle entreprise avec son premier Admin"""
    # Infos company
    company_name = serializers.CharField(max_length=200)
    email_domain = serializers.CharField(max_length=100, required=False, allow_blank=True)
    plan = serializers.ChoiceField(choices=['free', 'pro', 'enterprise'], default='free')

    # Infos Admin
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Cet email est déjà utilisé")
        return value

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Ce nom d'utilisateur est déjà pris")
        return value

    def validate_company_name(self, value):
        slug = slugify(value)
        if Company.objects.filter(slug=slug).exists():
            raise serializers.ValidationError("Une entreprise avec ce nom existe déjà")
        return value

    def create(self, validated_data):
        from django.utils.text import slugify

        # 1. Créer la company
        company = Company.objects.create(
            name=validated_data['company_name'],
            slug=slugify(validated_data['company_name']),
            email_domain=validated_data.get('email_domain', ''),
            plan=validated_data.get('plan', 'free')
        )

        # 2. Créer l'Admin
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            role='ADMIN',
            company=company
        )

        return {'company': company, 'user': user}