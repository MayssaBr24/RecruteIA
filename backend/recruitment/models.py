from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.core.exceptions import ValidationError
from datetime import datetime, timedelta
# recruitment/models.py

class RHAvailabilityException(models.Model):
    rh_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date = models.DateField()

    class Meta:
        unique_together = ('rh_user', 'date')
# --- Fonctions utilitaires pour les uploads ---
def job_offer_upload_path(instance, filename):
    return f'job_offers/{instance.id}/{filename}'

def cv_upload_path(instance, filename):
    return f'applications/{instance.job_offer.id}/cv/{filename}'

def cover_letter_upload_path(instance, filename):
    return f'applications/{instance.job_offer.id}/cover_letters/{filename}'

# --- ÉTAPE 1 : Le modèle User ---
class User(AbstractUser):
    """Modèle utilisateur personnalisé avec rôles"""
    ROLE_CHOICES = (
        ('CANDIDATE', 'Candidat'),
        ('RH', 'Responsable RH'),
        ('ADMIN', 'Administrateur'),
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='CANDIDATE',
        verbose_name="Rôle"
    )
    email = models.EmailField(unique=True, verbose_name="Email")

    groups = models.ManyToManyField(
        'auth.Group',
        related_name='recruitment_user_groups',
        blank=True,
        verbose_name='groups',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='recruitment_user_permissions',
        blank=True,
        verbose_name='user permissions',
    )

    class Meta:
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"

    def __str__(self):
        return f"{self.username} - {self.get_role_display()}"


# --- ÉTAPE 2 : Modèles de gestion RH ---
from django.core.exceptions import ValidationError


class RHAvailability(models.Model):
    rh_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='availabilities')

    # On rend day_of_week optionnel (null=True) pour les cas où on veut une date précise
    day_of_week = models.IntegerField(
        choices=[(0, 'Lundi'), (1, 'Mardi'), (2, 'Mercredi'), (3, 'Jeudi'), (4, 'Vendredi'), (5, 'Samedi'),
                 (6, 'Dimanche')],
        null=True, blank=True,
        help_text="Jour de la semaine (récurrence)"
    )

    # NOUVEAU : Pour gérer un jour précis
    specific_date = models.DateField(
        null=True, blank=True,
        help_text="Date spécifique (exception)"
    )

    start_time = models.TimeField()
    end_time = models.TimeField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['specific_date', 'day_of_week', 'start_time']

    def clean(self):
        # Validation : Il faut soit un jour de la semaine, soit une date spécifique
        if self.day_of_week is None and self.specific_date is None:
            raise ValidationError("Précisez soit un jour de la semaine, soit une date spécifique.")

        if self.start_time >= self.end_time:
            raise ValidationError("L'heure de début doit être avant l'heure de fin")


class JobOffer(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='job_offers',
        verbose_name="Créé par"
    )

    # --- LOGISTIQUE ---
    location = models.CharField(max_length=100, default="Tunisie")
    contract_type = models.CharField(max_length=50, default="CDI")

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Date de création")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Dernière modification")
    is_active = models.BooleanField(default=True, verbose_name="Offre active")

    # --- CRITÈRES IA ---
    # Stocke la liste des compétences (ex: "Python, Django, React")
    requirements = models.TextField(help_text="Compétences techniques séparées par des virgules")

    # Expérience requise (en années)
    experience_years = models.PositiveIntegerField(default=0, help_text="Années d'expérience requises")

    # Niveau d'études
    EDUCATION_LEVEL = [
        ('BAC', 'Baccalauréat'),
        ('BAC+2', 'BAC+2 (DUT/BTS)'),
        ('BAC+3', 'Licence'),
        ('BAC+5', 'Master / Ingénieur'),
        ('PHD', 'Doctorat'),
    ]
    education_level = models.CharField(max_length=20, choices=EDUCATION_LEVEL, default='BAC+5')

    # Soft Skills (séparés par virgules)
    soft_skills = models.TextField(blank=True, help_text="Compétences douces (ex: Travail d'équipe, Communication)")

    def __str__(self):
        return self.title
class Application(models.Model):
    job_offer = models.ForeignKey(JobOffer, on_delete=models.CASCADE, related_name='applications')

    # --- Champs Existants ---
    full_name = models.CharField(max_length=200)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    cv_file = models.FileField(upload_to=cv_upload_path)
    cover_letter_file = models.FileField(upload_to=cover_letter_upload_path, blank=True, null=True)
    applied_date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, default='pending')

    # --- NOUVEAUX CHAMPS POUR L'IA ---
    nationality = models.CharField(max_length=100, blank=True, help_text="Nationalité")
    university = models.CharField(max_length=200, blank=True, help_text="Établissement d'enseignement")
    degree_level = models.CharField(max_length=50, blank=True, help_text="Diplôme obtenu")
    graduation_year = models.IntegerField(null=True, blank=True, help_text="Année d'obtention")
    experience_years = models.IntegerField(default=0, help_text="Années d'expérience")
    linkedin_url = models.URLField(blank=True, help_text="Lien profil LinkedIn")
    portfolio_url = models.URLField(blank=True, help_text="Lien portfolio/GitHub")
    current_location = models.CharField(max_length=100, blank=True, help_text="Ville actuelle")
    salary_expectation = models.IntegerField(null=True, blank=True, help_text="Prétention salariale (Mensuel)")
    availability_date = models.DateField(null=True, blank=True, help_text="Date de disponibilité")
    ai_score = models.IntegerField(default=0)
    ai_summary = models.TextField(blank=True, default='')
    ai_decision = models.CharField(max_length=20, default='PENDING')
    ai_missing_skills = models.JSONField(default=list, blank=True)
    ai_strengths = models.JSONField(default=list, blank=True)
    ai_weaknesses = models.JSONField(default=list, blank=True)
    ai_recommendations = models.TextField(blank=True, default='')
class Interview(models.Model):
    """Entretiens planifiés"""
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name='interviews')
    # CORRECTION ICI : Utilisation de settings.AUTH_USER_MODEL
    rh_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='interviews')
    scheduled_date = models.DateField()
    scheduled_time = models.TimeField()
    duration_minutes = models.IntegerField(default=60)
    status = models.CharField(max_length=20, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

class RHSettings(models.Model):
    """Paramètres globaux du RH pour les entretiens"""
    # CORRECTION ICI : Utilisation de settings.AUTH_USER_MODEL
    rh_user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='rh_settings')
    disable_weekends = models.BooleanField(default=True)
    enable_lunch_break = models.BooleanField(default=True)
    default_interview_duration = models.IntegerField(default=60)
    lunch_break_start = models.TimeField(default="12:00")
    lunch_break_end = models.TimeField(default="13:00")
