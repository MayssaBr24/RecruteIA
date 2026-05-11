
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
    """Appel Groq pour texte libre"""
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
        logger.error(f"Erreur Groq text: {e}")
        return ""


# ==============================================
# COLLECTE DES DONNÉES
# ==============================================

def _get_historical_data(rh_user=None) -> dict:
    """
    Collecte toutes les données historiques pour les prévisions.
    """
    from django.utils import timezone
    from recruitment.models import (
        JobOffer, Application, AIInterview,
        RHMetrics, InterviewWarning
    )
    from django.db.models import Count, Avg, Q
    from django.db.models.functions import TruncMonth

    now = timezone.now()
    six_months_ago = now - timedelta(days=180)

    # ── Filtre RH si spécifié ──────────────────────
    offer_filter = Q(created_at__gte=six_months_ago)
    if rh_user:
        offer_filter &= Q(created_by=rh_user)

    offers = JobOffer.objects.filter(offer_filter)
    offer_ids = offers.values_list('id', flat=True)
    applications = Application.objects.filter(job_offer_id__in=offer_ids)

    # ── 1. Candidatures par mois ───────────────────
    apps_by_month = list(
        applications.annotate(
            month=TruncMonth('applied_date')
        ).values('month').annotate(
            count=Count('id'),
            avg_score=Avg('ai_score'),
        ).order_by('month')
    )

    # ── 2. Offres par mois ─────────────────────────
    offers_by_month = list(
        offers.annotate(
            month=TruncMonth('created_at')
        ).values('month').annotate(
            count=Count('id')
        ).order_by('month')
    )

    # ── 3. Taux de conversion ──────────────────────
    total_apps = applications.count()
    total_hired = applications.filter(hired_at__isnull=False).count()
    conversion_rate = round(
        (total_hired / max(total_apps, 1)) * 100, 1
    )

    # ── 4. Temps moyen de recrutement ─────────────
    hired_apps = applications.filter(
        hired_at__isnull=False
    )
    avg_time_to_hire = 0
    if hired_apps.exists():
        total_days = 0
        count = 0
        for app in hired_apps:
            if app.hired_at and app.applied_date:
                days = (app.hired_at - app.applied_date.date()).days
                if days >= 0:
                    total_days += days
                    count += 1
        avg_time_to_hire = round(total_days / max(count, 1), 1)

    # ── 5. Par département ─────────────────────────
    by_department = list(
        offers.values('department').annotate(
            offers_count=Count('id'),
            apps_count=Count('applications'),
        )
    )

    # ── 6. Par source candidature ──────────────────
    by_source = list(
        applications.values('source').annotate(
            count=Count('id')
        ).order_by('-count')
    )

    # ── 7. Par type de contrat ─────────────────────
    by_contract = list(
        offers.values('contract_type').annotate(
            offers=Count('id'),
            applications=Count('applications')
        )
    )

    # ── 8. Entretiens IA ──────────────────────────
    interviews = AIInterview.objects.filter(
        application__job_offer_id__in=offer_ids
    )
    total_interviews = interviews.count()
    completed_interviews = interviews.filter(status='completed').count()
    fraud_interviews = interviews.filter(
        status='fraud_terminated'
    ).count()
    avg_interview_score = interviews.filter(
        ai_interview_score__isnull=False
    ).aggregate(avg=Avg('ai_interview_score'))['avg'] or 0

    # ── 9. Offres actives ──────────────────────────
    active_offers = offers.filter(is_active=True).count()
    expired_unfilled = offers.filter(
        is_active=False,
        filled_at__isnull=True,
        deadline_processed=True
    ).count()

    # ── 10. Snapshots historiques (RHMetrics) ──────
    historical_snapshots = list(
        RHMetrics.objects.order_by('-month').values(
            'month', 'total_applications', 'total_hired',
            'avg_time_to_hire', 'conversion_rate'
        )[:6]
    )

    return {
        'period': '6 derniers mois',
        'apps_by_month': [
            {
                'month': item['month'].strftime('%Y-%m') if item['month'] else '',
                'count': item['count'],
                'avg_score': round(item['avg_score'] or 0, 1),
            }
            for item in apps_by_month
        ],
        'offers_by_month': [
            {
                'month': item['month'].strftime('%Y-%m') if item['month'] else '',
                'count': item['count'],
            }
            for item in offers_by_month
        ],
        'kpis': {
            'total_offers': offers.count(),
            'active_offers': active_offers,
            'total_applications': total_apps,
            'total_hired': total_hired,
            'conversion_rate': conversion_rate,
            'avg_time_to_hire': avg_time_to_hire,
            'avg_interview_score': round(avg_interview_score, 1),
            'interview_completion_rate': round(
                (completed_interviews / max(total_interviews, 1)) * 100, 1
            ),
            'fraud_rate': round(
                (fraud_interviews / max(total_interviews, 1)) * 100, 1
            ),
            'expired_unfilled': expired_unfilled,
        },
        'by_department': by_department,
        'by_source': by_source,
        'by_contract': by_contract,
        'historical_snapshots': historical_snapshots,
    }


# ==============================================
# PRÉVISIONS
# ==============================================

