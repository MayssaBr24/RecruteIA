from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.core.exceptions import ValidationError
from datetime import datetime, timedelta
import uuid
from django.utils import timezone

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):

    ROLE_CHOICES = (
        ('CANDIDATE', 'Candidat'),
        ('RH', 'Responsable RH'),
        ('ADMIN', 'Administrateur'),
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='CANDIDATE'
    )

    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, unique=True, null=True, blank=True)

    def __str__(self):
        return f"{self.username} - {self.role}"
class SystemSettings(models.Model):
    """Paramètres globaux de la plateforme"""
    company_name = models.CharField(max_length=200, default="Ma Plateforme RH")
    logo = models.ImageField(upload_to='branding/', null=True, blank=True)
    email_sender = models.EmailField(default="noreply@platform.com")
    max_offers_per_rh = models.IntegerField(default=50)
    max_cv_size_mb = models.IntegerField(default=5)
    offer_validity_days = models.IntegerField(default=30)
    enable_ai_module = models.BooleanField(default=False)
    maintenance_mode = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Paramètres Système"
        verbose_name_plural = "Paramètres Système"

    def __str__(self):
        return f"Settings - {self.company_name}"

class AuditLog(models.Model):
    """Logs d'audit pour traçabilité"""
    ACTION_CHOICES = [
        ('create', 'Création'),
        ('update', 'Modification'),
        ('delete', 'Suppression'),
        ('login', 'Connexion'),
        ('logout', 'Déconnexion'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    model_name = models.CharField(max_length=50)
    object_id = models.IntegerField(null=True, blank=True)
    description = models.TextField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        verbose_name = "Log d'Audit"
        verbose_name_plural = "Logs d'Audit"

    def __str__(self):
        return f"{self.action} - {self.model_name} - {self.timestamp}"


class SupportTicket(models.Model):
    STATUS_CHOICES = [
        ('open', 'Ouvert'),
        ('in_progress', 'En cours'),
        ('resolved', 'Résolu'),
        ('closed', 'Fermé'),
    ]

    PRIORITY_CHOICES = [
        (1, 'Urgente'),
        (2, 'Normale'),
        (3, 'Faible'),
    ]
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_tickets')
    subject = models.CharField(max_length=200)
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tickets')
    created_at = models.DateTimeField(auto_now_add=True)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    priority = models.IntegerField(choices=PRIORITY_CHOICES, default=2)

    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Ticket Support"
        verbose_name_plural = "Tickets Support"

    def __str__(self):
        return f"#{self.id} - {self.subject}"

class ActivityLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='activity_logs')
    activity_type = models.CharField(max_length=50)
    description = models.CharField(max_length=255)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        verbose_name = "Log d'Activité"
        verbose_name_plural = "Logs d'Activité"

    def __str__(self):
        return f"{self.user.username} - {self.activity_type} - {self.timestamp}"


class InterviewInvitation(models.Model):
    """Modèle pour les invitations aux entretiens finaux (RH)"""

    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('sent', 'Envoyée'),
        ('accepted', 'Acceptée'),
        ('declined', 'Refusée'),
        ('cancelled', 'Annulée'),
    ]

    application = models.ForeignKey(
        'Application',
        on_delete=models.CASCADE,
        related_name='interview_invitations'
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sent_invitations'
    )

    # Infos d'invitation
    interview_date = models.DateField()
    interview_time = models.TimeField()
    meeting_link = models.URLField(blank=True, null=True, help_text="Lien visioconférence ou adresse physique")
    interviewer_name = models.CharField(max_length=200, help_text="Nom de l'interviewer")

    # Métadonnées
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Réponse du candidat
    candidate_response = models.TextField(blank=True, help_text="Réponse du candidat si accepté/refusé")
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Invitation {self.application.full_name} - {self.interview_date}"

# === 2. ENSUITE LES FONCTIONS UTILITAIRES ===
def job_offer_upload_path(instance, filename):
    return f'job_offers/{uuid.uuid4()}/{filename}'

def cv_upload_path(instance, filename):
    return f'applications/{instance.job_offer.id}/cv/{filename}'

