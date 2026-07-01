import logging
from celery import shared_task
from django.core.mail import EmailMultiAlternatives
from django.conf import settings

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# HELPERS EMAIL
# ──────────────────────────────────────────────────────────────────────────────

def _send_email(subject: str, text: str, html: str, to: str) -> None:
    """Envoi centralisé — raise en cas d'échec pour laisser Celery retry."""
    msg = EmailMultiAlternatives(
        subject=subject,
        body=text,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to],
    )
    msg.attach_alternative(html, "text/html")
    msg.send()


def _email_wrapper(title: str, body_html: str) -> str:
    """
    Gabarit commun — table 600px, charte bleu #1a3c6e / blanc / gris très léger.
    Compatible Outlook, Gmail, Apple Mail.
    """
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background-color:#f0f2f5;padding:32px 16px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0"
             style="background-color:#ffffff;border:1px solid #d1d5db;border-radius:4px;
                    overflow:hidden;max-width:600px;">

        <!-- EN-TÊTE -->
        <tr>
          <td style="background-color:#1a3c6e;padding:28px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <p style="margin:0;font-size:11px;color:#a8bbd4;
                             text-transform:uppercase;letter-spacing:1.5px;
                             font-weight:bold;">
                    Système de recrutement
                  </p>
                  <p style="margin:6px 0 0;font-size:18px;color:#ffffff;
                             font-weight:bold;line-height:1.3;">
                    {title}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CORPS -->
        <tr>
          <td style="padding:32px 36px;color:#1f2937;font-size:14px;line-height:1.7;">
            {body_html}
          </td>
        </tr>

        <!-- PIED DE PAGE -->
        <tr>
          <td style="background-color:#f8f9fb;border-top:1px solid #e5e7eb;
                     padding:16px 36px;">
            <p style="margin:0;font-size:11px;color:#6b7280;line-height:1.6;">
              Ce message est généré automatiquement — merci de ne pas y répondre.<br>
              Système de recrutement intelligent &mdash; usage interne confidentiel.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>"""


def _kv_row(label: str, value: str) -> str:
    """Ligne clé/valeur pour les blocs d'information."""
    return f"""
<tr>
  <td width="160" style="padding:8px 12px;vertical-align:top;
                          font-size:13px;color:#6b7280;border-bottom:1px solid #f3f4f6;">
    {label}
  </td>
  <td style="padding:8px 12px;vertical-align:top;
              font-size:13px;color:#111827;font-weight:bold;
              border-bottom:1px solid #f3f4f6;">
    {value}
  </td>
</tr>"""


def _badge(text: str, score: int) -> str:
    """Badge coloré selon le score."""
    if score >= 80:
        bg, fg = "#dcfce7", "#166534"
    elif score >= 60:
        bg, fg = "#dbeafe", "#1e40af"
    else:
        bg, fg = "#fee2e2", "#991b1b"
    return (
        f'<span style="background-color:{bg};color:{fg};'
        f'padding:2px 10px;border-radius:2px;font-size:12px;'
        f'font-weight:bold;">{text}</span>'
    )


def _section_title(text: str) -> str:
    return (
        f'<p style="margin:24px 0 10px;font-size:11px;color:#6b7280;'
        f'text-transform:uppercase;letter-spacing:1.2px;font-weight:bold;'
        f'border-bottom:1px solid #e5e7eb;padding-bottom:6px;">{text}</p>'
    )


def _cta_button(label: str, url: str) -> str:
    return f"""
<table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td style="background-color:#1a3c6e;border-radius:3px;">
      <a href="{url}"
         style="display:inline-block;padding:12px 28px;
                font-size:14px;font-weight:bold;color:#ffffff;
                text-decoration:none;letter-spacing:0.3px;">
        {label}
      </a>
    </td>
  </tr>
</table>"""


# ──────────────────────────────────────────────────────────────────────────────
# TÂCHE PRINCIPALE — TRAITEMENT OFFRES EXPIRÉES
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=3)
def process_expired_offers(self):
    from .models import JobOffer
    try:
        today         = timezone.now().date()
        expired_offers = JobOffer.objects.filter(
            offer_deadline__lte=today,
            is_active=True,
            deadline_processed=False,
        )
        count = expired_offers.count()
        logger.info("%d offre(s) expirée(s) à traiter", count)
        for offer in expired_offers:
            select_top_candidates.delay(offer.id)
        return f"{count} offre(s) traitée(s)"
    except Exception as exc:
        logger.error("Erreur process_expired_offers: %s", exc)
        raise self.retry(exc=exc, countdown=60)


