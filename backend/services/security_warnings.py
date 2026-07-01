from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional

logger = logging.getLogger(__name__)


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

    # Audio — anciens
    DOUBLE_VOICE        = "double_voice"

    # ── NOUVEAU — Sécurité vocale ────────────────────────────────────
    SPEAKER_CHANGE              = "speaker_change"
    MULTIPLE_SPEAKERS           = "multiple_speakers_simultaneous"
    QUESTION_REREAD             = "question_reread"
    # ────────────────────────────────────────────────────────────────

    # Système / accès distant
    REMOTE_ACCESS       = "remote_access"
    ANYDESK_TEAMVIEWER  = "anydesk_teamviewer"
    MULTI_SCREEN        = "multi_screen"
    VM_DETECTED         = "vm_detected"
    ROBOT_MOUSE         = "robot_mouse"
    DEVTOOLS_OPEN       = "devtools_open"
    TIME_EXCEEDED       = "time_exceeded"


SECURITY_WARNING_LABELS: dict[SecurityWarningType, str] = {
    SecurityWarningType.FACE_NOT_VISIBLE:   "Visage non visible à la caméra",
    SecurityWarningType.MULTIPLE_FACES:     "Plusieurs visages détectés dans le champ de la caméra",
    SecurityWarningType.FACE_NOT_CENTERED:  "Visage non centré / absent du cadre caméra",
    SecurityWarningType.TAB_SWITCH:         "Changement d'onglet détecté",
    SecurityWarningType.WINDOW_BLUR:        "Perte de focus de la fenêtre d'entretien",
    SecurityWarningType.FULLSCREEN_EXIT:    "Sortie du mode plein écran",
    SecurityWarningType.COPY_PASTE:         "Copier-coller détecté dans la zone de réponse",
    SecurityWarningType.DOUBLE_VOICE:       "Seconde voix détectée dans l'audio",
    # NOUVEAU
    SecurityWarningType.SPEAKER_CHANGE:     "Changement de locuteur détecté (voix différente)",
    SecurityWarningType.MULTIPLE_SPEAKERS:  "Plusieurs voix simultanées détectées (soufflage probable)",
    SecurityWarningType.QUESTION_REREAD:    "Le candidat a relu la question à voix haute",
    # Système
    SecurityWarningType.REMOTE_ACCESS:      "Connexion d'accès distant détectée",
    SecurityWarningType.ANYDESK_TEAMVIEWER: "Logiciel AnyDesk / TeamViewer détecté",
    SecurityWarningType.MULTI_SCREEN:       "Configuration multi-écran détectée",
    SecurityWarningType.VM_DETECTED:        "Environnement virtuel (VM) détecté",
    SecurityWarningType.ROBOT_MOUSE:        "Comportement de souris automatisé (bot) détecté",
    SecurityWarningType.DEVTOOLS_OPEN:      "DevTools ouvert pendant l'entretien",
    SecurityWarningType.TIME_EXCEEDED:      "Dépassement du temps imparti",
}

# Pénalités spécifiques par type (overrides PENALTY_PER_WARNING si défini)
WARNING_PENALTIES: dict[SecurityWarningType, int] = {
    SecurityWarningType.SPEAKER_CHANGE:    15,   # critique
    SecurityWarningType.MULTIPLE_SPEAKERS: 15,   # critique
    SecurityWarningType.QUESTION_REREAD:   8,    # moyen
    SecurityWarningType.DOUBLE_VOICE:      10,
    # tous les autres → PENALTY_PER_WARNING (5 pts)
}

PENALTY_PER_WARNING:      int = 5
MAX_WARNINGS_BEFORE_STOP: int = 3


@dataclass
class SecurityWarningEvent:
    """Un warning de sécurité horodaté."""
    type:           SecurityWarningType
    timestamp:      datetime = field(default_factory=datetime.utcnow)
    screenshot_url: Optional[str] = None
    metadata:       dict = field(default_factory=dict)
    # NOUVEAU — champs optionnels pour les warnings vocaux
    severity:       str = "medium"
    penalty:        int = 0          # 0 = utilise WARNING_PENALTIES ou PENALTY_PER_WARNING
    description:    str = ""

    @property
    def label(self) -> str:
        return SECURITY_WARNING_LABELS.get(self.type, self.type.value)

    @property
    def penalty_points(self) -> int:
        # Priorité : penalty explicite → table WARNING_PENALTIES → défaut
        if self.penalty > 0:
            return self.penalty
        return WARNING_PENALTIES.get(self.type, PENALTY_PER_WARNING)