def cover_letter_upload_path(instance, filename):
    return f'applications/{instance.job_offer.id}/cover_letters/{filename}'


# === 3. ENFIN TOUS LES AUTRES MODÈLES ===
class RHAvailabilityException(models.Model):
    rh_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)  # OK maintenant
    date = models.DateField()

    class Meta:
        unique_together = ('rh_user', 'date')


class RHAvailability(models.Model):
    rh_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='availabilities')

    day_of_week = models.IntegerField(
        choices=[(0, 'Lundi'), (1, 'Mardi'), (2, 'Mercredi'), (3, 'Jeudi'), (4, 'Vendredi'), (5, 'Samedi'),
                 (6, 'Dimanche')],
        null=True, blank=True,
        help_text="Jour de la semaine (récurrence)"
    )
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
        if self.day_of_week is None and self.specific_date is None:
            raise ValidationError("Précisez soit un jour de la semaine, soit une date spécifique.")
        if self.start_time >= self.end_time:
            raise ValidationError("L'heure de début doit être avant l'heure de fin")


class JobOffer(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,  # OK maintenant
        on_delete=models.CASCADE,
        related_name='job_offers',
        verbose_name="Créé par"
    )
    weight_cv = models.FloatField(default=0.50, help_text="Poids CV (0-1)")
    weight_motivation = models.FloatField(default=0.15, help_text="Poids lettre motivation (0-1)")
    weight_softskills = models.FloatField(default=0.10, help_text="Poids soft skills (0-1)")
    weight_github = models.FloatField(default=0.25, help_text="Poids GitHub (0-1)")
    offer_deadline = models.DateField(null=True, blank=True)
    agents_needed = models.IntegerField(default=1)
    interview_type = models.CharField(
        max_length=20,
        choices=[('RH', 'Entretien RH'), ('AI', 'Entretien IA')],
        default='AI'
    )
    deadline_processed = models.BooleanField(default=False)
    location = models.CharField(max_length=100, default="Tunisie")
    contract_type = models.CharField(max_length=50, default="CDI")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Date de création")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Dernière modification")
    is_active = models.BooleanField(default=True, verbose_name="Offre active")
    requirements = models.TextField(help_text="Compétences techniques séparées par des virgules")
    experience_years = models.PositiveIntegerField(default=0, help_text="Années d'expérience requises")
    EDUCATION_LEVEL = [
        ('BAC', 'Baccalauréat'),
        ('BAC+2', 'BAC+2 (DUT/BTS)'),
        ('BAC+3', 'Licence'),
        ('BAC+5', 'Master / Ingénieur'),
        ('PHD', 'Doctorat'),
    ]
    education_level = models.CharField(max_length=20, choices=EDUCATION_LEVEL, default='BAC+5')
    soft_skills = models.TextField(blank=True, help_text="Compétences douces (ex: Travail d'équipe, Communication)")
    # Nouveaux champs
    views_count = models.IntegerField(default=0)
    filled_at = models.DateField(null=True, blank=True)
    required_count = models.IntegerField(default=1)
    DEPARTMENT_CHOICES = [
        ('tech', 'Technologie'),
        ('rh', 'Ressources Humaines'),
        ('finance', 'Finance'),
        ('marketing', 'Marketing'),
        ('commercial', 'Commercial'),
        ('operations', 'Opérations'),
        ('other', 'Autre'),
    ]
    department = models.CharField(
        max_length=50,
        choices=DEPARTMENT_CHOICES,
        default='tech'
    )
    contract_duration = models.IntegerField(
        null=True, blank=True,
        help_text="Durée en mois (null si CDI)"
    )

    def clean(self):
        total = self.weight_cv + self.weight_motivation + self.weight_softskills + self.weight_github
        if abs(total - 1.0) > 0.01:
            raise ValidationError("La somme des poids doit être égale à 1.0")

    def __str__(self):
        return self.title


