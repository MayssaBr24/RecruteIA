from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

from .groq_client import _call_groq_json

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# DÉTECTION DE NON-SENS
# ─────────────────────────────────────────────────────────────────────────────

def _detect_gibberish(text: str) -> bool:
    """
    Détecte si un texte est du charabia / texte aléatoire.
    Retourne True si le texte semble être du non-sens.

    CORRECTIONS v2 :
    - Détecte le spam de mots valides répétés ("oui oui oui oui oui")
    - Détecte les réponses mono-mot répété (ex: "je je je je")
    - Seuil consonnes abaissé à 5 (était 6  — trop permissif)
    - Détecte les séquences de chiffres aléatoires
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
    #    CORRIGÉ : seuil abaissé de 6 à 5
    consonant_clusters = re.findall(r'[bcdfghjklmnpqrstvwxyz]{5,}', text.lower())
    if len(consonant_clusters) >= 2:
        return True

    # 3. Mots avec > 8 caractères sans aucune voyelle
    no_vowel_long = [
        w for w in words
        if len(w) > 8 and not re.search(r'[aeiouàâéèêëîïôùûü]', w.lower())
    ]
    if len(no_vowel_long) >= 2:
        return True


    if len(words) >= 4:
        lowered = [w.lower().strip(".,;:!?") for w in words]
        STOPWORDS_FR = {
            "de", "le", "la", "les", "un", "une", "des", "du", "et", "ou",
            "à", "au", "aux", "en", "sur", "pour", "dans", "par", "avec",
            "ce", "ces", "que", "qui", "ne", "pas", "se", "sa", "son", "ses",
        }
        most_common = max(set(lowered), key=lowered.count)
        repeat_ratio = lowered.count(most_common) / len(lowered)
        if repeat_ratio > 0.40 and most_common not in STOPWORDS_FR:
            return True

    # 5. NOUVEAU : Séquences de chiffres aléatoires (ex: "123 456 789 012")
    digit_words = [w for w in words if re.fullmatch(r'\d+', w)]
    if len(digit_words) / max(len(words), 1) > 0.60:
        return True

    # 6. NOUVEAU : Texte trop court en mots réels (moins de 3 mots de 3+ chars)
    real_words = [w for w in words if len(w) >= 3 and re.search(r'[aeiouàâéèêëîïôùûü]', w.lower())]
    if len(real_words) < 2 and len(words) < 6:
        return True

    return False


def _estimate_useful_word_count(text: str) -> int:
    """Compte les mots de 3+ caractères (filtre particules et ponctuation)."""
    return sum(1 for w in text.split() if len(w) >= 3)


# ─────────────────────────────────────────────────────────────────────────────
# PROMPTS SPÉCIFIQUES PAR ANGLE TECHNIQUE
# ─────────────────────────────────────────────────────────────────────────────

# Mapping angle → description de ce qu'on évalue précisément
ANGLE_FOCUS: Dict[str, str] = {
    "architecture": (
        "la capacité à concevoir et expliquer une architecture logicielle : "
        "choix des couches, séparation des responsabilités, flux de données, "
        "justification des patterns (monolithe, microservices, MVC…)"
    ),
    "code_explanation": (
        "la compréhension du code produit : logique de l'extrait, rôle dans le projet, "
        "choix d'implémentation (gestion d'erreurs, nommage, structure), "
        "et capacité à identifier des améliorations concrètes"
    ),
    "technologies": (
        "la maturité dans le choix des outils : justification du choix face aux alternatives, "
        "compromis acceptés (performance, maintenabilité, courbe d'apprentissage), "
        "et connaissance des cas où l'outil concurrent serait préférable"
    ),
    "contribution_tache": (
        "la capacité à résoudre des problèmes complexes via méthode STAR : "
        "identification de la contrainte, démarche de diagnostic, "
        "solution choisie parmi alternatives, résultat mesurable"
    ),
    "code_review": (
        "l'esprit critique sur son propre code : identification d'un point fort, "
        "d'une faiblesse ou dette technique, et proposition de refactoring concret"
    ),
}

# Critères de breakdown spécifiques par angle
ANGLE_BREAKDOWN_CRITERIA: Dict[str, Dict[str, str]] = {
    "architecture": {
        "pertinence_question": "La réponse décrit-elle bien l'architecture demandée ?",
        "profondeur_technique": "Couches, patterns, flux décrits avec précision ?",
        "justification_choix": "Les choix d'architecture sont-ils justifiés ?",
        "exemples_concrets": "Exemples réels du projet ou cas concrets cités ?",
        "coherence_profil": "Cohérence avec l'expérience et le poste visé ?",
    },
    "code_explanation": {
        "pertinence_question": "La réponse explique-t-elle bien le code demandé ?",
        "comprehension_logique": "La logique du code est-elle comprise et bien expliquée ?",
        "qualite_implementation": "Les choix d'implémentation sont-ils analysés (erreurs, nommage) ?",
        "ameliorations_proposees": "Des améliorations concrètes et pertinentes sont-elles proposées ?",
        "coherence_profil": "Niveau de compréhension cohérent avec l'expérience déclarée ?",
    },
    "technologies": {
        "pertinence_question": "La réponse traite-t-elle le choix technologique demandé ?",
        "connaissance_alternatives": "Les alternatives sont-elles connues et comparées ?",
        "compromis_acceptes": "Les compromis (perf, maint, apprentissage) sont-ils analysés ?",
        "exemples_concrets": "Exemples réels d'usage ou de contexte cités ?",
        "maturite_technique": "Maturité dans le raisonnement technologique ?",
    },
    "contribution_tache": {
        "pertinence_question": "La réponse décrit-elle bien la tâche difficile demandée ?",
        "structure_star": "Situation → Tâche → Action → Résultat identifiables ?",
        "diagnostic_technique": "La démarche de diagnostic est-elle claire et rigoureuse ?",
        "solution_choisie": "La solution et les alternatives envisagées sont-elles expliquées ?",
        "resultat_mesurable": "Le résultat est-il concret et mesurable ?",
    },
    "code_review": {
        "pertinence_question": "La réponse porte-t-elle sur le code demandé ?",
        "identification_forces": "Un point fort réel et justifié est-il identifié ?",
        "identification_faiblesses": "Une faiblesse ou dette technique réelle est-elle identifiée ?",
        "refactoring_propose": "Une proposition de refactoring concrète est-elle faite ?",
        "esprit_critique": "L'auto-évaluation est-elle honnête et pertinente ?",
    },
}

# Critères génériques pour les phases non-techniques
GENERIC_BREAKDOWN_CRITERIA: Dict[str, Dict[str, str]] = {
    "communication": {
        "pertinence_question": "La réponse traite-t-elle exactement ce qui est demandé ?",
        "authenticite": "La réponse semble-t-elle sincère, personnelle, non récitée ?",
        "exemples_concrets": "Des exemples réels, situations vécues, projets nommés ?",
        "clarte_expression": "Clarté, structure, facilité de compréhension ?",
        "coherence_profil": "Cohérence avec le parcours et le poste visé ?",
    },
    "cv_clarification": {
        "pertinence_question": "La réponse traite-t-elle exactement ce qui est demandé ?",
        "precision_factuelle": "Dates, noms, technologies, chiffres précis et vérifiables ?",
        "coherence_cv": "Cohérence avec le reste du parcours déclaré ?",
        "completude": "La réponse est-elle complète ou évasive ?",
        "clarte_expression": "Clarté et facilité de compréhension ?",
    },
    "scenario": {
        "pertinence_question": "La réponse traite-t-elle exactement ce qui est demandé ?",
        "structure_star": "Situation → Tâche/Problème → Action → Résultat identifiables ?",
        "exemples_concrets": "Exemples réels, chiffres, technologies, projets nommés ?",
        "profondeur": "Réflexion, nuance, complexité de la pensée ?",
        "resultat_mesurable": "Le résultat est-il concret, mesurable, impactant ?",
    },
}


def _get_breakdown_criteria(phase: str, angle: str = "") -> Dict[str, str]:
    """Retourne les critères de breakdown adaptés à la phase et à l'angle."""
    if phase == "technical" and angle in ANGLE_BREAKDOWN_CRITERIA:
        return ANGLE_BREAKDOWN_CRITERIA[angle]
    if phase in GENERIC_BREAKDOWN_CRITERIA:
        return GENERIC_BREAKDOWN_CRITERIA[phase]
    # Fallback générique
    return {
        "pertinence_question": "Pertinence par rapport à la question posée",
        "structure":           "Structure et clarté de la réponse",
        "exemples_concrets":   "Exemples concrets et situations réelles",
        "profondeur":          "Profondeur et précision du contenu",
        "coherence_profil":    "Cohérence avec le profil et le poste visé",
    }


