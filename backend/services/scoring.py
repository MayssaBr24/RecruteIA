"""
scoring.py
==========
Calcul des scores par phase et score final pondéré.

Architecture des pénalités (CORRIGÉE) :
  - Incohérences de profil (ProfileInconsistency) → NE pénalisent PAS
  - Warnings de sécurité (SecurityWarningEvent)   → -5 pts chacun, max -15 pts
  - 3 warnings de sécurité = entretien arrêté
"""

from __future__ import annotations
import logging
from typing import Optional
from .groq_client import _call_groq_json
from .security_warnings import SecurityWarningState, compute_security_penalty

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


def _format_transcript(transcript: list, phase: Optional[str] = None) -> str:
    entries = [e for e in transcript if e.get("type") != "voice_analysis"]
    if phase:
        entries = [e for e in entries if e.get("phase") == phase]
    if not entries:
        return "Aucun échange précédent."
    lines = []
    for e in entries:
        ph = e.get("phase", "").upper()
        lines.append(f"[{ph}] Q: {e.get('question', '')}")
        lines.append(f"       R: {e.get('answer', '')}")
    return "\n".join(lines)


def analyze_phase_score(transcript: list, phase: str, job_title: str) -> int:
    phase_entries = [e for e in transcript if e.get("phase") == phase]
    if not phase_entries:
        return 0

    answers   = [e.get("answer", "").strip() for e in phase_entries]
    avg_words = sum(len(a.split()) for a in answers) / max(len(answers), 1)
    garbage_ratio = sum(1 for a in answers if len(a) < 5 or len(a.split()) < 3) / max(len(answers), 1)
    if garbage_ratio >= 0.5:
        return 0

    exchanges = _format_transcript(transcript, phase)
    focus_map = {
        "communication":    "compétences comportementales, communication, motivation et adéquation culturelle",
        "cv_clarification": "cohérence, honnêteté, capacité à expliquer son parcours",
        "technical":        "maîtrise technique, justification des choix, profondeur",
        "scenario":         "résolution de problèmes, maturité professionnelle, STAR",
    }
    focus = focus_map.get(phase, "qualité générale des réponses")

    prompt = f"""
Évalue les réponses. Score 0-100 sur : {focus}
Poste : {job_title} | Phase : {phase}
{exchanges}
Critères : clarté(20) profondeur(20) exemples concrets(20) pertinence(20) communication(20)
JSON : {{"score": <int 0-100>, "justification": "1-2 phrases", "points_forts": ["..."], "points_faibles": ["..."]}}
"""
    result = _call_groq_json(prompt, max_tokens=600)
    score = result.get("score", 30) if result else 30

    if avg_words < 10:   score = max(0, score - 40)
    elif avg_words < 25: score = max(0, score - 15)
    elif avg_words < 40: score = max(0, score - 5)

    return max(0, min(100, int(score)))

from .scoring_scenario import score_scenario_answer


def analyze_scenario_score(transcript: list, scenario_questions: list, job_title: str) -> int:
    """
    Nouveau scoring scénario basé sur scoring_scenario.py (sémantique par question).
    """
    scenario_entries = [e for e in transcript if e.get("phase") == "scenario"]
    if not scenario_entries:
        return 0

    scores = []

    for entry in scenario_entries:
        q_index = entry.get("question_index", 0)
        question_data = scenario_questions[q_index] if q_index < len(scenario_questions) else {}

        result = score_scenario_answer(
            question=entry.get("question", ""),
            answer=entry.get("answer", ""),
            phase="scenario",
            profile={
                "job_title": job_title,
            },
            criteria=question_data.get("evaluation_criteria", []),
        )

        scores.append(result["score"])

    # moyenne des scores des scénarios
    return int(sum(scores) / len(scores))

def compute_final_score(
    communication_score: int,
    clarification_score: int,
    technical_score: int,
    scenario_score: int,
    qcm_score: int,
    security_state: SecurityWarningState,
    vocal_score: Optional[int] = None,
    has_technical_phase: bool = True,
) -> dict:
    """
    Score final pondéré.
    SEULS les warnings de sécurité pénalisent (-5 pts/warning, max -15).
    Les incohérences de profil N'impactent PAS le score.
    """
    has_vocal = vocal_score is not None

    if has_technical_phase:
        w = WEIGHTS_FULL_VOCAL if has_vocal else WEIGHTS_FULL
    else:
        w = WEIGHTS_NO_TECHNICAL_VOCAL if has_vocal else WEIGHTS_NO_TECHNICAL

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
        "[Score] Final=%d raw=%d security_penalty=%d (warnings=%d)",
        final, int(raw), security_penalty, security_state.total_count,
    )

    return {
        "final_score":      final,
        "raw_score":        int(raw),
        "security_penalty": security_penalty,
        "breakdown": {
            "communication": communication_score,
            "clarification": clarification_score,
            "technical":     technical_score,
            "scenario":      scenario_score,
            "qcm":           qcm_score,
            "vocal":         vocal_score,
        },
    }


def _extract_vocal_score(transcript: list) -> Optional[int]:
    vocal  = [e for e in transcript if e.get("type") == "voice_analysis"]
    scores = [e.get("vocal_score", 0) for e in vocal if e.get("vocal_score") is not None]
    return int(sum(scores) / len(scores)) if scores else None