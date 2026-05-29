

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

from .groq_client import _call_groq_json

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# DÉTECTION DE NON-SENS (filtre rapide avant scoring IA)
# ─────────────────────────────────────────────────────────────────────────────

def _detect_gibberish(text: str) -> bool:
    """
    Détecte si un texte est du charabia / texte aléatoire avant d'appeler l'IA.
    Retourne True si le texte semble être du non-sens.

    Heuristiques :
      - Ratio consonnes consécutives > 4 sans voyelle (ex: "kkjhsdflk")
      - Ratio mots inconnus très élevé (séquences > 12 chars sans voyelle)
      - Mots < 2 chars représentent > 60% du texte
      - Entropie de bigrammes très faible (texte répétitif) ou très haute (aléatoire)
      - Proportion de vrais mots français/anglais < 10%
    """
    if not text or len(text.strip()) < 10:
        return True

    words = text.strip().split()
    if not words:
        return True

    # 1. Trop de mots ultra-courts (< 2 chars) → spam de lettres
    short_ratio = sum(1 for w in words if len(w) <= 2) / len(words)
    if short_ratio > 0.65:
        return True

    # 2. Séquences de consonnes impossibles en FR/EN (> 5 consonnes d'affilée)
    consonant_clusters = re.findall(r'[bcdfghjklmnpqrstvwxyz]{6,}', text.lower())
    if len(consonant_clusters) >= 2:
        return True

    # 3. Mots avec > 12 caractères sans aucune voyelle
    no_vowel_long = [w for w in words if len(w) > 8 and not re.search(r'[aeiouàâéèêëîïôùûü]', w.lower())]
    if len(no_vowel_long) >= 3:
        return True

    # 4. Répétition massive du même mot ou char (> 40% du texte)
    if words:
        most_common = max(set(words), key=words.count)
        if words.count(most_common) / len(words) > 0.50 and len(words) > 5:
            return True

    return False


def _estimate_useful_word_count(text: str) -> int:
    """Compte les mots de 3+ caractères (filtrage des particules et ponctuation)."""
    return sum(1 for w in text.split() if len(w) >= 3)


# ─────────────────────────────────────────────────────────────────────────────
# SCORING PRINCIPAL
# ─────────────────────────────────────────────────────────────────────────────