# ─────────────────────────────────────────────────────────────────────────────
# SCORING PRINCIPAL — UNIFIÉ ET ALIGNÉ SUR LES PHASES
# ─────────────────────────────────────────────────────────────────────────────

def score_phase_answer(
    question:    str,
    answer:      str,
    phase:       str,
    job_title:   str,
    angle:       str = "",
    criteria:    Optional[List[str]] = None,
    profile:     Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Score une réponse 0-100 avec breakdown adapté à la phase ET à l'angle.

    NOUVEAU v2 :
    - Un seul point d'entrée pour toutes les phases (remplace score_scenario_answer,
      score_communication_answer, score_clarification_answer, score_technical_answer)
    - Prompt spécifique selon phase + angle (5 angles techniques distincts)
    - evaluation_criteria réellement intégrés dans le prompt
    - breakdown aligné sur ce qui est réellement évalué dans chaque angle
    - Bonus/pénalités cohérents avec la phase

    Returns:
        {
            "score": int (0-100),
            "label": str,
            "breakdown": dict,
            "feedback": str,
            "is_gibberish": bool,
            "penalties": list[str],
        }
    """
    # ── Anti-charabia AVANT appel IA ─────────────────────────────────────
    if _detect_gibberish(answer):
        breakdown_keys = list(_get_breakdown_criteria(phase, angle).keys())
        logger.warning("[Scoring] Réponse détectée comme charabia — score 0")
        return {
            "score":        0,
            "label":        "Non évalué",
            "breakdown":    {k: 0 for k in breakdown_keys},
            "feedback":     "La réponse ne contient pas de contenu évaluable.",
            "is_gibberish": True,
            "penalties":    ["Texte non-intelligible détecté"],
        }

    useful_words = _estimate_useful_word_count(answer)
    breakdown_criteria = _get_breakdown_criteria(phase, angle)

    # ── Contexte candidat ─────────────────────────────────────────────────
    profile_block = ""
    if profile:
        profile_block = f"""
