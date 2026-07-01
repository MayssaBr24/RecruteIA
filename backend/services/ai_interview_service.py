from __future__ import annotations
import logging
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

TIME_COMMUNICATION: int = 3 * 60    # 3 min / question
TIME_CLARIFICATION: int = 3 * 60    # 3 min / question
TIME_TECHNICAL:     int = 7 * 60   # 7 min / question technique orale
TIME_SCENARIO:      int = 7 * 60   # 7 min / scénario
TIME_QCM_TOTAL:     int = 7 * 60   # 15 min total pour le QCM


# ─────────────────────────────────────────────────────────────────────────────
# CONSTRUCTION DU PROFIL CANDIDAT
# ─────────────────────────────────────────────────────────────────────────────

def _build_candidate_profile(application) -> Dict[str, Any]:
    offer          = application.job_offer


    certifications: List[str] = []
    if application.ai_certifications:
        raw = application.ai_certifications
        if isinstance(raw, list):
            certifications = [str(c) for c in raw if c]
        elif isinstance(raw, dict):
            certifications = [str(v) for v in raw.values() if v]

    github_projects: List[str] = []
    if application.github_data and isinstance(application.github_data, dict):
        github_data = application.github_data or {}
        repos = (
                github_data.get("top_repos")
                or github_data.get("repositories")
                or github_data.get("repos")
                or []
        )
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
        "job_city":              getattr(offer, "location", "") or "",
        "job_country": _infer_country_from_location(getattr(offer, "location", "")),
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
        "is_technical":          _is_technical_position(
                                     offer.title,
                                     getattr(offer, "requirements", "") or ""
                                 ),
        "source":                application.source or "direct",
        "linkedin_url":          str(application.linkedin_url) if application.linkedin_url else "",
        "github_url":            str(application.github_url) if application.github_url else "",
        "github_data": application.github_data or {},
    }
TUNISIA_CITIES = {
    "tunis", "sfax", "sousse", "monastir", "gabès", "gabes", "bizerte",
    "kairouan", "nabeul", "ariana", "mahdia", "kasserine", "gafsa",
    "médenine", "medenine", "tozeur", "kébili", "kebili", "siliana",
    "zaghouan", "jendouba", "béja", "beja", "le kef", "kef",
    "sidi bouzid", "tataouine", "manouba", "ben arous",
}

def _infer_country_from_location(location: str) -> str:
    """Déduit le pays à partir du champ location de l'offre (ex: 'Monastir', 'Monastir, Tunisie')."""
    if not location:
        return ""
    loc_lower = location.lower()
    if "tunisie" in loc_lower or "tunisia" in loc_lower:
        return "Tunisie"
    if "france" in loc_lower:
        return "France"
    # Vérifier si une ville tunisienne connue est mentionnée
    if any(city in loc_lower for city in TUNISIA_CITIES):
        return "Tunisie"
    return ""  # inconnu → pas d'inférence, pas de fallback dangereux

