
import os
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)


def _load_env():
    env_path = Path(__file__).resolve().parent.parent / '.env'
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, _, value = line.partition('=')
                    os.environ.setdefault(key.strip(), value.strip())

_load_env()


def _call_groq_text(prompt: str, max_tokens: int = 1500) -> str:
    try:
        from groq import Groq
        client = Groq(api_key=os.getenv('GROQ_API_KEY'))
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Erreur Groq: {e}")
        return ""


# ==============================================
# COLLECTE DONNÉES TURNOVER
# ==============================================

def _get_turnover_data(rh_user=None) -> dict:
    from django.utils import timezone
    from django.db.models import Count, Avg, Q, F
    from recruitment.models import (
        JobOffer, Application, AIInterview, InterviewWarning
    )

    now = timezone.now()
    six_months_ago = now - timedelta(days=180)

    offer_filter = Q(created_at__gte=six_months_ago)
    if rh_user:
        offer_filter &= Q(created_by=rh_user)

    offers = JobOffer.objects.filter(offer_filter)
    offer_ids = list(offers.values_list('id', flat=True))
    applications = Application.objects.filter(
        job_offer_id__in=offer_ids
    )

    # ── 1. Funnel de conversion ────────────────────
    total = applications.count()
    shortlisted = applications.filter(
        status='shortlisted'
    ).count()
    interviewed = applications.filter(
        ai_interview__isnull=False
    ).count()
    hired = applications.filter(
        hired_at__isnull=False
    ).count()

    funnel = [
        {'stage': 'Candidatures', 'count': total, 'pct': 100},
        {
            'stage': 'Présélectionnés',
            'count': shortlisted,
            'pct': round(shortlisted / max(total, 1) * 100, 1)
        },
        {
            'stage': 'Entretien IA',
            'count': interviewed,
            'pct': round(interviewed / max(total, 1) * 100, 1)
        },
        {
            'stage': 'Recrutés',
            'count': hired,
            'pct': round(hired / max(total, 1) * 100, 1)
        },
    ]

    # ── 2. Rejets par étape ────────────────────────
    rejection_by_stage = list(
        applications.filter(
            rejection_stage__isnull=False
        ).values('rejection_stage').annotate(
            count=Count('id')
        ).order_by('-count')
    )

    # ── 3. Abandon entretien IA ────────────────────
    interviews = AIInterview.objects.filter(
        application__job_offer_id__in=offer_ids
    )
    total_interviews = interviews.count()
    completed = interviews.filter(status='completed').count()
    fraud = interviews.filter(status='fraud_terminated').count()
    abandoned = interviews.filter(
        status='in_progress',
        started_at__lt=now - timedelta(hours=25)
    ).count()

    interview_stats = {
        'total': total_interviews,
        'completed': completed,
        'fraud': fraud,
        'abandoned': abandoned,
        'completion_rate': round(
            completed / max(total_interviews, 1) * 100, 1
        ),
        'fraud_rate': round(
            fraud / max(total_interviews, 1) * 100, 1
        ),
        'abandon_rate': round(
            abandoned / max(total_interviews, 1) * 100, 1
        ),
        'avg_score': round(
            interviews.filter(
                ai_interview_score__isnull=False
            ).aggregate(
                avg=Avg('ai_interview_score')
            )['avg'] or 0, 1
        ),
    }

    # ── 4. Scores par phase entretien ─────────────
    phase_scores = {
        'communication': round(
            interviews.filter(
                communication_score__isnull=False
            ).aggregate(
                avg=Avg('communication_score')
            )['avg'] or 0, 1
        ),
        'clarification': round(
            interviews.filter(
                clarification_score__isnull=False
            ).aggregate(
                avg=Avg('clarification_score')
            )['avg'] or 0, 1
        ),
        'qcm': round(
            interviews.filter(
                qcm_score__isnull=False
            ).aggregate(
                avg=Avg('qcm_score')
            )['avg'] or 0, 1
        ),
        'coding': round(
            interviews.filter(
                coding_score__isnull=False
            ).aggregate(
                avg=Avg('coding_score')
            )['avg'] or 0, 1
        ),
    }

    # ── 5. Offres répétées (postes difficiles) ─────
    repeated_offers = list(
        offers.values('title').annotate(
            count=Count('id')
        ).filter(count__gte=2).order_by('-count')[:5]
    )

    # ── 6. Offres non pourvues ─────────────────────
    unfilled_offers = offers.filter(
        is_active=False,
        filled_at__isnull=True,
        deadline_processed=True
    ).count()

    # ── 7. Taux attraction (views vs candidatures) ─
    attraction_data = list(
        offers.filter(views_count__gt=0).values(
            'title', 'views_count'
        ).annotate(
            apps=Count('applications')
        ).order_by('-views_count')[:5]
    )
    for item in attraction_data:
        item['attraction_rate'] = round(
            item['apps'] / max(item['views_count'], 1) * 100, 1
        )

    # ── 8. Performance par source ──────────────────
    source_performance = list(
        applications.values('source').annotate(
            total=Count('id'),
            hired=Count('id', filter=Q(hired_at__isnull=False)),
            avg_score=Avg('ai_score'),
        ).order_by('-total')
    )
    for s in source_performance:
        s['conversion_rate'] = round(
            s['hired'] / max(s['total'], 1) * 100, 1
        )
        s['avg_score'] = round(s['avg_score'] or 0, 1)

    # ── 9. Warnings par type ───────────────────────
    warning_stats = list(
        InterviewWarning.objects.filter(
            interview__application__job_offer_id__in=offer_ids
        ).values('warning_type').annotate(
            count=Count('id')
        ).order_by('-count')
    )

    return {
        'funnel': funnel,
        'rejection_by_stage': rejection_by_stage,
        'interview_stats': interview_stats,
        'phase_scores': phase_scores,
        'repeated_offers': repeated_offers,
        'unfilled_offers': unfilled_offers,
        'attraction_data': attraction_data,
        'source_performance': source_performance,
        'warning_stats': warning_stats,
        'total_offers': offers.count(),
        'period': '6 derniers mois',
    }