Contexte candidat :
- Poste visé        : {profile.get('job_title', job_title)}
- Expérience        : {profile.get('experience_years', 0)} ans
- Points forts      : {', '.join(profile.get('ai_strengths', [])) or 'N/A'}
- Points faibles    : {', '.join(profile.get('ai_weaknesses', [])) or 'N/A'}
- Compétences Δ     : {', '.join(profile.get('ai_missing_skills', [])) or 'aucune'}
"""

    # ── Focus selon phase et angle ────────────────────────────────────────
    if phase == "technical" and angle:
        focus = ANGLE_FOCUS.get(angle, "maîtrise technique et justification des choix")
        phase_label = f"Technique — Angle : {angle}"
    elif phase == "communication":
        focus = "soft skills, motivation, authenticité, savoir-être"
        phase_label = "Communication / Soft Skills"
    elif phase == "cv_clarification":
        focus = "cohérence factuelle, précision, honnêteté sur le parcours"
        phase_label = "Clarification CV"
    elif phase == "scenario":
        focus = "résolution de problèmes, maturité professionnelle, méthode STAR"
        phase_label = "Scénario Professionnel"
    else:
        focus = "qualité générale des réponses"
        phase_label = phase

    # ── Critères spécifiques à la question (evaluation_criteria) ─────────
    specific_criteria_block = ""
    if criteria:
        specific_criteria_block = (
            f"\nCritères spécifiques à cette question (à pondérer fortement) :\n"
            + "\n".join(f"  • {c}" for c in criteria)
            + "\n"
        )

    # ── Construction du breakdown pour le prompt ──────────────────────────
    breakdown_prompt_lines = "\n".join(
        f"- {key} (0-20) : {desc}"
        for key, desc in breakdown_criteria.items()
    )

    # ── Règles de pénalité selon la phase ────────────────────────────────
    if phase == "technical":
        penalty_rules = (
            "- +20 si la réponse est du charabia ou ne répond pas à la question\n"
            "- +15 si totalement hors sujet technique\n"
            "- +10 si aucune justification technique fournie\n"
            "- +5  si moins de 25 mots utiles"
        )
        bonus_rules = (
            "- +5 si résultats mesurables cités (%, délais, métriques)\n"
            "- +3 si des alternatives technologiques sont comparées"
        )
    elif phase == "communication":
        penalty_rules = (
            "- +15 si réponse générique sans aucun exemple personnel\n"
            "- +10 si hors sujet total\n"
            "- +5  si moins de 15 mots utiles"
        )
        bonus_rules = "- +5 si exemple avec résultat mesurable ou impact cité"
    elif phase == "cv_clarification":
        penalty_rules = (
            "- +15 si réponse évasive ou refus de répondre\n"
            "- +10 si contradiction factuelle évidente\n"
            "- +5  si moins de 10 mots utiles"
        )
        bonus_rules = "- +3 si dates, noms et chiffres précis vérifiables fournis"
    elif phase == "scenario":
        penalty_rules = (
            "- +20 si charabia ou hors sujet total\n"
            "- +10 si aucun exemple concret\n"
            "- +5  si moins de 20 mots utiles"
        )
        bonus_rules = (
            "- +5 si résultats mesurables cités (%, chiffres, délais)\n"
            "- +3 si structure STAR clairement identifiable"
        )
    else:
        penalty_rules = "- +10 si hors sujet\n- +5 si moins de 15 mots utiles"
        bonus_rules   = "- +5 si résultats concrets cités"

    # ── Prompt final ──────────────────────────────────────────────────────
    breakdown_keys_json = ", ".join(f'"{k}": <int 0-20>' for k in breakdown_criteria.keys())

    prompt = f"""Tu es un évaluateur expert en recrutement technique.