def _profile_to_text(p: Dict[str, Any]) -> str:
    salary_str = "non précisée"
    if p.get("salary_expected") is not None:
        salary_str = f"{p['salary_expected']} €/mois ({p['salary_expected'] * 12:,} €/an)"


    lines = [
        f"Candidat       : {p['name']}",
        f"Localisation   : {p['city'] or 'non précisée'}",        f"Poste visé     : {p['job_title']}",
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
import re

def _extract_skills_list(requirements: str, only_hard: bool = True) -> List[str]:
    """
    Parse un bloc 'Hard Skills: - X\n- Y\nSoft Skills: - Z...' en liste propre.
    Retourne uniquement les Hard Skills par défaut (plus pertinent pour les questions techniques).
    """
    if not requirements:
        return []

    text = requirements
    if only_hard and "soft skills" in text.lower():
        # Coupe avant "Soft Skills" pour ne garder que la partie technique
        text = re.split(r"soft\s*skills", text, flags=re.IGNORECASE)[0]

    # Retire les préfixes type "Hard Skills:"
    text = re.sub(r"hard\s*skills\s*:?", "", text, flags=re.IGNORECASE)

    # Découpe sur les puces / retours à la ligne
    items = re.split(r"[\n\r]+|^\s*-\s*|(?<=\n)\s*-\s*", text)
    items = [i.strip(" -•\t") for i in items]
    items = [i for i in items if len(i) > 2]

    return items

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 1 — COMMUNICATION (5 min/question)
# ─────────────────────────────────────────────────────────────────────────────

def _get_communication_themes(p: Dict[str, Any]) -> List[str]:
    themes = []


    # Motivation personnalisée selon expérience
    exp = p["experience_years"] or 0
    if exp == 0:
        themes.append(
            f"motivation profonde pour un premier poste de {p['job_title']} "
            f"et comment le parcours académique prépare à ce rôle"
        )
    elif exp < 3:
        themes.append(
            f"motivation pour évoluer vers {p['job_title']} "
            f"après {exp} an(s) d'expérience et ambitions à 3 ans"
        )
    else:
        themes.append(
            f"valeur ajoutée des {exp} années d'expérience "
            f"pour le poste de {p['job_title']} et vision long terme"
        )

    # GitHub dominant language — remplace mobilité
    MARKUP_LANGS = {'html', 'css', 'scss', 'sass', 'less', 'xml', 'markdown', 'md'}

    github_data   = (p.get("github_data") or {}) if isinstance(p.get("github_data"), dict) else {}
    raw_languages = github_data.get("languages") or []
    real_langs    = [l for l in raw_languages if l.lower() not in MARKUP_LANGS]

    if real_langs:
        dominant = real_langs[0]
        second   = real_langs[1] if len(real_langs) > 1 else None
        job_reqs = (p.get("job_requirements") or "").lower()

        if second and dominant.lower() not in job_reqs:
            # Dominant non mentionné dans l'offre — creuser pourquoi
            themes.append(
                f"le langage dominant sur son GitHub est {dominant} "
                f"alors que l'offre cible {second} — "
                f"demander lequel il maîtrise réellement mieux et pourquoi"
            )
        elif second:
            # Dominant dans l'offre — comparer avec le second
            themes.append(
                f"il utilise principalement {dominant} sur GitHub mais aussi {second} — "
                f"demander dans quel contexte il choisirait l'un plutôt que l'autre "
                f"et lequel il considère comme sa vraie force"
            )
        else:
            themes.append(
                f"il utilise principalement {dominant} sur GitHub — "
                f"demander sa profondeur réelle dans ce langage "
                f"et ses limites actuelles"
            )
    elif not p["github_url"]:
        # Pas de GitHub du tout — question sur stack favorite
        themes.append(
            f"quel est son langage ou framework de prédilection "
            f"pour le type de poste {p['job_title']} et pourquoi ce choix"
        )

    # Collaboration
    if p["github_projects"] or p["cover_letter_projects"]:
        projects = p["github_projects"] or p["cover_letter_projects"]
        themes.append(
            f"expérience de collaboration en équipe sur un projet concret "
            f"comme {projects[0]} — gestion de conflit ou décision difficile"
        )
    else:
        themes.append(
            "expérience de collaboration en équipe — conflit ou décision difficile concrète"
        )

    # Pression et priorités
    themes.append(
        f"gestion de la pression et des délais dans un contexte de {p['job_title']} "
        f"— exemple concret avec résultat mesurable"
    )

    # Faiblesse active
    if p["ai_weaknesses"]:
        weakness = p["ai_weaknesses"][0]
        themes.append(
            f"comment le candidat travaille activement sur '{weakness}' "
            f"et exemple concret de progression récente"
        )
    else:
        themes.append(
            "valeur professionnelle la plus importante et exemple concret démontré"
        )



    return themes

def _question_already_asked(question: str, transcript: list) -> int:
    """Retourne combien de fois une question similaire a déjà été posée."""
    if not question:
        return 0
    count = 0
    q_words = set(question.lower().split())
    for entry in transcript:
        prev_words = set(entry.get("question", "").lower().split())
        if not prev_words:
            continue
        overlap = len(q_words & prev_words) / max(len(q_words), 1)
        if overlap > 0.6:
            count += 1
    return count

def _get_covered_themes(transcript: list, phase: str) -> List[str]:
    return [
        e.get("theme", "")
        for e in transcript
        if e.get("phase") == phase and e.get("theme")
    ]

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
    # Dans generate_first_question — remplace le fallback par :
    if not q:
        diploma = (p['diploma'] or 'diplôme').strip()
        univ = (p['university'] or 'votre université').strip()
        job = p['job_title'].strip()
        # Capitaliser proprement
        diploma = diploma[0].upper() + diploma[1:] if diploma else diploma
        univ = univ[0].upper() + univ[1:] if univ else univ
        q = (
            f"Vous avez obtenu votre {diploma} à {univ}. "
            f"Qu'est-ce qui vous a amené(e) précisément à viser un poste de {job} ?"
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

    # Sélectionner le thème non encore couvert
    covered = _get_covered_themes(transcript, "communication")
    theme   = next(
        (t for t in themes if t not in covered),
        themes[min(question_index, len(themes) - 1)]
    )

    rag = _get_rag(application, theme,
                   [SOURCE_CV, SOURCE_COVER_LETTER, SOURCE_RECOMMENDATION])

    last_entries = [e for e in transcript if e.get("phase") == "communication"]
    last_answer  = last_entries[-1].get("answer", "") if last_entries else ""

    # Inconsistances communication
    comm_inconsistency_types = {
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
            "theme":              inc.type.value,
        }

    prompt = f"""
{profile}
{rag}

Échanges précédents :
{prev}

Dernière réponse du candidat : "{last_answer}"

OBJECTIF : Évaluer les SOFT SKILLS, la motivation, le savoir-être.
PAS de question technique, PAS de question sur diplômes ou certifications.

THÈME À COUVRIR : "{theme}"

CONSIGNE :
- Mentionner au moins un élément concret du profil (poste, projet, contexte)
- Si la dernière réponse était courte (<40 mots), relancer sur un exemple concret
- Jamais de question générique
- Max 2 phrases. UNIQUEMENT la question.
"""
    q = _call_groq_text(prompt, max_tokens=200)

    # Déduplication — se rappelle elle-même correctement
    if q and _question_already_asked(q, transcript) >= 1:
        logger.info("[Communication] Question répétée → thème suivant")
        next_idx = question_index + 1
        if next_idx < len(themes):
            return generate_communication_question(
                application, next_idx, transcript, profile_inconsistencies
            )

    # Fallback intelligent
    if not q:
        missing  = ", ".join(p["ai_missing_skills"]) if p["ai_missing_skills"] else ""
        weakness = p["ai_weaknesses"][0] if p["ai_weaknesses"] else ""
        if missing:
            q = (
                f"Votre profil ne mentionne pas de compétences en {missing}. "
                f"Comment envisagez-vous de développer ces compétences pour le poste de {p['job_title']} ?"
            )
        elif weakness:
            q = (
                f"Parmi vos points d'amélioration ({weakness}), "
                f"lequel aurait le plus d'impact sur ce poste et comment le travaillez-vous ?"
            )
        else:
            q = (
                f"Qu'est-ce qui vous distingue des autres candidats pour ce poste de {p['job_title']} ?"
            )

    return {
        "question":           q,
        "time_limit_seconds": TIME_COMMUNICATION,
        "phase":              "communication",       # ← FIX bug phase
        "question_index":     question_index,
        "theme":              theme,                 # ← tracking thème couvert
    }

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2 — CLARIFICATION CV (5 min/question)
# ─────────────────────────────────────────────────────────────────────────────
"""
PATCH 1 — generate_clarification_question()
Problème : `missing` non défini quand ai_missing_skills est vide → crash sur return final
           Même question répétée 3 fois car dédup seuil >= 2
           Fallback absurde "absence de aucune"
"""

def generate_clarification_question(
    application,
    question_index: int,
    transcript: list,
    profile_inconsistencies,
) -> dict:
    p       = _build_candidate_profile(application)
    profile = _profile_to_text(p)
    rag_all = _get_rag(
        application,
        "parcours expériences diplômes certifications cohérence",
        [SOURCE_CV, SOURCE_CERTIFICATION, SOURCE_RECOMMENDATION, SOURCE_COVER_LETTER]
    )
    prev = _format_transcript(transcript, "cv_clarification")

    clarif_types = {
        "DIPLÔME_HORS_DOMAINE", "INCOHÉRENCE_ÂGE_EXPÉRIENCE",
        "CERTIFICATION_NON_VÉRIFIÉE", "EXPÉRIENCE_ABSENTE_CV",
        "DISCORDANCE_CV_GIT", "DISCORDANCE_CV_LETTRE",
    }
    clarif_inconsistencies = sorted(
        [i for i in profile_inconsistencies
         if i.type.value in clarif_types and i.suggested_question],
        key=lambda x: getattr(x, 'severity', 0),
        reverse=True
    )

    if question_index < len(clarif_inconsistencies):
        inc = clarif_inconsistencies[question_index]
        return {
            "question":           inc.suggested_question,
            "time_limit_seconds": TIME_CLARIFICATION,
            "phase":              "cv_clarification",
            "question_index":     question_index,
            "theme":              inc.type.value,
        }

    # ── Variables locales toujours définies AVANT usage ──────────────────
    weaknesses = ", ".join(p["ai_weaknesses"]) if p["ai_weaknesses"] else ""
    missing    = ", ".join(p["ai_missing_skills"]) if p["ai_missing_skills"] else ""

    cert_block = ""
    if p["certifications"]:
        cert_block = (
            f"\nCertifications déclarées : {', '.join(p['certifications'])}\n"
            f"Si non justifiées par le reste du profil, "
            f"pose une question qui vérifie leur réalité concrète.\n"
        )

    priority_hints = []
    if p["ai_missing_skills"]:
        priority_hints.append(f"Compétences absentes vs poste : {missing}")
    if p["experience_years"] == 0 and p["diploma"]:
        priority_hints.append("Candidat sans expérience pro — clarifier projets académiques concrets")
    if p["github_projects"] and p["cover_letter_projects"]:
        gh_set = set(p["github_projects"])
        cl_set = set(p["cover_letter_projects"])
        if not gh_set.intersection(cl_set):
            priority_hints.append(
                "Projets GitHub et lettre de motivation différents — vérifier cohérence"
            )

    priority_block = "\n".join(f"→ {h}" for h in priority_hints)

    prompt = f"""
{profile}
{rag_all}
{cert_block}

Échanges clarification précédents :
{prev}

PRIORITÉS À EXPLORER :
{priority_block or "Explorer les zones d'ombre du parcours"}

OBJECTIF : Vérifier la COHÉRENCE et combler les ZONES D'OMBRE du parcours.
PAS de soft skills (déjà couvertes). PAS de question déjà posée.

Points faibles identifiés : {weaknesses or "non identifiés"}
Compétences manquantes : {missing or "aucune identifiée"}
Recommandations IA : {p['ai_recommendations'][:200] if p['ai_recommendations'] else 'aucune'}

CONTRAINTE : Nommer un élément SPÉCIFIQUE et VÉRIFIABLE (date, projet, technologie,
université, certification). La réponse attendue doit être un FAIT, pas une opinion.
Max 2 phrases. UNIQUEMENT la question.
"""
    q = _call_groq_text(prompt, max_tokens=200)

    # ── Déduplication — seuil abaissé à 1 (bloque dès la 1ère répétition) ──
    if q and _question_already_asked(q, transcript) >= 1:
        logger.info("[Clarification] Question répétée → question_index+1")
        if question_index < 5:
            return generate_clarification_question(
                application, question_index + 1, transcript, profile_inconsistencies
            )

    # ── Fallback conditionnel — jamais "absence de aucune" ──────────────
    if not q:
        if p["ai_missing_skills"]:
            q = (
                f"Votre profil ne mentionne pas {missing}. "
                f"Comment comptez-vous acquérir ces compétences pour le poste de {p['job_title']} ?"
            )
        elif p["ai_weaknesses"]:
            weakness = p["ai_weaknesses"][0]
            q = (
                f"Vous avez identifié '{weakness}' comme point à améliorer. "
                f"Donnez un exemple concret de progression récente dans ce domaine."
            )
        elif p["github_projects"]:
            project = p["github_projects"][0]
            q = (
                f"Dans votre projet {project}, quelles ont été les décisions techniques "
                f"les plus importantes que vous avez prises et pourquoi ?"
            )
        elif p["certifications"]:
            cert = p["certifications"][0]
            q = (
                f"Votre certification '{cert}' est mentionnée dans votre profil. "
                f"Dans quel projet ou contexte l'avez-vous concrètement appliquée ?"
            )
        else:
            q = (
                f"Quel aspect de votre formation à {p['university'] or 'votre université'} "
                f"vous a le mieux préparé aux défis du poste de {p['job_title']} ? "
                f"Donnez un exemple précis."
            )

    return {
        "question":           q,   # `q` est toujours défini ici — plus de crash possible
        "time_limit_seconds": TIME_CLARIFICATION,
        "phase":              "cv_clarification",
        "question_index":     question_index,
        "theme":              "zone_ombre",
    }

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 3 — QUESTIONS TECHNIQUES ORALES (5 min/question)
# ─────────────────────────────────────────────────────────────────────────────
def generate_technical_questions(application) -> List[Dict[str, Any]]:
    p       = _build_candidate_profile(application)
    profile = _profile_to_text(p)
    rag_cv  = _get_rag(
        application,
        f"projets techniques réalisations {p['job_requirements']}",
        [SOURCE_CV, SOURCE_GITHUB, SOURCE_COVER_LETTER],
        top_k=6,
    )

    github_projects = p["github_projects"]
    cover_projects  = p["cover_letter_projects"]
    has_github      = bool(github_projects)
    has_cover       = bool(cover_projects)
    has_projects    = has_github or has_cover
    skills          = _extract_skills_list(p["job_requirements"])
    primary_skill   = skills[0] if skills else p["job_title"]
    secondary_skill = skills[1] if len(skills) > 1 else primary_skill

    if has_github:
        github_block = "\n".join(f"- {pr}" for pr in github_projects)
    elif has_cover:
        github_block = "\n".join(f"- {pr}" for pr in cover_projects)
    else:
        github_block = "Aucun projet déclaré."

    code_samples = getattr(application, 'github_code_samples', None) or []
    has_code     = bool(code_samples)

    # ── Sélection intelligente des fichiers par langage ──────────────────
    BACKEND_LANGS   = ['py', 'java', 'cs', 'go', 'rb', 'php']
    FRONTEND_LANGS  = ['ts', 'tsx', 'js', 'jsx', 'vue']

    best_backend  = next((s for s in code_samples if s['language'] in BACKEND_LANGS), None)
    best_frontend = next((s for s in code_samples if s['language'] in FRONTEND_LANGS), None)

    # Fichier principal pour ANGLE 2 — préférer backend, sinon frontend, sinon premier
    main_sample   = best_backend or best_frontend or (code_samples[0] if has_code else None)

    # Fichier secondaire pour ANGLE 5 — différent du principal si possible
    second_sample = None
    if has_code and len(code_samples) > 1:
        second_sample = next(
            (s for s in code_samples if s != main_sample),
            code_samples[0]
        )
    elif has_code:
        second_sample = code_samples[0]

    # ── Prompt style commun ───────────────────────────────────────────────
    STYLE = (
        "La question doit être précise, technique, et nécessiter une réponse "
        "structurée de 4 à 7 minutes. Pas de question générique. "
        "UNIQUEMENT la question, max 3 phrases."
    )

    # ── Helper : bloc code formaté ────────────────────────────────────────
    def code_block(sample, max_chars=2500) -> str:
        if not sample:
            return ""
        return (
            f'Fichier réel : "{sample["file_path"]}" — repo "{sample["repo"]}"\n'
            f'```{sample["language"]}\n'
            f'{sample["content"][:max_chars]}\n'
            f'```'
        )

    angle_configs = [

        # ── ANGLE 1 : Architecture ────────────────────────────────────────
        {
            "angle": "architecture",
            "prompt": f"""
{profile}
{rag_cv}

Projets du candidat :
{github_block}

{code_block(main_sample) if has_code else ""}

OBJECTIF : Évaluer la capacité à concevoir et expliquer l'architecture logicielle.

{"Cite le nom EXACT d'un projet listé et demande comment il est structuré : "
 "modules, couches, flux de données, choix d'architecture (monolithe, micro-services, MVC…). "
 "Si du code est fourni, ancre la question sur ce code réel."
 if has_projects else
 f"Aucun projet déclaré. Demande comment le candidat structurerait une application "
 f"utilisant {primary_skill} pour le poste de {p['job_title']} "
 f"(couches, séparation des responsabilités, flux de données)."}

{STYLE}
""",
            "fallback": (
                f"Dans votre projet {github_projects[0] if has_github else cover_projects[0] if has_cover else 'le plus récent'}, "
                f"décrivez l'architecture mise en place : "
                f"quelles couches logicielles, comment les composants communiquent-ils, "
                f"et pourquoi ces choix ?"
                if has_projects else
                f"Comment structureriez-vous une application {primary_skill} "
                f"pour le poste de {p['job_title']} ? "
                f"Décrivez les couches, les modules et les flux de données."
            ),
        },

        # ── ANGLE 2 : Explication de code (fichier le plus pertinent) ────
        {
            "angle": "code_explanation",
            "prompt": (
                f"""
{profile}

{code_block(main_sample, max_chars=3000)}

OBJECTIF : Évaluer la compréhension du code propre produit par le candidat.
Pose une question demandant d'expliquer :
1. La logique de cet extrait et son rôle dans le projet
2. Les choix d'implémentation (gestion d'erreurs, structure, nommage)
3. Ce qu'il modifierait pour le rendre plus robuste ou scalable

{STYLE}
"""
                if main_sample else
                f"""
{profile}
{rag_cv}

Projets du candidat :
{github_block}

OBJECTIF : Évaluer la capacité à expliquer une implémentation technique concrète.

{"Cite un projet listé et demande d'expliquer UNE fonctionnalité précise : "
 "comment elle est implémentée, les choix techniques faits, "
 "et ce qui pourrait être amélioré."
 if has_projects else
 f"Demande comment le candidat implémenterait concrètement "
 f"une fonctionnalité clé liée à {primary_skill} "
 f"(algorithme, gestion d'état, persistance des données)."}

{STYLE}
"""
            ),
            "fallback": (
                f"Dans le fichier {main_sample['file_path']} de votre repo "
                f"{main_sample['repo']}, expliquez la logique implémentée : "
                f"quel problème résout ce code, pourquoi ces choix techniques, "
                f"et qu'amélioreriez-vous ?"
                if main_sample else
                f"Expliquez, étape par étape, comment vous implémenteriez "
                f"une fonctionnalité centrale utilisant {primary_skill} : "
                f"algorithme, structure de données, gestion des erreurs."
            ),
        },

        # ── ANGLE 3 : Choix technologique ancré sur le code ──────────────
        {
            "angle": "technologies",
            "prompt": f"""
{profile}
{rag_cv}

Projets du candidat :
{github_block}

{code_block(main_sample) if main_sample else ""}

OBJECTIF : Évaluer la maturité dans le choix des outils et frameworks.

{"À partir du code fourni, identifie UNE technologie ou pattern réellement utilisé "
 "(framework, librairie, pattern architectural). "
 "Demande pourquoi ce choix face à l'alternative principale, "
 "les compromis acceptés (performance, maintenabilité, courbe d'apprentissage), "
 "et si c'était à refaire, changerait-il quelque chose."
 if main_sample else
 ("Cite UN projet listé et UNE technologie réelle utilisée dedans. "
  "Demande pourquoi ce choix face aux alternatives, "
  "les compromis acceptés, et si c'était à refaire."
  if has_projects else
  f"Demande pourquoi le candidat choisirait {primary_skill} "
  f"plutôt qu'une alternative connue pour le poste de {p['job_title']}, "
  f"et dans quel contexte il choisirait l'inverse.")}

{STYLE}
""",
            "fallback": (
                f"Dans votre projet {main_sample['repo'] if main_sample else (github_projects[0] if has_github else cover_projects[0] if has_cover else 'récent')}, "
                f"pourquoi avez-vous choisi les technologies utilisées ? "
                f"Quelles alternatives avez-vous étudiées, quels compromis avez-vous acceptés ?"
                if has_projects or main_sample else
                f"Pourquoi choisiriez-vous {primary_skill} pour ce poste "
                f"plutôt qu'une alternative ? "
                f"Citez un cas où vous choisiriez l'outil concurrent à la place."
            ),
        },

        # ── ANGLE 4 : Tâche difficile (méthode STAR) ─────────────────────
        {
            "angle": "contribution_tache",
            "prompt": f"""
{profile}
{rag_cv}

Projets du candidat :
{github_block}

{code_block(second_sample) if second_sample and second_sample != main_sample else ""}

OBJECTIF : Évaluer la capacité à résoudre des problèmes techniques complexes (méthode STAR).

{"Cite UN projet listé. Demande de décrire LA tâche la plus difficile techniquement : "
 "quelle était la contrainte ou le bug, "
 "quelle démarche de diagnostic a été suivie, "
 "quelle solution a été choisie parmi les alternatives, "
 "et quel était le résultat mesurable."
 if has_projects else
 f"Demande de décrire le problème technique le plus complexe "
 f"résolu en lien avec {secondary_skill} : diagnostic, solution, résultat."}

{STYLE}
""",
            "fallback": (
                f"Dans votre projet {github_projects[0] if has_github else cover_projects[0] if has_cover else 'récent'}, "
                f"décrivez la tâche techniquement la plus difficile : "
                f"quelle était la contrainte, comment avez-vous diagnostiqué le problème, "
                f"quelle solution avez-vous implémentée et quel résultat avez-vous obtenu ?"
                if has_projects else
                f"Décrivez le problème technique le plus complexe que vous ayez résolu "
                f"en lien avec {secondary_skill} : "
                f"situation, démarche, solution choisie, résultat."
            ),
        },

        # ── ANGLE 5 : Code Review (nouveau — impossible sans IA) ──────────
        {
            "angle": "code_review",
            "prompt": (
                f"""
{profile}

{code_block(second_sample or main_sample, max_chars=2500)}

OBJECTIF : Évaluer l'esprit critique du candidat sur son propre code.
Pose une question demandant au candidat d'identifier :
1. Un point fort de cet extrait (clarté, performance, maintenabilité)
2. Une faiblesse ou dette technique présente dans ce code
3. Comment il refactoriserait ou améliorerait ce code aujourd'hui

La question doit citer le fichier et le repo exacts.
{STYLE}
"""
                if (second_sample or main_sample) else
                f"""
{profile}
{rag_cv}

Projets du candidat :
{github_block}

OBJECTIF : Évaluer l'esprit critique et la capacité à s'auto-évaluer.

{"Cite un projet listé. Demande au candidat d'identifier un point fort "
 "et une faiblesse technique dans son implémentation, "
 "et comment il améliorerait le code aujourd'hui."
 if has_projects else
 f"Demande au candidat d'identifier les points forts et faiblesses "
 f"d'une architecture {primary_skill} typique, "
 f"et comment il éviterait les pièges classiques."}

{STYLE}
"""
            ),
            "fallback": (
                f"Dans le fichier {(second_sample or main_sample)['file_path']}, "
                f"identifiez un point fort et une faiblesse de votre implémentation. "
                f"Comment refactoriseriez-vous ce code aujourd'hui ?"
                if (second_sample or main_sample) else
                f"Identifiez les forces et faiblesses d'une architecture {primary_skill} "
                f"que vous avez mise en place, et comment vous l'amélioreriez."
            ),
        },
    ]

    questions_out: List[Dict[str, Any]] = []
    for cfg in angle_configs:
        try:
            q = _call_groq_text(cfg["prompt"], max_tokens=250)
        except Exception as exc:
            logger.warning(f"[TechQ] Groq échoué pour angle={cfg['angle']}: {exc}")
            q = None
        if not q:
            q = cfg["fallback"]

        angle = cfg["angle"]
        if angle == "code_explanation" and main_sample:
            sample_for_angle = main_sample
        elif angle == "code_review" and (second_sample or main_sample):
            sample_for_angle = second_sample or main_sample
        elif angle == "contribution_tache" and second_sample and second_sample != main_sample:
            sample_for_angle = second_sample
        else:
            sample_for_angle = None

        questions_out.append({
            "question": q,
            "time_limit_seconds": TIME_TECHNICAL,
            "phase": "technical",
            "question_index": len(questions_out),
            "angle": angle,
            "code_sample": {
                "file_path": sample_for_angle["file_path"],
                "repo": sample_for_angle["repo"],
                "language": sample_for_angle["language"],
                "content": sample_for_angle["content"][:2000],
            } if sample_for_angle else None,
        })

    return questions_out
# ─────────────────────────────────────────────────────────────────────────────
# PHASE 4 — SCÉNARIOS PROFESSIONNELS (4 fixes, 7 min/scénario)
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
            "hint": (
                    f"Utilise une expérience ou situation concrète visible dans le CV ou la lettre. "
                    + (
                        f"Si possible, ancre sur le projet '{p['github_projects'][0]}' ou '{p['cover_letter_projects'][0] if p['cover_letter_projects'] else ''}'. "
                        if p['github_projects'] or p['cover_letter_projects'] else ""
                    )
                    + "Décris une situation de conflit d'équipe, délai impossible ou décision difficile."
            ),
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
            "hint": (
                f"Cite OBLIGATOIREMENT le nom exact d'un de ces repos : "
                f"{', '.join(p['github_projects'][:3]) if p['github_projects'] else 'aucun repo disponible'}. "
                f"Demande comment un problème technique complexe a été résolu dans ce projet précis "
                f"(bug critique, décision d'architecture, contrainte de performance). "
                f"Si aucun repo disponible, ancre sur les technologies requises : {p['job_requirements'][:100]}."
            ),
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
        q = q or _fallback_scenario(cfg["index"], p)

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

Répartition OBLIGATOIRE : 3 faciles, 7 moyennes, 10 difficiles. Total = {num_questions} questions exactement.
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
    result = _call_groq_json(prompt, max_tokens=4000, temperature=0.25)
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

    if len(valid) != num_questions:
        logger.warning(
            f"[QCM] Groq a retourné {len(valid)}/{len(questions)} questions valides "
            f"au lieu de {num_questions} demandées"
        )

    if len(valid) > num_questions:
        valid = valid[:num_questions]  # tronque l'excédent (ex: 22 → 20)

    if not valid:
        raise RuntimeError(
            f"Groq n'a retourné aucune question QCM valide "
            f"(brut: {questions[:1] if questions else 'vide'})"
        )

    if len(valid) < num_questions:
        raise RuntimeError(
            f"Seulement {len(valid)}/{num_questions} questions QCM valides — "
            f"insuffisant, nouvelle tentative nécessaire"
        )

    return {
        "questions": valid,
        "time_limit_seconds": TIME_QCM_TOTAL,
        "phase": "qcm",
    }



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

Contradiction significative = compétence déclarée, technologie, expérience, dates, méthode de travail.
Nuance, reformulation ou précision supplémentaire = PAS une contradiction.
Seuil élevé : ne détecter que les vraies contradictions factuelles, pas les imprécisions.

JSON :
{{
  "contradiction_detected": true | false,
  "severity": "high" | "medium" | "low",
  "contradiction_summary": "1 phrase ou null",
  "followup_question": "Question de relance directe max 2 phrases ou null"
}}
"""
    result = _call_groq_json(prompt, max_tokens=300)

    # Seuil : seulement les contradictions high/medium
    if (
        result.get("contradiction_detected")
        and result.get("severity") in ("high", "medium")
        and result.get("followup_question")
    ):
        logger.info(
            "[Contradiction] severity=%s — %s",
            result.get("severity"),
            result.get("contradiction_summary", "")
        )
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

    # Contradiction — seulement si réponse substantielle (>20 mots)
    if last_answer and last_question and len(last_answer.split()) > 20:
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