# ──────────────────────────────────────────────────────────────────────────────
# SÉLECTION TOP CANDIDATS
# ──────────────────────────────────────────────────────────────────────────────
import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def select_top_candidates(self, offer_id: int):
    from .models import JobOffer, Application
    try:
        offer = JobOffer.objects.get(id=offer_id)
        limit = (offer.agents_needed or 1) * 25

        # Filtrage : ai_score doit être supérieur ou égal à 40
        top_candidates = Application.objects.filter(
            job_offer=offer,
            ai_score__gte=40
        ).order_by("-ai_score")[:limit]

        selected_count = 0
        for application in top_candidates:
            # Exemple d'intégration de ta logique de décision si nécessaire :
            # decision = "REJECTED" if application.ai_score <= 40 else "TO_REVIEW"

            application.status = "shortlisted"
            application.save()

            if offer.interview_type == "AI":
                create_ai_interview.delay(application.id)
            else:
                notify_rh_interview.delay(application.id)
            selected_count += 1

        notify_rh_selection_summary.delay(offer_id, selected_count)

        offer.deadline_processed = True
        offer.save()

        logger.info("Offre #%d — %d candidat(s) sélectionné(s)", offer_id, selected_count)
        return f"{selected_count} candidats sélectionnés pour offre #{offer_id}"

    except JobOffer.DoesNotExist:
        logger.error("Offre #%d introuvable", offer_id)
    except Exception as exc:
        logger.error("Erreur select_top_candidates #%d: %s", offer_id, exc)
        raise self.retry(exc=exc, countdown=120)
# ──────────────────────────────────────────────────────────────────────────────
# CRÉATION ENTRETIEN IA
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=3)
def create_ai_interview(self, application_id: int):
    from .models import Application, AIInterview
    try:
        application = Application.objects.select_related("job_offer").get(id=application_id)
        if hasattr(application, "ai_interview"):
            logger.warning("Entretien déjà existant pour candidature #%d", application_id)
            return
        interview = AIInterview.objects.create(application=application)
        logger.info("Entretien IA créé #%d pour %s", interview.id, application.full_name)
        send_interview_invitation_email.delay(interview.id)
        return f"Entretien #{interview.id} créé"
    except Application.DoesNotExist:
        logger.error("Candidature #%d introuvable", application_id)
    except Exception as exc:
        logger.error("Erreur create_ai_interview #%d: %s", application_id, exc)
        raise self.retry(exc=exc, countdown=60)