def _calculate_trend(monthly_data: list) -> dict:
    """
    Calcule la tendance et prédit les 3 prochains mois.
    """
    if len(monthly_data) < 2:
        return {
            'trend_pct': 0,
            'trend_label': 'Données insuffisantes',
            'predictions': []
        }

    counts = [m['count'] for m in monthly_data]

    # Croissance moyenne mois/mois
    growth_rates = []
    for i in range(1, len(counts)):
        if counts[i-1] > 0:
            rate = (counts[i] - counts[i-1]) / counts[i-1] * 100
            growth_rates.append(rate)

    avg_growth = sum(growth_rates) / max(len(growth_rates), 1)

    # Prédictions 3 mois suivants
    last_count = counts[-1] if counts else 0
    last_month = monthly_data[-1]['month'] if monthly_data else ''

    predictions = []
    current = last_count

    for i in range(1, 4):
        current = max(0, current * (1 + avg_growth / 100))
        if last_month:
            year, month = last_month.split('-')
            next_month_num = int(month) + i
            next_year = int(year) + (next_month_num - 1) // 12
            next_month_num = ((next_month_num - 1) % 12) + 1
            month_str = f"{next_year}-{next_month_num:02d}"
        else:
            month_str = f"M+{i}"

        predictions.append({
            'month': month_str,
            'predicted': round(current),
        })

    # Label tendance
    if avg_growth > 10:
        trend_label = 'Forte hausse'
    elif avg_growth > 3:
        trend_label = 'Hausse modérée'
    elif avg_growth > -3:
        trend_label = 'Stable'
    elif avg_growth > -10:
        trend_label = 'Légère baisse'
    else:
        trend_label = 'Forte baisse'

    return {
        'trend_pct': round(avg_growth, 1),
        'trend_label': trend_label,
        'predictions': predictions,
    }


def generate_forecasting(rh_user=None) -> dict:
    """
    Génère les prévisions RH complètes :
    - Données historiques
    - Tendances calculées
    - Prédictions 3 mois
    - Texte IA explicatif
    - Données graphiques
    """
    data = _get_historical_data(rh_user)
    trend = _calculate_trend(data['apps_by_month'])

    # Construire données graphiques
    graph_data = {
        'applications_trend': {
            'historical': data['apps_by_month'],
            'predictions': trend['predictions'],
        },
        'offers_trend': data['offers_by_month'],
        'by_department': data['by_department'],
        'by_source': data['by_source'],
        'by_contract': data['by_contract'],
    }

    # Générer texte IA
    ai_text = _generate_forecast_text(data, trend)

    return {
        'kpis': data['kpis'],
        'trend': trend,
        'graph_data': graph_data,
        'ai_analysis': ai_text,
        'generated_at': datetime.now().strftime('%d/%m/%Y %H:%M'),
    }


def _generate_forecast_text(data: dict, trend: dict) -> str:
    """Génère l'analyse textuelle via Groq"""
    kpis = data['kpis']

    by_source_text = ', '.join([
        f"{s['source']}: {s['count']} candidatures"
        for s in data['by_source'][:4]
    ]) or 'Non disponible'

    by_dept_text = ', '.join([
        f"{d['department']}: {d['offers_count']} offres"
        for d in data['by_department'][:4]
    ]) or 'Non disponible'

    predictions_text = ', '.join([
        f"{p['month']}: ~{p['predicted']} candidatures"
        for p in trend['predictions']
    ]) or 'Non calculable'

    prompt = f"""
Tu es un expert RH analytique. Génère une analyse prédictive concise et professionnelle.

DONNÉES DES 6 DERNIERS MOIS :
- Total offres : {kpis['total_offers']}
- Offres actives : {kpis['active_offers']}
- Total candidatures : {kpis['total_applications']}
- Personnes recrutées : {kpis['total_hired']}
- Taux de conversion : {kpis['conversion_rate']}%
- Temps moyen de recrutement : {kpis['avg_time_to_hire']} jours
- Score IA moyen entretiens : {kpis['avg_interview_score']}/100
- Taux completion entretien : {kpis['interview_completion_rate']}%
- Offres non pourvues après deadline : {kpis['expired_unfilled']}
- Tendance candidatures : {trend['trend_pct']}% ({trend['trend_label']})
- Prévisions prochains mois : {predictions_text}
- Sources candidatures : {by_source_text}
- Répartition départements : {by_dept_text}

Génère une analyse structurée avec ces sections EXACTES :

**Résumé de la période**
[2-3 phrases sur la situation globale]

**Tendances identifiées**
[3-4 points clés avec → ]

**Prévisions pour les 3 prochains mois**
[Prédictions basées sur les données]

**Recommandations prioritaires**
[3-4 actions concrètes avec → ]

**Alertes**
[Points d'attention urgents si applicable]

Sois précis, utilise les chiffres fournis, reste professionnel.
Réponds en français.
"""

    text = _call_groq_text(prompt, max_tokens=1200)

    if not text:
        return (
            f"Sur les 6 derniers mois, {kpis['total_applications']} "
            f"candidatures ont été reçues avec un taux de conversion "
            f"de {kpis['conversion_rate']}%. "
            f"La tendance est {trend['trend_label'].lower()}."
        )

    return text