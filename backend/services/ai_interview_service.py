from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import Any, Dict, List, Optional

from .rag import (
    SOURCE_CV,
    SOURCE_COVER_LETTER,
    SOURCE_RECOMMENDATION,
    SOURCE_CERTIFICATION,
    SOURCE_GITHUB,
    retrieve_for_interview,
)
from .groq_client import _call_groq_json, _call_groq_text
from .profile_warnings import ProfileInconsistency

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION TEMPS
# ─────────────────────────────────────────────────────────────────────────────

TIME_COMMUNICATION: int = 5 * 60    # 5 min / question
TIME_CLARIFICATION: int = 5 * 60    # 5 min / question
TIME_TECHNICAL:     int = 10 * 60   # 10 min / question technique orale
TIME_SCENARIO:      int = 10 * 60   # 10 min / scénario
TIME_QCM_TOTAL:     int = 15 * 60   # 15 min total pour le QCM


# ─────────────────────────────────────────────────────────────────────────────
# CONSTRUCTION DU PROFIL CANDIDAT
# ─────────────────────────────────────────────────────────────────────────────

def _build_candidate_profile(application) -> Dict[str, Any]:
    offer          = application.job_offer
    candidate_city = (application.current_location or "").strip().lower()
    job_city       = (getattr(offer, "city", "") or "").strip().lower()
    same_city      = bool(
        candidate_city and job_city and (
            candidate_city in job_city or job_city in candidate_city
        )
    )

    certifications: List[str] = []
    if application.ai_certifications:
        raw = application.ai_certifications
        if isinstance(raw, list):
            certifications = [str(c) for c in raw if c]
        elif isinstance(raw, dict):
            certifications = [str(v) for v in raw.values() if v]

    github_projects: List[str] = []
    if application.github_data and isinstance(application.github_data, dict):
        repos = application.github_data.get("repositories", application.github_data.get("repos", []))
        if isinstance(repos, list):
            github_projects = [
                r.get("name", str(r)) if isinstance(r, dict) else str(r)
                for r in repos[:8]
            ]

    cover_letter_projects: List[str] = []
    if application.ai_projects:
        raw = application.ai_projects
        if isinstance(raw, list):
            cover_letter_projects = [str(p) for p in raw if p]
        elif isinstance(raw, dict):
            cover_letter_projects = [str(v) for v in raw.values() if v]

    return {
        "name":                  application.full_name,
        "email":                 application.email or "",
        "city":                  application.current_location or "",
        "nationality":           application.nationality or "",
        "job_title":             offer.title,
        "job_city":              getattr(offer, "city", "") or "",
        "job_country":           getattr(offer, "country", "France") or "France",
        "job_domain":            getattr(offer, "domain", "") or "",
        "job_requirements":      getattr(offer, "requirements", "") or "",
        "diploma":               application.degree_level or "",
        "diploma_domain":        getattr(application, "diploma_domain", "") or "",
        "university":            application.university or "",
        "graduation_year":       application.graduation_year,
        "experience_years":      application.experience_years or 0,
        "salary_expected":       application.salary_expectation,
        "availability_date":     str(application.availability_date) if application.availability_date else None,
        "current_position":      application.current_position or "",
        "certifications":        certifications,
        "ai_summary":            application.ai_summary or "",
        "ai_strengths":          application.ai_strengths or [],
        "ai_weaknesses":         application.ai_weaknesses or [],
        "ai_missing_skills":     application.ai_missing_skills or [],
        "ai_recommendations":    application.ai_recommendations or "",
        "ai_coherence_flags":    application.ai_coherence_flags or [],
        "github_projects":       github_projects,
        "github_username":       application.github_username or "",
        "cover_letter_projects": cover_letter_projects,
        "same_city":             same_city,
        "is_technical":          _is_technical_position(
                                     offer.title,
                                     getattr(offer, "requirements", "") or ""
                                 ),
        "source":                application.source or "direct",
        "linkedin_url":          str(application.linkedin_url) if application.linkedin_url else "",
        "github_url":            str(application.github_url) if application.github_url else "",
    }


