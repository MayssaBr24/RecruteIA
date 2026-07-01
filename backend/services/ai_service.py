
from __future__ import annotations

import json
import logging
import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
from pathlib import Path
import os
import requests
from dotenv import load_dotenv
from pypdf import PdfReader
from pdf2image import convert_from_path
import pytesseract
from PIL import Image
from .rag import (
    SOURCE_CERTIFICATION,
    SOURCE_COVER_LETTER,
    SOURCE_CV,
    SOURCE_GITHUB,
    SOURCE_RECOMMENDATION,
    index_document,
    retrieve_for_job,
)
from datetime import timedelta

# ──────────────────────────────────────────────────────────────────────────────
# ENV
# ──────────────────────────────────────────────────────────────────────────────

_backend_dir = Path(__file__).resolve().parent.parent
_env_path    = _backend_dir / ".env"
if _env_path.exists():
    load_dotenv(_env_path, override=True)

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# CONFIGURATION GROQ
# ──────────────────────────────────────────────────────────────────────────────

GROQ_API_URL: str  = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL: str    = "llama-3.3-70b-versatile"
MAX_RAG_CHARS: int = 6000  # ~1500 tokens — protège la fenêtre de contexte Groq


# ── Extraction code source GitHub (questions techniques ciblées) ──────────
CODE_EXTENSIONS = {
    '.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.go', '.rb',
    '.php', '.c', '.cpp', '.cs', '.kt', '.swift', '.rs',
}
IGNORE_PATTERNS = (
    'test_', '_test.', '.test.', 'spec.', '__init__', 'migrations/',
    'node_modules/', 'vendor/', '.min.', 'dist/', 'build/',
)
MAX_CODE_FILE_SIZE     = 8000
MAX_CODE_FILES_PER_REPO = 2
MAX_CODE_REPOS          = 2


_SYSTEM_PROMPT_ANALYSIS = """\
Tu es un expert RH senior spécialisé en recrutement tech. Ta mission :
- Évaluer l'adéquation candidat/poste de façon objective et structurée.
- Baser TOUTE ton analyse UNIQUEMENT sur les extraits RAG fournis et les données GitHub.
- Ne jamais inventer de compétences ou d'expériences non mentionnées.
- Si le domaine principal du candidat est totalement étranger au poste :
  is_out_of_field=true, overall_score<30.
- Les certifications mentionnées dans la section [CERTIFICATIONS VÉRIFIÉES] sont
  des documents officiels fournis par le candidat — leur poids doit être supérieur
  à une simple mention dans le CV.
  - Pour chaque certification soumise, évalue sa crédibilité :
  * La date est-elle possible ? (ex: AWS Certified n'existe pas avant 2013)
  * Le niveau est-il cohérent avec l'expérience déclarée ?
  * Le format du nom correspond-il aux certifications officielles connues ?
  * Y a-t-il contradiction entre la certification et les compétences déclarées ?
- Si une certification semble suspecte : marque-la "suspicious": true
  et explique pourquoi dans "suspicion_reason".
- Répondre UNIQUEMENT en JSON valide (pas de markdown, pas de backticks).\
"""

# ──────────────────────────────────────────────────────────────────────────────
# DATACLASSES
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class CVAnalysis:
    score: int
    summary: str
    strengths: List[str]
    weaknesses: List[str]
    missing_skills: List[str]
    skill_levels: Dict[str, str]
    inconsistencies: List[str]
    professional_stability: str
    red_flags: List[str]
    total_years_experience: int


@dataclass
class MotivationAnalysis:
    score: int
    is_personalized: bool
    motivation_level: str
    understanding_score: int
    writing_quality: int
    professionalism: int
    key_strengths: List[str]
    red_flags: List[str]


@dataclass
class SoftSkillsAnalysis:
    leadership: int
    autonomy: int
    teamwork: int
    problem_solving: int
    communication: int
    detected_keywords: Dict[str, List[str]]


@dataclass
class GitHubAnalysis:
    score: int
    total_repos: int
    main_languages: List[str]
    activity_score: int
    project_quality: int
    documentation_score: int
    last_activity: str
    top_repos: List[Dict[str, Any]]
    relevance_score: int


@dataclass
class CoherenceCheck:
    experience_match: bool
    availability_compatible: bool
    is_out_of_field: bool        # exposé au frontend
    overall_score: int
    flags: List[str]
    notes: str
    letter_is_generic: bool = False
    letter_personalization_score: int = 100
    company_mentioned: bool = True


@dataclass
class FinalAnalysis:
    final_score: int
    cv_analysis: CVAnalysis
    motivation_analysis: Optional[MotivationAnalysis]
    softskills_analysis: SoftSkillsAnalysis
    github_analysis: Optional[GitHubAnalysis]
    coherence_check: CoherenceCheck
    decision: str
    recommendations: str
    detailed_breakdown: Dict[str, Any]
    candidate_message: str = ""
    next_steps: str = ""
    weights_used: Dict[str, float] = field(default_factory=dict)
    certifications: List[Any] = field(default_factory=list)
    projects: List[Any] = field(default_factory=list)


# ──────────────────────────────────────────────────────────────────────────────
# HELPER : appel Groq
# ──────────────────────────────────────────────────────────────────────────────

def _call_groq_json(
    api_key: str,
    user_prompt: str,
    system_prompt: str = _SYSTEM_PROMPT_ANALYSIS,
    max_tokens: int = 4000,
    temperature: float = 0.2,
) -> Dict[str, Any]:
    """
    Appel Groq en mode JSON strict.
    Retourne un dict vide en cas d'erreur — jamais d'exception levée.
    """
    try:
        resp = requests.post(
            GROQ_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type":  "application/json",
            },
            json={
                "model":   GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": user_prompt},
                ],
                "temperature":     temperature,
                "max_tokens":      max_tokens,
                "response_format": {"type": "json_object"},
            },
            timeout=60,
        )
        resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"]
        return json.loads(raw)
    except requests.exceptions.Timeout:
        logger.error("[Groq] Timeout dépassé")
        return {}
    except json.JSONDecodeError as exc:
        logger.error("[Groq] JSON invalide: %s", exc)
        return {}
    except Exception as exc:
        logger.error("[Groq] Erreur inattendue: %s", exc)
        return {}
# ──────────────────────────────────────────────────────────────────────────────
# COHÉRENCE D'IDENTITÉ (nom déclaré vs CV vs lettre)
# ──────────────────────────────────────────────────────────────────────────────

_NAME_TOKEN_RE = re.compile(r"[a-zàâäéèêëïîôöùûüçñ]+")
# À ajouter après l'existant _NAME_TOKEN_RE

_LETTER_GENERIC_PATTERNS = [
    (r"je suis vivement intéressé par le poste de \w+", "Formule générique d'intérêt"),
    (r"je souhaiterais rejoindre votre entreprise", "Absence de nom d'entreprise"),
    (r"mes compétences et mon expérience", "Tournure passe-partout"),
    (r"je me permets de vous adresser ma candidature", "Formule administrative générique"),
]

# Patterns de personnalisation forte (bonus)
_PERSONALIZATION_PATTERNS = [
    (r"(votre|vos|votre entreprise|votre équipe)", "Utilisation du 'vous' personnalisé"),
    (r"après avoir consulté (votre|vos)", "Recherche préalable"),
    (r"en particulier (votre|votre stack|votre projet)", "Référence spécifique"),
]


def _detect_generic_letter(letter_text: str, company_name: str = "") -> Dict[str, Any]:
    """
    Analyse la lettre de motivation pour détecter un caractère générique.
    Retourne un score de personnalisation (0-100) et des flags.
    """
    if not letter_text or len(letter_text.strip()) < 100:
        return {"is_generic": True, "score": 0, "flags": ["Lettre trop courte"], "matches": []}

    letter_lower = letter_text.lower()
    flags = []
    matched_patterns = []

    # 1. Détection des patterns génériques
    for pattern, description in _LETTER_GENERIC_PATTERNS:
        if re.search(pattern, letter_lower):
            flags.append(description)
            matched_patterns.append(description)

    # 2. Vérification présence nom de l'entreprise
    if company_name and company_name.lower() not in letter_lower:
        flags.append(f"Nom de l'entreprise '{company_name}' absent")
    elif company_name:
        matched_patterns.append(f"Entreprise mentionnée : {company_name}")

    # 3. Bonus pour personnalisation
    personalization_score = 0
    for pattern, description in _PERSONALIZATION_PATTERNS:
        if re.search(pattern, letter_lower):
            personalization_score += 15
            matched_patterns.append(f"[BONUS] {description}")

    # 4. Détection de structure template
    # Si la lettre commence par "Objet :" ou "Madame, Monsieur" générique
    if re.match(r"^(objet|subject|madame|monsieur)[\s:]", letter_lower):
        flags.append("Structure template détectée (en-tête standardisé)")

    # 5. Score final (plus bas = plus générique)
    # Pénalité : 20 pts par flag générique
    generic_penalty = min(80, len([f for f in flags if "générique" in f.lower() or "absent" in f]) * 20)
    base_score = 100 - generic_penalty + personalization_score

    score = max(0, min(100, base_score))
    is_generic = score < 40

    return {
        "is_generic": is_generic,
        "score": score,
        "flags": flags[:4],
        "personalization_bonus": personalization_score,
        "matches": matched_patterns[:5],
    }

def _name_tokens(name: str) -> set:
    return {t for t in _NAME_TOKEN_RE.findall((name or "").lower()) if len(t) > 2}