# ──────────────────────────────────────────────────────────────────────────────
# EMAIL 1 — INVITATION ENTRETIEN IA (candidat)
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=3)
def send_interview_invitation_email(self, interview_id: int):
    from .models import AIInterview
    try:
        interview     = AIInterview.objects.select_related(
            "application__job_offer"
        ).get(id=interview_id)
        application   = interview.application
        job           = application.job_offer
        interview_url = f"{settings.FRONTEND_URL}/interview/{interview.token}"
        candidate     = application.full_name
        job_title     = job.title

        subject = f"Convocation — entretien en ligne pour le poste {job_title}"

        # ── Corps HTML ────────────────────────────────────────────────────────
        body = f"""
<p style="margin:0 0 16px;">Madame, Monsieur {candidate},</p>

<p style="margin:0 0 16px;">
  Suite à l'examen de votre candidature pour le poste de
  <strong>{job_title}</strong>, nous avons le plaisir de vous convier
  à un entretien en ligne conduit par notre système d'évaluation automatisé.
</p>

{_cta_button("Accéder à l'entretien", interview_url)}



{_section_title("Modalités de l'entretien")}

<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="border:1px solid #e5e7eb;border-radius:3px;border-collapse:collapse;
              font-size:13px;">
  {_kv_row("Durée estimée", "1h30-1h45")}
  {_kv_row("Matériel requis", "Ordinateur avec caméra et microphone")}
  {_kv_row("Navigateur", "Google Chrome ou Mozilla Firefox (version récente)")}
  {_kv_row("Validité du lien", "24 heures à compter de la réception")}
  {_kv_row("Tentatives", "Une seule session autorisée")}
</table>

{_section_title("Déroulement")}

<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="font-size:13px;color:#374151;">
  <tr>
    <td style="padding:6px 0;">
      <strong>Phase 1</strong> &mdash;Phase Communication (30% du score)
    </td>
  </tr>
  <tr>
    <td style="padding:6px 0;">
      <strong>Phase 2</strong> &mdash; Phase Clarification CV (20% du score)
    </td>
  </tr>
  <tr>
    <td style="padding:6px 0;">
      <strong>Phase 3</strong> &mdash;Phase Technique & Mise en Situation (30% du score)
    </td>
  </tr>
  <tr>
    <td style="padding:6px 0;">
      <strong>Phase 4</strong> &mdash;Phase QCM Technique (20% du score)
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="margin-top:24px;background-color:#fefce8;
              border:1px solid #fbbf24;border-radius:3px;">
  <tr>
    <td style="padding:14px 16px;font-size:13px;color:#78350f;line-height:1.6;">
      Ce lien est strictement personnel et confidentiel.
      Toute transmission à un tiers ou tentative de fraude entraîne
      la disqualification immédiate de la candidature.
    </td>
  </tr>
</table>

<p style="margin:24px 0 0;font-size:13px;color:#374151;">
  Nous vous souhaitons un bon entretien et restons disponibles pour
  toute question d'ordre technique à l'adresse indiquée dans vos documents
  de candidature.
</p>

<p style="margin:16px 0 0;font-size:13px;color:#374151;">
  Cordialement,<br>
  <strong>L'équipe Ressources Humaines</strong>
</p>
"""

        html = _email_wrapper(f"Convocation — {job_title}", body)

        # ── Version texte ──────────────────────────────────────────────────────
        text = (
            f"Madame, Monsieur {candidate},\n\n"
            f"Suite à l'examen de votre candidature pour le poste de {job_title}, "
            f"nous avons le plaisir de vous convier à un entretien en ligne.\n\n"
            f"Lien d'accès : {interview_url}\n\n"
            f"MODALITÉS\n"
            f"- Durée estimée : 45 minutes\n"
            f"- Matériel requis : caméra et microphone\n"
            f"- Navigateur : Chrome ou Firefox\n"
            f"- Validité du lien : 24 heures\n"
            f"- Tentatives autorisées : 1\n\n"
            f"DÉROULEMENT\n"
            f"Phase 1 — Communication et compétences comportementales\n"
            f"Phase 2 — Clarification du parcours professionnel\n"
            f"Phase 3 — Évaluation technique (QCM)\n\n"
            f"Ce lien est strictement personnel et confidentiel.\n\n"
            f"Cordialement,\nL'équipe Ressources Humaines"
        )

        _send_email(subject, text, html, application.email)
        logger.info("Email invitation envoyé à %s (entretien #%d)", application.email, interview_id)
        return f"Email envoyé à {application.email}"

    except Exception as exc:
        logger.error("Erreur send_interview_invitation_email #%d: %s", interview_id, exc)
        raise self.retry(exc=exc, countdown=60)


# ──────────────────────────────────────────────────────────────────────────────
# EMAIL 2 — CONFIRMATION FIN D'ENTRETIEN (candidat)
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=3)
def send_interview_completion_email(self, interview_id: int):
    from .models import AIInterview
    try:
        interview   = AIInterview.objects.select_related(
            "application__job_offer"
        ).get(id=interview_id)
        application = interview.application
        job         = application.job_offer
        score       = interview.ai_interview_score or 0
        candidate   = application.full_name
        job_title   = job.title

        subject = f"Confirmation de participation — entretien {job_title}"

        body = f"""
<p style="margin:0 0 16px;">Madame, Monsieur {candidate},</p>

<p style="margin:0 0 16px;">
  Nous accusons réception de votre entretien en ligne pour le poste de
  <strong>{job_title}</strong>. Votre session a bien été enregistrée
  et transmise à notre équipe pour analyse.
</p>

{_section_title("Récapitulatif")}

<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="border:1px solid #e5e7eb;border-radius:3px;border-collapse:collapse;">
  {_kv_row("Candidat", candidate)}
  {_kv_row("Poste", job_title)}
  {_kv_row("Score obtenu", f"{score} / 100")}
</table>

<p style="margin:24px 0 0;font-size:13px;color:#374151;line-height:1.7;">
  Notre équipe Ressources Humaines examinera l'ensemble des résultats et
  vous communiquera la suite du processus de recrutement dans un délai
  de <strong>48 à 72 heures ouvrées</strong>.
</p>

<p style="margin:16px 0 0;font-size:13px;color:#374151;">
  Nous vous remercions du temps consacré à cette démarche et restons
  à votre disposition pour toute question.
</p>

<p style="margin:16px 0 0;font-size:13px;color:#374151;">
  Cordialement,<br>
  <strong>L'équipe Ressources Humaines</strong>
</p>
"""

        html = _email_wrapper(f"Confirmation de participation — {job_title}", body)

        text = (
            f"Madame, Monsieur {candidate},\n\n"
            f"Nous accusons réception de votre entretien en ligne pour le poste de {job_title}.\n\n"
            f"Score obtenu : {score} / 100\n\n"
            f"Notre équipe vous contactera sous 48 à 72 heures ouvrées.\n\n"
            f"Cordialement,\nL'équipe Ressources Humaines"
        )

        _send_email(subject, text, html, application.email)
        logger.info("Email confirmation entretien envoyé à %s", application.email)
        return f"Email completion envoyé à {application.email}"

    except Exception as exc:
        logger.error("Erreur send_interview_completion_email #%d: %s", interview_id, exc)
        raise self.retry(exc=exc, countdown=60)