def _profile_to_text(p: Dict[str, Any]) -> str:
    salary_str = "non précisée"
    if p.get("salary_expected") is not None:
        salary_str = f"{p['salary_expected']} €/mois ({p['salary_expected'] * 12:,} €/an)"

    mobility_str = (
        f"même ville que le poste ({p['job_city']}) — mobilité non requise"
        if p["same_city"]
        else f"{p['city'] or 'non précisée'} → poste à {p['job_city'] or 'non précisée'} (mobilité à clarifier)"
    )

    lines = [
        f"Candidat       : {p['name']}",
        f"Localisation   : {mobility_str}",
        f"Nationalité    : {p['nationality'] or 'non précisée'}",
        f"Poste visé     : {p['job_title']}",
        f"Domaine offre  : {p['job_domain']}",
        f"Technologies   : {p['job_requirements']}",
        f"Poste actuel   : {p['current_position'] or 'non précisé'}",
        f"Diplôme        : {p['diploma'] or 'non précisé'} — {p['diploma_domain'] or ''} "
        f"(université : {p['university'] or 'non précisée'}, année : {p['graduation_year'] or 'N/A'})",
        f"Années exp.    : {p['experience_years'] or 0}",
        f"Disponibilité  : {p['availability_date'] or 'immédiate'}",
        f"Salaire attendu: {salary_str}",
        f"Certifications : {', '.join(p['certifications']) or 'aucune déclarée'}",
        f"GitHub         : {p['github_username'] or 'non fourni'}",
        f"Projets GitHub : {', '.join(p['github_projects']) or 'aucun'}",
        f"Projets lettre : {', '.join(p['cover_letter_projects']) or 'aucun'}",
        f"Résumé CV      : {p['ai_summary'][:500] if p['ai_summary'] else 'non disponible'}",
        f"Points forts   : {', '.join(p['ai_strengths']) or 'non analysés'}",
        f"Points faibles : {', '.join(p['ai_weaknesses']) or 'non analysés'}",
        f"Compétences Δ  : {', '.join(p['ai_missing_skills']) or 'aucune'}",
    ]
    if p.get("ai_coherence_flags"):
        lines.append(f"Alertes IA     : {', '.join(str(f) for f in p['ai_coherence_flags'])}")
    return "\n".join(lines)


def _get_rag(application, theme: str, sources: List[str], top_k: int = 5) -> str:
    ctx = retrieve_for_interview(
        question=theme,
        candidate_id=str(application.id),
        top_k=top_k,
        source_filter=sources,
    )
    return f"\n[Contexte extrait du profil] :\n{ctx}\n" if ctx else ""


def _format_transcript(transcript: list, phase: Optional[str] = None) -> str:
    entries = [e for e in transcript if e.get("type") != "voice_analysis"]
    if phase:
        entries = [e for e in entries if e.get("phase") == phase]
    if not entries:
        return "Aucun échange précédent."
    lines: List[str] = []
    for e in entries:
        ph = e.get("phase", "").upper()
        lines.append(f"[{ph}] Q: {e.get('question', '')}")
        lines.append(f"       R: {e.get('answer', '')}")
    return "\n".join(lines)


def _is_technical_position(title: str, requirements: str) -> bool:
    keywords = (
        "dev", "developer", "engineer", "ingénieur", "data", "cloud",
        "devops", "backend", "frontend", "fullstack", "software", "infra",
        "sécurité", "security", "ml", "ia", "architect",
    )
    return any(k in (title + " " + requirements).lower() for k in keywords)


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 1 — COMMUNICATION (5 min/question)
# ─────────────────────────────────────────────────────────────────────────────