def _check_identity_coherence(
    declared_name: str,
    cv_text: str,
    letter_text: str,
    company_name: str = "",
) -> Dict[str, Any]:
    flags: List[str] = []
    warnings: List[str] = []
    details: Dict[str, Any] = {}

    declared_tokens = _name_tokens(declared_name)
    if not declared_tokens:
        return {
            "flags": [], "warnings": [], "details": {},
            "has_issues": False,
            "letter_is_generic": False,
            "letter_personalization_score": 100,
        }

    def ratio_in(text: str, sample_chars: int = 1000) -> Optional[float]:
        if not text or "[Erreur" in text or len(text.strip()) < 10:
            return None
        sample = text[:sample_chars].lower()
        found = sum(1 for t in declared_tokens if t in sample)
        return found / len(declared_tokens) if declared_tokens else None

    cv_ratio     = ratio_in(cv_text)
    letter_ratio = ratio_in(letter_text)

    # ── 1. Nom déclaré présent dans CV et lettre ─────────────────────────────
    if cv_ratio is not None and cv_ratio < 0.4:
        flags.append(f"Nom '{declared_name}' non trouvé dans le CV")

    if letter_ratio is not None and letter_ratio < 0.4:
        flags.append(
            f"Nom déclaré '{declared_name}' non trouvé dans la lettre "
            f"— lettre possiblement empruntée"
        )

    # ── 2. Cohérence inter-documents ─────────────────────────────────────────
    if cv_ratio is not None and letter_ratio is not None:
        cv_sample     = cv_text[:1000].lower()
        letter_sample = letter_text[:1000].lower()
        cv_tokens_found     = {t for t in declared_tokens if t in cv_sample}
        letter_tokens_found = {t for t in declared_tokens if t in letter_sample}
        if (not cv_tokens_found and not letter_tokens_found
                and (cv_ratio == 0 or letter_ratio == 0)):
            flags.append(
                "CV et lettre semblent appartenir à des identités différentes"
            )

    # ── 3. Détection lettre générique ────────────────────────────────────────
    generic_analysis = _detect_generic_letter(letter_text, company_name)
    details["letter_generic_analysis"] = generic_analysis

    if generic_analysis["is_generic"]:
        flags.append("LETTRE_GENERIQUE")
        warnings.append(f"Lettre générique détectée (score {generic_analysis['score']}/100)")
        for flag in generic_analysis["flags"]:
            warnings.append(f"  • {flag}")

    return {
        "flags":                      flags,
        "warnings":                   warnings,
        "details":                    details,
        "has_issues":                 len(flags) > 0,
        "letter_is_generic":          generic_analysis["is_generic"],
        "letter_personalization_score": generic_analysis["score"],
    }

def _check_company_mention(
        letter_text: str,
        company_name: str,
        job_title: str = ""
) -> Dict[str, Any]:
    """
    Vérifie si le candidat a personnalisé sa lettre avec le nom de l'entreprise
    et éventuellement le titre du poste.
    """
    if not company_name or not letter_text:
        logger.warning("[Pipeline] company_name non fourni — pénalité entreprise désactivée")

        return {"company_mentioned": False, "score": 0, "details": "Nom entreprise non fourni"}

    letter_lower = letter_text.lower()
    company_lower = company_name.lower()

    # Nettoyer les variantes (ex: "Company Inc." → "company", "inc")
    company_core = re.sub(r'\b(inc|llc|sas|sa|gmbh|sarl)\b\.?', '', company_lower).strip()

    # Vérification exacte
    exact_match = company_lower in letter_lower or company_core in letter_lower

    # Vérification avec mots séparés (ex: "Google" vs "Google Cloud")
    company_words = set(company_core.split())
    letter_words = set(letter_lower.split())
    partial_match = len(company_words & letter_words) >= 1 if company_words else False

    # Bonus si titre du poste mentionné aussi
    job_mentioned = False
    if job_title:
        job_title_lower = job_title.lower()
        # Extraire le cœur du titre (ex: "Développeur Full Stack" → "développeur")
        job_core = job_title_lower.split()[0] if job_title_lower.split() else ""
        job_mentioned = job_core in letter_lower or job_title_lower in letter_lower

    score = 0
    if exact_match:
        score = 100
    elif partial_match:
        score = 60
    else:
        score = 0

    if job_mentioned and score > 0:
        score = min(100, score + 20)

    return {
        "company_mentioned": exact_match or partial_match,
        "exact_match": exact_match,
        "partial_match": partial_match,
        "job_title_mentioned": job_mentioned,
        "score": score,
        "company_name_used": company_name,
    }

# ──────────────────────────────────────────────────────────────────────────────
# ANALYSEUR PRINCIPAL
# ──────────────────────────────────────────────────────────────────────────────