# ──────────────────────────────────────────────────────────────────────────────
# EMAIL 3 — NOTIFICATION RH : ENTRETIEN HUMAIN À PLANIFIER
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=3)
def notify_rh_interview(self, application_id: int):
    from .models import Application
    try:
        application = Application.objects.select_related(
            "job_offer__created_by"
        ).get(id=application_id)

        rh        = application.job_offer.created_by
        job       = application.job_offer
        rh_name   = rh.first_name or "Responsable RH"
        job_title = job.title
        score     = application.ai_score or 0

        subject = f"[Action requise] Candidat à contacter — {job_title}"

        body = f"""
<p style="margin:0 0 16px;">Bonjour {rh_name},</p>

<p style="margin:0 0 16px;">
  Un candidat a été sélectionné automatiquement pour le poste
  <strong>{job_title}</strong> et doit être contacté afin de planifier
  un entretien.
</p>

{_section_title("Informations du candidat")}

<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="border:1px solid #e5e7eb;border-radius:3px;border-collapse:collapse;">
  {_kv_row("Nom complet", application.full_name)}
  {_kv_row("Adresse e-mail", application.email)}
  {_kv_row("Téléphone", application.phone or "Non renseigné")}
  {_kv_row("Score IA", f"{score} / 100")}
  {_kv_row("Poste", job_title)}
</table>

<p style="margin:24px 0 0;font-size:13px;color:#374151;">
  Veuillez prendre contact avec ce candidat dans les meilleurs délais
  pour convenir d'une date d'entretien.
</p>

<p style="margin:16px 0 0;font-size:13px;color:#374151;">
  Cordialement,<br>
  <strong>Système de recrutement — notification automatique</strong>
</p>
"""

        html = _email_wrapper(f"Candidat sélectionné — {job_title}", body)

        text = (
            f"Bonjour {rh_name},\n\n"
            f"Un candidat a été sélectionné pour le poste {job_title}.\n\n"
            f"Nom     : {application.full_name}\n"
            f"Email   : {application.email}\n"
            f"Tél.    : {application.phone or 'Non renseigné'}\n"
            f"Score   : {score} / 100\n\n"
            f"Veuillez le contacter pour planifier un entretien.\n\n"
            f"Système de recrutement — notification automatique"
        )

        _send_email(subject, text, html, rh.email)
        logger.info("Notification RH envoyée à %s (candidature #%d)", rh.email, application_id)
        return "Notification RH envoyée"

    except Exception as exc:
        logger.error("Erreur notify_rh_interview #%d: %s", application_id, exc)
        raise self.retry(exc=exc, countdown=60)


