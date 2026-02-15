# recruitment/serializers.py
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import JobOffer, Application
from django.contrib.auth import get_user_model
User = get_user_model()

# recruitment/serializers.py
from .models import RHAvailability, Interview, RHSettings, Application
from .models import RHAvailability, RHAvailabilityException # <-- Assure-toi que RHAvailabilityException est écrit ici !

# ... vos serializers existants ...
# recruitment/serializers.py

class RHAvailabilityExceptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RHAvailabilityException
        fields = ['id', 'date']
class RHAvailabilitySerializer(serializers.ModelSerializer):
    day_name = serializers.SerializerMethodField()

    class Meta:
        model = RHAvailability
        fields = [
            'id',
            'rh_user',
            'day_of_week',
            'specific_date',
            'start_time',
            'end_time',
            'is_active',
            'day_name'
        ]
        read_only_fields = ['id', 'rh_user']
    def get_day_name(self, obj):
        # On met un retour simple pour tester si le reste fonctionne
        return "Test"

    def validate(self, data):
        if data['start_time'] >= data['end_time']:
            raise serializers.ValidationError("L'heure de début doit être avant l'heure de fin")
        return data


class InterviewSerializer(serializers.ModelSerializer):
    candidate_name = serializers.CharField(source='application.full_name', read_only=True)
    candidate_email = serializers.CharField(source='application.email', read_only=True)
    candidate_phone = serializers.CharField(source='application.phone', read_only=True)
    job_title = serializers.CharField(source='application.job_offer.title', read_only=True)
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
        fields = ['lunch_break_start', 'lunch_break_end', 'enable_lunch_break', 'default_interview_duration']
        read_only_fields = ['id']
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)

        # On utilise d'abord le champ 'role' défini dans votre modèle User personnalisé
        # Si le champ n'existe pas, on cherche dans les groupes
        role = getattr(self.user, 'role', 'CANDIDATE')

        # Sécurité : Si c'est un superutilisateur, c'est forcément un ADMIN
        if self.user.is_superuser:
            role = 'ADMIN'
        # Si le rôle est encore CANDIDATE mais qu'il est staff, on vérifie ses groupes
        elif role == 'CANDIDATE':
            if self.user.groups.filter(name='ADMIN').exists():
                role = 'ADMIN'
            elif self.user.groups.filter(name='RH').exists():
                role = 'RH'

        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'role': role,  # <--- C'est cette valeur qui sera envoyée au Frontend
        }
        return data

class CustomTokenObtainPairView(TokenObtainPairView):
    """Vue personnalisée pour le login"""
    serializer_class = CustomTokenObtainPairSerializer