@dataclass
class SecurityWarningState:
    """
    État consolidé des warnings de sécurité pour une session d'entretien.
    """
    events:               List[SecurityWarningEvent] = field(default_factory=list)
    interview_terminated: bool = False
    termination_reason:   Optional[str] = None

    @property
    def total_count(self) -> int:
        return len(self.events)

    @property
    def penalty_total(self) -> int:
        """Somme des pénalités individuelles, plafonnée à 15 pts."""
        total = sum(e.penalty_points for e in self.events)
        return min(total, MAX_WARNINGS_BEFORE_STOP * PENALTY_PER_WARNING)

    @property
    def should_terminate(self) -> bool:
        """Alias principal — entretien doit-il être arrêté ?"""
        return self.total_count >= MAX_WARNINGS_BEFORE_STOP

    # NOUVEAU — alias pour compatibilité avec les vues existantes
    def should_stop_interview(self) -> bool:
        """Alias de should_terminate pour compatibilité avec les vues."""
        return self.should_terminate

    def add_event(self, event: SecurityWarningEvent) -> bool:
        """
        Ajoute un warning. Retourne True si l'entretien doit être arrêté.
        """
        self.events.append(event)
        logger.warning(
            "[SecurityWarning] +1 warning (%d/%d) — type=%s severity=%s penalty=%d",
            self.total_count, MAX_WARNINGS_BEFORE_STOP,
            event.type.value, event.severity, event.penalty_points,
        )
        if self.should_terminate and not self.interview_terminated:
            self.interview_terminated = True
            self.termination_reason = (
                f"Arrêt automatique : {MAX_WARNINGS_BEFORE_STOP} infractions détectées. "
                f"Dernier incident : {event.label}."
            )
            logger.error(
                "[SecurityWarning] ENTRETIEN ARRÊTÉ — %s", self.termination_reason,
            )
            return True
        return False

    def to_dict(self) -> dict:
        return {
            "total_warnings":       self.total_count,
            "penalty_points":       self.penalty_total,
            "interview_terminated": self.interview_terminated,
            "termination_reason":   self.termination_reason,
            "events": [
                {
                    "type":           e.type.value,
                    "label":          e.label,
                    "timestamp":      e.timestamp.isoformat(),
                    "severity":       e.severity,
                    "penalty_points": e.penalty_points,
                    "description":    e.description or e.label,
                    "screenshot_url": e.screenshot_url,
                    "metadata":       e.metadata,
                }
                for e in self.events
            ],
        }


def handle_security_warning(
    state:          SecurityWarningState,
    warning_type:   str,
    screenshot_url: Optional[str] = None,
    metadata:       Optional[dict] = None,
    severity:       str = "medium",
    penalty:        int = 0,
    description:    str = "",
) -> dict:
    """
    Point d'entrée principal : reçoit un warning du frontend/détecteur.
    CORRIGÉ : accepte maintenant les nouveaux types vocaux sans ValueError.
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
        severity=severity,
        penalty=penalty,
        description=description or SECURITY_WARNING_LABELS.get(wtype, warning_type),
    )

    should_stop = state.add_event(event)

    remaining = max(0, MAX_WARNINGS_BEFORE_STOP - state.total_count)
    if should_stop:
        msg = (
            "⛔ Votre entretien a été interrompu automatiquement suite à la détection "
            f"de {MAX_WARNINGS_BEFORE_STOP} infractions. "
            "Un rapport détaillé a été transmis au recruteur."
        )
    elif remaining == 1:
        msg = (
            f"⚠️ {event.label}. "
            "Un dernier incident entraînera l'arrêt immédiat de l'entretien."
        )
    else:
        msg = (
            f"⚠️ {event.label}. "
            f"({state.total_count}/{MAX_WARNINGS_BEFORE_STOP} — encore {remaining} avant arrêt)"
        )

    return {
        "acknowledged":        True,
        "warning_count":       state.total_count,
        "penalty_points":      state.penalty_total,
        "terminate_interview": should_stop,
        "termination_reason":  state.termination_reason,
        "message_to_candidate": msg,
    }


def compute_security_penalty(state: SecurityWarningState) -> int:
    """Retourne les points à déduire du score final (max 15 pts)."""
    return state.penalty_total


def format_security_warnings_for_report(state: SecurityWarningState) -> str:
    """Bloc texte pour le rapport RH."""
    if not state.events:
        return "  ✓ Aucun incident de sécurité détecté."

    lines = []
    for i, e in enumerate(state.events, 1):
        shot = f" | Capture : {e.screenshot_url}" if e.screenshot_url else ""
        lines.append(
            f"  [{i}] {e.timestamp.strftime('%H:%M:%S')} — {e.label} "
            f"(sévérité: {e.severity}, -{e.penalty_points} pts){shot}"
        )

    if state.interview_terminated:
        lines.append(f"\n  🔴 ENTRETIEN INTERROMPU : {state.termination_reason}")

    lines.append(f"\n  Pénalité totale appliquée : -{state.penalty_total} pts")
    return "\n".join(lines)