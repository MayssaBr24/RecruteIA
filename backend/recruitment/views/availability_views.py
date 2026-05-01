
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from datetime import datetime, timedelta, date as date_cls
from django.utils import timezone
from django.db.models import Count, Avg, Q

from ..models import (
    RHAvailability, RHAvailabilityException,
    RHSettings, JobOffer, Application, RHNote
)
from ..serializers import (
    RHAvailabilitySerializer,
    RHAvailabilityExceptionSerializer,
    RHSettingsSerializer,
)
from ..permissions import IsRHUser


# ══════════════════════════════════════════════════════════════
# DISPONIBILITÉS
# ══════════════════════════════════════════════════════════════

class RHAvailabilityListCreateView(generics.ListCreateAPIView):
    """Liste et création des disponibilités RH"""
    serializer_class   = RHAvailabilitySerializer
    permission_classes = [IsAuthenticated, IsRHUser]

    def get_queryset(self):
        return RHAvailability.objects.filter(rh_user=self.request.user, is_active=True)

    def perform_create(self, serializer):
        specific_date = self.request.data.get('specific_date')

        # ✅ Fix bug affichage : si créneau unique créé → supprimer l'exception de ce jour
        if specific_date:
            RHAvailabilityException.objects.filter(
                rh_user=self.request.user,
                date=specific_date
            ).delete()

        serializer.save(rh_user=self.request.user)


class RHAvailabilityDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Détail, modification et suppression d'une disponibilité"""
    serializer_class   = RHAvailabilitySerializer
    permission_classes = [IsAuthenticated, IsRHUser]

    def get_queryset(self):
        return RHAvailability.objects.filter(rh_user=self.request.user)

    def perform_destroy(self, instance):
        # Soft delete
        instance.is_active = False
        instance.save()


# ══════════════════════════════════════════════════════════════
# EXCEPTIONS
# ══════════════════════════════════════════════════════════════

