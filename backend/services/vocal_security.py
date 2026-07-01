from __future__ import annotations

import logging
import re
import unicodedata
from difflib import SequenceMatcher
from typing import List, Optional

import numpy as np

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

# Seuil au-delà duquel on considère que le candidat a relu la question
QUESTION_REPEAT_THRESHOLD = 0.72   # ratio de similarité textuelle (0-1)

# Nombre minimum de mots dans la transcription pour tenter la détection
# (évite les faux positifs sur les réponses "oui" / "non" / très courtes)
MIN_WORDS_FOR_DETECTION = 6

# Fenêtre de début de réponse à analyser (les N premiers mots)
# Le candidat qui relit la question le fait généralement au début
LEADING_WORDS_WINDOW = 25


# ─────────────────────────────────────────────────────────────────────────────
# UTILITAIRES TEXTE
# ─────────────────────────────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    """
    Normalisation pour comparaison textuelle :
      - Minuscules
      - Suppression accents
      - Suppression ponctuation
      - Suppression mots vides courants (articles, pronoms…)
    """
    # Minuscules + suppression accents
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")

    # Suppression ponctuation
    text = re.sub(r"[^\w\s]", " ", text)

    # Mots vides FR + EN (ne pas les compter dans la similarité)
    STOP_WORDS = {
        "le", "la", "les", "un", "une", "des", "du", "de", "en", "et",
        "est", "que", "qui", "quoi", "dans", "pour", "par", "sur", "avec",
        "vous", "votre", "vos", "vouz", "il", "elle", "ils", "elles",
        "je", "tu", "nous", "on", "ce", "se", "sa", "son", "ses",
        "au", "aux", "a", "ou", "si", "ne", "pas", "plus",
        "the", "a", "an", "is", "are", "was", "were", "in", "on", "at",
        "to", "of", "and", "or", "but", "how", "what", "when", "where",
    }

    words = text.split()
    words = [w for w in words if w not in STOP_WORDS and len(w) > 2]
    return " ".join(words)


def _similarity_ratio(text_a: str, text_b: str) -> float:
    """
    Ratio de similarité textuelle entre deux textes normalisés.
    Utilise SequenceMatcher (Ratcliff/Obershelp) — rapide, sans dépendance.
    Retourne un float entre 0 (totalement différent) et 1 (identique).
    """
    a = _normalize(text_a)
    b = _normalize(text_b)
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def _leading_window(text: str, n_words: int = LEADING_WORDS_WINDOW) -> str:
    """Retourne les N premiers mots du texte (début de réponse)."""
    return " ".join(text.split()[:n_words])


def _word_overlap_ratio(text_a: str, text_b: str) -> float:
    """
    Ratio de mots en commun (Jaccard sur les mots normalisés).
    Complémentaire à SequenceMatcher pour les réponses réordonnées.
    """
    a_words = set(_normalize(text_a).split())
    b_words = set(_normalize(text_b).split())
    if not a_words or not b_words:
        return 0.0
    intersection = a_words & b_words
    union        = a_words | b_words
    return len(intersection) / len(union)


# ─────────────────────────────────────────────────────────────────────────────
# DÉTECTION RELECTURE QUESTION
# ─────────────────────────────────────────────────────────────────────────────

def detect_question_reread(
    transcribed_text: str,
    question_text:    str,
) -> dict:
    """
    Détecte si le candidat a relu la question affichée à voix haute.

    Stratégie à 3 niveaux :
      1. Similarité globale transcription / question
      2. Similarité sur les N premiers mots (fenêtre de début)
      3. Jaccard sur les mots clés (overlap)

    Un warning est déclenché si au moins 2 des 3 indicateurs dépassent le seuil.

    Returns:
        {
            "detected": bool,
            "confidence": float (0-1),
            "method": str,
            "details": dict,
        }
    """
    if not transcribed_text or not question_text:
        return {"detected": False, "confidence": 0.0, "method": "skip_empty", "details": {}}

    words = transcribed_text.strip().split()
    if len(words) < MIN_WORDS_FOR_DETECTION:
        return {"detected": False, "confidence": 0.0, "method": "skip_too_short", "details": {}}

    # ── 3 indicateurs ─────────────────────────────────────────────────────────
    sim_global  = _similarity_ratio(transcribed_text, question_text)
    sim_leading = _similarity_ratio(
        _leading_window(transcribed_text, LEADING_WORDS_WINDOW),
        question_text,
    )
    sim_jaccard = _word_overlap_ratio(transcribed_text, question_text)

    indicators_triggered = sum([
        sim_global  >= QUESTION_REPEAT_THRESHOLD,
        sim_leading >= QUESTION_REPEAT_THRESHOLD,
        sim_jaccard >= QUESTION_REPEAT_THRESHOLD,
    ])

    # Confidence = moyenne pondérée des 3 indicateurs
    confidence = (
        sim_global  * 0.40 +
        sim_leading * 0.35 +
        sim_jaccard * 0.25
    )

    detected = indicators_triggered >= 2

    if detected:
        logger.warning(
            "[VocalSecurity] Relecture question détectée — "
            "sim_global=%.2f sim_leading=%.2f sim_jaccard=%.2f",
            sim_global, sim_leading, sim_jaccard,
        )

    return {
        "detected":    detected,
        "confidence":  round(confidence, 3),
        "method":      "triple_indicator",
        "details": {
            "sim_global":         round(sim_global, 3),
            "sim_leading":        round(sim_leading, 3),
            "sim_jaccard":        round(sim_jaccard, 3),
            "indicators_triggered": indicators_triggered,
            "threshold":          QUESTION_REPEAT_THRESHOLD,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# CHECKER PRINCIPAL
# ─────────────────────────────────────────────────────────────────────────────

class VocalSecurityChecker:
    """
    Point d'entrée unique pour toutes les vérifications de sécurité vocale.

    Appeler analyze() après chaque réponse audio transcrite.
    Retourne une liste de warnings à passer à SecurityWarningState.

    Exemple :
        checker = VocalSecurityChecker()
        warnings = checker.analyze(
            transcribed_text=transcription['text'],
            question_text=current_question['question'],
            audio_bytes=audio_bytes,
            interview_id=str(interview.id),
            timestamp=response_index * 60.0,
        )
    """

    def analyze(
        self,
        transcribed_text: str,
        question_text:    str,
        audio_bytes:      bytes,
        interview_id:     str,
        timestamp:        float,
        candidate_id:     Optional[str] = None,
    ) -> List[dict]:
        """
        Lance toutes les vérifications de sécurité vocale.

        Retourne une liste de warnings, chacun au format :
        {
            "type":        str,   # "question_reread" | "speaker_change" | "multiple_speakers"
            "severity":    str,   # "low" | "medium" | "high" | "critical"
            "penalty":     int,   # points à soustraire (géré par security_warnings.py)
            "description": str,
            "details":     dict,
        }
        """
        warnings: List[dict] = []

        # ── 1. Détection relecture question ────────────────────────────────────
        try:
            reread_result = detect_question_reread(transcribed_text, question_text)
            if reread_result["detected"]:
                confidence = reread_result["confidence"]
                severity   = "high" if confidence >= 0.85 else "medium"
                warnings.append({
                    "type":        "question_reread",
                    "severity":    severity,
                    "penalty":     15 if severity == "high" else 8,
                    "description": (
                        f"Le candidat semble avoir relu la question à voix haute "
                        f"(similarité textuelle : {confidence * 100:.0f}%)"
                    ),
                    "details": reread_result["details"],
                })
                logger.warning(
                    "[VocalSecurity] WARNING question_reread — interview=%s confidence=%.2f",
                    interview_id, confidence,
                )
        except Exception as exc:
            logger.error("[VocalSecurity] Erreur detect_question_reread : %s", exc)

        # ── 2. Vérification cohérence vocale (Resemblyzer) ────────────────────
        if audio_bytes:
            try:
                from .speaker_embedding import speaker_analyzer

                is_consistent, similarity_pct, details = speaker_analyzer.verify_speaker_consistency(
                    interview_id=interview_id,
                    audio_bytes=audio_bytes,
                    timestamp=timestamp,
                    candidate_id=candidate_id,
                )

                if not is_consistent and not details.get("is_first", False):
                    sudden = details.get("sudden_change", False)
                    warnings.append({
                        "type":        "speaker_change",
                        "severity":    "critical" if sudden else "high",
                        "penalty":     30 if sudden else 20,
                        "description": (
                            f"{'Changement brusque de locuteur' if sudden else 'Changement de locuteur'} détecté "
                            f"(similarité vocale : {similarity_pct:.0f}% — "
                            f"seuil : {details.get('threshold', 0.75) * 100:.0f}%)"
                        ),
                        "details": details,
                    })

            except ImportError:
                logger.warning("[VocalSecurity] speaker_embedding non disponible — skip diarisation")
            except Exception as exc:
                logger.error("[VocalSecurity] Erreur verify_speaker_consistency : %s", exc)

        # ── 3. Détection multi-locuteurs dans le clip ──────────────────────────
        if audio_bytes:
            try:
                from .speaker_embedding import speaker_analyzer

                multi_result = speaker_analyzer.detect_multiple_speakers_in_audio(audio_bytes)

                if multi_result.get("has_multiple"):
                    n_speakers = multi_result.get("unique_speakers", 2)
                    warnings.append({
                        "type":        "multiple_speakers",
                        "severity":    "high",
                        "penalty":     20,
                        "description": (
                            f"{n_speakers} voix distinctes détectées dans la même réponse "
                            f"(soufflage probable)"
                        ),
                        "details": {
                            "unique_speakers":   n_speakers,
                            "total_segments":    multi_result.get("total_segments", 0),
                        },
                    })

            except ImportError:
                pass
            except Exception as exc:
                logger.error("[VocalSecurity] Erreur detect_multiple_speakers : %s", exc)

        if warnings:
            logger.info(
                "[VocalSecurity] %d warning(s) pour interview=%s : %s",
                len(warnings),
                interview_id,
                [w["type"] for w in warnings],
            )

        return warnings


# ─────────────────────────────────────────────────────────────────────────────
# SINGLETON — importer directement dans les vues
# ─────────────────────────────────────────────────────────────────────────────

vocal_security = VocalSecurityChecker()