class JobOfferSerializer(serializers.ModelSerializer):
    """Serializer pour les offres d'emploi"""
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    applications_count = serializers.IntegerField(source='applications.count', read_only=True)

    class Meta:
        model = JobOffer
        fields = [
            'id', 'title', 'description',
            'created_by', 'created_by_name', 'created_at',
            'updated_at', 'is_active', 'applications_count',
            'location', 'contract_type', 'location',
            'contract_type',

            # --- CRITÈRES IA (Manquait) ---
            'requirements',
            'experience_years',
            'education_level',
            'soft_skills',


        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class ApplicationSerializer(serializers.ModelSerializer):
    """
    Serializer pour les candidatures avec informations enrichies par IA
    """
    # Champs relationnels en lecture seule
    job_offer_title = serializers.CharField(source='job_offer.title', read_only=True)

    # Champs IA en lecture seule (seront remplis automatiquement par le service)
    ai_score = serializers.IntegerField(read_only=True)
    ai_summary = serializers.CharField(read_only=True, allow_blank=True)
    ai_decision = serializers.CharField(read_only=True, allow_blank=True)

    # CORRECTION: ai_missing_skills est un JSONField dans le modèle, pas besoin de redéfinir
    # Le serializer Django REST gère automatiquement les JSONField

    class Meta:
        model = Application
        fields = [
            # Identifiants
            'id',

            # Relation offre d'emploi
            'job_offer',
            'job_offer_title',

            # Informations candidat de base
            'full_name',
            'email',
            'phone',

            # Fichiers
            'cv_file',
            'cover_letter_file',

            # Dates et statut
            'applied_date',  # ou 'applied_date' si c'est le nom dans votre modèle
            'status',

            # Informations enrichies par IA (extraction du CV)
            'nationality',
            'university',
            'degree_level',
            'graduation_year',
            'experience_years',
            'linkedin_url',
            'portfolio_url',
            'current_location',
            'salary_expectation',
            'availability_date',

            # Analyse IA
            'ai_score',
            'ai_summary',
            'ai_decision',
            'ai_missing_skills',  # JSONField - géré automatiquement
            'ai_strengths',  # JSONField - géré automatiquement
            'ai_weaknesses',  # JSONField - géré automatiquement
            'ai_recommendations',
        ]

        # Champs en lecture seule (ne peuvent pas être modifiés via l'API)
        read_only_fields = [
            'id',
            'applied_date',  # ou 'applied_date'
            'status',
            # Tous les champs enrichis par IA
            'nationality',
            'university',
            'degree_level',
            'graduation_year',
            'experience_years',
            'linkedin_url',
            'portfolio_url',
            'current_location',
            'salary_expectation',
            'availability_date',
            'ai_score',
            'ai_summary',
            'ai_decision',
            'ai_missing_skills',
            'ai_strengths',
            'ai_weaknesses',
            'ai_recommendations',
        ]
    def validate_cv_file(self, value):
        if not value.name.endswith('.pdf'):
            raise serializers.ValidationError("Le CV doit être un fichier PDF")
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Le fichier CV ne doit pas dépasser 5MB")
        return value

    def validate_cover_letter_file(self, value):
        if value and not value.name.endswith('.pdf'):
            raise serializers.ValidationError("La lettre de motivation doit être un fichier PDF")
        if value and value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("La lettre de motivation ne doit pas dépasser 5MB")
        return value

    def validate_email(self, value):
        """Vérifier que l'email n'a pas déjà postulé à cette offre"""
        # Récupérer l'ID de l'offre depuis les données initiales
        job_offer_id = self.initial_data.get('job_offer')

        if job_offer_id:
            # Vérifier l'unicité email + offre
            exists = Application.objects.filter(
                job_offer_id=job_offer_id,
                email=value
            ).exists()

            if exists:
                raise serializers.ValidationError(
                    "Vous avez déjà postulé à cette offre avec cet email"
                )

        return value


# =============== 1. SERIALIZER POUR CRÉATION (Admin) ===============
class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer pour l'enregistrement d'utilisateurs (Admin/RH) - VERSION GROUPS"""
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=['ADMIN', 'RH'], write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'password', 'role']

    def create(self, validated_data):
        role = validated_data.pop('role')
        user = User.objects.create_user(**validated_data)

        # Assigner le groupe
        group, created = Group.objects.get_or_create(name=role)
        user.groups.add(group)

        # Si ADMIN, donner les droits staff
        if role == 'ADMIN':
            user.is_staff = True
            user.save()

        return user


# recruitment/serializers.py

class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'is_active', 'first_name', 'last_name']

    def get_role(self, obj):
        # 1. Vérifier si c'est un superutilisateur (toujours ADMIN)
        if obj.is_superuser:
            return 'ADMIN'

        # 2. Utiliser le champ 'role' du modèle
        if hasattr(obj, 'role') and obj.role:
            return obj.role

        # 3. Fallback sur les groupes si le champ role est vide
        if obj.groups.filter(name='ADMIN').exists():
            return 'ADMIN'
        elif obj.groups.filter(name='RH').exists():
            return 'RH'

        return 'CANDIDATE'
# =============== 3. SERIALIZER POUR MODIFICATION (Admin) ===============
class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer pour la modification d'utilisateurs"""
    role = serializers.ChoiceField(choices=['ADMIN', 'RH'], required=False)

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'is_active', 'role']

    def update(self, instance, validated_data):
        role = validated_data.pop('role', None)

        # Mettre à jour les champs standards
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Mettre à jour le rôle (groupe)
        if role:
            # Retirer tous les groupes RH/ADMIN
            instance.groups.filter(name__in=['RH', 'ADMIN']).clear()
            # Ajouter le nouveau groupe
            group, _ = Group.objects.get_or_create(name=role)
            instance.groups.add(group)
            # Mettre à jour is_staff pour ADMIN
            instance.is_staff = (role == 'ADMIN')
            instance.save()

        return instance