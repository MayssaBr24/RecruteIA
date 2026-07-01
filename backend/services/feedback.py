from __future__ import annotations

import logging
from typing import List, Optional
from .groq_client import _call_groq_json, _call_groq_text
from .profile_warnings import ProfileInconsistency, format_inconsistencies_for_report
from .security_warnings import SecurityWarningState, format_security_warnings_for_report

logger = logging.getLogger(__name__)


def generate_final_feedback(
    interview,
    score_result: dict,
    profile_inconsistencies: List[ProfileInconsistency],
    security_state: SecurityWarningState,
) -> str:
    """
    Rapport RH complet avec séparation nette :
      - Warnings de sécurité (pénalisants)
      - Incohérences de profil (informatifs, non-pénalisants)
    """
    bd    = score_result.get("breakdown", {})
    comm  = bd.get("communication", 0) or 0
    clarif= bd.get("clarification", 0) or 0
    tech  = bd.get("technical", 0) or 0
    scen  = bd.get("scenario", 0) or 0
    qcm   = bd.get("qcm", 0) or 0
    vocal = bd.get("vocal")
    final = score_result.get("final_score", 0)
    raw   = score_result.get("raw_score", final)
    penalty = score_result.get("security_penalty", 0)

    low_scores   = [s for s in [comm, clarif, qcm] if 0 < s < 40]
    has_critical = len(low_scores) >= 2

    vocal_str = f"Vocal : {vocal}/100" if vocal is not None else "Analyse vocale : non disponible"

    prompt = f"""
Génère un rapport d'entretien structuré destiné au service RH.

Candidat : {interview.application.full_name}
Poste    : {interview.application.job_offer.title}

SCORES :
- Communication      : {comm}/100
- Clarification CV   : {clarif}/100
- Technique          : {tech}/100
- Mises en situation : {scen}/100
- QCM                : {qcm}/100
- {vocal_str}
- Score brut         : {raw}/100
- Pénalité sécurité  : -{penalty} pts
- Score global final : {final}/100

Incidents de sécurité : {security_state.total_count} (pénalité appliquée)
Entretien interrompu  : {'OUI — ' + (security_state.termination_reason or '') if security_state.interview_terminated else 'NON'}
Faiblesse critique    : {'Oui' if has_critical else 'Non'}

JSON :
{{
  "recommendation": "{"REJECTED" if final < 40 else "TO_REVIEW"}",
  "summary": "3 phrases synthétiques",
  "strengths": ["force 1", "force 2", "force 3"],
  "weaknesses": ["faiblesse 1", "faiblesse 2"],
  "rh_notes": "Points d'attention pour l'entretien humain de suivi",
  "next_steps": "Action recommandée concrète et immédiate"
}}
"""
    result = _call_groq_json(prompt, max_tokens=1200)

    if not result:
        reco = "REJECTED" if final < 40 else "TO_REVIEW"
        reco_block = f"[{reco}] Score global : {final}/100"
    else:
        reco_block = (
            f"[{result.get('recommendation','TO_REVIEW')}] {result.get('summary','')}\n\n"
            f"Forces         : {' | '.join(result.get('strengths',[]))}\n"
            f"Faiblesses     : {' | '.join(result.get('weaknesses',[]))}\n"
            f"Notes RH       : {result.get('rh_notes','')}\n"
            f"Étape suivante : {result.get('next_steps','')}"
        )

    # Séparateur section sécurité
    sec_header = (
        "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🔒 INCIDENTS DE SÉCURITÉ ({security_state.total_count}) "
        f"→ Pénalité appliquée : -{penalty} pts\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    )
    sec_block = format_security_warnings_for_report(security_state)

    # Séparateur section incohérences profil
    inc_header = (
        "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"📋 INCOHÉRENCES DE PROFIL ({len(profile_inconsistencies)}) "
        f"→ Informatif uniquement — score NON impacté\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    )
    inc_block = format_inconsistencies_for_report(profile_inconsistencies)

    legal = (
        "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "⚙  Évaluation automatique par IA — aide à la décision uniquement.\n"
        "   La décision finale appartient au Responsable RH.\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    )

    return (
        f"SCORE GLOBAL : {final}/100 (brut {raw} — pénalité sécurité -{penalty})\n\n"
        f"{reco_block}"
        f"{sec_header}\n{sec_block}"
        f"{inc_header}\n{inc_block}"
        f"{legal}"
    )


def generate_termination_report(
    interview,
    security_state: SecurityWarningState,
    partial_scores: Optional[dict] = None,
) -> str:
    """
    Rapport d'arrêt d'entretien pour fraude.
    Généré quand 3 warnings de sécurité sont atteints.
    """
    events_detail = "\n".join(
        f"  [{i}] {e.timestamp.strftime('%H:%M:%S')} — {e.label}"
        + (f"\n      Capture : {e.screenshot_url}" if e.screenshot_url else "")
        for i, e in enumerate(security_state.events, 1)
    )

    partial_str = ""
    if partial_scores:
        partial_str = "SCORES PARTIELS (phases complétées avant arrêt) :\n" + "\n".join(
            f"  - {k} : {v}/100" for k, v in partial_scores.items() if v is not None
        )

    return (
        "═══════════════════════════════════════════════════════\n"
        "🔴 ENTRETIEN INTERROMPU POUR FRAUDE PRÉSUMÉE\n"
        "═══════════════════════════════════════════════════════\n\n"
        f"Candidat    : {interview.application.full_name}\n"
        f"Poste       : {interview.application.job_offer.title}\n"
        f"Motif       : {security_state.termination_reason}\n\n"
        f"INCIDENTS DÉTECTÉS :\n{events_detail}\n\n"
        f"{partial_str}\n\n"
        "RECOMMANDATION : [REJETÉ — Fraude présumée]\n"
        "ACTION : Informer le candidat par email. Archiver les captures. "
        "Ne pas recontacter sans validation RH.\n\n"
        "⚙  Ce rapport a été généré automatiquement suite à la détection\n"
        "   de 3 incidents de sécurité consécutifs."
    )


def generate_candidate_feedback(interview, final_score: int) -> str:
    if getattr(interview, 'status', '') == 'fraud_terminated':
        return (
            f"Cher(e) {interview.application.full_name},\n\n"
            f"Suite à des irrégularités détectées durant votre entretien pour le poste de "
            f"{interview.application.job_offer.title}, nous ne sommes pas en mesure de "
            f"poursuivre votre candidature.\n\n"
            f"Cordialement,\nL'équipe RH"
        )
    comm   = getattr(interview, 'communication_score', 0) or 0
    clarif = getattr(interview, 'clarification_score', 0) or 0
    tech   = getattr(interview, 'technical_score', 0) or 0
    scen   = getattr(interview, 'scenario_score', 0) or 0
    qcm    = getattr(interview, 'qcm_score', 0) or 0

    tone = (
        "très positif et enthousiaste"        if final_score >= 75 else
        "encourageant et constructif"          if final_score >= 50 else
        "respectueux, bienveillant et honnête"
    )
    outcome = (
        "votre candidature a particulièrement retenu notre attention" if final_score >= 75 else
        "votre dossier fait l'objet d'une analyse approfondie"        if final_score >= 50 else
        "nous avons décidé de ne pas poursuivre le processus"
    )

    strengths = []
    if comm   >= 65: strengths.append("vos qualités de communication")
    if tech   >= 65: strengths.append("votre maîtrise technique")
    if scen   >= 65: strengths.append("votre gestion des situations professionnelles")
    if qcm    >= 65: strengths.append("vos connaissances métier")
    if clarif >= 65: strengths.append("la cohérence de votre parcours")
    strength_text = ", ".join(strengths) if strengths else "votre engagement durant l'entretien"

    improvements = []
    if comm  < 50: improvements.append("structurez davantage vos réponses avec des exemples concrets")
    if tech  < 50: improvements.append("approfondissez les aspects techniques de votre domaine")
    if scen  < 50: improvements.append("pratiquez la méthode STAR pour les mises en situation")
    if qcm   < 50: improvements.append("renforcez vos connaissances théoriques et pratiques")
    improvement_text = " et ".join(improvements[:2]) if improvements else ""

    prompt = f"""
Rédige un email de feedback post-entretien professionnel et personnalisé.
Candidat : {interview.application.full_name}
Poste    : {interview.application.job_offer.title}
Ton      : {tone}
Message  : {outcome}
Points positifs : {strength_text}
{"Conseils d'amélioration : " + improvement_text if improvement_text else ""}
Max 180 mots. Mentionne le prénom et le titre du poste. UNIQUEMENT le texte de l'email.
"""
    body = _call_groq_text(prompt, max_tokens=400)
    if not body:
        body = (
            f"Cher(e) {interview.application.full_name},\n\n"
            f"Nous vous remercions d'avoir participé à notre processus de recrutement "
            f"pour le poste de {interview.application.job_offer.title}.\n\n"
            f"Nous revenons vers vous très prochainement.\n\nCordialement,\nL'équipe RH"
        )
    return body