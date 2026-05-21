"""
interview_service/
==================
Package de gestion des entretiens IA.

Structure :
  groq_client.py      — Appels API Groq (JSON + TEXT)
  profile_warnings.py — Incohérences CV (informatif, non pénalisant)
  security_warnings.py — Fraudes comportementales (pénalisant, arrêt à 3)
  scoring.py          — Calcul des scores par phase + score final
  feedback.py         — Rapports RH + emails candidats
  interview.py        — Logique principale (phases, questions, dispatcher)

Séparation des responsabilités :
  ┌─────────────────────────────────────────────────────┐
  │  ProfileInconsistency  →  questions + note RH       │
  │  (CV ≠ lettre ≠ GitHub)    SCORE NON IMPACTÉ        │
  ├─────────────────────────────────────────────────────┤
  │  SecurityWarning       →  pénalité -5 pts/warning   │
  │  (fraude comportemental)   MAX -15 pts              │
  │                            3 warnings = ARRÊT       │
  └─────────────────────────────────────────────────────┘
"""

from .groq_client import _call_groq_json, _call_groq_text
from .profile_warnings import (
    ProfileInconsistency,
    ProfileInconsistencyType,
    detect_profile_inconsistencies,
    format_inconsistencies_for_report,
)
from .security_warnings import (
    SecurityWarningEvent,
    SecurityWarningState,
    SecurityWarningType,
    handle_security_warning,
    compute_security_penalty,
    format_security_warnings_for_report,
    PENALTY_PER_WARNING,
    MAX_WARNINGS_BEFORE_STOP,
)
from .scoring import (
    analyze_phase_score,
    analyze_scenario_score,
    compute_final_score,
    _extract_vocal_score,
)
from .feedback import (
    generate_final_feedback,
    generate_termination_report,
    generate_candidate_feedback,
)
from .speaker_embedding import (
    SpeakerProfile,
    SpeakerEmbeddingAnalyzer,
    speaker_analyzer,

)
from .audio_service import (
    transcribe_audio,
    analyze_voice_enhanced,
    analyze_audio_response,
    detect_double_voice,
    detect_anomalous_silences,
    detect_synthetic_voice,
    detect_background_noise,
    AudioAnomaly,
    VoiceAnalysisResult,
    get_interview_speaker_report,  # ← MANQUAIT
)
from .scoring_scenario import (
    score_scenario_answer,
    score_communication_answer,
    score_technical_answer,
)


__all__ = [
    # Groq
    "_call_groq_json",
    "_call_groq_text",
    # Profile
    "ProfileInconsistency",
    "ProfileInconsistencyType",
    "detect_profile_inconsistencies",
    "format_inconsistencies_for_report",
    # Security
    "SecurityWarningEvent",
    "SecurityWarningState",
    "SecurityWarningType",
    "handle_security_warning",
    "compute_security_penalty",
    "format_security_warnings_for_report",
    "PENALTY_PER_WARNING",
    "MAX_WARNINGS_BEFORE_STOP",
    # Scoring
    "analyze_phase_score",
    "analyze_scenario_score",
    "compute_final_score",
    "_extract_vocal_score",
    # Feedback
    "generate_final_feedback",
    "generate_termination_report",
    "generate_candidate_feedback",
    "get_interview_speaker_report",
]