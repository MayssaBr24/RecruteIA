"""
Calcul des scores par phase et score final pondéré.

  - UN SEUL moteur de scoring question par question : score_phase_answer()
    (scoring_scenario.py), qui utilise l'angle (questions techniques) et les
    evaluation_criteria (scénarios) propres à CHAQUE question.
  - analyze_phase_score() est le SEUL point d'entrée appelé par la vue
    (4x : 'communication', 'cv_clarification', 'technical', 'scenario').
  - analyze_communication_score / analyze_clarification_score /
    analyze_technical_score / analyze_scenario_score sont gardées en alias
    minces pour compatibilité (si importées ailleurs) mais ne contiennent
    plus aucune logique propre — tout passe par analyze_phase_score().

Pénalités :
  - Incohérences de profil (ProfileInconsistency) → NE pénalisent PAS
  - Warnings de sécurité (SecurityWarningEvent)   → -5 pts chacun, max -15 pts
  - 3 warnings de sécurité = entretien arrêté
"""

from __future__ import annotations
import logging
from typing import Optional

from .security_warnings import SecurityWarningState, compute_security_penalty
from .scoring_scenario import score_phase_answer, _detect_gibberish

logger = logging.getLogger(__name__)

WEIGHTS_FULL = {
    "comm": 0.20, "clarif": 0.15, "technical": 0.25,
    "scenario": 0.20, "qcm": 0.20,
}
WEIGHTS_FULL_VOCAL = {
    "comm": 0.19, "clarif": 0.14, "technical": 0.24,
    "scenario": 0.19, "qcm": 0.19, "vocal": 0.05,
}
WEIGHTS_NO_TECHNICAL = {
    "comm": 0.25, "clarif": 0.20, "technical": 0.00,
    "scenario": 0.25, "qcm": 0.30,
}
WEIGHTS_NO_TECHNICAL_VOCAL = {
    "comm": 0.24, "clarif": 0.19, "technical": 0.00,
    "scenario": 0.24, "qcm": 0.28, "vocal": 0.05,
}


def _is_garbage_answer(answer: str) -> bool:
    """Rejet rapide (avant appel LLM) des réponses vides/spam évidentes."""
    if not answer or len(answer.strip()) == 0:
        return True
    words = answer.strip().split()
    if len(words) < 4:
        return True
    if _detect_gibberish(answer):
        return True
    return False


def analyze_phase_score(transcript: list, phase: str, job_title: str) -> int:
    """
    Score 0-100 pour une phase donnée.

    Pour CHAQUE question de la phase :
      1. Rejet rapide (score=0, pas d'appel LLM) si réponse vide/garbage.
      2. Sinon score_phase_answer() avec :
         - angle = entry['angle']                  (pour 'technical')
         - criteria = entry['evaluation_criteria']  (pour 'scenario')
    Score de phase = moyenne des scores obtenus question par question.

    IMPORTANT : pour que l'angle / les critères soient bien exploités, chaque
    entrée du transcript doit conserver le champ 'angle' (questions techniques)
    ou 'evaluation_criteria' (scénarios) tel que retourné par
    generate_technical_questions() / generate_scenario_questions() au moment
    où la question a été posée. S'ils sont absents, ça ne plante pas — le
    scoring retombe juste sur des critères génériques, moins précis.
    """
    phase_entries = [
        e for e in transcript
        if e.get("phase") == phase and e.get("type") != "voice_analysis"
    ]
    if not phase_entries:
        return 0

    scores: list[int] = []
    for entry in phase_entries:
        answer   = (entry.get("answer") or "").strip()
        question = entry.get("question", "")

        if not answer or _is_garbage_answer(answer):
            scores.append(0)
            continue

        try:
            result = score_phase_answer(
                question=question,
                answer=answer,
                phase=phase,
                job_title=job_title,
                angle=entry.get("angle") or "",
                criteria=entry.get("evaluation_criteria") or None,
                profile={"job_title": job_title},
            )
            scores.append(result.get("score", 0))
        except Exception:
            # Un échec ponctuel (Groq down, JSON malformé...) ne doit JAMAIS
            # faire planter tout le scoring de l'entretien.
            logger.exception(
                "[Score] Échec scoring question phase=%s angle=%s — fallback=0",
                phase, entry.get("angle"),
            )
            scores.append(0)

    final = round(sum(scores) / len(scores)) if scores else 0

    logger.info(
        "[Score] Phase=%s job=%s → %d (n=%d, détail=%s)",
        phase, job_title, final, len(scores), scores,
    )
    return final


