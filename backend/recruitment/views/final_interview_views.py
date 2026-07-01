from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.core.mail import EmailMultiAlternatives
from django.conf import settings

from ..models import Application, AIInterview, InterviewInvitation
from ..permissions import IsRHOrAdmin
import logging
from django.utils.dateparse import parse_date, parse_time
logger = logging.getLogger(__name__)
logger = logging.getLogger(__name__)


class QualifiedCandidatesView(APIView):
    """
    GET /recruitment/rh/qualified-candidates/
    Returns all candidates with AI interview score >= 70, grouped by job offer.
    Supports optional ?offer_id=X filter.
    """
    permission_classes = [permissions.IsAuthenticated, IsRHOrAdmin]

    def get(self, request):
        offer_id = request.query_params.get('offer_id')

        # Base queryset: candidates with completed AI interviews scoring >= 70
        interviews_qs = (
            AIInterview.objects
            .select_related('application__job_offer')
            .filter(
                status='completed',
                ai_interview_score__gte=70,
                application__job_offer__created_by=request.user
            )
            .exclude(application__status='hired')
            .order_by('-ai_interview_score')
        )



        if offer_id:
            interviews_qs = interviews_qs.filter(
                application__job_offer_id=offer_id
            )

        results = []
        for interview in interviews_qs:
            app = interview.application
            job = app.job_offer

            # Check invitation status
            invitation = InterviewInvitation.objects.filter(
                application=app
            ).order_by('-created_at').first()

            # Build video URL if exists
            # Build video URL if exists
            video_url = interview.video_url or None
            # AI analysis synthesis
            ai_analysis = self._build_ai_analysis(interview, app)

            results.append({
                # Candidate info
                'application_id': app.id,
                'full_name': app.full_name,
                'email': app.email,
                'phone': app.phone,
                'nationality': app.nationality,
                'current_location': app.current_location,
                'university': app.university,
                'degree_level': app.degree_level,
                'graduation_year': app.graduation_year,
                'experience_years': app.experience_years,
                'linkedin_url': app.linkedin_url,
                'github_url': app.github_url,
                'salary_expectation': app.salary_expectation,
                'availability_date': str(app.availability_date) if app.availability_date else None,
                'applied_date': app.applied_date,
                'cv_file_url': request.build_absolute_uri(app.cv_file.url) if app.cv_file else None,
                'cover_letter_url': request.build_absolute_uri(app.cover_letter_file.url) if app.cover_letter_file else None,

                # AI screening scores
                'ai_score': app.ai_score,
                'ai_summary': app.ai_summary,
                'ai_decision': app.ai_decision,
                'ai_strengths': app.ai_strengths,
                'ai_weaknesses': app.ai_weaknesses,
                'ai_missing_skills': app.ai_missing_skills,
                'ai_recommendations': app.ai_recommendations,

                # Interview scores
                'interview_id': interview.id,
                'interview_token': str(interview.token),
                'ai_interview_score': interview.ai_interview_score,
                'communication_score': interview.communication_score,
                'clarification_score': interview.clarification_score,
                'qcm_score': interview.qcm_score,
                'ai_interview_feedback': interview.ai_interview_feedback,
                'warnings_count': interview.warnings.count(),
                'interview_duration': interview.duration_minutes,
                'completed_at': interview.completed_at,

                # Video
                'video_url': video_url,
                'has_video': bool(interview.video_url),
                # Job info
                'job_offer_id': job.id,
                'job_title': job.title,
                'job_location': job.location,
                'job_contract_type': job.contract_type,

                # AI global analysis
                'ai_analysis': ai_analysis,

                # Invitation status
                'invitation_status': invitation.status if invitation else None,
                'invitation_id': invitation.id if invitation else None,
                'invitation_date': str(invitation.interview_date) if invitation else None,
            })

        return Response({
            'count': len(results),
            'results': results
        })

    def _build_ai_analysis(self, interview, app):
        """Build a comprehensive AI analysis summary."""
        score = interview.ai_interview_score or 0
        comm = interview.communication_score or 0
        clarif = interview.clarification_score or 0
        qcm = interview.qcm_score or 0
        warnings = interview.warnings.count()

        # Determine overall verdict
        if score >= 85:
            verdict = 'HIGHLY_RECOMMENDED'
            verdict_label = 'Hautement recommandé'
            verdict_color = 'emerald'
        elif score >= 70:
            verdict = 'RECOMMENDED'
            verdict_label = 'Recommandé'
            verdict_color = 'blue'
        else:
            verdict = 'NEUTRAL'
            verdict_label = 'Neutre'
            verdict_color = 'amber'

        # Fraud risk
        if warnings == 0:
            fraud_risk = 'LOW'
            fraud_label = 'Aucun risque détecté'
        elif warnings <= 2:
            fraud_risk = 'MEDIUM'
            fraud_label = f'{warnings} avertissement(s)'
        else:
            fraud_risk = 'HIGH'
            fraud_label = f'{warnings} avertissements — risque élevé'

        # Strengths analysis
        strengths = []
        if comm >= 80:
            strengths.append('Excellente communication verbale')
        if clarif >= 75:
            strengths.append('Bonne cohérence avec le CV')
        if qcm >= 80:
            strengths.append('Solides compétences techniques')
        if app.experience_years and app.experience_years >= 3:
            strengths.append(f'{app.experience_years} ans d\'expérience pertinente')
        if app.github_verified:
            strengths.append('Profil GitHub vérifié')
        if app.linkedin_verified:
            strengths.append('Profil LinkedIn vérifié')

        # Add AI strengths from screening
        if app.ai_strengths:
            strengths.extend(app.ai_strengths[:2])

        # Areas to explore
        areas_to_explore = []
        if comm < 70:
            areas_to_explore.append('Communication à approfondir')
        if clarif < 65:
            areas_to_explore.append('Clarifications CV nécessaires')
        if qcm < 70:
            areas_to_explore.append('Compétences techniques à vérifier')
        if app.ai_weaknesses:
            areas_to_explore.extend(app.ai_weaknesses[:2])

        # Final recommendation text
        # Final recommendation text
        if score >= 80 and warnings == 0:
            recommendation = (
                f"{app.full_name} a réalisé un entretien exceptionnel avec un score de {score}/100. "
                "Les réponses sont cohérentes, les compétences techniques sont solides et aucune anomalie "
                "n'a été détectée. Ce profil est fortement recommandé pour un entretien final."
            )

        elif score >= 70:
            extra_text = (
                "Quelques points méritent d'être approfondis lors d'un entretien final."
                if areas_to_explore
                else "Le profil correspond globalement aux attentes du poste."
            )

            recommendation = (
                f"{app.full_name} présente un profil intéressant avec {score}/100. "
                f"{extra_text}"
            )

        else:
            recommendation = (
                f"Profil à évaluer davantage. Score de {score}/100 avec "
                f"{'des signaux de vigilance détectés.' if warnings > 0 else 'des compétences à consolider.'}"
            )

        return {
            'verdict': verdict,
            'verdict_label': verdict_label,
            'verdict_color': verdict_color,
            'fraud_risk': fraud_risk,
            'fraud_label': fraud_label,
            'overall_score': score,
            'score_breakdown': {
                'communication': comm,
                'cv_coherence': clarif,
                'technical': qcm,
            },
            'strengths': strengths[:5],
            'areas_to_explore': areas_to_explore[:3],
            'recommendation': recommendation,
            'interview_feedback': interview.ai_interview_feedback,
        }