class RHNote(models.Model):
    LEVEL_CHOICES = [
        ('info',    'Info'),
        ('warning', 'Avertissement'),
        ('urgent',  'Urgent'),
    ]

    rh_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='rh_notes')
    date         = models.DateField()
    content      = models.TextField()
    level        = models.CharField(max_length=10, choices=LEVEL_CHOICES, default='info')
    notify_at    = models.DateTimeField(null=True, blank=True)
    notified     = models.BooleanField(default=False)
    linked_offer = models.ForeignKey(
        'JobOffer', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='notes'
    )
    linked_application = models.ForeignKey(
        'Application', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='notes'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering  = ['date', 'notify_at']
        db_table  = 'rh_notes'

    def __str__(self):
        return f"Note {self.rh_user} — {self.date}"

class Application(models.Model):
    job_offer = models.ForeignKey(JobOffer, on_delete=models.CASCADE, related_name='applications')
    full_name = models.CharField(max_length=200)
    email = (models.EmailField())
    phone = models.CharField(max_length=20, unique=True, null=True, blank=True)
    cv_file = models.FileField(upload_to=cv_upload_path)
    cover_letter_file = models.FileField(upload_to=cover_letter_upload_path, blank=True, null=True)
    applied_date = models.DateTimeField(auto_now_add=True)
    STATUS_CHOICES = [
        ('pending', 'Candidature reçue'),
        ('qualified', 'Qualifié après IA'),
        ('invited', 'Invité entretien final'),
        ('rejected', 'Rejeté'),
        ('hired', 'Recruté'),
    ]
    status = models.CharField(max_length=20,choices=STATUS_CHOICES,default='pending')
    nationality = models.CharField(max_length=100, blank=True, help_text="Nationalité")
    university = models.CharField(max_length=200, blank=True, help_text="Établissement d'enseignement")
    degree_level = models.CharField(max_length=50, blank=True, help_text="Diplôme obtenu")
    graduation_year = models.IntegerField(null=True, blank=True, help_text="Année d'obtention")
    experience_years = models.IntegerField(default=0, help_text="Années d'expérience")
    linkedin_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    linkedin_url = models.URLField(null=True)
    linkedin_verified = models.BooleanField(default=False)
    github_id = models.IntegerField(unique=True, null=True, blank=True)
    github_username = models.CharField(max_length=100, null=True)
    github_url = models.URLField(null=True)
    github_verified = models.BooleanField(default=False)
    github_data = models.JSONField(default=dict, blank=True, null=True)
    linkedin_data = models.JSONField(default=dict, blank=True)
    current_location = models.CharField(max_length=100, blank=True, help_text="Ville actuelle")
    current_position = models.CharField(max_length=200, blank=True)
    salary_expectation = models.IntegerField(null=True, blank=True, help_text="Prétention salariale (Mensuel)")
    availability_date = models.DateField(null=True, blank=True, help_text="Date de disponibilité")
    ai_score = models.IntegerField(default=0)
    ai_summary = models.TextField(blank=True, default='')
    ai_decision = models.CharField(max_length=20, default='PENDING')
    ai_missing_skills = models.JSONField(default=list, blank=True)
    ai_strengths = models.JSONField(default=list, blank=True)
    ai_weaknesses = models.JSONField(default=list, blank=True)
    ai_recommendations = models.TextField(blank=True, default='')
    ai_candidate_message = models.TextField(blank=True, default='', help_text="Message personnalisé pour le candidat")
    ai_next_steps = models.TextField(blank=True, default='', help_text="Instructions sur les prochaines étapes")
    ai_analysis_date = models.DateTimeField(null=True, blank=True, help_text="Date de la dernière analyse IA")
    created_at = models.DateTimeField(default=timezone.now)
    hired_at = models.DateField(null=True, blank=True)
    ai_certifications = models.JSONField(null=True, blank=True)
    ai_projects = models.JSONField(null=True, blank=True)
    extra_profile_details = models.JSONField(
        default=dict,
        blank=True,
        help_text="Stocke les certifications et liens sous forme { 'certif': '...', 'link': '...' }"
    )
    ai_score_rationale = models.TextField(blank=True, null=True, help_text="Explication détaillée du score IA")
    ai_notes = models.TextField(blank=True, null=True, help_text="Notes additionnelles de l'analyse IA")
    ai_detailed_justification = models.JSONField(default=dict, blank=True,
                                                 help_text="Justification détaillée par composant")
    certificate_file = models.FileField(upload_to='certificates/', blank=True, null=True)
    contract_file = models.FileField(upload_to='employees/contracts/', null=True, blank=True)
    cin_file = models.FileField(upload_to='employees/cin/', null=True, blank=True)
    rib_file = models.FileField(upload_to='employees/rib/', null=True, blank=True)
    photo_file = models.FileField(upload_to='employees/photos/', null=True, blank=True)
    diplomas_file = models.FileField(upload_to='employees/diplomas/', null=True, blank=True)
    criminal_record_file = models.FileField(upload_to='employees/criminal/', null=True, blank=True)
    medical_file = models.FileField(upload_to='employees/medical/', null=True, blank=True)
    start_date = models.DateField(null=True, blank=True)
    department = models.CharField(max_length=100, null=True, blank=True)
    position_title = models.CharField(max_length=150, null=True, blank=True)
    employee_id = models.CharField(max_length=50, null=True, blank=True)
    ai_breakdown = models.JSONField(null=True, blank=True,
                                    help_text="Détail pondéré du score IA")
    ai_coherence_flags = models.JSONField(default=list, blank=True,
                                          help_text="Alertes de cohérence détectées")
    REJECTION_STAGE_CHOICES = [
        ('cv_screening', 'Screening CV'),
        ('ai_analysis', 'Analyse IA'),
        ('interview', 'Entretien'),
        ('final', 'Décision finale'),
    ]
    rejection_stage = models.CharField(
        max_length=50,
        choices=REJECTION_STAGE_CHOICES,
        null=True, blank=True
    )
    SOURCE_CHOICES = [
        ('linkedin', 'LinkedIn'),
        ('indeed', 'Indeed'),
        ('direct', 'Candidature directe'),
        ('referral', 'Recommandation'),
        ('other', 'Autre'),
    ]
    source = models.CharField(
        max_length=50,
        choices=SOURCE_CHOICES,
        default='direct'
    )
    email_verified = models.BooleanField(default=False)


    class Meta:
        ordering = ['-applied_date']

class RHMetrics(models.Model):
    """
    Snapshot mensuel des métriques RH.
    Généré automatiquement par Celery le 1er de chaque mois.
    """
    month = models.CharField(
        max_length=7,
        unique=True,
        help_text="Format : 2024-01"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True
    )
    total_offers = models.IntegerField(default=0)
    total_applications = models.IntegerField(default=0)
    total_hired = models.IntegerField(default=0)
    total_rejected = models.IntegerField(default=0)
    total_interviews_completed = models.IntegerField(default=0)
    avg_time_to_hire = models.FloatField(
        default=0,
        help_text="Temps moyen en jours"
    )
    avg_ai_score = models.FloatField(default=0)
    avg_interview_score = models.FloatField(default=0)
    conversion_rate = models.FloatField(
        default=0,
        help_text="Taux candidature→embauche en %"
    )
    interview_completion_rate = models.FloatField(
        default=0,
        help_text="Taux completion entretien IA en %"
    )
    fraud_rate = models.FloatField(
        default=0,
        help_text="Taux fraude entretien en %"
    )
    by_department = models.JSONField(
        default=dict,
        help_text="Métriques par département"
    )
    by_source = models.JSONField(
        default=dict,
        help_text="Candidatures par source"
    )
    by_contract_type = models.JSONField(
        default=dict,
        help_text="Candidatures par type contrat"
    )
    rejection_by_stage = models.JSONField(
        default=dict,
        help_text="Rejets par étape du process"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-month']
        verbose_name = "Métriques RH"

    def __str__(self):
        return f"Métriques {self.month}"


class CVMatch(models.Model):
    """
    Résultats du matching IA entre une offre et les anciens candidats.
    """
    job_offer = models.ForeignKey(
        JobOffer,
        on_delete=models.CASCADE,
        related_name='cv_matches'
    )
    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name='cv_matches'
    )
    match_score = models.IntegerField(
        help_text="Score de matching 0-100"
    )
    matching_skills = models.JSONField(
        default=list,
        help_text="Compétences communes"
    )
    missing_skills = models.JSONField(
        default=list,
        help_text="Compétences manquantes"
    )
    match_summary = models.TextField(
        blank=True,
        help_text="Résumé IA du matching"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-match_score']
        unique_together = ('job_offer', 'application')

    def __str__(self):
        return f"Match {self.application.full_name} → {self.job_offer.title} ({self.match_score}%)"


class Interview(models.Model):
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name='interviews')
    rh_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='interviews')  # OK
    scheduled_date = models.DateField()
    scheduled_time = models.TimeField()
    duration_minutes = models.IntegerField(default=60)
    status = models.CharField(max_length=20, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)