_COMMUNICATION_THEMES_DEFAULT = [
    "motivation profonde pour ce poste spécifique et cette entreprise",
    "expérience de collaboration en équipe — conflit ou projet difficile concret",
    "gestion de la pression, délais courts, priorités contradictoires",
    "valeur professionnelle la plus importante et exemple concret démontré",
    "projet le plus réussi et impact mesurable obtenu",
]

_COMMUNICATION_THEMES_WITH_MOBILITY = [
    "disponibilité, mobilité géographique et conditions de prise de poste",
] + _COMMUNICATION_THEMES_DEFAULT


def _get_communication_themes(p: Dict[str, Any]) -> List[str]:
    return _COMMUNICATION_THEMES_DEFAULT if p.get("same_city") else _COMMUNICATION_THEMES_WITH_MOBILITY


def generate_first_question(application) -> Dict[str, Any]:
    p       = _build_candidate_profile(application)
    profile = _profile_to_text(p)
    rag     = _get_rag(application, "parcours motivation poste",
                       [SOURCE_CV, SOURCE_COVER_LETTER, SOURCE_RECOMMENDATION])

    prompt = f"""
{profile}
{rag}

CONTRAINTE ABSOLUE : La question doit mentionner explicitement l'un des éléments suivants :
- Le poste visé : {p['job_title']}
- Le diplôme : {p['diploma']} de {p['university']}
- Un projet ou expérience visible dans le résumé CV

Pose UNE question d'ouverture sur la motivation et le parcours, 100% personnalisée.
Ne pose PAS de question générique type "présentez-vous".
Max 2 phrases. UNIQUEMENT la question.
"""
    q = _call_groq_text(prompt, max_tokens=200)
    if not q:
        q = (
            f"Vous avez obtenu votre {p['diploma']} à {p['university']} avant de viser un poste de "
            f"{p['job_title']}. Qu'est-ce qui vous a amené précisément vers cette orientation ?"
        )
    return {
        "question":           q,
        "time_limit_seconds": TIME_COMMUNICATION,
        "phase":              "communication",
        "question_index":     0,
    }


def generate_communication_question(
    application,
    question_index: int,
    transcript: list,
    profile_inconsistencies: List[ProfileInconsistency],
) -> Dict[str, Any]:
    p       = _build_candidate_profile(application)
    profile = _profile_to_text(p)
    prev    = _format_transcript(transcript, "communication")
    themes  = _get_communication_themes(p)
    theme   = themes[min(question_index, len(themes) - 1)]

    rag = _get_rag(application, theme,
                   [SOURCE_CV, SOURCE_COVER_LETTER, SOURCE_RECOMMENDATION])

    last_entries = [e for e in transcript if e.get("phase") == "communication"]
    last_answer  = last_entries[-1].get("answer", "") if last_entries else ""

    context_hints = []
    if not p["same_city"] and p["city"] and p["job_city"]:
        context_hints.append(
            f"Le candidat réside à {p['city']} alors que le poste est à {p['job_city']} "
            f"(mobilité à aborder naturellement si pertinent au thème)."
        )
    if (
        p["nationality"]
        and p["nationality"].lower() not in ("français", "française", "french", "tunisien", "tunisienne")
        and p["job_country"].lower() == "france"
    ):
        context_hints.append(
            f"Nationalité {p['nationality']} pour poste en {p['job_country']} "
            f"(situation administrative à aborder si pertinent)."
        )
    if p["salary_expected"] is not None:
        context_hints.append(
            f"Prétention : {p['salary_expected']} €/mois ({p['salary_expected'] * 12:,} €/an) "
            f"(à aborder si pertinent)."
        )
    if p["availability_date"]:
        context_hints.append(f"Disponibilité déclarée : {p['availability_date']}.")

    comm_inconsistency_types = {
        "LOCALISATION_DIFFÉRENTE", "SITUATION_ADMINISTRATIVE",
        "ANOMALIE_SALAIRE", "POSTE_ACTUEL_INCOHÉRENT",
    }
    comm_inconsistencies = [
        i for i in profile_inconsistencies
        if i.type.value in comm_inconsistency_types and i.suggested_question
    ]
    adjusted = question_index - 1
    if 0 <= adjusted < len(comm_inconsistencies):
        inc = comm_inconsistencies[adjusted]
        return {
            "question":           inc.suggested_question,
            "time_limit_seconds": TIME_COMMUNICATION,
            "phase":              "communication",
            "question_index":     question_index,
        }

    hints_block = "\n".join(context_hints)
    prompt = f"""
{profile}
{rag}
Échanges précédents :
{prev}
Dernière réponse du candidat : "{last_answer}"
{f"Informations contextuelles :{chr(10)}{hints_block}" if hints_block else ""}

CONSIGNE : Pose UNE question sur le thème : "{theme}"
- Mentionner au moins un élément concret du profil
- Si réponse < 40 mots, reformuler pour inciter à développer avec un exemple
- Jamais de question générique
Max 2 phrases. UNIQUEMENT la question.
"""
    q = _call_groq_text(prompt, max_tokens=200)
    return {
        "question":           q or f"Citez un exemple concret où vous avez dû démontrer {theme}.",
        "time_limit_seconds": TIME_COMMUNICATION,
        "phase":              "communication",
        "question_index":     question_index,
    }


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2 — CLARIFICATION CV (5 min/question)
# ─────────────────────────────────────────────────────────────────────────────