Évalue la réponse d'un candidat à un entretien structuré de manière STRICTE et OBJECTIVE.

Poste visé     : {job_title}
Phase          : {phase_label}
Critère focus  : {focus}
{profile_block}
{specific_criteria_block}

CONTEXTE IMPORTANT :
- Le candidat répond à l'ORAL. La transcription est automatique (Whisper).
- Des fautes de français, anglicismes, hésitations sont NORMAUX.
- Évalue le FOND (contenu, pertinence, exemples) — PAS la forme grammaticale.
- Une réponse courte mais précise vaut mieux qu'une longue réponse creuse.
- Une réponse de 200 lettres aléatoires DOIT scorer 0. Une vraie réponse structurée de 150 mots peut scorer 70-85.

QUESTION POSÉE :
"{question}"

RÉPONSE DU CANDIDAT ({useful_words} mots utiles) :
"{answer}"

CRITÈRES DE NOTATION (chacun sur 20 points) :
{breakdown_prompt_lines}

BARÈME PRÉCIS :
- 0-4   : Absent ou complètement hors sujet
- 5-9   : Très insuffisant, vague, générique
- 10-14 : Acceptable mais manque de précision ou d'exemples
- 15-18 : Bon, pertinent, avec des éléments concrets
- 19-20 : Excellent, précis, mesurable, impactant

PÉNALITÉS (valeur positive à soustraire du total) :
{penalty_rules}

BONUS (à ajouter au total) :
{bonus_rules}