class RHExceptionCreateView(generics.ListCreateAPIView):
    """Création et liste des exceptions de disponibilité"""
    serializer_class   = RHAvailabilityExceptionSerializer
    permission_classes = [IsAuthenticated, IsRHUser]

    def get_queryset(self):
        return RHAvailabilityException.objects.filter(rh_user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(rh_user=self.request.user)


class RHExceptionDestroyView(generics.DestroyAPIView):
    """Suppression d'une exception (réactivation du jour)"""
    serializer_class   = RHAvailabilityExceptionSerializer
    permission_classes = [IsAuthenticated, IsRHUser]

    def get_queryset(self):
        return RHAvailabilityException.objects.filter(rh_user=self.request.user)


# ══════════════════════════════════════════════════════════════
# CRÉNEAUX DISPONIBLES (ancienne logique conservée)
# ══════════════════════════════════════════════════════════════

class AvailableSlotsView(APIView):
    """Créneaux disponibles pour une date donnée"""
    permission_classes = [IsAuthenticated, IsRHUser]

    def get(self, request):
        date_str = request.query_params.get('date')
        if not date_str:
            return Response({'error': 'Date requise'}, status=400)

        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Format invalide (YYYY-MM-DD)'}, status=400)

        day_of_week  = target_date.weekday()
        availabilities = RHAvailability.objects.filter(
            rh_user=request.user, day_of_week=day_of_week, is_active=True
        )

        # Entretiens déjà planifiés ce jour
        try:
            from ..models import Interview
            scheduled = Interview.objects.filter(
                rh_user=request.user,
                scheduled_date=target_date,
                status__in=['pending', 'confirmed']
            )
        except Exception:
            scheduled = []

        settings, _ = RHSettings.objects.get_or_create(rh_user=request.user)
        available_slots = []

        for avail in availabilities:
            current = datetime.combine(target_date, avail.start_time)
            end     = datetime.combine(target_date, avail.end_time)

            while current < end:
                slot_start = current.time()
                slot_end   = (
                    current + timedelta(minutes=settings.default_interview_duration)
                ).time()

                # Pause déjeuner
                if settings.enable_lunch_break:
                    if not (
                        slot_start >= settings.lunch_break_end
                        or slot_end <= settings.lunch_break_start
                    ):
                        current += timedelta(minutes=30)
                        continue

                # Vérifier si occupé
                occupied = False
                if scheduled:
                    occupied = scheduled.filter(
                        scheduled_time__lt=slot_end,
                        scheduled_time__gte=slot_start
                    ).exists()

                if not occupied:
                    available_slots.append({
                        'start_time': slot_start.strftime('%H:%M'),
                        'end_time':   slot_end.strftime('%H:%M'),
                        'available':  True,
                    })

                current += timedelta(minutes=30)

        return Response({'date': date_str, 'slots': available_slots})


# ══════════════════════════════════════════════════════════════
# NOTES RH
# ══════════════════════════════════════════════════════════════

class RHNoteListCreateView(APIView):
    """
    GET  /recruitment/rh/notes/?date=2025-03-15
    POST /recruitment/rh/notes/
    """
    permission_classes = [IsAuthenticated, IsRHUser]

    def get(self, request):
        filter_date = request.query_params.get('date')
        notes = RHNote.objects.filter(rh_user=request.user)
        if filter_date:
            notes = notes.filter(date=filter_date)
        return Response([self._serialize(n) for n in notes])

    def post(self, request):
        note = RHNote.objects.create(
            rh_user               = request.user,
            date                  = request.data.get('date'),
            content               = request.data.get('content', ''),
            level                 = request.data.get('level', 'info'),
            notify_at             = request.data.get('notify_at') or None,
            linked_offer_id       = request.data.get('linked_offer_id') or None,
            linked_application_id = request.data.get('linked_application_id') or None,
        )
        return Response(self._serialize(note), status=201)

    @staticmethod
    def _serialize(note: RHNote) -> dict:
        return {
            'id':         note.id,
            'date':       str(note.date),
            'content':    note.content,
            'level':      note.level,
            'notify_at':  note.notify_at.isoformat() if note.notify_at else None,
            'linked_offer_title': (
                note.linked_offer.title if note.linked_offer else None
            ),
            'created_at': note.created_at.isoformat(),
        }


class RHNoteDetailView(APIView):
    """
    PATCH  /recruitment/rh/notes/<id>/
    DELETE /recruitment/rh/notes/<id>/
    """
    permission_classes = [IsAuthenticated, IsRHUser]

    def patch(self, request, note_id: int):
        note = RHNote.objects.filter(id=note_id, rh_user=request.user).first()
        if not note:
            return Response({'error': 'Note introuvable'}, status=404)
        for field in ['content', 'level', 'notify_at', 'date']:
            if field in request.data:
                setattr(note, field, request.data[field] or None)
        note.save()
        return Response({'id': note.id, 'content': note.content})

    def delete(self, request, note_id: int):
        RHNote.objects.filter(id=note_id, rh_user=request.user).delete()
        return Response(status=204)


# ══════════════════════════════════════════════════════════════
# NOTIFICATIONS INTELLIGENTES
# ══════════════════════════════════════════════════════════════

class RHNotificationsView(APIView):
    """
    GET /recruitment/rh/notifications/
    Toutes les alertes actives pour le RH connecté
    """
    permission_classes = [IsAuthenticated, IsRHUser]

    def get(self, request):
        user  = request.user
        today = date_cls.today()
        notifs = []

        # ── 1. Offres expirant dans ≤ 3 jours ──────────────────
        expiring = JobOffer.objects.filter(
            created_by          = user,
            offer_deadline__gte = today,
            offer_deadline__lte = today + timedelta(days=3),
            is_active           = True,
        )
        for offer in expiring:
            days_left = (offer.offer_deadline - today).days
            notifs.append({
                'type':    'offer_expiring',
                'level':   'warning',
                'title':   'Offre expire bientôt',
                'message': f'"{offer.title}" — dans {days_left} jour{"s" if days_left > 1 else ""}',
                'date':    str(offer.offer_deadline),
                'link_id': offer.id,
            })

        # ── 2. Candidats en attente > 5 jours ──────────────────
        pending_count = Application.objects.filter(
            job_offer__created_by = user,
            status                = 'pending',
            applied_date__lte     = today - timedelta(days=5),
        ).count()
        if pending_count > 0:
            notifs.append({
                'type':    'pending_too_long',
                'level':   'warning',
                'title':   f'{pending_count} candidat{"s" if pending_count > 1 else ""} en attente',
                'message': 'Sans réponse depuis plus de 5 jours',
                'date':    str(today),
                'link_id': None,
            })

        # ── 3. Entretiens IA terminés ───────────────────────────
        try:
            from ..models import AIInterview
            completed = AIInterview.objects.filter(
                application__job_offer__created_by=user,
                status='completed',
            ).count()
            if completed > 0:
                notifs.append({
                    'type':    'interviews_completed',
                    'level':   'success',
                    'title':   f'{completed} entretien{"s" if completed > 1 else ""} IA terminé{"s" if completed > 1 else ""}',
                    'message': 'Résultats disponibles',
                    'date':    str(today),
                    'link_id': None,
                })
        except Exception:
            pass

        # ── 4. Offres publiées sans candidature depuis 7 jours ──
        silent = JobOffer.objects.filter(
            created_by=user,
            is_active=True,
            created_at__lte=timezone.now() - timedelta(days=7),
        ).annotate(app_count=Count('applications')).filter(app_count=0)

        if silent.exists():
            notifs.append({
                'type':    'no_applications',
                'level':   'info',
                'title':   f'{silent.count()} offre{"s" if silent.count() > 1 else ""} sans candidature',
                'message': 'Publiées depuis plus de 7 jours',
                'date':    str(today),
                'link_id': None,
            })

        # ── 5. Rappels de notes du jour ─────────────────────────
        due_notes = RHNote.objects.filter(
            rh_user         = user,
            notify_at__date = today,
            notified        = False,
        )
        for note in due_notes:
            notifs.append({
                'type':    'note_reminder',
                'level':   'info',
                'title':   'Rappel — Note',
                'message': note.content[:100],
                'date':    str(note.date),
                'link_id': note.id,
            })
            note.notified = True
            note.save()

        # Trier : urgent > warning > info > success
        order = {'urgent': 0, 'warning': 1, 'info': 2, 'success': 3}
        notifs.sort(key=lambda n: order.get(n['level'], 99))

        return Response(notifs)


# ══════════════════════════════════════════════════════════════
# STATISTIQUES HEBDOMADAIRES
# ══════════════════════════════════════════════════════════════

class RHWeekStatsView(APIView):
    """GET /recruitment/rh/week-stats/"""
    permission_classes = [IsAuthenticated, IsRHUser]

    def get(self, request):
        user       = request.user
        today      = date_cls.today()
        week_start = today - timedelta(days=today.weekday())
        week_end   = week_start + timedelta(days=6)
        prev_start = week_start - timedelta(days=7)
        prev_end   = week_start - timedelta(days=1)

        new_apps = Application.objects.filter(
            job_offer__created_by=user,
            applied_date__gte=week_start,
            applied_date__lte=week_end,
        ).count()

        prev_apps = Application.objects.filter(
            job_offer__created_by=user,
            applied_date__gte=prev_start,
            applied_date__lte=prev_end,
        ).count()

        interviews_done = 0
        avg_score       = 0
        try:
            from ..models import AIInterview
            interviews_done = AIInterview.objects.filter(
                application__job_offer__created_by=user,
                status='completed',
                completed_at__date__gte=week_start,
                completed_at__date__lte=week_end,
            ).count()
            avg_score = AIInterview.objects.filter(
                application__job_offer__created_by=user,
                status='completed',
            ).aggregate(avg=Avg('ai_interview_score'))['avg'] or 0
        except Exception:
            pass

        active_offers = JobOffer.objects.filter(
            created_by=user, is_active=True
        ).count()

        total_apps  = Application.objects.filter(job_offer__created_by=user).count()
        total_hired = Application.objects.filter(
            job_offer__created_by=user, status='hired'
        ).count()
        conversion  = round(total_hired / total_apps * 100) if total_apps > 0 else 0

        trend = 0
        if prev_apps > 0:
            trend = round((new_apps - prev_apps) / prev_apps * 100)

        return Response({
            'week_start':        str(week_start),
            'week_end':          str(week_end),
            'new_applications':  new_apps,
            'interviews_done':   interviews_done,
            'avg_score':         round(avg_score),
            'active_offers':     active_offers,
            'conversion_rate':   conversion,
            'trend_pct':         trend,
            'prev_applications': prev_apps,
        })


# ══════════════════════════════════════════════════════════════
# TIMELINE OFFRES
# ══════════════════════════════════════════════════════════════

class RHOfferTimelineView(APIView):
    """GET /recruitment/rh/offer-timeline/"""
    permission_classes = [IsAuthenticated, IsRHUser]

    def get(self, request):
        user   = request.user
        offers = JobOffer.objects.filter(
            created_by=user, is_active=True
        ).prefetch_related('applications')

        today    = date_cls.today()
        timeline = []

        for offer in offers:
            apps        = offer.applications.all()
            total       = apps.count()
            screened    = apps.filter(
                status__in=['under_review', 'interview_scheduled', 'hired']
            ).count()
            interviewed = apps.filter(
                Q(status='interview_scheduled') | Q(status='hired')
            ).count()
            hired       = apps.filter(status='hired').count()

            # Progression 0 → 100
            if total == 0:
                progress, stage = 5,   'published'
            elif screened == 0:
                progress, stage = 20,  'applications'
            elif interviewed == 0:
                progress, stage = 50,  'screening'
            elif hired == 0:
                progress, stage = 75,  'interviews'
            else:
                progress, stage = 100, 'hired'

            days_left  = None
            is_expired = False
            if offer.offer_deadline:
                days_left  = (offer.offer_deadline - today).days
                is_expired = days_left < 0

            timeline.append({
                'id':         offer.id,
                'title':      offer.title,
                'contract':   getattr(offer, 'contract_type', None),
                'department': getattr(offer, 'department', None),
                'created_at': str(offer.created_at.date()),
                'deadline':   str(offer.offer_deadline) if offer.offer_deadline else None,
                'days_left':  days_left,
                'is_expired': is_expired,
                'stats': {
                    'total':       total,
                    'screened':    screened,
                    'interviewed': interviewed,
                    'hired':       hired,
                },
                'progress': progress,
                'stage':    stage,
            })

        timeline.sort(key=lambda x: x['progress'], reverse=True)
        return Response(timeline)


# ══════════════════════════════════════════════════════════════
# DONNÉES CALENDRIER COMPLÈTES (1 seul appel API)
# ══════════════════════════════════════════════════════════════

class RHCalendarDataView(APIView):
    """
    GET /recruitment/rh/calendar/
    Toutes les données du calendrier en un seul appel
    """
    permission_classes = [IsAuthenticated, IsRHUser]

    def get(self, request):
        user = request.user

        availabilities = RHAvailability.objects.filter(rh_user=user, is_active=True)
        exceptions     = RHAvailabilityException.objects.filter(rh_user=user)
        notes          = RHNote.objects.filter(rh_user=user)

        # Entretiens IA avec date programmée
        ai_interviews = []
        try:
            from ..models import AIInterview
            ivs = AIInterview.objects.filter(
                application__job_offer__created_by=user,
            ).select_related('application', 'application__job_offer')

            for iv in ivs:
                app = iv.application
                scheduled_date = getattr(app, 'ai_interview_scheduled_date', None)
                if scheduled_date:
                    ai_interviews.append({
                        'id':             iv.id,
                        'candidate_name': getattr(app, 'full_name', 'Candidat'),
                        'job_title':      app.job_offer.title,
                        'scheduled_date': str(scheduled_date),
                        'scheduled_time': str(
                            getattr(app, 'ai_interview_scheduled_time', '')
                        ) or None,
                        'status':         iv.status,
                        'score':          getattr(iv, 'ai_interview_score', None),
                    })
        except Exception:
            pass

        return Response({
            'availabilities': RHAvailabilitySerializer(availabilities, many=True).data,
            'exceptions':     RHAvailabilityExceptionSerializer(exceptions, many=True).data,
            'notes': [
                {
                    'id':                note.id,
                    'date':              str(note.date),
                    'content':           note.content,
                    'level':             note.level,
                    'notify_at':         note.notify_at.isoformat() if note.notify_at else None,
                    'linked_offer_title': note.linked_offer.title if note.linked_offer else None,
                }
                for note in notes
            ],
            'ai_interviews': ai_interviews,
        })


# ══════════════════════════════════════════════════════════════
# SETTINGS
# ══════════════════════════════════════════════════════════════

class RHSettingsView(APIView):
    """GET / PUT /recruitment/rh/settings/"""
    permission_classes = [IsAuthenticated, IsRHUser]

    def get(self, request):
        settings, _ = RHSettings.objects.get_or_create(rh_user=request.user)
        return Response(RHSettingsSerializer(settings).data)

    def put(self, request):
        settings, _ = RHSettings.objects.get_or_create(rh_user=request.user)
        serializer  = RHSettingsSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)