def generate_clarification_question(
    application,
    question_index: int,
    transcript: list,
    profile_inconsistencies: List[ProfileInconsistency],
) -> Dict[str, Any]:
    p       = _build_candidate_profile(application)
    profile = _profile_to_text(p)
    rag_all = _get_rag(application, "parcours expériences diplômes certifications",
                       [SOURCE_CV, SOURCE_CERTIFICATION, SOURCE_RECOMMENDATION, SOURCE_COVER_LETTER])
    prev    = _format_transcript(transcript, "cv_clarification")

    clarif_types = {
        "DIPLÔME_HORS_DOMAINE", "INCOHÉRENCE_ÂGE_EXPÉRIENCE",
        "CERTIFICATION_NON_VÉRIFIÉE", "EXPÉRIENCE_ABSENTE_CV",
        "DISCORDANCE_CV_GIT", "DISCORDANCE_CV_LETTRE",
    }
    clarif_inconsistencies = [
        i for i in profile_inconsistencies
        if i.type.value in clarif_types and i.suggested_question
    ]

    if question_index < len(clarif_inconsistencies):
        inc = clarif_inconsistencies[question_index]
        return {
            "question":           inc.suggested_question,
            "time_limit_seconds": TIME_CLARIFICATION,
            "phase":              "cv_clarification",
            "question_index":     question_index,
        }

    weaknesses = ", ".join(p["ai_weaknesses"]) or "non identifiées"
    missing    = ", ".join(p["ai_missing_skills"]) or "aucune"

    prompt = f"""
{profile}
{rag_all}
Échanges clarification précédents :
{prev}

Pose UNE question de clarification sur :
- Points faibles identifiés : {weaknesses}
- Compétences manquantes vs poste : {missing}
- Recommandations IA : {p['ai_recommendations'][:200] if p['ai_recommendations'] else 'aucune'}

CONTRAINTE : Nommer un élément spécifique du profil (date, projet, technologie, université).
Max 2 phrases. UNIQUEMENT la question.
"""
    q = _call_groq_text(prompt, max_tokens=200)
    return {
        "question":           q or f"Comment compensez-vous l'absence de {missing} pour le poste de {p['job_title']} ?",
        "time_limit_seconds": TIME_CLARIFICATION,
        "phase":              "cv_clarification",
        "question_index":     question_index,
    }


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 3 — QUESTIONS TECHNIQUES ORALES (10 min/question)
# ─────────────────────────────────────────────────────────────────────────────
#
# ✅ CORRECTION : Les questions techniques sont TOUJOURS générées pour les
#    postes techniques, même en l'absence de projets GitHub ou lettre.
#    Si aucun projet n'est détecté, on s'appuie sur job_title + job_requirements.
#
# Flux de génération (par priorité décroissante) :
#   1. Projets GitHub du candidat  → questions ancrées sur du code réel
#   2. Projets lettre de motivation → questions sur les projets déclarés
#   3. Technologies de l'offre     → questions génériques mais ciblées sur le stack
#   4. Fallback hardcodé           → questions universelles sur le domaine