class IntelligentCVAnalyzer:
    """
    Pipeline d'analyse candidat production-ready.

    Étapes :
      1. Extraction PDF (CV, lettre, recommandations)
      2. Analyse GitHub (sans LLM)
      3. Indexation RAG dans ChromaDB
      4. Récupération RAG (passages pertinents)
      5. Un seul appel Groq (contexte RAG complet)
      6. Parsing + calcul score final
      7. Génération messages candidat
    """

    def __init__(self) -> None:
        self.api_key = os.getenv("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError("GROQ_API_KEY non définie dans .env")
        logger.info("[CVAnalyzer] Initialisé — modèle: %s", GROQ_MODEL)

    # ──────────────────────────────────────────────────────────────────────────
    # EXTRACTION PDF
    # ──────────────────────────────────────────────────────────────────────────

    def extract_text_from_pdf(self, pdf_file) -> str:
        try:
            path = str(pdf_file) if isinstance(pdf_file, (str, Path)) else str(pdf_file)

            # Détecter si c'est une image déguisée en PDF
            with open(path, 'rb') as f:
                header = f.read(4)

            # JPEG header : FF D8 FF
            if header[:3] == b'\xff\xd8\xff':
                logger.info("[CVAnalyzer] Fichier JPEG détecté (extension .pdf) → OCR direct")
                return self._ocr_pdf(path)

            # PNG header : 89 50 4E 47
            if header[:4] == b'\x89PNG':
                logger.info("[CVAnalyzer] Fichier PNG détecté → OCR direct")
                return self._ocr_pdf(path)

            reader = PdfReader(path)
            pages = [
                p.extract_text().strip()
                for p in reader.pages
                if p.extract_text() and p.extract_text().strip()
            ]
            full = "\n\n".join(pages)

            if not full:
                return self._ocr_pdf(path)

            return full

        except Exception as exc:
            logger.error("[CVAnalyzer] Erreur extraction PDF: %s", exc)
            # Dernier recours — tenter OCR quand même
            try:
                return self._ocr_pdf(pdf_file)
            except Exception:
                return "[Erreur extraction PDF]"

    def _ocr_pdf(self, pdf_file) -> str:
        try:


            path = str(pdf_file) if isinstance(pdf_file, (str, Path)) else str(pdf_file)

            # Détecter image par header (pas par extension)
            with open(path, 'rb') as f:
                header = f.read(4)

            is_image = (
                    header[:3] == b'\xff\xd8\xff'  # JPEG
                    or header[:4] == b'\x89PNG'  # PNG
                    or path.lower().endswith((".jpg", ".jpeg", ".png"))
            )

            if is_image:
                img = Image.open(path)
                text = pytesseract.image_to_string(img, lang="fra+eng", config="--psm 6").strip()
                logger.info("[OCR] Image → %d chars extraits", len(text))
                return text or "[OCR image sans résultat]"

            # PDF scanné → convertir en images
            images = convert_from_path(path, dpi=300)
            texts = []
            for img in images:
                text = pytesseract.image_to_string(img, lang="fra+eng").strip()
                if text:
                    texts.append(text)

            result = "\n\n".join(texts)
            logger.info("[OCR] PDF scanné → %d chars extraits", len(result))
            return result or "[OCR sans résultat]"

        except ImportError:
            logger.warning("[OCR] pytesseract/pdf2image non installé")
            return "[PDF scanné — OCR non disponible]"
        except Exception as exc:
            logger.error("[OCR] Erreur: %s", exc)
            return "[Erreur OCR]"


    # ──────────────────────────────────────────────────────────────────────────
    # ANALYSE GITHUB (API directe, sans LLM)
    # ──────────────────────────────────────────────────────────────────────────
    _SKILL_LANG_MAP: Dict[str, List[str]] = {
        # Python ecosystem
        "python": ["python", "jupyter notebook", "cython"],
        "django": ["python"],
        "flask": ["python"],
        "fastapi": ["python"],
        "machine learning": ["python", "jupyter notebook", "r"],
        "data science": ["python", "jupyter notebook", "r", "julia"],

        # JS / TS ecosystem
        "javascript": ["javascript", "typescript", "vue", "svelte"],
        "typescript": ["typescript", "javascript"],
        "react": ["javascript", "typescript"],
        "vue": ["javascript", "typescript", "vue"],
        "node": ["javascript", "typescript"],
        "nodejs": ["javascript", "typescript"],

        # Java ecosystem
        "java": ["java", "kotlin", "groovy", "scala"],
        "kotlin": ["kotlin", "java"],
        "spring": ["java", "kotlin"],

        # DevOps / infra
        "devops": ["shell", "dockerfile", "hcl", "python", "go", "ruby"],
        "docker": ["dockerfile", "shell"],
        "kubernetes": ["shell", "hcl", "go"],
        "terraform": ["hcl", "shell"],
        "ansible": ["python", "shell"],
        "ci/cd": ["shell", "python", "go", "ruby"],

        # Go / Rust / C++
        "go": ["go"],
        "golang": ["go"],
        "rust": ["rust"],
        "c++": ["c++", "c"],
        "cpp": ["c++", "c"],

        # Mobile
        "ios": ["swift", "objective-c"],
        "swift": ["swift", "objective-c"],
        "android": ["kotlin", "java"],
        "flutter": ["dart"],
        "dart": ["dart"],

        # Data / ML
        "sql": ["plpgsql", "tsql", "python"],
        "r": ["r"],
        "scala": ["scala"],
        "spark": ["scala", "python"],
        "airflow": ["python"],

        # Web générique
        "php": ["php", "hack"],
        "ruby": ["ruby"],
        "rails": ["ruby"],
        "c#": ["c#"],
        "dotnet": [".net", "c#"],
        ".net": ["c#"],
        "elixir": ["elixir"],
    }

    def _compute_stack_relevance(
            self,
            repos_data: List[Dict],
            required_skills: List[str],
    ) -> Dict[str, Any]:
        """
        Compare les langages réellement utilisés dans les repos originaux
        avec les hard skills requis par le poste.

        Retourne un score 0–35 et un détail des matches.
        Zéro appel LLM, zéro token consommé.
        """
        if not required_skills:
            return {"score": 0, "matches": [], "misses": [], "detail": "Aucun skill requis"}

        # Compter les langages dans les repos ORIGINAUX uniquement
        original_repos = repos_data  # on prend tous les repos sans distinction

        lang_counter: Dict[str, int] = {}
        for repo in repos_data[:20]:
            lang = (repo.get("language") or "").lower().strip()
            if lang:
                lang_counter[lang] = lang_counter.get(lang, 0) + 1

        # Normaliser les langages GitHub (ex: "Jupyter Notebook" → "jupyter notebook")
        langs_present = set(lang_counter.keys())

        matches: List[str] = []
        misses: List[str] = []

        for skill in required_skills:
            skill_lower = skill.lower().strip()

            # Chercher dans le mapping : skill → familles de langages attendues
            expected_langs = self._SKILL_LANG_MAP.get(skill_lower, [skill_lower])

            skill_found = False
            for expected in expected_langs:
                if expected in langs_present:
                    skill_found = True
                    break

            # Matching inverse : un langage GitHub peut matcher directement un skill
            if not skill_found:
                for lang in langs_present:
                    if skill_lower in lang or lang in skill_lower:
                        skill_found = True
                        break

            if skill_found:
                matches.append(skill)
            else:
                misses.append(skill)

        n_skills = len(required_skills)
        n_match = len(matches)
        ratio = n_match / n_skills if n_skills else 0

        # Score sur 35 — pénalité supplémentaire si 0 match
        if n_match == 0:
            score = 0
        elif ratio >= 0.8:
            score = 40
        elif ratio >= 0.6:
            score = 32
        elif ratio >= 0.4:
            score = 24
        elif ratio >= 0.2:
            score = 12
        else:
            score = 6

        return {
            "score": score,
            "matches": matches,
            "misses": misses,
            "detail": f"{n_match}/{n_skills} skills matchés — langages: {', '.join(sorted(langs_present)[:6])}",
            "langs_found": list(langs_present),
        }

    def analyze_github(
            self,
            github_url: str,
            required_skills: Optional[List[str]] = None,
    ) -> Optional[GitHubAnalysis]:
        if not github_url or not github_url.strip():
            return None
        try:
            username = github_url.strip().rstrip("/").split("/")[-1]
            if not username or len(username) < 2:
                return None

            headers = {}
            token = os.getenv("GITHUB_TOKEN")
            if token:
                headers["Authorization"] = f"token {token}"

            user_resp = requests.get(
                f"https://api.github.com/users/{username}",
                headers=headers, timeout=10,
            )
            if user_resp.status_code != 200:
                return None
            user_data = user_resp.json()
            if "message" in user_data:
                return None

            repos_resp = requests.get(
                f"https://api.github.com/users/{username}/repos"
                f"?sort=updated&per_page=30&type=owner",
                headers=headers, timeout=10,
            )
            repos_data = repos_resp.json() if repos_resp.status_code == 200 else []
            if not isinstance(repos_data, list):
                repos_data = []

            total_repos = user_data.get("public_repos", 0)

            def _has_readme(repo_name):
                try:
                    r = requests.get(
                        f"https://api.github.com/repos/{username}/{repo_name}/readme",
                        headers=headers,
                        timeout=5,
                    )
                    return r.status_code == 200
                except:
                    return False

            # ── Langages principaux (top 5, repos originaux seulement) ───────────
            original_repos = [r for r in repos_data if not r.get("fork", False)]
            readme_cache = {}

            top_recent_repos = sorted(
                original_repos,
                key=lambda r: r.get("updated_at", ""),
                reverse=True
            )[:3]

            for repo in top_recent_repos:
                readme_cache[repo["name"]] = _has_readme(repo["name"])

            repos_with_readme = sum(readme_cache.values())
            langs: Dict[str, int] = {}
            for repo in original_repos[:20]:
                lang = repo.get("language")
                if lang:
                    langs[lang] = langs.get(lang, 0) + 1
            main_languages = sorted(langs, key=lambda x: langs[x], reverse=True)[:5]

            top_repos = [
                {
                    "name": r.get("name", ""),
                    "stars": r.get("stargazers_count", 0),
                    "forks": r.get("forks_count", 0),
                    "description": r.get("description") or "",
                    "language": r.get("language"),
                    "updated_at": r.get("updated_at", "")[:10],
                }
                for r in repos_data[:5]
            ]

            # ── PILIER 1 : Stack relevance (35 pts) ──────────────────────────────
            stack_result = self._compute_stack_relevance(repos_data, required_skills or [])
            stack_score = stack_result["score"]  # 0–35

            # ── PILIER 2 : Activité réelle sur 6 mois (25 pts) ───────────────────
            # On regarde les repos originaux mis à jour dans les 6 derniers mois
            # (pas 2 ans comme avant — trop généreux)

            cutoff_6m = datetime.now() - timedelta(days=180)
            cutoff_12m = datetime.now() - timedelta(days=365)

            recently_active_6m = 0
            recently_active_12m = 0
            for repo in original_repos:
                updated_str = repo.get("updated_at", "")[:10]
                if not updated_str:
                    continue
                try:
                    updated_dt = datetime.strptime(updated_str, "%Y-%m-%d")
                    if updated_dt >= cutoff_6m:
                        recently_active_6m += 1
                        recently_active_12m += 1
                    elif updated_dt >= cutoff_12m:
                        recently_active_12m += 1
                except ValueError:
                    pass

            # Score sur 25 — strict : 1 repo actif ≠ développeur actif
            if recently_active_6m >= 5:
                activity_score_pts = 25
            elif recently_active_6m >= 3:
                activity_score_pts = 20
            elif recently_active_6m >= 1:
                activity_score_pts = 6
            elif recently_active_12m >= 2:
                activity_score_pts = 8
            elif recently_active_12m >= 1:
                activity_score_pts = 4
            else:
                activity_score_pts = 0

            # Pour compatibilité avec le champ activity_score (0–5) existant
            activity_score = min(5, recently_active_6m)

            # ── PILIER 3 : Qualité projets originaux (25 pts) ────────────────────
            def _score_repo_strict(repo: Dict) -> int:
                points = 0

                # Description substantielle
                if len(repo.get("description") or "") > 30:  # seuil baissé 50→30
                    points += 1

                # Stars OU forks (1 seul suffit)
                if repo.get("stargazers_count", 0) >= 1 or repo.get("forks_count", 0) >= 1:
                    points += 1

                if readme_cache.get(repo.get("name"), False):
                    points += 2

                # Activité récente
                updated = repo.get("updated_at", "")[:10]
                if updated:
                    try:
                        repo_dt = datetime.strptime(updated, "%Y-%m-%d")
                        if repo_dt >= cutoff_6m:
                            points += 1
                        elif repo_dt >= cutoff_12m:  # ← bonus partiel si 12 mois
                            points += 0  # on garde 0 mais on ne pénalise pas
                    except ValueError:
                        pass

                # Bonus : repo avec topics ou homepage (indique soin du profil)
                if repo.get("homepage") or repo.get("topics"):
                    points += 1

                return points


            repo_scores = [_score_repo_strict(r) for r in original_repos[:15]]
            quality_repos = [s for s in repo_scores if s >= 2]

            if not original_repos:
                project_quality_pts = 0
            elif not quality_repos:
                project_quality_pts = 3 if len(original_repos) >= 3 else 0
            else:
                ratio = len(quality_repos) / len(original_repos)
                project_quality_pts = min(35, max(5, round(ratio * 35)))
            project_quality = min(5, len(quality_repos))  # pour compatibilité

            # ── PÉNALITÉS ────────────────────────────────────────────────────────
            penalty = 0



            # Stack totalement hors sujet (0 match sur 3+ skills requis) → −5 pts
            if (required_skills and len(required_skills) >= 3
                    and stack_result["score"] == 0):
                penalty += 5

            # ── SCORE FINAL ──────────────────────────────────────────────────────
            raw_score = stack_score + activity_score_pts + project_quality_pts
            score = int(round(max(0, min(100, raw_score - penalty))))

            # ── Documentation (inchangée, pour info dans le rapport) ──────────────
            documented_repos = [r for r in original_repos[:10]
                                if len(r.get("description") or "") > 20]
            documentation_score = min(3, len(documented_repos))

            last_activity = (
                repos_data[0].get("updated_at", "")[:10] if repos_data else "Inconnu"
            )

            logger.info(
                "[GitHub] %s → score=%d | stack=%d/40 (matches=%s) | "
                "activity=%d/25 (6m=%d) | quality=%d/35",
                username, score,
                stack_score, stack_result["matches"],
                activity_score_pts, recently_active_6m,
                project_quality_pts,
            )

            gh = GitHubAnalysis(
                score=score,
                total_repos=total_repos,
                main_languages=main_languages,
                activity_score=activity_score,
                project_quality=project_quality,
                documentation_score=documentation_score,
                last_activity=last_activity,
                top_repos=top_repos,
                relevance_score=stack_result["score"],# remplace l'ancien relevance_score %
            )
            # Attacher le détail stack pour le rapport
            gh.stack_detail = stack_result
            gh.activity_score_pts = activity_score_pts  # pts réels 0–25
            gh.project_quality_pts = project_quality_pts  # pts réels 0–25
            gh.penalty_gh = penalty  # pénalité GitHub (0, 5 ou 10)
            return gh
        except requests.exceptions.Timeout:
            logger.error("[GitHub] Timeout")
            return None
        except Exception as exc:
            logger.error("[GitHub] Erreur: %s", exc)
            return None

    # ─────────────────────────────────────────────────────────────────────────────
    # EXTRACTION CODE SOURCE GITHUB (pour questions techniques ciblées)
    # ─────────────────────────────────────────────────────────────────────────────

    def fetch_github_code_samples(
            self,
            github_url: str,
            top_repos: List[Dict],
            job_offer=None,
    ) -> List[Dict]:
        if not github_url or not github_url.strip():
            return []

        try:
            username = github_url.strip().rstrip("/").split("/")[-1]
            if not username or len(username) < 2:
                return []

            headers = {}
            token = os.getenv("GITHUB_TOKEN")
            if token:
                headers["Authorization"] = f"token {token}"
            else:
                logger.warning("[GitHubCode] GITHUB_TOKEN absent — quota limité à 60 req/h")

            # ── Construire preferred_extensions AVANT la boucle ──────────
            offer_keywords = set()
            preferred_extensions = set()

            if job_offer:
                for text in [job_offer.title or '', job_offer.description or '', job_offer.requirements or '']:
                    for word in text.lower().split():
                        if len(word) > 3:
                            offer_keywords.add(word)

                TECH_KEYWORDS = {
                    'python': ['py'], 'django': ['py'], 'react': ['tsx', 'jsx', 'ts', 'js'],
                    'typescript': ['ts', 'tsx'], 'javascript': ['js', 'jsx'],
                    'java': ['java'], 'spring': ['java'], 'angular': ['ts'],
                    'node': ['js', 'ts'], 'fastapi': ['py'], 'flask': ['py'],
                    'vue': ['js', 'ts', 'vue'], 'c': ['c', 'h'], 'cpp': ['cpp', 'hpp'],
                    'dotnet': ['cs'], 'csharp': ['cs'],
                }
                title_lower = (job_offer.title or '').lower()
                desc_lower = (job_offer.description or '').lower()
                for tech, exts in TECH_KEYWORDS.items():
                    if tech in title_lower or tech in desc_lower:
                        preferred_extensions.update(exts)

            # ── Filtrer repos originaux + trier par pertinence ────────────
            candidate_repos = list(top_repos)

            if preferred_extensions:
                def repo_relevance(r):
                    lang = (r.get("language") or "").lower()
                    ext_map = {
                        'python': 'py', 'typescript': 'ts', 'javascript': 'js',
                        'java': 'java', 'c': 'c', 'c++': 'cpp', 'html': 'html',
                    }
                    repo_ext = ext_map.get(lang, '')
                    return 1 if repo_ext in preferred_extensions else 0

                candidate_repos.sort(key=repo_relevance, reverse=True)
                relevant = [r for r in candidate_repos if repo_relevance(r) > 0]
                candidate_repos = relevant[:MAX_CODE_REPOS] if relevant else candidate_repos[:MAX_CODE_REPOS]
            else:
                candidate_repos = candidate_repos[:MAX_CODE_REPOS]
            if not candidate_repos:
                logger.info("[GitHubCode] Aucun repo original disponible pour %s", username)
                return []

            samples: List[Dict] = []

            for repo in candidate_repos:
                repo_name = repo.get("name", "")
                if not repo_name:
                    continue

                try:
                    tree_resp = requests.get(
                        f"https://api.github.com/repos/{username}/{repo_name}"
                        f"/git/trees/HEAD?recursive=1",
                        headers=headers,
                        timeout=10,
                    )

                    if tree_resp.status_code == 404:
                        logger.warning("[GitHubCode] Repo %s introuvable (404)", repo_name)
                        continue
                    if tree_resp.status_code == 409:
                        logger.info("[GitHubCode] Repo %s vide (409)", repo_name)
                        continue
                    if tree_resp.status_code != 200:
                        logger.warning("[GitHubCode] Repo %s → HTTP %d", repo_name, tree_resp.status_code)
                        continue

                    tree = tree_resp.json().get("tree", [])
                    if not tree:
                        continue

                    code_files = [
                        f for f in tree
                        if f.get("type") == "blob"
                           and any(f["path"].endswith(ext) for ext in CODE_EXTENSIONS)
                           and not any(pat in f["path"] for pat in IGNORE_PATTERNS)
                           and 200 < f.get("size", 0) < 15000
                    ]

                    if not code_files:
                        logger.info("[GitHubCode] Repo %s : aucun fichier de code éligible", repo_name)
                        continue

                    # ── Scorer chaque fichier ─────────────────────────────
                    def score_file(f: Dict) -> int:
                        score = 0
                        path_lower = f["path"].lower()
                        ext = Path(f["path"]).suffix.lstrip(".").lower()

                        if preferred_extensions and ext in preferred_extensions:
                            score += 3
                        for kw in offer_keywords:
                            if kw in path_lower:
                                score += 2
                                break
                        score += f.get("size", 0) // 1000
                        generic_ui = ['card', 'button', 'modal', 'header', 'footer', 'navbar', 'sidebar']
                        if any(p in path_lower for p in generic_ui):
                            score -= 2
                        business_logic = ['service', 'controller', 'view', 'model', 'api', 'utils', 'core', 'main']
                        if any(p in path_lower for p in business_logic):
                            score += 2
                        return score

                    code_files.sort(key=score_file, reverse=True)
                    selected = code_files[:MAX_CODE_FILES_PER_REPO]

                    for f in selected:
                        try:
                            content_resp = requests.get(
                                f"https://api.github.com/repos/{username}/{repo_name}"
                                f"/contents/{f['path']}",
                                headers=headers,
                                timeout=10,
                            )
                            if content_resp.status_code != 200:
                                continue

                            content_data = content_resp.json()
                            if content_data.get("encoding") != "base64":
                                continue

                            import base64
                            try:
                                decoded = base64.b64decode(
                                    content_data["content"]
                                ).decode("utf-8", errors="ignore")
                            except Exception:
                                continue

                            if len(decoded.strip()) < 50:
                                continue

                            extension = Path(f["path"]).suffix.lstrip(".")
                            samples.append({
                                "repo": repo_name,
                                "file_path": f["path"],
                                "language": extension,
                                "content": decoded[:MAX_CODE_FILE_SIZE],
                                "size": f.get("size", 0),
                            })
                            logger.info(
                                "[GitHubCode] ✓ %s/%s (%d chars)",
                                repo_name, f["path"], len(decoded[:MAX_CODE_FILE_SIZE])
                            )

                        except requests.exceptions.Timeout:
                            logger.warning("[GitHubCode] Timeout fichier %s/%s", repo_name, f["path"])
                            continue
                        except Exception as exc:
                            logger.warning("[GitHubCode] Erreur fichier %s/%s : %s", repo_name, f["path"], exc)
                            continue

                except requests.exceptions.Timeout:
                    logger.warning("[GitHubCode] Timeout arborescence repo %s", repo_name)
                    continue
                except Exception as exc:
                    logger.warning("[GitHubCode] Erreur repo %s : %s", repo_name, exc)
                    continue

            logger.info(
                "[GitHubCode] %s → %d fichier(s) extrait(s) sur %d repo(s) analysé(s)",
                username, len(samples), len(candidate_repos)
            )
            return samples

        except Exception as exc:
            logger.error("[GitHubCode] Erreur globale : %s", exc, exc_info=True)
            return []

    # credly api pour les verifier es certificat via url

    def verify_credly_badge(self, badge_url: str) -> Dict[str, Any]:
        """
        Vérifie un badge Credly via l'endpoint OBI public — gratuit, sans clé API.
        Fonctionne avec AWS, Google, IBM, Cisco, Microsoft, etc.

        badge_url exemple : https://www.credly.com/badges/abc-123-def
                         ou https://www.credly.com/badges/abc-123-def/public_url
        """
        if not badge_url or "credly.com" not in badge_url:
            return {"verified": False, "reason": "URL Credly non détectée"}

        try:
            # Extraire le badge ID de l'URL
            # Format : https://www.credly.com/badges/{badge_id}
            parts = badge_url.strip("/").split("/")
            badge_id = None
            for i, part in enumerate(parts):
                if part == "badges" and i + 1 < len(parts):
                    badge_id = parts[i + 1]
                    break

            if not badge_id:
                return {"verified": False, "reason": "ID badge non trouvé dans l'URL"}

            # Endpoint OBI public — pas d'authentification requise
            obi_url = f"https://api.credly.com/v1/obi/v2/badge_assertions/{badge_id}"
            resp = requests.get(obi_url, timeout=10, headers={"Accept": "application/json"})

            if resp.status_code == 404:
                return {"verified": False, "reason": "Badge introuvable — peut être fake ou supprimé"}

            if resp.status_code != 200:
                return {"verified": False, "reason": f"Erreur Credly API (HTTP {resp.status_code})"}

            data = resp.json()

            # Extraire les infos clés
            issued_on = data.get("issuedOn", "")
            expires = data.get("expires")
            badge_info = data.get("badge", "")

            # Vérifier expiration
            is_expired = False
            if expires:
                try:
                    from datetime import timezone
                    exp_date = datetime.fromisoformat(expires.replace("Z", "+00:00"))
                    is_expired = exp_date < datetime.now(tz=timezone.utc)
                except Exception:
                    pass

            return {
                "verified": True,
                "badge_id": badge_id,
                "issued_on": issued_on[:10] if issued_on else "Inconnu",
                "expires": expires[:10] if expires else None,
                "is_expired": is_expired,
                "badge_url": badge_info if isinstance(badge_info, str) else "",
                "source": "Credly OBI API",
            }

        except requests.exceptions.Timeout:
            logger.warning("[Credly] Timeout vérification badge: %s", badge_url)
            return {"verified": False, "reason": "Timeout — Credly non disponible"}
        except Exception as exc:
            logger.error("[Credly] Erreur: %s", exc)
            return {"verified": False, "reason": str(exc)}

    def verify_all_certifications(
            self,
            credential_url: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Vérifie toutes les URLs de certifications fournies par le candidat.
        Retourne une liste de résultats de vérification.
        """
        if not credential_url:
            return []

        results = []
        for url in credential_url:
            if not url or not url.strip():
                continue
            url = url.strip()

            if "credly.com" in url:
                result = self.verify_credly_badge(url)
                result["url"] = url
                result["platform"] = "Credly"
            else:
                # Plateforme non supportée — flag pour vérification manuelle
                result = {
                    "verified": None,  # None = inconnu, pas False
                    "url": url,
                    "platform": "Non supportée",
                    "reason": "Vérification manuelle requise",
                }
            results.append(result)
            logger.info("[CertVerify] %s → %s", url, result.get("verified"))

        return results
    # ──────────────────────────────────────────────────────────────────────────
    # INDEXATION RAG
    # ──────────────────────────────────────────────────────────────────────────

    def _index_all_documents(
        self,
        candidate_id: str,
        cv_text: str,
        letter_text: str,
        recommendation_texts: List[str],
        certification_texts: List[str],
        form_text: str,
        github_analysis: Optional[GitHubAnalysis],
    ) -> None:

        def safe_index(text: str, source: str, extra: Optional[Dict] = None) -> None:
            if (
                text
                and "[Erreur" not in text
                and "[PDF vide" not in text
                and len(text.strip()) > 10
            ):
                index_document(text, source, candidate_id, extra)

        safe_index(cv_text, SOURCE_CV)
        safe_index(letter_text, SOURCE_COVER_LETTER)

        for i, rec in enumerate(recommendation_texts):
            if rec and len(rec.strip()) > 30:
                index_document(
                    rec, SOURCE_RECOMMENDATION, candidate_id,
                    {"rec_index": i},
                    doc_key=f"{SOURCE_RECOMMENDATION}_{i}",
                )

        for i, cert in enumerate(certification_texts):
            cert_str = cert if isinstance(cert, str) else (
                    cert.get("text") or cert.get("name") or str(cert)
            )
            logger.info("[DEBUG CERT %d] type=%s | len=%d | apercu=%s",
                        i, type(cert).__name__, len(cert_str), cert_str[:100])

            if not cert_str or len(cert_str.strip()) < 5:
                continue

            # Détecter le type pour mieux labelliser
            lower = cert_str.lower()
            if any(w in lower for w in ["transcript", "relevé de notes", "grade", "gpa", "semestre"]):
                label = f"[TRANSCRIPT ACADÉMIQUE #{i + 1}]"
            elif any(w in lower for w in ["bachelor", "master", "licence", "diplôme", "degree", "ingénieur"]):
                label = f"[DIPLÔME OFFICIEL #{i + 1}]"
            else:
                label = f"[CERTIFICATION #{i + 1}]"

            index_document(
                f"{label}\n{cert_str.strip()}",
                SOURCE_CERTIFICATION,
                candidate_id,
                {"cert_index": i, "cert_type": label},
                doc_key=f"{SOURCE_CERTIFICATION}_{i}",
            )

        if github_analysis:
            gh_text = (
                f"Langages principaux : {', '.join(github_analysis.main_languages)}\n"
                f"Repos publics : {github_analysis.total_repos}\n"
                f"Score GitHub : {github_analysis.score}/100\n"
                f"Dernière activité : {github_analysis.last_activity}\n"
                f"Pertinence stack : {github_analysis.relevance_score}%\n\n"
                + "\n".join(
                    f"Repo: {r['name']} — {r['description']} "
                    f"(lang: {r['language']}, stars: {r['stars']}, "
                    f"forks: {r['forks']})"
                    for r in github_analysis.top_repos
                )
            )
            index_document(gh_text, SOURCE_GITHUB, candidate_id)

        logger.info("[RAG] Indexation complète — candidat=%s", candidate_id)

    # ──────────────────────────────────────────────────────────────────────────
    # FORMULAIRE → TEXTE
    # ──────────────────────────────────────────────────────────────────────────

    def _form_data_to_text(self, form_data: Dict[str, Any]) -> str:
        if not form_data:
            return ""
        labels = {
            "years_experience": "Années d'expérience",
            "current_position": "Poste actuel",
            "education": "Diplôme",
            "skills": "Compétences déclarées",
            "availability": "Disponibilité",
            "availability_date": "Date de disponibilité",
            "motivation_text": "Motivation",
        }
        excluded = {"salary_expectation", "job_salary_min", "job_salary_max"}  # ← définition manquante
        return "\n".join(
            f"{labels.get(k, k)} : {v}"
            for k, v in form_data.items()
            if v and k not in excluded
        )

    # ──────────────────────────────────────────────────────────────────────────
    # TRUNCATE RAG
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _truncate_rag(text: str, limit: int = MAX_RAG_CHARS) -> str:
        """
        Tronque le contexte RAG en préservant les blocs de source complets.
        Coupe sur le dernier séparateur '---' si possible.
        """
        if len(text) <= limit:
            return text
        truncated = text[:limit]
        last_sep  = truncated.rfind("\n---")
        if last_sep > limit // 2:
            truncated = truncated[:last_sep]
        return truncated + "\n\n[RAG] Contexte tronqué — fenêtre de tokens atteinte."

    # ──────────────────────────────────────────────────────────────────────────
    # PROMPT UNIFIÉ → GROQ
    # ──────────────────────────────────────────────────────────────────────────

    def _build_analysis_prompt(
        self,
        job_title: str,
        job_description: str,
        required_skills: List[str],
        company_name: str,
        candidate_form_data: Dict[str, Any],
        github_analysis: Optional[GitHubAnalysis],
        rag_context: str,
        cert_verifications: Optional[List[Dict]] = None,
        cert_integrity_flags: Optional[List[str]] = None,
        certification_texts: Optional[List[str]] = None,
    ) -> str:
        cd        = candidate_form_data if isinstance(candidate_form_data, dict) else {}
        years_exp = cd.get("years_experience", "Non renseigné")

        skills_text = ", ".join(required_skills) if required_skills else "Non précisées"
        rag_block   = self._truncate_rag(rag_context) if rag_context else "[RAG] Aucun extrait disponible."

        github_ctx = "Non fourni"
        fraud_signals_block = ""
        if github_analysis:

            github_ctx = (
                f"Score: {github_analysis.score}/100 | "
                f"Repos: {github_analysis.total_repos} | "
                f"Langages: {', '.join(github_analysis.main_languages)} | "
                f"Activité: {github_analysis.activity_score}/5 | "
                f"Pertinence stack: {github_analysis.relevance_score}%"
            )

            if cert_verifications:
                lines = []
                for cv in cert_verifications:
                    if cv.get("verified") is False:
                        lines.append(
                            f"- ⚠ URL {cv.get('url', '?')} : INVALIDE/INTROUVABLE sur Credly ({cv.get('reason', '?')})")
                    elif cv.get("verified") is True:
                        lines.append(
                            f"- ✓ URL {cv.get('url', '?')} : confirmée par Credly (émise le {cv.get('issued_on', '?')})")
                if lines:
                    fraud_signals_block += "\n=== VÉRIFICATION CREDLY (autorité externe) ===\n" + "\n".join(
                        lines) + "\n"

            if cert_integrity_flags:
                fraud_signals_block += (
                        "\n=== ANOMALIES STRUCTURELLES PDF DÉTECTÉES (FALSIFICATION PROBABLE) ===\n"
                        + "\n".join(f"- {f}" for f in cert_integrity_flags[:5]) + "\n"
                        + "INSTRUCTION : Pour chaque certification concernée, tu DOIS mettre "
                        + "suspicious=true, credibility_score<=20, et expliquer dans suspicion_reason "
                        + "de façon précise et RH-friendly : quel outil a servi, quelle anomalie de date, "
                        + "et pourquoi c'est incompatible avec une certification officielle.\n"
                )
                if certification_texts:
                    cert_count = len([c for c in certification_texts if c and len(c.strip()) > 10])
                    fraud_signals_block += (
                        f"\n=== CERTIFICATIONS SOUMISES ===\n"
                        f"{cert_count} document(s) de certification fourni(s) par le candidat.\n"
                    )

            if fraud_signals_block:
                fraud_signals_block = (
                        "\n⚠ SIGNAUX DE FRAUDE PRÉ-DÉTECTÉS (autorité technique, à prendre en compte "
                        "obligatoirement dans 'suspicious' et 'credibility_score') :\n" + fraud_signals_block
                )



        return f"""
RAISONNEMENT ÉTAPE PAR ÉTAPE (avant de remplir le JSON) :
1) Adéquation compétences / poste
2) Pertinence des projets réalisés
3) Cohérence chronologique du parcours
4) Vérification certifications, recommandations et preuves concrètes