class RHSettings(models.Model):
    rh_user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='rh_settings')  # OK
    disable_weekends = models.BooleanField(default=True)
    enable_lunch_break = models.BooleanField(default=True)
    default_interview_duration = models.IntegerField(default=60)
    lunch_break_start = models.TimeField(default="12:00")
    lunch_break_end = models.TimeField(default="13:00")


class AIInterview(models.Model):
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('in_progress', 'En cours'),
        ('completed', 'Terminé'),
        ('expired', 'Expiré'),
        ('fraud_terminated', 'Terminé pour fraude'),
    ]

    # ── Priorité 1 : phase scénario ajoutée dans PHASE_CHOICES ──────
    PHASE_CHOICES = [
        ('communication', 'Communication'),
        ('cv_clarification', 'Clarification CV'),
        ('scenario', 'Mise en situation'),  # ← NOUVEAU
        ('technical', 'Technique'),
        ('completed', 'Terminé'),
    ]

    # Relations
    application = models.OneToOneField(
        'Application', on_delete=models.CASCADE, related_name='ai_interview'
    )

    # Identifiant & durée
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Statut & phase
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    current_phase = models.CharField(max_length=20, choices=PHASE_CHOICES, default='communication')

    # Transcript
    transcript = models.JSONField(default=list)

    # ── Scores par phase ────────────────────────────────────────────
    communication_score = models.IntegerField(null=True, blank=True)
    clarification_score = models.IntegerField(null=True, blank=True)

    # NOUVEAU — Priorité 1
    scenario_score = models.IntegerField(
        null=True, blank=True,
        help_text="Score phase mise en situation (0-100)"
    )
    warnings_count      = models.IntegerField(default=0)
    technical_score     = models.IntegerField(null=True, blank=True)   # ← NOUVEAU



    qcm_score = models.IntegerField(null=True, blank=True)
    coding_score = models.IntegerField(null=True, blank=True)
    ai_interview_score = models.IntegerField(null=True, blank=True)

    # Feedback global
    ai_interview_feedback = models.TextField(blank=True)

    # QCM
    qcm_questions = models.JSONField(default=list)
    qcm_answers = models.JSONField(default=dict)

    # Coding
    coding_exercise = models.JSONField(default=dict)
    coding_submission = models.TextField(blank=True)

    # NOUVEAU — Priorité 1 : scénarios pré-générés
    scenario_questions = models.JSONField(
        default=list, blank=True,
        help_text="Scénarios pré-générés avec evaluation_criteria"
    )

    # Vidéo
    video_recording = models.FileField(
        upload_to='interview_videos/%Y/%m/', null=True, blank=True
    )

    # ── Priorité 3 : Annotations RH ─────────────────────────────────
    rh_annotation = models.TextField(
        null=True, blank=True,
        help_text="Note libre du RH après visionnage de la vidéo"
    )
    rh_rating = models.IntegerField(
        null=True, blank=True,
        help_text="Note manuelle RH 1-5"
    )
    override_recommendation = models.CharField(
        max_length=20, null=True, blank=True,
        help_text="Override RH de la recommandation IA : VALIDATED | TO_REVIEW | REJECTED"
    )
    rh_annotated_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Date de la dernière annotation RH"
    )

    # ── Anti-triche : horodatage de phase ───────────────────────────
    phase_started_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Horodatage de début de la phase courante (contrôle chrono)"
    )
    qcm_started_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Horodatage de début du QCM (contrôle chrono)"
    )

    # ── Méthodes ────────────────────────────────────────────────────
    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=24)
        super().save(*args, **kwargs)

    @property
    def is_valid(self):
        return self.status == 'pending' and timezone.now() < self.expires_at

    @property
    def duration_minutes(self):
        if self.started_at and self.completed_at:
            return int((self.completed_at - self.started_at).total_seconds() / 60)
        return None

    def __str__(self):
        return f"Entretien IA — {self.application.full_name} ({self.status})"