_TECHNICAL_ANGLES = [
    ("architecture",         "Expliquez l'architecture que vous avez choisie et pourquoi."),
    ("technologies",         "Justifiez le choix des technologies face aux alternatives disponibles."),
    ("securite_performance", "Décrivez comment vous gérez la sécurité et/ou les performances."),
    ("contribution",         "Détaillez votre contribution personnelle versus celle de l'équipe."),
]


def generate_technical_questions(application) -> List[Dict[str, Any]]:
    """
    Génère 4 questions techniques orales (phase 'technical').
    Fonctionne même sans GitHub ni projets déclarés.
    """
    p       = _build_candidate_profile(application)
    profile = _profile_to_text(p)

    # Contexte RAG — GitHub en priorité, sinon CV + lettre
    rag_cv = _get_rag(
        application,
        f"projets techniques réalisations {p['job_requirements']}",
        [SOURCE_CV, SOURCE_GITHUB, SOURCE_COVER_LETTER],
        top_k=6,
    )

    # ── Collecte des projets ──────────────────────────────────────────────────
    projects = p["github_projects"] + p["cover_letter_projects"]
    has_projects = bool(projects)

    if has_projects:
        projects_block = "\n".join(f"- {pr}" for pr in projects)
        project_source_hint = "Ancre chaque question sur un projet spécifique listé ci-dessus."
        fallback_anchor = f"vos projets GitHub ou lettre de motivation"
    else:
        # Pas de projets : on base les questions sur les technologies de l'offre
        tech_list = [t.strip() for t in p["job_requirements"].split(",") if t.strip()][:5]
        projects_block = (
            "Aucun projet GitHub ou lettre de motivation identifié.\n"
            f"Technologies requises par le poste : {', '.join(tech_list) if tech_list else p['job_title']}"
        )
        project_source_hint = (
            "Puisqu'aucun projet spécifique n'est disponible, "
            "génère une question sur une situation concrète impliquant les technologies du poste. "
            f"Exemple : 'Dans votre expérience avec {tech_list[0] if tech_list else p['job_title']}, comment...'"
        )
        fallback_anchor = f"les technologies {p['job_requirements'][:80] or p['job_title']}"

    questions_out: List[Dict[str, Any]] = []

    for angle_key, angle_default in _TECHNICAL_ANGLES:
        prompt = f"""
{profile}
{rag_cv}

Projets / contexte technique du candidat :
{projects_block}

Génère UNE question technique orale (réponse attendue 5-10 min) sur l'angle : "{angle_key}"

{project_source_hint}

RÈGLES :
- Si un projet est disponible : "Dans votre projet [NOM], vous avez utilisé [TECHNO]. Expliquez..."
- Sinon : "Dans votre expérience avec [TECHNO du poste], comment avez-vous géré [angle] ?"
- La question doit être ouverte, évaluable par méthode STAR
- Max 3 phrases. UNIQUEMENT la question.
"""
        q = _call_groq_text(prompt, max_tokens=250)
        if not q:
            q = _fallback_technical_question(angle_key, p, fallback_anchor)

        questions_out.append({
            "question":           q,
            "time_limit_seconds": TIME_TECHNICAL,
            "phase":              "technical",   # ← phase "technical", PAS "qcm"
            "question_index":     len(questions_out),
            "angle":              angle_key,
        })

    return questions_out