=== POSTE ===
Titre      : {job_title}
Entreprise : {company_name}
Description :
{job_description}

Compétences requises : {skills_text}

=== CONTEXTE CANDIDAT — EXTRAIT PAR RAG ===
Les passages ci-dessous sont sélectionnés automatiquement parmi le CV,
la lettre de motivation, les recommandations et formulaire.
BASE TON ANALYSE UNIQUEMENT SUR CES EXTRAITS.

{rag_block}
=== PROFIL DÉCLARÉ ===
Expérience déclarée : {years_exp} ans

=== GITHUB — ANALYSE OBJECTIVE ===
{github_ctx}
{fraud_signals_block}

=== RÈGLES STRICTES ===
1. Réponds UNIQUEMENT en JSON valide — pas de markdown, pas de backticks.
2. Base-toi UNIQUEMENT sur les extraits RAG, certifications vérifiées et données GitHub.
3. "certifications" = liste d'OBJETS (jamais de strings).
4. "projects"       = liste d'OBJETS (jamais de strings).
5. Si aucune certification/projet : retourne [] pour ces champs.
6. Domaine totalement étranger → "is_out_of_field"=true et overall_score<30.
7. Détecte incohérences de dates, rôles, expérience.
8. Les certifications vérifiées augmentent le score CV si pertinentes au poste.
9. "complexity" doit refléter la réalité du projet :
   - "Élevée" : micro-services, ML prod, système distribué, +6 mois, équipe
   - "Moyenne" : API REST, app mobile, pipeline de données, 2-6 mois
   - "Faible"  : projet scolaire, tutorial, CRUD basique, <2 mois solo