# ──────────────────────────────────────────────────────────────────────────────
# EMAIL 4 — RÉSUMÉ DE SÉLECTION (RH)
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=3)
def notify_rh_selection_summary(self, offer_id: int, selected_count: int):
    from .models import JobOffer, Application
    try:
        offer     = JobOffer.objects.select_related("created_by").get(id=offer_id)
        rh        = offer.created_by
        rh_name   = rh.first_name or "Responsable RH"
        job_title = offer.title
        itw_type  = offer.interview_type
        nb_postes = offer.agents_needed or 1

        selected = Application.objects.filter(
            job_offer=offer,
            status="shortlisted",
        ).order_by("-ai_score")

        # Tableau des candidats
        rows = ""
        for i, app in enumerate(selected, start=1):
            score     = app.ai_score or 0
            decision  = app.ai_decision or "—"
            score_badge = _badge(f"{score}/100", score)
            if decision == "TO_REVIEW":
                dec_bg, dec_fg = "#fef9c3", "#854d0e"

            else:
                dec_bg, dec_fg = "#fee2e2", "#991b1b"

            rows += f"""
<tr style="{'background-color:#f9fafb;' if i % 2 == 0 else ''}">
  <td style="padding:10px 12px;font-size:13px;color:#374151;
              border-bottom:1px solid #f3f4f6;">{i}</td>
  <td style="padding:10px 12px;font-size:13px;color:#111827;font-weight:bold;
              border-bottom:1px solid #f3f4f6;">{app.full_name}</td>
  <td style="padding:10px 12px;font-size:13px;color:#374151;
              border-bottom:1px solid #f3f4f6;">{app.email}</td>
  <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #f3f4f6;">
    {score_badge}
  </td>
  <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #f3f4f6;">
    <span style="background-color:{dec_bg};color:{dec_fg};
                 padding:2px 10px;border-radius:2px;font-size:12px;
                 font-weight:bold;">{decision}</span>
  </td>
</tr>"""

        itw_note = (
            "Les candidats sélectionnés ont reçu un lien d'accès sécurisé par e-mail. "
            "Vous serez notifié(e) à l'issue de chaque entretien avec le rapport détaillé."
            if itw_type == "AI" else
            "Veuillez contacter les candidats listés ci-dessous afin de planifier les entretiens."
        )

        body = f"""
<p style="margin:0 0 16px;">Bonjour {rh_name},</p>

<p style="margin:0 0 16px;">
  La date limite de l'offre <strong>{job_title}</strong> est désormais dépassée.
  L'analyse automatisée des candidatures est terminée&nbsp;:
  <strong>{selected_count} profil(s)</strong> ont été retenus sur la base
  des scores IA.
</p>

{_section_title("Synthèse")}

<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="border-collapse:collapse;">
  <tr>
    <td width="33%" style="padding:0 8px 0 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border:1px solid #e5e7eb;border-radius:3px;">
        <tr>
          <td style="padding:16px;text-align:center;">
            <p style="margin:0;font-size:28px;font-weight:bold;color:#1a3c6e;">
              {selected_count}
            </p>
            <p style="margin:4px 0 0;font-size:11px;color:#6b7280;
                       text-transform:uppercase;letter-spacing:0.8px;">
              Candidats retenus
            </p>
          </td>
        </tr>
      </table>
    </td>
    <td width="33%" style="padding:0 4px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border:1px solid #e5e7eb;border-radius:3px;">
        <tr>
          <td style="padding:16px;text-align:center;">
            <p style="margin:0;font-size:28px;font-weight:bold;color:#1a3c6e;">
              {nb_postes}
            </p>
            <p style="margin:4px 0 0;font-size:11px;color:#6b7280;
                       text-transform:uppercase;letter-spacing:0.8px;">
              Poste(s) à pourvoir
            </p>
          </td>
        </tr>
      </table>
    </td>
    <td width="33%" style="padding:0 0 0 8px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border:1px solid #e5e7eb;border-radius:3px;">
        <tr>
          <td style="padding:16px;text-align:center;">
            <p style="margin:0;font-size:14px;font-weight:bold;color:#1a3c6e;">
              {itw_type}
            </p>
            <p style="margin:4px 0 0;font-size:11px;color:#6b7280;
                       text-transform:uppercase;letter-spacing:0.8px;">
              Type d'entretien
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

{_section_title("Liste des candidats retenus")}

<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="border:1px solid #e5e7eb;border-radius:3px;border-collapse:collapse;
              font-size:13px;">
  <thead>
    <tr style="background-color:#f3f4f6;">
      <th style="padding:10px 12px;text-align:left;color:#6b7280;
                  font-weight:bold;font-size:11px;text-transform:uppercase;
                  letter-spacing:0.8px;border-bottom:1px solid #e5e7eb;">#</th>
      <th style="padding:10px 12px;text-align:left;color:#6b7280;
                  font-weight:bold;font-size:11px;text-transform:uppercase;
                  letter-spacing:0.8px;border-bottom:1px solid #e5e7eb;">Nom</th>
      <th style="padding:10px 12px;text-align:left;color:#6b7280;
                  font-weight:bold;font-size:11px;text-transform:uppercase;
                  letter-spacing:0.8px;border-bottom:1px solid #e5e7eb;">Email</th>
      <th style="padding:10px 12px;text-align:center;color:#6b7280;
                  font-weight:bold;font-size:11px;text-transform:uppercase;
                  letter-spacing:0.8px;border-bottom:1px solid #e5e7eb;">Score</th>
      <th style="padding:10px 12px;text-align:center;color:#6b7280;
                  font-weight:bold;font-size:11px;text-transform:uppercase;
                  letter-spacing:0.8px;border-bottom:1px solid #e5e7eb;">Décision</th>
    </tr>
  </thead>
  <tbody>
    {rows}
  </tbody>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="margin-top:24px;background-color:#eff6ff;
              border:1px solid #bfdbfe;border-radius:3px;">
  <tr>
    <td style="padding:14px 16px;font-size:13px;color:#1e40af;line-height:1.6;">
      <strong>Prochaine étape&nbsp;:</strong> {itw_note}
    </td>
  </tr>
</table>

<p style="margin:24px 0 0;font-size:13px;color:#374151;">
  Cordialement,<br>
  <strong>Système de recrutement — notification automatique</strong>
</p>
"""

        html = _email_wrapper(f"Sélection automatique — {job_title}", body)

        text = (
            f"Bonjour {rh_name},\n\n"
            f"Sélection terminée pour le poste {job_title}.\n"
            f"{selected_count} candidat(s) retenu(s) — {nb_postes} poste(s) à pourvoir.\n\n"
            "CANDIDATS RETENUS\n"
            + "\n".join(
                f"{i}. {app.full_name} <{app.email}> — {app.ai_score or 0}/100 — {app.ai_decision or '—'}"
                for i, app in enumerate(selected, start=1)
            )
            + f"\n\nProchaine étape : {itw_note}\n\n"
            "Système de recrutement — notification automatique"
        )

        _send_email(
            f"[Recrutement] {selected_count} candidats sélectionnés — {job_title}",
            text, html, rh.email,
        )
        logger.info("Email résumé RH envoyé à %s", rh.email)

    except Exception as exc:
        logger.error("Erreur notify_rh_selection_summary: %s", exc)
        raise self.retry(exc=exc, countdown=60)