def _fallback_technical_question(angle: str, p: Dict[str, Any], anchor: str) -> str:
    """Questions de secours si l'IA échoue — toujours pertinentes même sans GitHub."""
    req = p["job_requirements"].split(",")[0].strip() if p["job_requirements"] else p["job_title"]
    fallbacks = {
        "architecture": (
            f"Dans votre expérience avec {anchor}, "
            f"décrivez l'architecture que vous avez conçue ou utilisée et justifiez vos choix."
        ),
        "technologies": (
            f"Pourquoi avez-vous choisi {req} plutôt qu'une alternative "
            f"pour un projet récent ? Quels étaient les compromis ?"
        ),
        "securite_performance": (
            f"Décrivez une situation concrète où vous avez dû optimiser les performances "
            f"ou renforcer la sécurité d'une application utilisant {req}."
        ),
        "contribution": (
            f"Dans un projet d'équipe récent impliquant {req}, "
            f"quelle était précisément votre contribution individuelle "
            f"et comment avez-vous coordonné votre travail avec l'équipe ?"
        ),
    }
    return fallbacks.get(
        angle,
        f"Décrivez un défi technique concret rencontré avec {req} et comment vous l'avez résolu.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 4 — SCÉNARIOS PROFESSIONNELS (4 fixes, 10 min/scénario)
# ─────────────────────────────────────────────────────────────────────────────

def generate_scenario_questions(application) -> List[Dict[str, Any]]:
    p        = _build_candidate_profile(application)
    profile  = _profile_to_text(p)
    rag_cv   = _get_rag(application, "expériences difficiles conflits résultats",
                        [SOURCE_CV, SOURCE_COVER_LETTER, SOURCE_RECOMMENDATION], top_k=5)
    rag_cert = _get_rag(application, "certifications compétences validées",
                        [SOURCE_CERTIFICATION], top_k=3)
    rag_git  = _get_rag(application, "projets techniques réalisations GitHub",
                        [SOURCE_GITHUB, SOURCE_CV], top_k=4)

    scenario_configs = [
        {
            "index": 0,
            "theme": "conflit ou situation difficile vécue (ancré CV / lettre)",
            "rag": rag_cv,
            "hint": "Utilise une expérience ou situation concrète visible dans le CV ou la lettre.",
            "evaluation_criteria": ["Identification du problème", "Actions prises", "Résultat obtenu", "Leçon retenue"],
        },
        {
            "index": 1,
            "theme": "application concrète des compétences certifiées dans un contexte stressant",
            "rag": rag_cert,
            "hint": "Mentionne l'une des certifications ou compétences validées du candidat.",
            "evaluation_criteria": ["Mobilisation des compétences", "Prise de décision", "Communication", "Résultat"],
        },
        {
            "index": 2,
            "theme": "problème technique complexe lié aux projets GitHub ou au domaine du poste",
            "rag": rag_git,
            "hint": "Ancre le scénario dans un projet GitHub visible ou dans les technologies requises.",
            "evaluation_criteria": ["Diagnostic technique", "Solution proposée", "Collaboration", "Qualité livrable"],
        },
        {
            "index": 3,
            "theme": "veille technologique, intégration de l'IA, apprentissage autonome",
            "rag": "",
            "hint": (
                "Mentionne le domaine du poste et une technologie émergente pertinente. "
                "Tester la capacité à se former en continu et à intégrer l'IA dans le travail."
            ),
            "evaluation_criteria": [
                "Processus de veille", "Intégration de l'IA",
                "Vitesse d'apprentissage", "Application concrète", "Curiosité intellectuelle",
            ],
        },
    ]

    results: List[Dict[str, Any]] = []
    for cfg in scenario_configs:
        prompt = f"""
{profile}
{cfg['rag']}

Génère UNE mise en situation professionnelle concrète.
Thème : "{cfg['theme']}"
Instruction : {cfg['hint']}

Format :
- Situation contextualisée et réaliste (2-3 phrases)
- Question ouverte méthode STAR implicite (1 phrase)

CONTRAINTE : Mentionner un élément concret du profil.
Max 5 phrases. UNIQUEMENT la mise en situation et la question.
"""
        q = _call_groq_text(prompt, max_tokens=350)
        if not q:
            q = _fallback_scenario(cfg["index"], p)
        results.append({
            "question":            q,
            "theme":               cfg["theme"],
            "time_limit_seconds":  TIME_SCENARIO,
            "phase":               "scenario",
            "question_index":      cfg["index"],
            "evaluation_criteria": cfg["evaluation_criteria"],
        })

    return results


def _fallback_scenario(index: int, p: Dict[str, Any]) -> str:
    fallbacks = [
        (
            f"Dans votre expérience en tant que {p['job_title']}, vous avez dû gérer une situation "
            f"où les attentes étaient irréalistes. Décrivez un cas concret : quelle était la situation, "
            f"quelles actions avez-vous prises et quel résultat avez-vous obtenu ?"
        ),
        (
            f"Votre profil mentionne des compétences en {p['job_requirements'].split(',')[0] if p['job_requirements'] else 'votre domaine'}. "
            f"Décrivez une situation où ces compétences ont été mises à rude épreuve sous contrainte de temps. "
            f"Comment avez-vous priorisé et qu'avez-vous accompli ?"
        ),
        (
            f"Sur un projet technique de votre parcours, une décision d'architecture s'est révélée problématique "
            f"en production. Comment l'avez-vous identifiée, communiquée à l'équipe et résolue ?"
        ),
        (
            f"Le domaine {p['job_domain']} évolue rapidement avec l'IA. "
            f"Comment organisez-vous votre veille ? Donnez un exemple récent d'une nouveauté "
            f"que vous avez apprise et intégrée dans votre pratique professionnelle."
        ),
    ]
    return fallbacks[min(index, len(fallbacks) - 1)]


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 5 — QCM TECHNIQUE (15 min total) — phase "qcm" (séparée de "technical")
# ─────────────────────────────────────────────────────────────────────────────

def generate_qcm(
    job_title: str,
    requirements: str,
    num_questions: int = 20,
    candidate_id: Optional[str] = None,
    certifications: Optional[List[str]] = None,
) -> Dict[str, Any]:
    rag_blk = ""
    if candidate_id:
        ctx = retrieve_for_interview(
            question=f"certifications niveau technique {requirements}",
            candidate_id=candidate_id,
            top_k=3,
            source_filter=[SOURCE_CERTIFICATION],
        )
        if ctx:
            rag_blk = f"\nCertifications vérifiées (adapter la difficulté) :\n{ctx}\n"

    cert_hint = ""
    if certifications:
        cert_hint = f"Le candidat déclare : {', '.join(certifications)}. Inclure 2 questions liées."

    prompt = f"""
Génère exactement {num_questions} questions QCM pour un entretien technique.
Poste : "{job_title}"
Compétences requises : {requirements}
{rag_blk}
{cert_hint}

Répartition OBLIGATOIRE : 3 faciles, 5 moyennes, 2 difficiles.
Questions sur les technologies listées. Pas de question générique.

JSON STRICT :
{{
  "questions": [
    {{
      "question": "...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correct": 0,
      "difficulty": "easy | medium | hard",
      "domain": "...",
      "explanation": "..."
    }}
  ]
}}
4 options, 1 bonne réponse, index "correct" en 0-based.
"""
    result    = _call_groq_json(prompt, max_tokens=4000, temperature=0.25)
    questions = result.get("questions", [])
    valid = [
        q for q in questions
        if (
            q.get("question") and
            isinstance(q.get("options"), list) and
            len(q["options"]) == 4 and
            isinstance(q.get("correct"), int) and
            0 <= q["correct"] <= 3
        )
    ]
    return {
        "questions":          valid or _fallback_qcm(),
        "time_limit_seconds": TIME_QCM_TOTAL,
        "phase":              "qcm",            # ← "qcm", PAS "technical"
    }


def _fallback_qcm() -> List[Dict]:
    return [
        {
            "question": "Quelle est la complexité temporelle d'une recherche binaire ?",
            "options": ["A. O(n)", "B. O(n²)", "C. O(log n)", "D. O(1)"],
            "correct": 2, "difficulty": "medium",
            "domain": "Algorithmique",
            "explanation": "Divise l'espace de recherche en deux à chaque itération.",
        },
        {
            "question": "Quel principe SOLID : une classe = une seule raison de changer ?",
            "options": ["A. Open/Closed", "B. Liskov", "C. Single Responsibility", "D. Dependency Inversion"],
            "correct": 2, "difficulty": "easy",
            "domain": "Architecture logicielle",
            "explanation": "SRP : Single Responsibility Principle.",
        },
        {
            "question": "Quelle méthode HTTP est idempotente et remplace une ressource entière ?",
            "options": ["A. POST", "B. PATCH", "C. PUT", "D. DELETE"],
            "correct": 2, "difficulty": "easy",
            "domain": "API REST",
            "explanation": "PUT remplace la ressource complète, est idempotente.",
        },
    ]


# ─────────────────────────────────────────────────────────────────────────────
# DÉTECTION DE CONTRADICTIONS
# ─────────────────────────────────────────────────────────────────────────────

def detect_contradictions(
    transcript: list,
    new_answer: str,
    new_question: str,
) -> Optional[str]:
    real_entries = [e for e in transcript if e.get("answer") and e.get("type") != "voice_analysis"]
    if len(real_entries) < 2:
        return None

    previous_text = "\n".join(
        f"Q: {e.get('question', '')[:120]}\nR: {e.get('answer', '')[:200]}"
        for e in real_entries[-6:]
    )

    prompt = f"""
Compare la NOUVELLE réponse avec les échanges PRÉCÉDENTS.

Échanges précédents :
{previous_text}

Nouvelle question : "{new_question}"
Nouvelle réponse  : "{new_answer}"

Contradiction significative = compétence déclarée, technologie, expérience, méthode de travail.
Nuance ou reformulation = PAS une contradiction.

JSON :
{{
  "contradiction_detected": true | false,
  "contradiction_summary": "1 phrase ou null",
  "followup_question": "Question de relance directe max 2 phrases ou null"
}}
"""
    result = _call_groq_json(prompt, max_tokens=300)
    if result.get("contradiction_detected") and result.get("followup_question"):
        logger.info("[Contradiction] %s", result.get("contradiction_summary", ""))
        return result["followup_question"]
    return None


# ─────────────────────────────────────────────────────────────────────────────
# DISPATCHER PRINCIPAL
# ─────────────────────────────────────────────────────────────────────────────

def generate_next_question(
    application,
    phase: str,
    question_index: int,
    transcript: list,
    profile_inconsistencies: List[ProfileInconsistency],
    last_answer: str = "",
    last_question: str = "",
) -> Dict[str, Any]:
    # Détection de contradiction avant toute chose
    if last_answer and last_question:
        followup = detect_contradictions(transcript, last_answer, last_question)
        if followup:
            return {
                "question":                  followup,
                "time_limit_seconds":        TIME_CLARIFICATION,
                "phase":                     phase,
                "question_index":            question_index,
                "is_contradiction_followup": True,
            }

    dispatchers = {
        "communication":    lambda: generate_communication_question(
            application, question_index, transcript, profile_inconsistencies
        ),
        "cv_clarification": lambda: generate_clarification_question(
            application, question_index, transcript, profile_inconsistencies
        ),
        # "technical" et "qcm" sont pré-générés en batch, pas via ce dispatcher.
        # Voir generate_technical_questions() et generate_qcm().
    }

    handler = dispatchers.get(phase)
    if handler:
        return handler()

    return {
        "question":           "Avez-vous des questions pour notre équipe ?",
        "time_limit_seconds": TIME_COMMUNICATION,
        "phase":              phase,
        "question_index":     question_index,
    }