# ==============================================
# GÉNÉRATION ANALYSE TURNOVER
# ==============================================

def generate_turnover_analysis(rh_user=None) -> dict:
    """
    Génère l'analyse complète du turnover :
    - Données calculées
    - Graphiques
    - Texte IA
    """
    data = _get_turnover_data(rh_user)
    ai_text = _generate_turnover_text(data)

    return {
        'graph_data': {
            'funnel': data['funnel'],
            'rejection_by_stage': data['rejection_by_stage'],
            'phase_scores': data['phase_scores'],
            'source_performance': data['source_performance'],
            'warning_stats': data['warning_stats'],
            'attraction_data': data['attraction_data'],
        },
        'stats': {
            'interview': data['interview_stats'],
            'repeated_offers': data['repeated_offers'],
            'unfilled_offers': data['unfilled_offers'],
        },
        'ai_analysis': ai_text,
        'generated_at': datetime.now().strftime('%d/%m/%Y %H:%M'),
    }


def _generate_turnover_text(data: dict) -> str:
    iv = data['interview_stats']
    funnel = data['funnel']
    phases = data['phase_scores']

    source_text = ', '.join([
        f"{s['source']}: {s['total']} candidats "
        f"({s['conversion_rate']}% recrutés)"
        for s in data['source_performance'][:4]
    ]) or 'Non disponible'

    repeated_text = ', '.join([
        f"{r['title']} ({r['count']} fois)"
        for r in data['repeated_offers'][:3]
    ]) or 'Aucun'

    prompt = f"""
Tu es un expert RH analytique. Génère une analyse du turnover et du process de recrutement.

DONNÉES DU FUNNEL :
- Candidatures totales : {funnel[0]['count']}
- Présélectionnés : {funnel[1]['count']} ({funnel[1]['pct']}%)
- Entretiens IA : {funnel[2]['count']} ({funnel[2]['pct']}%)
- Recrutés : {funnel[3]['count']} ({funnel[3]['pct']}%)

ENTRETIENS IA :
- Taux de complétion : {iv['completion_rate']}%
- Taux d'abandon : {iv['abandon_rate']}%
- Taux de fraude : {iv['fraud_rate']}%
- Score moyen : {iv['avg_score']}/100

SCORES PAR PHASE :
- Communication : {phases['communication']}/100
- Clarification CV : {phases['clarification']}/100
- QCM Technique : {phases['qcm']}/100

POSTES RÉPÉTÉS (difficiles à pourvoir) : {repeated_text}
OFFRES NON POURVUES : {data['unfilled_offers']}
PERFORMANCE PAR SOURCE : {source_text}

Génère une analyse structurée avec ces sections EXACTES :

**Vue d'ensemble du process**
[État général du funnel de recrutement]

**Points de friction identifiés**
[Où perd-on le plus de candidats et pourquoi]

**Analyse des entretiens IA**
[Performance, abandons, fraude]

**Canaux de sourcing**
[Analyse des sources les plus efficaces]

**Postes problématiques**
[Postes difficiles à pourvoir et recommandations]

**Plan d'action recommandé**
[5 actions prioritaires avec →]

Sois direct, utilise les chiffres, réponds en français.
"""

    text = _call_groq_text(prompt, max_tokens=1400)

    if not text:
        return (
            f"Analyse sur {data['total_offers']} offres. "
            f"Taux de conversion global : "
            f"{funnel[3]['pct']}%. "
            f"Taux de complétion entretien IA : "
            f"{iv['completion_rate']}%."
        )

    return text