def score_scenario_answer(
    question:    str,
    answer:      str,
    phase:       str,
    profile:     Optional[Dict[str, Any]] = None,
    criteria:    Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Score une réponse de scénario de 0 à 100 avec explication.

    Returns:
        {
            "score": int (0-100),
            "label": str ("Insuffisant" | "Acceptable" | "Bien" | "Excellent"),
            "breakdown": {
                "pertinence_question": int,
                "structure_star": int,
                "exemples_concrets": int,
                "profondeur": int,
                "coherence_profil": int,
            },
            "feedback": str,
            "is_gibberish": bool,
            "penalties": list[str],
        }
    """
    # ── Vérification anti-charabia AVANT l'appel IA ──────────────────────────
    if _detect_gibberish(answer):
        logger.warning("[Scoring] Réponse détectée comme charabia — score 0")
        return {
            "score":       0,
            "label":       "Non évalué",
            "breakdown":   {k: 0 for k in ["pertinence_question", "structure_star", "exemples_concrets", "profondeur", "coherence_profil"]},
            "feedback":    "La réponse ne contient pas de contenu évaluable. Veuillez répondre à la question avec des exemples concrets.",
            "is_gibberish": True,
            "penalties":   ["Texte non-intelligible détecté"],
        }

    useful_words = _estimate_useful_word_count(answer)

    # ── Profil candidat (contexte optionnel) ──────────────────────────────────
    profile_block = ""
    if profile:
        profile_block = f"""
Contexte candidat :
- Poste visé : {profile.get('job_title', 'N/A')}
- Expérience : {profile.get('experience_years', 0)} ans
- Compétences déclarées : {', '.join(profile.get('ai_strengths', [])) or 'N/A'}
"""

    criteria_block = ""
    if criteria:
        criteria_block = f"\nCritères spécifiques à cette question : {', '.join(criteria)}\n"

    prompt = f"""
Tu es un évaluateur d'entretien professionnel expert. Évalue cette réponse de manière STRICTE et OBJECTIVE.

QUESTION POSÉE :
"{question}"

RÉPONSE DU CANDIDAT ({useful_words} mots utiles) :
"{answer}"
{profile_block}
{criteria_block}

RÈGLES D'ÉVALUATION STRICTES :
1. Évalue chaque critère de 0 à 20 points selon ce barème PRÉCIS :
   - 0-4   : Absent ou complètement hors sujet
   - 5-9   : Très insuffisant, vague, générique
   - 10-14 : Acceptable mais manque de précision ou d'exemples
   - 15-18 : Bon, pertinent, avec des éléments concrets
   - 19-20 : Excellent, précis, mesurable, impactant

2. PÉNALITÉS (à soustraire du total) :
   - -20 si la réponse est du charabia, du texte aléatoire ou ne répond pas à la question
   - -10 si la réponse est totalement hors sujet
   - -5  si moins de 20 mots utiles

3. BONUS :
   - +5 si la réponse cite des résultats mesurables (%, chiffres, délais)

4. Une réponse de 200 lettres aléatoires DOIT scorer 0, pas 25.
   Une vraie réponse structurée de 150 mots peut scorer 70-85.

CRITÈRES :
- pertinence_question (0-20) : La réponse traite-t-elle exactement ce qui est demandé ?
- structure_star (0-20)      : Situation → Tâche/Problème → Action → Résultat identifiables ?
- exemples_concrets (0-20)   : Exemples réels, chiffres, technologies, projets nommés ?
- profondeur (0-20)          : Réflexion, nuance, complexité de la pensée ?
- coherence_profil (0-20)    : Cohérence avec le profil/expérience du candidat ?

Réponds UNIQUEMENT en JSON strict :
{{
  "pertinence_question": <int 0-20>,
  "structure_star": <int 0-20>,
  "exemples_concrets": <int 0-20>,
  "profondeur": <int 0-20>,
  "coherence_profil": <int 0-20>,
  "bonus": <int 0 ou 5>,
  "penalty": <int 0-30, valeur positive à soustraire>,
  "penalty_reasons": ["..."],
  "feedback": "<2-3 phrases FR : points forts + ce qui manque>"
}}
"""

    result = _call_groq_json(prompt, max_tokens=600, temperature=0.1)

    # ── Calcul du score ───────────────────────────────────────────────────────
    breakdown = {
        "pertinence_question": _clamp(result.get("pertinence_question", 0), 0, 20),
        "structure_star":      _clamp(result.get("structure_star", 0),      0, 20),
        "exemples_concrets":   _clamp(result.get("exemples_concrets", 0),   0, 20),
        "profondeur":          _clamp(result.get("profondeur", 0),           0, 20),
        "coherence_profil":    _clamp(result.get("coherence_profil", 0),    0, 20),
    }

    raw_score = sum(breakdown.values())
    bonus     = _clamp(result.get("bonus", 0),   0, 5)
    penalty   = _clamp(result.get("penalty", 0), 0, 30)

    # Pénalité supplémentaire : réponse trop courte
    if useful_words < 20:
        penalty += 5

    final_score = _clamp(raw_score + bonus - penalty, 0, 100)

    label = (
        "Insuffisant" if final_score < 40 else
        "Acceptable"  if final_score < 60 else
        "Bien"        if final_score < 80 else
        "Excellent"
    )

    penalty_reasons: List[str] = result.get("penalty_reasons", [])
    if useful_words < 20:
        penalty_reasons.append("Réponse trop courte")

    logger.info(
        "[Scoring %s] score=%d breakdown=%s bonus=%d penalty=%d",
        phase, final_score, breakdown, bonus, penalty,
    )

    return {
        "score":       final_score,
        "label":       label,
        "breakdown":   breakdown,
        "feedback":    result.get("feedback", ""),
        "is_gibberish": False,
        "penalties":   penalty_reasons,
    }


def score_communication_answer(
    question: str,
    answer:   str,
    profile:  Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Wrapper pour les réponses de communication — mêmes règles anti-charabia.
    Critères légèrement différents (moins technique, plus soft skills).
    """
    return score_scenario_answer(
        question=question,
        answer=answer,
        phase="communication",
        profile=profile,
        criteria=[
            "Clarté de l'expression",
            "Capacité à donner des exemples concrets",
            "Authenticité et conviction",
            "Pertinence par rapport au poste visé",
            "Structure et cohérence du discours",
        ],
    )


def score_technical_answer(
    question: str,
    answer:   str,
    angle:    str = "",
    profile:  Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Wrapper pour les réponses techniques orales.
    Critères orientés architecture, technologie, impact.
    """
    return score_scenario_answer(
        question=question,
        answer=answer,
        phase="technical",
        profile=profile,
        criteria=[
            f"Maîtrise technique ({angle or 'général'})",
            "Justification des choix technologiques",
            "Prise en compte des contraintes (performance, sécurité, scalabilité)",
            "Clarté d'explication à un pair",
            "Expérience concrète démontrée",
        ],
    )


# ─────────────────────────────────────────────────────────────────────────────
# UTILITAIRES
# ─────────────────────────────────────────────────────────────────────────────

def _clamp(value: Any, lo: int, hi: int) -> int:
    try:
        return max(lo, min(hi, int(value)))
    except (TypeError, ValueError):
        return lo