class InterviewWarning(models.Model):
    # ── Priorité 3 : types de warning étendus ───────────────────────
    WARNING_CHOICES = [
        ('tab_switch', 'Changement onglet'),
        ('copy_paste', 'Copier-coller détecté'),
        ('fullscreen_exit', 'Sortie plein écran'),
        ('camera_off', 'Caméra désactivée'),
        ('multiple_faces', 'Plusieurs visages détectés'),
        # NOUVEAUX
        ('face_not_visible', 'Visage non visible'),
        ('phone_detected', 'Téléphone détecté'),
        ('window_blur', 'Fenêtre en arrière-plan'),
        ('screen_share_stopped', 'Partage écran interrompu'),
        ('time_exceeded', 'Temps dépassé'),
    ]

    interview = models.ForeignKey(AIInterview, on_delete=models.CASCADE, related_name='warnings')
    warning_type = models.CharField(max_length=50, choices=WARNING_CHOICES)
    timestamp = models.DateTimeField(auto_now_add=True)
    details = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"Warning {self.warning_type} — {self.interview}"


# =============================================================================
# MODÈLES POUR RAG - QUESTIONS BASÉES SUR LE PROFIL CANDIDAT
# =============================================================================

class ProfessionalLink(models.Model):
    """Sites professionnels (Bayt, Indeed, Portfolio...)"""
    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name='professional_links'
    )
    platform = models.CharField(max_length=50, help_text="Bayt, Indeed, Portfolio...")
    url = models.URLField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.platform} - {self.application.full_name}"