# ──────────────────────────────────────────────────────────────────────────────
# EMAIL 5 — RÉSULTAT ENTRETIEN IA (RH)
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=3)
def notify_rh_interview_completed(self, interview_id: int):
    from .models import AIInterview
    try:
        interview = AIInterview.objects.select_related(
            "application__job_offer__created_by"
        ).get(id=interview_id)

        app       = interview.application
        rh        = app.job_offer.created_by
        rh_name   = rh.first_name or "Responsable RH"
        job_title = app.job_offer.title
        score     = interview.ai_interview_score or 0
        comm      = interview.communication_score or 0
        clarif    = interview.clarification_score or 0
        qcm       = interview.qcm_score or 0
        duration  = interview.duration_minutes or 0
        warnings  = interview.warnings.count()
        feedback  = interview.ai_interview_feedback or "Aucun commentaire disponible."

        subject = f"[Entretien terminé] {app.full_name} — {score}/100 — {job_title}"

        body = f"""
<p style="margin:0 0 16px;">Bonjour {rh_name},</p>

<p style="margin:0 0 16px;">
  Le candidat <strong>{app.full_name}</strong> vient de terminer son entretien
  en ligne pour le poste <strong>{job_title}</strong>.
  Vous trouverez ci-dessous le rapport détaillé.
</p>

{_section_title("Score global")}

<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="padding:20px 0;text-align:center;">
      <table cellpadding="0" cellspacing="0" border="0"
             style="margin:0 auto;border:2px solid #1a3c6e;border-radius:3px;">
        <tr>
          <td style="padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:48px;font-weight:bold;color:#1a3c6e;
                       line-height:1;">{score}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#6b7280;
                       text-transform:uppercase;letter-spacing:1px;">sur 100</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

{_section_title("Détail par phase")}

<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="border:1px solid #e5e7eb;border-radius:3px;border-collapse:collapse;">
  {_kv_row("Communication", f"{comm} / 100")}
  {_kv_row("Clarification CV", f"{clarif} / 100")}
  {_kv_row("QCM technique", f"{qcm} / 100")}
  {_kv_row("Durée de session", f"{duration} minutes")}
  {_kv_row("Alertes détectées", f"{warnings} alerte(s)")}
</table>

{_section_title("Évaluation IA")}

<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background-color:#f8f9fb;border:1px solid #e5e7eb;border-radius:3px;">
  <tr>
    <td style="padding:16px;font-size:13px;color:#374151;line-height:1.7;">
      {feedback}
    </td>
  </tr>
</table>

{'<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;background-color:#fef2f2;border:1px solid #fecaca;border-radius:3px;"><tr><td style="padding:14px 16px;font-size:13px;color:#991b1b;line-height:1.6;"><strong>Attention :</strong> ' + str(warnings) + " alerte(s) de fraude détectée(s) durant la session. Veuillez examiner l'enregistrement avant toute décision.</td></tr></table>" if warnings > 0 else ""}

<p style="margin:24px 0 0;font-size:13px;color:#374151;">
  Cordialement,<br>
  <strong>Système de recrutement — notification automatique</strong>
</p>
"""

        html = _email_wrapper(f"Rapport d'entretien — {app.full_name}", body)

        text = (
            f"Bonjour {rh_name},\n\n"
            f"{app.full_name} a terminé son entretien pour le poste {job_title}.\n\n"
            f"SCORES\n"
            f"Score global      : {score} / 100\n"
            f"Communication     : {comm} / 100\n"
            f"Clarification CV  : {clarif} / 100\n"
            f"QCM technique     : {qcm} / 100\n"
            f"Durée             : {duration} minutes\n"
            f"Alertes fraude    : {warnings}\n\n"
            f"ÉVALUATION IA\n{feedback}\n\n"
            + (f"ATTENTION : {warnings} alerte(s) détectée(s).\n\n" if warnings > 0 else "")
            + "Système de recrutement — notification automatique"
        )

        _send_email(subject, text, html, rh.email)
        logger.info("Email résultat entretien envoyé au RH %s", rh.email)

    except Exception as exc:
        logger.error("Erreur notify_rh_interview_completed #%d: %s", interview_id, exc)
        raise self.retry(exc=exc, countdown=60)