class SendInterviewInvitationView(APIView):
    """
    POST /recruitment/rh/send-invitation/
    Send a final interview invitation email to a candidate.
    """
    permission_classes = [permissions.IsAuthenticated, IsRHOrAdmin]

    def post(self, request):
        application_id = request.data.get('application_id')
        raw_date = request.data.get('interview_date')
        raw_time = request.data.get('interview_time')
        meeting_link = request.data.get('meeting_link', '')
        interviewer_name = request.data.get('interviewer_name', '')
        location = request.data.get('location', '')

        # Validate required fields
        if not all([application_id, raw_date, raw_time, interviewer_name]):
            return Response(
                {'error': 'Champs requis : application_id, interview_date, interview_time, interviewer_name'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Convertir les chaînes en objets date et time
        interview_date = parse_date(raw_date)
        interview_time = parse_time(raw_time)

        if not interview_date or not interview_time:
            return Response(
                {'error': 'Format de date (YYYY-MM-DD) ou heure (HH:MM) invalide.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        application = get_object_or_404(
            Application,
            id=application_id,
            job_offer__created_by=request.user
        )

        # Create the invitation record
        invitation = InterviewInvitation.objects.create(
            application=application,
            invited_by=request.user,
            interview_date=interview_date,
            interview_time=interview_time,
            meeting_link=meeting_link or location,
            interviewer_name=interviewer_name,
            status='sent',
            sent_at=timezone.now()
        )

        # Send email
        try:
            self._send_invitation_email(invitation, application, location or meeting_link)
            logger.info(f"Invitation email sent to {application.email}")
        except Exception as e:
            logger.error(f"Email send error: {e}")
            invitation.status = 'pending'
            invitation.save()
            return Response(
                {'error': f'Invitation créée mais email non envoyé: {str(e)}'},
                status=status.HTTP_207_MULTI_STATUS
            )

        return Response({
            'success': True,
            'invitation_id': invitation.id,
            'message': f'Invitation envoyée avec succès à {application.email}',
        }, status=status.HTTP_201_CREATED)

    def _send_invitation_email(self, invitation, application, location):
        job = application.job_offer

        # Format date/time nicely
        from datetime import datetime
        date_obj = invitation.interview_date
        time_obj = invitation.interview_time

        DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
        MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

        date_str = f"{DAYS[date_obj.weekday()]} {date_obj.day} {MONTHS[date_obj.month - 1]} {date_obj.year}"
        time_str = f"{str(time_obj.hour).zfill(2)}h{str(time_obj.minute).zfill(2)}"

        is_online = bool(invitation.meeting_link and (
            'http' in invitation.meeting_link or
            'meet.' in invitation.meeting_link or
            'zoom.' in invitation.meeting_link or
            'teams.' in invitation.meeting_link
        ))

        location_label = "Lien visioconférence" if is_online else "Lieu"
        location_icon = "🎥" if is_online else "📍"

        subject = f"Invitation à un entretien final — {job.title}"

        html_content = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #f0f4f8; padding: 32px 16px; }}
  .wrapper {{ max-width: 620px; margin: 0 auto; }}
  .card {{ background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.12); }}
  .header {{ background: linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 50%, #1a8fe3 100%); padding: 48px 40px; text-align: center; position: relative; }}
  .header::before {{ content: ''; position: absolute; inset: 0; background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E"); }}
  .badge {{ display: inline-block; background: rgba(255,255,255,0.15); color: white; font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; padding: 6px 16px; border-radius: 999px; margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.25); }}
  .header h1 {{ color: white; font-size: 26px; font-weight: 700; line-height: 1.3; margin-bottom: 8px; }}
  .header p {{ color: rgba(255,255,255,0.8); font-size: 15px; }}
  .body {{ padding: 40px; }}
  .greeting {{ font-size: 17px; color: #1e293b; margin-bottom: 16px; font-weight: 600; }}
  .intro {{ color: #475569; line-height: 1.7; margin-bottom: 32px; font-size: 15px; }}
  .details-card {{ background: linear-gradient(135deg, #f8faff, #eef4ff); border: 1px solid #c7d9f5; border-radius: 12px; padding: 28px; margin-bottom: 28px; }}
  .details-title {{ font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #2d6a9f; margin-bottom: 20px; }}
  .detail-row {{ display: flex; align-items: flex-start; gap: 14px; padding: 12px 0; border-bottom: 1px solid rgba(199,217,245,0.6); }}
  .detail-row:last-child {{ border-bottom: none; padding-bottom: 0; }}
  .detail-icon {{ font-size: 20px; flex-shrink: 0; margin-top: 1px; }}
  .detail-label {{ font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 3px; font-weight: 600; }}
  .detail-value {{ font-size: 15px; color: #1e293b; font-weight: 600; }}
  .cta-section {{ text-align: center; margin: 32px 0; }}
  .confirm-btn {{ display: inline-block; background: linear-gradient(135deg, #1e3a5f, #2d6a9f); color: white; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-size: 16px; font-weight: 700; letter-spacing: 0.5px; box-shadow: 0 4px 16px rgba(45,106,159,0.35); }}
  .notice-box {{ background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px; padding: 16px 20px; margin-top: 24px; }}
  .notice-box p {{ color: #92400e; font-size: 13px; line-height: 1.6; }}
  .footer {{ background: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0; }}
  .footer p {{ color: #94a3b8; font-size: 12px; text-align: center; line-height: 1.8; }}
  .footer strong {{ color: #64748b; }}
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <div class="badge">Entretien Final</div>
      <h1>Félicitations, vous êtes sélectionné(e) !</h1>
      <p>Poste : {job.title}</p>
    </div>
    <div class="body">
      <p class="greeting">Bonjour {application.full_name},</p>
      <p class="intro">
        Suite à votre entretien en ligne, nous avons le plaisir de vous convier à un
        <strong>entretien final</strong> pour le poste de <strong>{job.title}</strong>.
        Veuillez trouver ci-dessous toutes les informations nécessaires.
      </p>

      <div class="details-card">
        <div class="details-title">📋 Détails de votre entretien</div>

        <div class="detail-row">
          <div class="detail-icon">📅</div>
          <div>
            <div class="detail-label">Date</div>
            <div class="detail-value">{date_str}</div>
          </div>
        </div>

        <div class="detail-row">
          <div class="detail-icon">⏰</div>
          <div>
            <div class="detail-label">Heure</div>
            <div class="detail-value">{time_str}</div>
          </div>
        </div>

        <div class="detail-row">
          <div class="detail-icon">{location_icon}</div>
          <div>
            <div class="detail-label">{location_label}</div>
            <div class="detail-value">{'<a href="' + location + '" style="color:#2d6a9f">' + location + '</a>' if is_online else location}</div>
          </div>
        </div>

        <div class="detail-row">
          <div class="detail-icon">👤</div>
          <div>
            <div class="detail-label">Vous rencontrerez</div>
            <div class="detail-value">{invitation.interviewer_name}</div>
          </div>
        </div>
      </div>

      <div class="notice-box">
        <p>
          ⚠️ <strong>Important :</strong> Merci de vous présenter 5 minutes avant l'heure indiquée.
          Pour un entretien en visioconférence, vérifiez votre connexion internet et votre matériel
          (caméra, microphone) à l'avance.
        </p>
      </div>
    </div>
    <div class="footer">
      <p>
        Cet email vous a été envoyé par <strong>{invitation.invited_by.get_full_name() or invitation.invited_by.username}</strong><br>
        Si vous avez des questions, répondez directement à cet email.<br>
        <strong>© {job.title} — Recrutement</strong>
      </p>
    </div>
  </div>
</div>
</body>
</html>"""

        text_content = (
            f"Bonjour {application.full_name},\n\n"
            f"Vous êtes invité(e) à un entretien final pour le poste : {job.title}\n\n"
            f"Date : {date_str}\n"
            f"Heure : {time_str}\n"
            f"{location_label} : {location}\n"
            f"Interviewer : {invitation.interviewer_name}\n\n"
            f"Merci de confirmer votre présence.\n\n"
            f"Cordialement,\n{invitation.invited_by.get_full_name()}"
        )

        email = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[application.email],
            reply_to=[invitation.invited_by.email] if invitation.invited_by.email else []
        )
        email.attach_alternative(html_content, "text/html")
        email.send()


class InvitationListView(APIView):
    """GET /recruitment/rh/invitations/ — list all invitations sent by RH"""
    permission_classes = [permissions.IsAuthenticated, IsRHOrAdmin]

    def get(self, request):
        invitations = InterviewInvitation.objects.select_related(
            'application__job_offer', 'invited_by'
        ).filter(
            invited_by=request.user
        ).order_by('-created_at')

        data = [{
            'id': inv.id,
            'candidate_name': inv.application.full_name,
            'candidate_email': inv.application.email,
            'job_title': inv.application.job_offer.title,
            'interview_date': inv.interview_date,
            'interview_time': inv.interview_time,
            'meeting_link': inv.meeting_link,
            'interviewer_name': inv.interviewer_name,
            'status': inv.status,
            'sent_at': inv.sent_at,
            'application_id': inv.application.id,
        } for inv in invitations]

        return Response(data)