def compute_final_score(
    communication_score: int,
    clarification_score: int,
    technical_score:     int,
    scenario_score:      int,
    qcm_score:           Optional[int],
    security_state:      SecurityWarningState,
    vocal_score:         Optional[int] = None,
    has_technical_phase: bool = True,
    qcm_skipped:         bool = False,
) -> dict:
    """
    Score final pondéré.
    - SEULS les warnings de sécurité pénalisent (-5 pts/warning, max -15).
    - Les incohérences de profil N'impactent PAS le score.
    - Si qcm_skipped=True, le poids QCM est redistribué sur les autres phases.
    """
    has_vocal = vocal_score is not None
    has_qcm   = qcm_score is not None and not qcm_skipped

    if has_technical_phase:
        w = dict(WEIGHTS_FULL_VOCAL if has_vocal else WEIGHTS_FULL)
    else:
        w = dict(WEIGHTS_NO_TECHNICAL_VOCAL if has_vocal else WEIGHTS_NO_TECHNICAL)

    if not has_qcm:
        qcm_weight = w.get("qcm", 0)
        if qcm_weight > 0:
            other_keys  = [k for k in w if k != "qcm" and w.get(k, 0) > 0]
            total_other = sum(w[k] for k in other_keys)
            if total_other > 0:
                for k in other_keys:
                    w[k] += qcm_weight * (w[k] / total_other)
            w["qcm"] = 0
        qcm_score = 0

    raw = (
        communication_score * w["comm"]
        + clarification_score * w["clarif"]
        + technical_score     * w["technical"]
        + scenario_score      * w["scenario"]
        + qcm_score           * w["qcm"]
        + (vocal_score or 0)  * w.get("vocal", 0)
    )

    security_penalty = compute_security_penalty(security_state)
    final = max(0, int(raw) - security_penalty)

    logger.info(
        "[Score] Final=%d raw=%.1f security_penalty=%d (warnings=%d) "
        "comm=%d clarif=%d technical=%d scenario=%d qcm=%s vocal=%s qcm_skipped=%s",
        final, raw, security_penalty, security_state.total_count,
        communication_score, clarification_score, technical_score, scenario_score,
        qcm_score, vocal_score, qcm_skipped,
    )

    return {
        "final_score":      final,
        "raw_score":        int(raw),
        "security_penalty": security_penalty,
        "qcm_skipped":      qcm_skipped,
        "breakdown": {
            "communication": communication_score,
            "clarification": clarification_score,
            "technical":     technical_score,
            "scenario":      scenario_score,
            "qcm":           qcm_score if has_qcm else None,
            "vocal":         vocal_score,
        },
        "weights_used": w,
    }


def _extract_vocal_score(transcript: list) -> Optional[int]:
    vocal  = [e for e in transcript if e.get("type") == "voice_analysis"]
    scores = [e.get("vocal_score", 0) for e in vocal if e.get("vocal_score") is not None]
    return int(sum(scores) / len(scores)) if scores else None


# ─────────────────────────────────────────────────────────────────────────────
# Plus aucune logique propre : tout délègue à analyze_phase_score().
# ─────────────────────────────────────────────────────────────────────────────

def analyze_communication_score(transcript: list, job_title: str) -> int:
    return analyze_phase_score(transcript, "communication", job_title)


def analyze_clarification_score(transcript: list, job_title: str) -> int:
    return analyze_phase_score(transcript, "cv_clarification", job_title)


def analyze_technical_score(transcript: list, job_title: str) -> int:
    return analyze_phase_score(transcript, "technical", job_title)


def analyze_scenario_score(transcript: list, scenario_questions: list, job_title: str) -> int:
    # scenario_questions n'est plus nécessaire ici : evaluation_criteria est
    # lu directement depuis chaque entrée du transcript.
    return analyze_phase_score(transcript, "scenario", job_title)