from django.utils import timezone
from datetime import timedelta

@shared_task(bind=True, max_retries=5, default_retry_delay=60)
def generate_qcm_task(self, interview_id: int):
    from .models import AIInterview
    from services.ai_interview_service import generate_qcm

    try:
        interview = AIInterview.objects.select_related('application__job_offer').get(id=interview_id)
    except AIInterview.DoesNotExist:
        logger.error(f"[QCM-Task] AIInterview {interview_id} introuvable")
        return

    if interview.qcm_questions:
        logger.info(f"[QCM-Task] QCM déjà présent pour interview {interview_id}, skip")
        return

    application = interview.application
    job_offer = application.job_offer

    try:
        qcm_result = generate_qcm(
            job_title=job_offer.title,
            requirements=getattr(job_offer, 'requirements', ''),
            num_questions=20,
            candidate_id=str(application.id),
        )
        questions = qcm_result.get("questions", [])

        interview.qcm_questions = questions
        interview.save(update_fields=['qcm_questions'])
        logger.info(f"[QCM-Task] {len(questions)} questions générées pour interview {interview_id}")

        job_offer.cached_qcm_questions = questions
        job_offer.cached_qcm_generated_at = timezone.now()
        job_offer.save(update_fields=['cached_qcm_questions', 'cached_qcm_generated_at'])

    except Exception as exc:
        logger.error(f"[QCM-Task] Erreur génération QCM interview {interview_id}: {exc}")
        countdown = 60 * (2 ** self.request.retries)
        try:
            raise self.retry(exc=exc, countdown=countdown)
        except self.MaxRetriesExceededError:
            _handle_qcm_final_failure(interview, job_offer, str(exc))


def _handle_qcm_final_failure(interview, job_offer, error_reason: str):
    cache_fresh = (
        job_offer.cached_qcm_questions
        and job_offer.cached_qcm_generated_at
        and (timezone.now() - job_offer.cached_qcm_generated_at) < timedelta(days=30)
    )

    if cache_fresh:
        interview.qcm_questions = job_offer.cached_qcm_questions
        interview.qcm_from_cache = True
        interview.save(update_fields=['qcm_questions', 'qcm_from_cache'])
        logger.warning(f"[QCM-Task] Échec Groq — QCM en cache réutilisé pour interview {interview.id}")
        send_qcm_incident_email.delay(
            interview_id=interview.id, severity='warning',
            reason=error_reason,
            detail="QCM en cache réutilisé (questions identiques à un précédent candidat)."
        )
    else:
        interview.qcm_questions = []
        interview.qcm_skipped = True
        interview.qcm_score = None
        interview.save(update_fields=['qcm_questions', 'qcm_skipped', 'qcm_score'])
        logger.error(f"[QCM-Task] Échec définitif sans cache — phase QCM ignorée pour interview {interview.id}")
        send_qcm_incident_email.delay(
            interview_id=interview.id, severity='critical',
            reason=error_reason,
            detail="Phase QCM ignorée — aucun cache disponible. Score recalculé sans QCM."
        )