=== FORMAT JSON ATTENDU ===
{{
  "cv": {{
    "score": 0,
    "summary": "",
    "strengths": [],
    "weaknesses": [],
    "missing_skills": [],
    "skill_levels": {{}},
    "inconsistencies": [],
    "professional_stability": "",
    "red_flags": [],
    "total_years_experience": 0
  }},
  "motivation": {{
    "score": 0,
    "is_personalized": false,
    "motivation_level": "",
    "understanding_score": 5,
    "writing_quality": 5,
    "professionalism": 5,
    "key_strengths": [],
    "red_flags": []
  }},
  "softskills": {{
    "leadership": 5,
    "autonomy": 5,
    "teamwork": 5,
    "problem_solving": 5,
    "communication": 5
  }},
  "coherence": {{
    "is_out_of_field": false,
    "score_rationale": "",
    "overall_score": 0,
    "flags": [],
    "availability_compatible": true
  }},
  "certifications": [
    {{
      "name": "",
      "issuer": "",
      "year": null,
      "level": "",
      "relevance": "",
      "suspicious": false,
      "suspicion_reason": "",
      "credibility_score": 100
    }}
  ],
"projects": [
  {{
    "name": "",
    "type": "Personnel | Académique | Open Source | Professionnel",
    "technologies": [],
    "complexity": "Faible | Moyenne | Élevée",  
    // Faible = CRUD simple, tutoriel
    // Moyenne = Auth + API REST + BDD + intégration externe
    // Élevée = Microservices, IA, temps réel, CI/CD, scalabilité
    "team_size": "Solo | 2-5 | 5-10 | +10",
    "duration": null,
    "description": "",

    "highlights": ""  // ce qui rend ce projet notable
  }}
]}}
"""

    # ──────────────────────────────────────────────────────────────────────────
    # SANITIZE RÉSULTAT GROQ
    # ──────────────────────────────────────────────────────────────────────────

    def _sanitize_result(self, result: Any) -> Dict[str, Any]:
        if isinstance(result, str):
            try:
                m      = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", result)
                raw    = m.group(1) if m else result.strip()
                result = json.loads(raw)
            except (json.JSONDecodeError, AttributeError) as exc:
                logger.warning("[Groq] Résultat non valide: %s", exc)
                return self._default_result()

        if not isinstance(result, dict):
            return self._default_result()

        result["certifications"] = self._sanitize_list_of_dicts(
            result.get("certifications", []),
            {"name": "", "issuer": "", "year": None, "relevant": False},
        )
        result["projects"] = self._sanitize_list_of_dicts(
            result.get("projects", []),
            {"name": "", "description": "", "technologies": [], "relevance_score": 0},
        )

        for section in ("cv", "motivation", "softskills", "coherence"):
            if not isinstance(result.get(section), dict):
                result[section] = {}

        cv = result.get("cv", {})
        if not isinstance(cv.get("skill_levels"), dict):
            cv["skill_levels"] = {}
        for key in ("strengths", "weaknesses", "missing_skills", "inconsistencies", "red_flags"):
            if not isinstance(cv.get(key), list):
                cv[key] = []

        return result

    def _sanitize_list_of_dicts(self, raw: Any, defaults: Dict) -> List[Dict]:
        if not isinstance(raw, list):
            return []
        out = []
        for item in raw:
            if isinstance(item, dict):
                out.append({**defaults, **item})
            elif isinstance(item, str) and item.strip():
                out.append({**defaults, "name": item.strip()})
        return out

    def _default_result(self) -> Dict[str, Any]:
        """Résultat de secours quand Groq échoue — aucun crash possible."""
        return {
            "cv": {
                "score": 0, "summary": "Analyse indisponible", "strengths": [],
                "weaknesses": [], "missing_skills": [], "skill_levels": {},
                "inconsistencies": [], "professional_stability": "", "red_flags": [],
                "total_years_experience": 0,
            },
            "motivation": {
                "score": 0, "is_personalized": False, "motivation_level": "",
                "understanding_score": 5, "writing_quality": 5, "professionalism": 5,
                "key_strengths": [], "red_flags": [],
            },
            "softskills": {
                "leadership": 5, "autonomy": 5, "teamwork": 5,
                "problem_solving": 5, "communication": 5,
            },
            "coherence": {
                "is_out_of_field": False, "score_rationale": "Analyse échouée",
                "overall_score": 0, "flags": [],
                "availability_compatible": True,
            },
            "certifications": [],
            "projects": [],
        }

    # ──────────────────────────────────────────────────────────────────────────
    # PARSERS RÉSULTAT GROQ
    # ──────────────────────────────────────────────────────────────────────────

    def _parse_cv(self, data: Dict) -> CVAnalysis:
        cv = data.get("cv", {})
        return CVAnalysis(
            score=max(0, min(100, int(cv.get("score", 0)))),
            summary=cv.get("summary", ""),
            strengths=cv.get("strengths", [])[:5],
            weaknesses=cv.get("weaknesses", [])[:4],
            missing_skills=cv.get("missing_skills", [])[:5],
            skill_levels=cv.get("skill_levels", {}),
            inconsistencies=cv.get("inconsistencies", [])[:4],
            professional_stability=cv.get("professional_stability", "Inconnu"),
            red_flags=cv.get("red_flags", [])[:4],
            total_years_experience=int(cv.get("total_years_experience", 0)),
        )

    def _parse_motivation(self, data: Dict) -> Optional[MotivationAnalysis]:
        mot = data.get("motivation", {})
        if not mot:
            return None
        return MotivationAnalysis(
            score=max(0, min(100, int(mot.get("score", 0)))),
            is_personalized=bool(mot.get("is_personalized", False)),
            motivation_level=mot.get("motivation_level", "Moyen"),
            understanding_score=int(mot.get("understanding_score", 5)),
            writing_quality=int(mot.get("writing_quality", 5)),
            professionalism=int(mot.get("professionalism", 5)),
            key_strengths=mot.get("key_strengths", [])[:4],
            red_flags=mot.get("red_flags", [])[:3],
        )

    def _parse_softskills(
        self, data: Dict, cv_text: str, letter_text: str
    ) -> SoftSkillsAnalysis:
        soft     = data.get("softskills", {})
        full_txt = (cv_text + " " + letter_text).lower()
        kw_map   = {
            "leadership":      ["dirige", "manage", "lead", "coordonne", "supervise", "encadre", "mentor"],
            "autonomy":        ["autonomie", "indépendant", "initiative", "proactif", "auto-géré"],
            "teamwork":        ["équipe", "collaboration", "collectif", "coopération", "agile", "scrum"],
            "problem_solving": ["résolu", "optimisé", "amélioré", "innovant", "solution", "débogue"],
            "communication":   ["présente", "formé", "documenté", "rédige", "communication", "reporting"],
        }
        detected = {
            sk: [kw for kw in kws if kw in full_txt]
            for sk, kws in kw_map.items()
        }

        def _safe(v: Any, default: int = 5) -> int:
            try:
                return max(1, min(10, int(v)))
            except (TypeError, ValueError):
                return default

        return SoftSkillsAnalysis(
            leadership=_safe(soft.get("leadership")),
            autonomy=_safe(soft.get("autonomy")),
            teamwork=_safe(soft.get("teamwork")),
            problem_solving=_safe(soft.get("problem_solving")),
            communication=_safe(soft.get("communication")),
            detected_keywords=detected,
        )

    def _parse_coherence(
        self,
        data: Dict,
        candidate_form_data: Dict,
        cv_years: int,
    ) -> CoherenceCheck:
        coh    = data.get("coherence", {})
        is_oof = bool(coh.get("is_out_of_field", False))
        flags  = list(coh.get("flags", []))

        # Hors-domaine : score plafonné à 28 (cohérent avec règle LLM overall_score<30)
        # PAS de soustraction — on plafonne directement pour éviter le double comptage
        # avec la pénalité de calculate_final_score
        base_score = coh.get("overall_score", 70)
        if is_oof:
            base_score = min(base_score, 28)
            if not any("hors" in f.lower() or "domaine" in f.lower() for f in flags):
                flags.insert(0, "Profil hors domaine par rapport au poste")

        # Vérification cohérence expérience déclarée vs CV
        exp_match = True
        declared  = candidate_form_data.get("years_experience")
        if declared and cv_years:
            try:
                diff = abs(int(declared) - int(cv_years))
                if diff > 2:
                    exp_match = False
                    flags.append(
                        f"Écart expérience : {declared} ans déclarés vs {cv_years} ans CV"
                    )
            except (ValueError, TypeError):
                pass

        return CoherenceCheck(
            experience_match=exp_match,
            availability_compatible=bool(coh.get("availability_compatible", True)),
            is_out_of_field=is_oof,
            overall_score=max(0, base_score),
            flags=flags[:5],
            notes=coh.get("score_rationale", ""),
        )

    # ──────────────────────────────────────────────────────────────────────────
    # CALCUL SCORE FINAL
    # ──────────────────────────────────────────────────────────────────────────

    def calculate_final_score(
            self,
            cv_analysis: CVAnalysis,
            motivation_analysis: Optional[MotivationAnalysis],
            softskills_analysis: SoftSkillsAnalysis,
            github_analysis: Optional[GitHubAnalysis],
            coherence_check: CoherenceCheck,
            weights: Optional[Dict[str, float]] = None,
            company_name: str = "",
    ) -> Dict[str, Any]:

        def clamp(v: float) -> float:
            return max(0.0, min(100.0, v))

        has_github = github_analysis is not None
        if weights is None:
            weights = (
                {"cv": 0.40, "motivation": 0.10, "softskills": 0.10,
                 "github": 0.30, "coherence": 0.05}
                if has_github else
                {"cv": 0.50, "motivation": 0.25, "softskills": 0.15,
                 "github": 0.00, "coherence": 0.05}
            )

        cv_score = clamp(cv_analysis.score)
        mot_score = clamp(motivation_analysis.score) if motivation_analysis else 50.0
        avg_soft = sum([
            softskills_analysis.leadership,
            softskills_analysis.autonomy,
            softskills_analysis.teamwork,
            softskills_analysis.problem_solving,
            softskills_analysis.communication,
        ]) / 5
        soft_score = clamp(avg_soft * 10)
        gh_score = clamp(github_analysis.score) if github_analysis else 0
        coh_score = clamp(coherence_check.overall_score)

        # ── SCORE BRUT (sans cohérence — elle est gérée séparément) ──────────
        w_coh = weights.get("coherence", 0.0)

        # ── SCORE BRUT (4 poids RH, somme = 1.0) ─────────────────────────────
        raw = (
                weights["cv"] * cv_score +
                weights["motivation"] * mot_score +
                weights["softskills"] * soft_score +
                weights["github"] * gh_score
        )

        # ── COHÉRENCE : bonus/malus post-calcul, indépendant des poids RH ─────
        # si coh_score >= 70 → +0.5% × coh_score (récompense)
        # si coh_score <  70 → −5%  × (70 − coh_score) (pénalité)
        if coh_score >= 70:
            coherence_bonus = 0.01 * coh_score  # ex: 0.01 × 80 = +0.8 pts
        else:
            coherence_bonus = -0.05 * (70 - coh_score)  # ex: −0.05 × 20 = −1.0 pts
        raw += coherence_bonus

        logger.info(
            "[Score] Cohérence post-calcul — coh_score=%d → bonus=%.2f pts",
            coh_score, coherence_bonus
        )

        # ── PÉNALITÉS ─────────────────────────────────────────────────────────
        penalty = 0
        penalty_details: List[str] = []

        if not coherence_check.experience_match:
            penalty += 10
            penalty_details.append("Écart expérience déclarée/CV supérieur à 2 ans (−10pts)")

        if len(cv_analysis.red_flags) >= 2:
            penalty += 5
            penalty_details.append(f"Red flags CV détectés : {', '.join(cv_analysis.red_flags[:2])} (−5pts)")

        if coherence_check.overall_score < 55 and not coherence_check.is_out_of_field:
            penalty += 10
            penalty_details.append(
                f"Cohérence insuffisante (score={coherence_check.overall_score}/100) (−10pts)"
            )
        elif coherence_check.overall_score <= 65 and len(coherence_check.flags) >= 1:
            penalty += 5
            penalty_details.append(
                f"Cohérence modérée avec alerte : {coherence_check.flags[0]} (−5pts)"
            )

        if coherence_check.letter_is_generic:
            penalty += 8
            penalty_details.append(
                f"Lettre générique détectée (personnalisation {coherence_check.letter_personalization_score}/100) (−8pts)"
            )
        elif not coherence_check.company_mentioned:
            penalty += 5
            penalty_details.append(f"Entreprise '{company_name}' non mentionnée dans la lettre (−5pts)")

        cert_verifications = getattr(coherence_check, '_cert_verifications', [])
        fake_certs = [c for c in cert_verifications if c.get("verified") is False]
        if fake_certs:
            penalty += 15
            penalty_details.append(
                f"{len(fake_certs)} certification(s) Credly invalide(s) détectée(s) (−15pts)"
            )
        cert_integrity_flags = getattr(coherence_check, '_cert_integrity_flags', [])
        if cert_integrity_flags:
            penalty += 5
            penalty_details.append(
                f"Intégrité PDF certification douteuse (outil non-officiel détecté) (−5pts)"
            )

        if penalty_details:
            logger.info("[Score] Pénalités appliquées: %s", " | ".join(penalty_details))

        final_score = int(round(clamp(raw - penalty)))

        if final_score == 0:
            decision = "TO_REVIEW"
            logger.warning("[Pipeline] Score 0 → TO_REVIEW (possible erreur Groq)")
        elif final_score < 40:
            decision = "REJECTED"
        else:
            decision = "TO_REVIEW"

        return {
            "final_score": final_score,
            "decision": decision,
            "weights_used": weights,
            "breakdown": {
                "cv_score": cv_score,
                "motivation_score": mot_score,
                "softskills_score": round(soft_score, 1),
                "github_score": gh_score,
                "coherence_score": coh_score,
                "penalty_applied": penalty,
                "penalty_details": penalty_details,
                "raw_score": round(raw, 1),
                "weighted_cv": round(weights["cv"] * cv_score, 2),
                "weighted_motivation": round(weights["motivation"] * mot_score, 2),
                "weighted_softskills": round(weights["softskills"] * soft_score, 2),
                "weighted_github": round(weights["github"] * gh_score, 2),
                "weight_cv": weights["cv"],
                "weight_motivation": weights["motivation"],
                "weight_softskills": weights["softskills"],
                "weight_github": weights["github"],
                "weighted_coherence": round(coherence_bonus, 2),
                "weight_coherence": 0.0,
                "coherence_floor_applied": False,
                "coherence_floor_bonus": round(coherence_bonus, 2),
            },
        }

    # ──────────────────────────────────────────────────────────────────────────
    # RECOMMANDATIONS TEXTUELLES
    # ──────────────────────────────────────────────────────────────────────────

    def _build_recommendations(
        self,
        cv: CVAnalysis,
        mot: Optional[MotivationAnalysis],
        soft: SoftSkillsAnalysis,
        gh: Optional[GitHubAnalysis],
        coh: CoherenceCheck,
        final_score: int,
    ) -> str:
        recs: List[str] = []

        if cv.score >= 80:
            recs.append("Profil technique solide")
        elif cv.score < 50:
            recs.append("Compétences techniques insuffisantes pour le poste")

        if cv.red_flags:
            recs.append(f"Red flags CV : {', '.join(cv.red_flags[:2])}")
        if cv.inconsistencies:
            recs.append(f"À vérifier : {', '.join(cv.inconsistencies[:2])}")

        if mot:
            if not mot.is_personalized:
                recs.append("Lettre générique — motivation réelle à vérifier")
            elif mot.motivation_level.lower() in ("élevé", "eleve", "forte", "fort"):
                recs.append("Forte motivation démontrée")

        avg_soft = (
            soft.leadership + soft.autonomy + soft.teamwork
            + soft.problem_solving + soft.communication
        ) / 5
        if avg_soft >= 7.5:
            recs.append("Excellentes soft skills")
        elif avg_soft < 5:
            recs.append("Soft skills à approfondir en entretien")

        if gh:
            if gh.score >= 70:
                recs.append("Portfolio GitHub actif et de qualité")
            elif gh.score < 40:
                recs.append("Peu d'activité GitHub publique")
            if gh.relevance_score >= 60:
                recs.append(f"Stack GitHub pertinente ({gh.relevance_score}% match)")

        if coh.is_out_of_field:
            recs.append("⚠ Profil hors domaine")
        elif coh.flags:
            recs.append(f"Cohérence : {coh.flags[0]}")

        if final_score >= 80:
            recs.append("RECOMMANDATION : Convoquer en entretien en priorité")
        elif final_score >= 58:
            recs.append("RECOMMANDATION : Profil intéressant, à examiner attentivement")
        else:
            recs.append("RECOMMANDATION : Profil ne correspond pas aux critères actuels")

        return " | ".join(recs)

    # ──────────────────────────────────────────────────────────────────────────
    # MESSAGE CANDIDAT
    # ──────────────────────────────────────────────────────────────────────────

    def generate_candidate_messages(self, analysis: FinalAnalysis) -> Dict[str, str]:
        cv = analysis.cv_analysis
        score = analysis.final_score
        cv_score = cv.score
        has_github = analysis.github_analysis is not None
        sources = "CV et lettre de motivation" + (" et profil GitHub" if has_github else "")

        # Calculer l'écart entre CV et score final
        diff = cv_score - score

        msg = f"**Analyse préliminaire de votre candidature**\n\n"
        msg += f"Votre dossier a obtenu un score de **{score}/100** sur la base de l'analyse "
        msg += f"automatisée de votre {sources}.\n\n"

        # Explication vague mais honnête de l'écart (sans mentionner pénalité)
        if diff > 15:
            msg += "Votre CV démontre des compétences techniques intéressantes. Cependant, certains aspects de votre candidature (lettre de motivation, disponibilité ou cohérence globale) mériteraient d'être mieux alignés avec les attentes du poste.\n\n"
        elif diff > 8:
            msg += "Votre profil technique est solide. Quelques éléments complémentaires dans votre candidature pourraient être ajustés pour correspondre encore mieux au poste.\n\n"
        elif diff > 3:
            msg += "Votre candidature est globalement cohérente avec le poste, avec une légère marge d'amélioration sur certains points.\n\n"
        else:
            msg += "Votre candidature est bien alignée avec les attentes du poste.\n\n"

        msg += "**Ce score est une aide à la décision** pour notre équipe RH.\n\n"

        if cv.strengths:
            msg += "**Points forts identifiés :**\n"
            msg += "\n".join(f"  • {s}" for s in cv.strengths[:3])
            msg += "\n\n"

        improvements: List[str] = []
        if cv.missing_skills:
            improvements.append(
                f"Compétences à renforcer : {', '.join(cv.missing_skills[:3])}"
            )
        if cv.weaknesses:
            improvements.append(f"Points d'attention : {', '.join(cv.weaknesses[:2])}")
        if improvements:
            msg += "**Éléments pris en compte :**\n"
            msg += "\n".join(f"  • {i}" for i in improvements)
            msg += "\n\n"

        next_steps = (
            "**Prochaines étapes :**\n"
            "• Notre équipe RH examine votre dossier complet dans les 48h\n"
            "• En cas de sélection, vous recevrez un lien (valable 24h) pour passer votre entretien directement avec notre IA\n\n"
            "Merci pour l'intérêt que vous portez à notre entreprise !"
        )
        return {"candidate_message": msg, "next_steps": next_steps}

    def _check_certification_integrity(self, cert_pdf_file) -> Dict[str, Any]:
        """
        Analyse structurelle du PDF — détecte signes de falsification.
        Ne garantit pas l'authenticité mais lève des alertes.
        """
        try:
            reader = PdfReader(cert_pdf_file)
            metadata = reader.metadata or {}
            text = " ".join(
                p.extract_text() or "" for p in reader.pages
            ).lower()

            flags = []

            # Créateur du PDF — Word/Canva = suspect pour une certification officielle
            creator = (metadata.get("/Creator") or "").lower()
            suspicious_creators = ["canva", "word", "photoshop", "gimp", "paint"]
            if any(c in creator for c in suspicious_creators):
                flags.append(f"PDF créé avec {creator} — suspect pour une certification officielle")

            # Date de modification récente sur un vieux certificat
            mod_date = metadata.get("/ModDate") or ""
            if mod_date:
                flags.append(f"Dernière modification PDF : {mod_date[:8]}")

            # Texte trop court — vrai certificat a du contenu
            if len(text) < 50:
                flags.append("Contenu PDF très court — possible image sans texte")

            # Mots-clés suspects absents (un vrai certificat AWS mentionne Amazon)
            known_issuers = {
                "aws": ["amazon", "aws", "amazon web services"],
                "microsoft": ["microsoft", "azure"],
                "google": ["google", "gcp", "cloud"],
                "cisco": ["cisco"],
                "pmi": ["pmi", "project management institute"],
            }
            for issuer, keywords in known_issuers.items():
                if issuer in text and not any(kw in text for kw in keywords):
                    flags.append(f"Certification {issuer.upper()} sans mention de l'organisme officiel")

            return {
                "integrity_flags": flags,
                "is_suspicious": len(flags) > 0,
                "creator": creator,
            }
        except Exception as exc:
            logger.warning("[CertCheck] Erreur analyse PDF: %s", exc)
            return {"integrity_flags": [], "is_suspicious": False}

    def retrieve_cert_context(self, candidate_id: str) -> str:
        """
        Récupère uniquement les certifications/diplômes/transcripts
        indexés dans ChromaDB pour ce candidat.
        Utilisé par le pipeline entretien pour générer des questions ciblées.
        """
        try:
            from .rag import get_chroma_collection
            collection = get_chroma_collection()
            results = collection.query(
                query_texts=["certification diplôme transcript compétences"],
                n_results=5,
                where={
                    "$and": [
                        {"candidate_id": {"$eq": candidate_id}},
                        {"source": {"$eq": SOURCE_CERTIFICATION}},
                    ]
                },
            )
            docs = results.get("documents", [[]])[0]
            return "\n\n".join(docs) if docs else ""
        except Exception as exc:
            logger.warning("[CertContext] Erreur récupération: %s", exc)
            return ""

    # ──────────────────────────────────────────────────────────────────────────
    # PIPELINE PRINCIPAL
    # ──────────────────────────────────────────────────────────────────────────

    def analyze_complete(
        self,
        cv_file,
        job_title: str,
        job_description: str,
        required_skills: List[str],
        cover_letter_file=None,
        github_url: str = "",
        company_name: str = "",
        weights: Optional[Dict[str, float]] = None,
        candidate_form_data: Optional[Dict[str, Any]] = None,
        recommendation_files: Optional[List] = None,
        certification_texts: Optional[List[str]] = None,
        candidate_id: Optional[str] = None,
        credential_url: Optional[List[str]] = None,
        certification_files: Optional[List] = None,

    ) -> FinalAnalysis:

        logger.info("[Pipeline] Début analyse — poste: %s", job_title)

        if candidate_form_data  is None: candidate_form_data  = {}
        if recommendation_files is None: recommendation_files = []
        if certification_texts is None: certification_texts = []
        if certification_files is None: certification_files = []

        certification_texts = [
            c if isinstance(c, str) else (
                    c.get("text") or c.get("name") or c.get("title") or str(c)
            )
            for c in certification_texts
        ]
        rag_id = (
            str(candidate_id) if candidate_id
            else f"tmp_{int(datetime.now().timestamp())}"
        )

        # ── 1. Extraction PDF ─────────────────────────────────────────────────
        logger.info("[Pipeline] Étape 1 — extraction PDF")
        cv_text     = self.extract_text_from_pdf(cv_file)
        letter_text = self.extract_text_from_pdf(cover_letter_file) if cover_letter_file else ""
        company_check = _check_company_mention(
            letter_text,
            company_name,
            job_title
        )
        rec_texts = [
            t for f in recommendation_files
            if (t := self.extract_text_from_pdf(f)) and "[Erreur" not in t
        ]
        # Analyse intégrité PDF certifications
        # Analyse intégrité PDF certifications — UNIQUEMENT sur les vrais fichiers PDF
        # uploadés (certification_files), pas sur le texte déjà extrait.
        cert_integrity_flags = []
        if certification_files:
            for i, cert_file in enumerate(certification_files):
                try:
                    integrity = self._check_certification_integrity(cert_file)
                    if integrity.get("is_suspicious"):
                        logger.warning(
                            "[Pipeline] Cert PDF #%d suspect: %s",
                            i, integrity["integrity_flags"]
                        )
                        cert_integrity_flags.extend(integrity["integrity_flags"])
                except Exception as exc:
                    logger.warning("[Pipeline] Intégrité PDF cert #%d ignorée: %s", i, exc)
        cert_verifications = self.verify_all_certifications(credential_url)
        if cert_verifications:
            verified_count = sum(1 for c in cert_verifications if c.get("verified") is True)
            fake_count = sum(1 for c in cert_verifications if c.get("verified") is False)
            logger.info(
                "[Pipeline] Certifications vérifiées: %d OK, %d fake/introuvable",
                verified_count, fake_count
            )
        identity_result = _check_identity_coherence(
            candidate_form_data.get("full_name", ""),
            cv_text,
            letter_text,
            company_name=company_name,
        )
        identity_result["company_mentioned"] = company_check["company_mentioned"]
        identity_result["company_score"] = company_check["score"]
        identity_result["company_exact_match"] = company_check["exact_match"]
        identity_result["job_title_mentioned"] = company_check["job_title_mentioned"]





        # ── 2. GitHub ─────────────────────────────────────────────────────────
        logger.info("[Pipeline] Étape 2 — analyse GitHub")
        github_analysis = (
            self.analyze_github(github_url, required_skills)
            if github_url and github_url.strip() else None
        )
        if github_analysis:
            logger.info("[Pipeline] GitHub score: %d/100", github_analysis.score)

        # ── 3. Indexation RAG ─────────────────────────────────────────────────
        logger.info("[Pipeline] Étape 3 — indexation RAG")
        form_text = self._form_data_to_text(candidate_form_data)
        self._index_all_documents(
            candidate_id=rag_id,
            cv_text=cv_text,
            letter_text=letter_text,
            recommendation_texts=rec_texts,
            certification_texts=certification_texts,
            form_text=form_text,
            github_analysis=github_analysis,
        )

        # ── 4. Récupération RAG ───────────────────────────────────────────────
        logger.info("[Pipeline] Étape 4 — récupération RAG")
        rag_context = retrieve_for_job(
            job_description=job_description,
            required_skills=required_skills,
            candidate_id=rag_id,
        )
        logger.info("[Pipeline] RAG : %d caractères récupérés", len(rag_context))

        # ── 5. Appel Groq ─────────────────────────────────────────────────────
        logger.info("[Pipeline] Étape 5 — appel Groq")
        prompt = self._build_analysis_prompt(
            job_title=job_title,
            job_description=job_description,
            required_skills=required_skills,
            company_name=company_name,
            candidate_form_data=candidate_form_data,
            github_analysis=github_analysis,
            rag_context=rag_context,
            certification_texts=certification_texts,
            cert_verifications=cert_verifications,
            cert_integrity_flags=cert_integrity_flags,
        )
        groq_raw = _call_groq_json(self.api_key, prompt, max_tokens=4000)
        groq_result = self._sanitize_result(groq_raw or {})

        # ── 6. Parsing ────────────────────────────────────────────────────────
        logger.info("[Pipeline] Étape 6 — parsing résultats")
        cv_analysis     = self._parse_cv(groq_result)
        mot_analysis    = self._parse_motivation(groq_result) if letter_text else None
        soft_analysis   = self._parse_softskills(groq_result, cv_text, letter_text)
        coherence_check = self._parse_coherence(
            groq_result, candidate_form_data, cv_analysis.total_years_experience
        )

        # Appliquer les vérifications d'identité
        if identity_result.get("has_issues"):
            coherence_check.flags.extend(identity_result.get("flags", []))
            coherence_check.overall_score = min(coherence_check.overall_score, 40)

            if len(identity_result.get("flags", [])) >= 2:
                coherence_check.overall_score = min(coherence_check.overall_score, 15)
                coherence_check.is_out_of_field = True

        # Ajouter les infos de lettre générique et entreprise
        coherence_check.letter_is_generic = identity_result.get("letter_is_generic", False)
        coherence_check.letter_personalization_score = identity_result.get("letter_personalization_score", 100)
        coherence_check.company_mentioned = identity_result.get("company_mentioned", True)

        coherence_check._cert_verifications = cert_verifications
        coherence_check._cert_integrity_flags = cert_integrity_flags  # ← AJOUT couche 1

        # Si l'inspection structurelle a détecté un PDF suspect (créé avec Canva/Word/etc.),
        # on l'ajoute aux flags visibles par le RH
        if cert_integrity_flags:
            coherence_check.flags.extend([
                f"⚠ Certif suspecte : {f}" for f in cert_integrity_flags[:3]
            ])
        score_result = self.calculate_final_score(
            cv_analysis, mot_analysis, soft_analysis,
            github_analysis, coherence_check, weights=weights,
            company_name=company_name,
        )

        recommendations = self._build_recommendations(
            cv_analysis, mot_analysis, soft_analysis,
            github_analysis, coherence_check, score_result["final_score"],
        )

        final = FinalAnalysis(
            final_score=score_result["final_score"],
            cv_analysis=cv_analysis,
            motivation_analysis=mot_analysis,
            softskills_analysis=soft_analysis,
            github_analysis=github_analysis,
            coherence_check=coherence_check,
            decision=score_result["decision"],
            recommendations=recommendations,
            detailed_breakdown=score_result["breakdown"],
            weights_used=score_result["weights_used"],
        )
        final.cert_verifications = cert_verifications

        final.certifications = [
            {
                "name": c.get("name", ""),
                "issuer": c.get("issuer", ""),
                "year": c.get("year"),
                "level": c.get("level", ""),
                "relevance": c.get("relevance", ""),
                "suspicious": c.get("suspicious", False),
                "suspicion_reason": c.get("suspicion_reason", ""),
                "credibility_score": c.get("credibility_score", 100),
            }
            for c in groq_result.get("certifications", [])[:8]
        ]
        final.projects = [
            {
                "name":         p.get("name", "Projet sans nom"),
                "type":         p.get("type", "Non défini"),
                "technologies": (
                    p.get("technologies")
                    if isinstance(p.get("technologies"), list) else []
                ),
                "complexity":   p.get("complexity", "Faible"),
                "team_size":    p.get("team_size"),
                "duration":     p.get("duration"),
            }
            for p in (groq_result.get("projects") or [])[:6]
            if isinstance(p, dict)
        ]

        # ── 7. Messages candidat ──────────────────────────────────────────────
        try:
            msgs                    = self.generate_candidate_messages(final)
            final.candidate_message = msgs["candidate_message"]
            final.next_steps        = msgs["next_steps"]
        except Exception as exc:
            logger.error("[Pipeline] Erreur messages candidat: %s", exc)
            final.candidate_message = "Analyse effectuée avec succès."
            final.next_steps        = "Vous recevrez un email de confirmation sous 48h."

        # ── Log final structuré ───────────────────────────────────────────────
        bd = final.detailed_breakdown
        logger.info(
            "[Pipeline] ✓ Score=%d/100 | Décision=%s | "
            "CV=%d×%.2f MOT=%d×%.2f SOFT=%.0f×%.2f GH=%.0f×%.2f COH=%d×%.2f PEN=-%d",
            final.final_score, final.decision,
            bd["cv_score"],         score_result["weights_used"]["cv"],
            bd["motivation_score"], score_result["weights_used"]["motivation"],
            bd["softskills_score"], score_result["weights_used"]["softskills"],
            bd["github_score"],     score_result["weights_used"]["github"],
            bd["coherence_score"],  score_result["weights_used"]["coherence"],
            bd["penalty_applied"],
        )

        if final.decision == "REJECTED":
            logger.warning(
                "[Pipeline] REJECTED — candidat=%s | oof=%s | flags=%s | missing=%s",
                candidate_id,
                final.coherence_check.is_out_of_field,
                final.coherence_check.flags[:3],
                final.cv_analysis.missing_skills[:3],
            )
        elif final.decision == "TO_REVIEW":
            logger.info(
                "[Pipeline] TO_REVIEW — candidat=%s | GitHub=%s | strengths=%s",
                candidate_id,
                final.github_analysis.score if final.github_analysis else "N/A",
                final.cv_analysis.strengths[:2],
            )

        return final

    # ──────────────────────────────────────────────────────────────────────────
    # UTILITAIRE DASHBOARD
    # ──────────────────────────────────────────────────────────────────────────

    def extract_skills_statistics(self, applications) -> Dict[str, Any]:
        all_strengths: List[str] = []
        all_missing:   List[str] = []
        for app in applications:
            all_strengths.extend(app.ai_strengths or [])
            all_missing.extend(app.ai_missing_skills or [])
        return {
            "topSkills":           [s for s, _ in Counter(all_strengths).most_common(10)],
            "missingSkillsTrends": [s for s, _ in Counter(all_missing).most_common(10)],
        }