class Certification(models.Model):
    """Certificats et diplômes additionnels"""
    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name='certifications'
    )
    name = models.CharField(max_length=200, help_text="Nom du certificat")
    issuing_organization = models.CharField(max_length=200, blank=True)
    file = models.FileField(upload_to='certifications/')
    issue_date = models.DateField(null=True, blank=True)
    expiration_date = models.DateField(null=True, blank=True)
    credential_url = models.URLField(blank=True)
    credential_id = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} - {self.application.full_name}"


class RecommendationLetter(models.Model):
    """Lettres de recommandation"""
    RELATION_CHOICES = [
        ('manager', 'Ancien Manager'),
        ('colleague', 'Collègue'),
        ('professor', 'Professeur'),
        ('client', 'Client'),
        ('other', 'Autre'),
    ]

    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name='recommendation_letters'
    )
    recommender_name = models.CharField(max_length=200)
    recommender_position = models.CharField(max_length=200, blank=True)
    recommender_company = models.CharField(max_length=200, blank=True)
    recommender_email = models.EmailField(blank=True)
    recommender_phone = models.CharField(max_length=50, blank=True)
    file = models.FileField(upload_to='recommendations/')
    relationship = models.CharField(max_length=50, choices=RELATION_CHOICES, default='other')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Reco de {self.recommender_name} → {self.application.full_name}"

class EmailVerification(models.Model):
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    email = models.EmailField()
    application = models.OneToOneField(
        'Application',
        on_delete=models.CASCADE,
        related_name='email_verification',
        null=True,  # ← AJOUTE
        blank=True,  # ← AJOUTE
    )
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def save(self, *args, **kwargs):
        if not self.pk:
            self.expires_at = timezone.now() + timedelta(hours=24)
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at