@shared_task
def send_qcm_incident_email(interview_id: int, severity: str, reason: str, detail: str):
    from .models import AIInterview
    from django.core.mail import send_mail
    from django.conf import settings

    try:
        interview = AIInterview.objects.select_related(
            'application__job_offer', 'application'
        ).get(id=interview_id)
    except AIInterview.DoesNotExist:
        return

    candidate = interview.application
    job_title = interview.application.job_offer.title
    hr_email = getattr(interview.application.job_offer, 'created_by', None)
    hr_email = getattr(hr_email, 'email', None)
    if not hr_email:
        logger.error(f"[QCM-Incident] Pas d'email RH trouvé pour interview {interview_id}")
        return

    subject = f"⚠️ Incident QCM — Entretien #{interview.id} ({job_title})"
    body = (
        f"Une anomalie technique s'est produite pendant l'entretien IA.\n\n"
        f"Candidat : {candidate.full_name} ({candidate.email})\n"
        f"Poste : {job_title}\n"
        f"Entretien ID : {interview.id}\n"
        f"Sévérité : {severity}\n"
        f"Raison technique : {reason}\n\n"
        f"Action prise automatiquement : {detail}\n\n"
        f"Merci de vérifier le rapport final avant toute décision basée sur ce score."
    )

    send_mail(
        subject=subject, message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[hr_email], fail_silently=True,
    )
    logger.info(f"[QCM-Incident] Email envoyé à {hr_email} pour interview {interview.id}")

@shared_task(bind=True, max_retries=2, default_retry_delay=120)
def fetch_github_code_samples_task(self, application_id: int):
    from .models import Application
    from services.ai_service import IntelligentCVAnalyzer

    try:
        application = Application.objects.get(id=application_id)
    except Application.DoesNotExist:
        return

    if not application.github_url or application.github_code_samples:
        return

    try:
        analyzer = IntelligentCVAnalyzer()
        github_data = application.github_data or {}

        top_repos = github_data.get("top_repos") or github_data.get("repositories", [])

        samples = analyzer.fetch_github_code_samples(
            github_url=str(application.github_url),
            top_repos=top_repos,
            job_offer=application.job_offer,

        )

        application.github_code_samples = samples
        application.github_code_fetched_at = timezone.now()
        application.save(update_fields=['github_code_samples', 'github_code_fetched_at'])

        logger.info(f"[GitHubCode-Task] {len(samples)} fichiers sauvegardés pour application {application_id}")

    except Exception as exc:
        logger.error(f"[GitHubCode-Task] Erreur application {application_id}: {exc}")
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            application.github_code_samples = []
            application.save(update_fields=['github_code_samples'])


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def generate_scenario_questions_task(self, interview_id: int):
    from .models import AIInterview
    from services.ai_interview_service import generate_scenario_questions

    try:
        interview = AIInterview.objects.select_related(
            'application__job_offer'
        ).get(id=interview_id)

        if interview.scenario_questions:
            logger.info(f"[ScenarioTask] Scénarios déjà générés pour interview {interview_id}")
            return

        questions = generate_scenario_questions(interview.application)
        interview.scenario_questions = questions
        interview.save(update_fields=['scenario_questions'])
        logger.info(f"[ScenarioTask] {len(questions)} scénarios générés pour interview {interview_id}")

    except Exception as exc:
        logger.error(f"[ScenarioTask] Erreur interview {interview_id}: {exc}")
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            # Fallback — générer avec les fallbacks uniquement
            from services.ai_interview_service import (
                _build_candidate_profile, _fallback_scenario
            )
            interview = AIInterview.objects.get(id=interview_id)
            p = _build_candidate_profile(interview.application)
            interview.scenario_questions = [
                {
                    "question":            _fallback_scenario(i, p),
                    "theme":               f"scenario_{i}",
                    "time_limit_seconds":  7 * 60,
                    "phase":               "scenario",
                    "question_index":      i,
                    "evaluation_criteria": [],
                }
                for i in range(4)
            ]
            interview.save(update_fields=['scenario_questions'])
            logger.warning(f"[ScenarioTask] Fallback utilisé pour interview {interview_id}")