"""
security_warnings.py
====================
Gestion des WARNINGS DE SÉCURITÉ comportementaux UNIQUEMENT.

Ces warnings sont DISTINCTS des incohérences de profil CV.
- Chaque warning de sécurité = -5 pts sur le score final
- 3 warnings = arrêt immédiat de l'entretien + rapport de fraude
- Les captures d'écran sont horodatées et archivées

Types détectés :
  Caméra       : face_not_visible, multiple_faces, face_not_centered
  Navigation   : tab_switch, window_blur, fullscreen_exit
  Saisie       : copy_paste
  Audio        : double_voice
  Système      : remote_access, anydesk_teamviewer, multi_screen,
                 vm_detected, robot_mouse
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# TYPES DE WARNINGS DE SÉCURITÉ
# ─────────────────────────────────────────────────────────────────────────────

class SecurityWarningType(str, Enum):
    # Caméra
    FACE_NOT_VISIBLE    = "face_not_visible"
    MULTIPLE_FACES      = "multiple_faces"
    FACE_NOT_CENTERED   = "face_not_centered"

    # Navigation / fenêtre
    TAB_SWITCH          = "tab_switch"
    WINDOW_BLUR         = "window_blur"
    FULLSCREEN_EXIT     = "fullscreen_exit"

    # Saisie
    COPY_PASTE          = "copy_paste"

    # Audio
    DOUBLE_VOICE        = "double_voice"

    # Système / accès distant
    REMOTE_ACCESS       = "remote_access"
    ANYDESK_TEAMVIEWER  = "anydesk_teamviewer"
    MULTI_SCREEN        = "multi_screen"
    VM_DETECTED         = "vm_detected"
    ROBOT_MOUSE         = "robot_mouse"


# Description humaine pour chaque type (rapport RH)
SECURITY_WARNING_LABELS: dict[SecurityWarningType, str] = {
    SecurityWarningType.FACE_NOT_VISIBLE:   "Visage non visible à la caméra",
    SecurityWarningType.MULTIPLE_FACES:     "Plusieurs visages détectés dans le champ de la caméra",
    SecurityWarningType.FACE_NOT_CENTERED:  "Visage non centré / absent du cadre caméra",
    SecurityWarningType.TAB_SWITCH:         "Changement d'onglet détecté",
    SecurityWarningType.WINDOW_BLUR:        "Perte de focus de la fenêtre d'entretien",
    SecurityWarningType.FULLSCREEN_EXIT:    "Sortie du mode plein écran",
    SecurityWarningType.COPY_PASTE:         "Copier-coller détecté dans la zone de réponse",
    SecurityWarningType.DOUBLE_VOICE:       "Seconde voix détectée dans l'audio",
    SecurityWarningType.REMOTE_ACCESS:      "Connexion d'accès distant détectée",
    SecurityWarningType.ANYDESK_TEAMVIEWER: "Logiciel AnyDesk / TeamViewer détecté",
    SecurityWarningType.MULTI_SCREEN:       "Configuration multi-écran détectée",
    SecurityWarningType.VM_DETECTED:        "Environnement virtuel (VM) détecté",
    SecurityWarningType.ROBOT_MOUSE:        "Comportement de souris automatisé (bot) détecté",
}

# Pénalité par warning (pts déduits du score final)
PENALTY_PER_WARNING: int = 5

# Seuil d'arrêt automatique de l'entretien
MAX_WARNINGS_BEFORE_STOP: int = 3


# ─────────────────────────────────────────────────────────────────────────────
# DATACLASSES
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class SecurityWarningEvent:
    """Un warning de sécurité horodaté."""
    type: SecurityWarningType
    timestamp: datetime = field(default_factory=datetime.utcnow)
    screenshot_url: Optional[str] = None          # URL capture archivée
    metadata: dict = field(default_factory=dict)  # données brutes du détecteur

    @property
    def label(self) -> str:
        return SECURITY_WARNING_LABELS.get(self.type, self.type.value)

    @property
    def penalty_points(self) -> int:
        return PENALTY_PER_WARNING


@dataclass
class SecurityWarningState:
    """
    État consolidé des warnings de sécurité pour une session d'entretien.
    Injecté dans la session Django via interview.security_state (JSONField).
    """
    events: List[SecurityWarningEvent] = field(default_factory=list)
    interview_terminated: bool = False
    termination_reason: Optional[str] = None

    @property
    def total_count(self) -> int:
        return len(self.events)

    @property
    def penalty_total(self) -> int:
        return min(self.total_count * PENALTY_PER_WARNING, MAX_WARNINGS_BEFORE_STOP * PENALTY_PER_WARNING)

    @property
    def should_terminate(self) -> bool:
        return self.total_count >= MAX_WARNINGS_BEFORE_STOP

    def add_event(self, event: SecurityWarningEvent) -> bool:
        """
        Ajoute un warning. Retourne True si l'entretien doit être arrêté.
        """
        self.events.append(event)
        logger.warning(
            "[SecurityWarning] +1 warning (%d/%d) — type=%s",
            self.total_count, MAX_WARNINGS_BEFORE_STOP, event.type.value,
        )
        if self.should_terminate and not self.interview_terminated:
            self.interview_terminated = True
            self.termination_reason = (
                f"Arrêt automatique : {MAX_WARNINGS_BEFORE_STOP} infractions de sécurité détectées. "
                f"Dernier incident : {event.label}."
            )
            logger.error(
                "[SecurityWarning] ENTRETIEN ARRÊTÉ pour %s — %s",
                event.type.value, self.termination_reason,
            )
            return True
        return False

    def to_dict(self) -> dict:
        return {
            "total_warnings": self.total_count,
            "penalty_points": self.penalty_total,
            "interview_terminated": self.interview_terminated,
            "termination_reason": self.termination_reason,
            "events": [
                {
                    "type": e.type.value,
                    "label": e.label,
                    "timestamp": e.timestamp.isoformat(),
                    "screenshot_url": e.screenshot_url,
                    "metadata": e.metadata,
                }
                for e in self.events
            ],
        }


# ─────────────────────────────────────────────────────────────────────────────
# SERVICE
# ─────────────────────────────────────────────────────────────────────────────

def handle_security_warning(
    state: SecurityWarningState,
    warning_type: str,
    screenshot_url: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> dict:
    """
    Point d'entrée principal : reçoit un warning du frontend/détecteur.

    Returns:
        {
            "acknowledged": bool,
            "warning_count": int,
            "penalty_points": int,
            "terminate_interview": bool,
            "termination_reason": str | None,
            "message_to_candidate": str,
        }
    """
    try:
        wtype = SecurityWarningType(warning_type)
    except ValueError:
        logger.error("[SecurityWarning] Type inconnu reçu : %s", warning_type)
        return {"acknowledged": False, "error": f"Type de warning inconnu : {warning_type}"}

    event = SecurityWarningEvent(
        type=wtype,
        screenshot_url=screenshot_url,
        metadata=metadata or {},
    )

    should_terminate = state.add_event(event)

    remaining = MAX_WARNINGS_BEFORE_STOP - state.total_count
    if should_terminate:
        msg = (
            "⛔ Votre entretien a été interrompu automatiquement suite à la détection "
            f"de {MAX_WARNINGS_BEFORE_STOP} infractions. Un rapport détaillé a été transmis au recruteur."
        )
    elif remaining == 1:
        msg = (
            f"⚠️ Attention : {event.label} détecté(e). "
            f"Un dernier incident entraînera l'arrêt immédiat de l'entretien."
        )
    else:
        msg = (
            f"⚠️ Attention : {event.label} détecté(e). "
            f"({state.total_count}/{MAX_WARNINGS_BEFORE_STOP} — encore {remaining} avant arrêt)"
        )

    return {
        "acknowledged": True,
        "warning_count": state.total_count,
        "penalty_points": state.penalty_total,
        "terminate_interview": should_terminate,
        "termination_reason": state.termination_reason,
        "message_to_candidate": msg,
    }


def compute_security_penalty(state: SecurityWarningState) -> int:
    """
    Retourne les points à déduire du score final.
    Plafonné à MAX_WARNINGS_BEFORE_STOP * PENALTY_PER_WARNING = 15 pts max.
    """
    return state.penalty_total


def format_security_warnings_for_report(state: SecurityWarningState) -> str:
    """Bloc texte pour le rapport RH."""
    if not state.events:
        return "  ✓ Aucun incident de sécurité détecté."

    lines = []
    for i, e in enumerate(state.events, 1):
        shot = f" | Capture : {e.screenshot_url}" if e.screenshot_url else ""
        lines.append(f"  [{i}] {e.timestamp.strftime('%H:%M:%S')} — {e.label}{shot}")

    if state.interview_terminated:
        lines.append(f"\n  🔴 ENTRETIEN INTERROMPU : {state.termination_reason}")

    lines.append(f"\n  Pénalité appliquée : -{state.penalty_total} pts")
    return "\n".join(lines)