Réponds UNIQUEMENT en JSON valide, sans texte avant ou après :
{{{breakdown_keys_json}, "bonus": <int 0-8>, "penalty": <int 0-30>, "penalty_reasons": ["..."], "feedback": "<2-3 phrases FR : points forts + ce qui manque>"}}
"""

    result = _call_groq_json(prompt, max_tokens=600, temperature=0.1)
    result = result or {}
    # ── Calcul du score ───────────────────────────────────────────────────
    breakdown = {
        key: _clamp(result.get(key, 0), 0, 20)
        for key in breakdown_criteria.keys()
    }

    raw_score   = sum(breakdown.values())
    bonus       = _clamp(result.get("bonus", 0),   0, 8)
    penalty     = _clamp(result.get("penalty", 0), 0, 30)

    if phase == "technical":
        min_words = 25
        short_penalty = 8
    elif phase == "cv_clarification":
        min_words = 10
        short_penalty = 5
    else:
        min_words = 15
        short_penalty = 5

    if useful_words < min_words // 2:
        penalty += short_penalty * 2
    elif useful_words < min_words:
        penalty += short_penalty

    final_score = _clamp(raw_score + bonus - penalty, 0, 100)

    label = (
        "Insuffisant" if final_score < 40 else
        "Acceptable"  if final_score < 60 else
        "Bien"        if final_score < 80 else
        "Excellent"
    )

    penalty_reasons: List[str] = result.get("penalty_reasons", [])
    if useful_words < min_words:
        penalty_reasons.append(f"Réponse courte ({useful_words} mots utiles)")

    logger.info(
        "[Scoring phase=%s angle=%s] score=%d raw=%d bonus=%d penalty=%d breakdown=%s",
        phase, angle, final_score, raw_score, bonus, penalty, breakdown,
    )

    return {
        "score":        final_score,
        "label":        label,
        "breakdown":    breakdown,
        "feedback":     result.get("feedback", ""),
        "is_gibberish": False,
        "penalties":    penalty_reasons,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Ces fonctions délèguent toutes vers score_phase_answer
# ─────────────────────────────────────────────────────────────────────────────

def score_scenario_answer(
    question:  str,
    answer:    str,
    phase:     str,
    profile:   Optional[Dict[str, Any]] = None,
    criteria:  Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Alias vers score_phase_answer pour compatibilité."""
    return score_phase_answer(
        question=question,
        answer=answer,
        phase=phase,
        job_title=profile.get("job_title", "") if profile else "",
        angle="",
        criteria=criteria,
        profile=profile,
    )


def score_communication_answer(
    question: str,
    answer:   str,
    profile:  Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Alias vers score_phase_answer pour compatibilité."""
    return score_phase_answer(
        question=question,
        answer=answer,
        phase="communication",
        job_title=profile.get("job_title", "") if profile else "",
        profile=profile,
    )


def score_clarification_answer(
    question: str,
    answer:   str,
    profile:  Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Alias vers score_phase_answer pour compatibilité."""
    return score_phase_answer(
        question=question,
        answer=answer,
        phase="cv_clarification",
        job_title=profile.get("job_title", "") if profile else "",
        profile=profile,
    )


def score_technical_answer(
    question: str,
    answer:   str,
    angle:    str = "",
    profile:  Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Alias vers score_phase_answer pour compatibilité."""
    return score_phase_answer(
        question=question,
        answer=answer,
        phase="technical",
        job_title=profile.get("job_title", "") if profile else "",
        angle=angle,
        criteria=[
            f"Maîtrise technique ({angle or 'général'})",
            "Justification des choix technologiques",
            "Prise en compte des contraintes (performance, sécurité, scalabilité)",
            "Clarté d'explication à un pair",
            "Expérience concrète démontrée",
        ],
        profile=profile,
    )


# ─────────────────────────────────────────────────────────────────────────────
# UTILITAIRES
# ─────────────────────────────────────────────────────────────────────────────

def _clamp(value: Any, lo: int, hi: int) -> int:
    try:
        return max(lo, min(hi, int(value)))
    except (TypeError, ValueError):
        return lo
