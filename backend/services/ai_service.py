"""
Système d'Analyse IA pour Recrutement — production-ready
Pipeline : PDF → GitHub → RAG index → RAG retrieve → Groq (1 appel) → score
"""

from __future__ import annotations

import json
import logging
import os
import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv
from pypdf import PdfReader

from .rag import (
    SOURCE_CERTIFICATION,
    SOURCE_COVER_LETTER,
    SOURCE_CV,
    SOURCE_FORM,
    SOURCE_GITHUB,
    SOURCE_RECOMMENDATION,
    index_document,
    retrieve_for_job,
)

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
    stack_match_bonus: int


@dataclass
class CoherenceCheck:
    experience_match: bool
    availability_compatible: bool
    is_out_of_field: bool        # exposé au frontend
    overall_score: int
    flags: List[str]
    notes: str


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
            reader = PdfReader(
                str(pdf_file) if isinstance(pdf_file, (str, Path)) else pdf_file
            )
            pages = [
                p.extract_text().strip()
                for p in reader.pages
                if p.extract_text() and p.extract_text().strip()
            ]
            full = "\n\n".join(pages)
            return full if full else "[PDF vide ou non lisible]"
        except Exception as exc:
            logger.error("[CVAnalyzer] Erreur extraction PDF: %s", exc)
            return "[Erreur extraction PDF]"

    # ──────────────────────────────────────────────────────────────────────────
    # ANALYSE GITHUB (API directe, sans LLM)
    # ──────────────────────────────────────────────────────────────────────────

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
                logger.warning("[GitHub] Profil introuvable: %s", username)
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

            # ── Langages principaux (top 5) ───────────────────────────────────
            langs: Dict[str, int] = {}
            for repo in repos_data[:15]:
                lang = repo.get("language")
                if lang:
                    langs[lang] = langs.get(lang, 0) + 1
            main_languages = sorted(langs, key=lambda x: langs[x], reverse=True)[:5]

            top_repos = [
                {
                    "name":        r.get("name", ""),
                    "stars":       r.get("stargazers_count", 0),
                    "forks":       r.get("forks_count", 0),
                    "description": r.get("description") or "",
                    "language":    r.get("language"),
                    "updated_at":  r.get("updated_at", "")[:10],
                    "is_fork":     r.get("fork", False),   # ← distingue vrais projets des forks
                }
                for r in repos_data[:5]
            ]

            now_year  = str(datetime.now().year)
            prev_year = str(datetime.now().year - 1)
            active = [
                r for r in repos_data
                if r.get("updated_at", "").startswith((now_year, prev_year))
            ]
            activity_score = min(5, len(active))

            # ── Qualité projets — corrigée ─────────────────────────────────────
            # Un repo original (non fork) actif et documenté compte même sans stars.
            # Un fork compte 0 — il ne prouve pas les compétences du candidat.
            original_repos = [r for r in repos_data[:15] if not r.get("fork", False)]
            quality_repos  = [
                r for r in original_repos
                if r.get("stargazers_count", 0) > 0
                or r.get("forks_count", 0) > 0
                or len(r.get("description") or "") > 20  # documenté = qualité
            ]
            project_quality = min(5, max(len(quality_repos), 1 if len(original_repos) > 3 else 0))

            documented_repos    = [r for r in repos_data[:10] if len(r.get("description") or "") > 20]
            documentation_score = min(3, len(documented_repos))

            score = int(round(
                (activity_score / 5)      * 40 +
                (project_quality / 5)     * 40 +
                (documentation_score / 3) * 20
            ))

            # ── Pertinence stack ──────────────────────────────────────────────
            relevance_score   = 0
            stack_match_bonus = 0
            if required_skills:
                req_lower  = [s.lower() for s in required_skills]
                lang_lower = [lang.lower() for lang in main_languages]
                desc_text  = " ".join(
                    (r.get("description") or "") + " " + (r.get("name") or "")
                    for r in repos_data[:10]
                ).lower()
                matches = sum(
                    1 for s in req_lower
                    if s in lang_lower or s in desc_text
                )
                relevance_score   = int((matches / len(required_skills)) * 100)
                stack_match_bonus = min(10, matches * 3)

            last_activity = (
                repos_data[0].get("updated_at", "")[:10] if repos_data else "Inconnu"
            )

            return GitHubAnalysis(
                score=score,
                total_repos=total_repos,
                main_languages=main_languages,
                activity_score=activity_score,
                project_quality=project_quality,
                documentation_score=documentation_score,
                last_activity=last_activity,
                top_repos=top_repos,
                relevance_score=relevance_score,
                stack_match_bonus=stack_match_bonus,
            )

        except requests.exceptions.Timeout:
            logger.error("[GitHub] Timeout")
            return None
        except Exception as exc:
            logger.error("[GitHub] Erreur: %s", exc)
            return None

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
                index_document(rec, SOURCE_RECOMMENDATION, candidate_id, {"rec_index": i})

        # Certifications : préfixe explicite pour que le LLM comprenne
        # que c'est un document officiel fourni, pas une mention dans le CV
        for i, cert in enumerate(certification_texts):
            if cert and len(cert.strip()) > 5:
                cert_labeled = f"[CERTIFICATION VÉRIFIÉE #{i+1}]\n{cert}"
                index_document(cert_labeled, SOURCE_CERTIFICATION, candidate_id, {"cert_index": i})

        safe_index(form_text, SOURCE_FORM)

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
                    f"forks: {r['forks']}, fork_du_projet: {r.get('is_fork', False)})"
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
            "years_experience":  "Années d'expérience",
            "current_position":  "Poste actuel",
            "education":         "Diplôme",
            "skills":            "Compétences déclarées",
            "availability":      "Disponibilité",
            "availability_date": "Date de disponibilité",
            "motivation_text":   "Motivation",
        }
        # salary_expectation + job_salary_* supprimés — gérés côté offre RH
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
        certification_texts: Optional[List[str]] = None,
    ) -> str:
        cd        = candidate_form_data if isinstance(candidate_form_data, dict) else {}
        years_exp = cd.get("years_experience", "Non renseigné")

        skills_text = ", ".join(required_skills) if required_skills else "Non précisées"
        rag_block   = self._truncate_rag(rag_context) if rag_context else "[RAG] Aucun extrait disponible."

        github_ctx = "Non fourni"
        if github_analysis:
            original_count = sum(
                1 for r in github_analysis.top_repos if not r.get("is_fork", False)
            )
            github_ctx = (
                f"Score: {github_analysis.score}/100 | "
                f"Repos: {github_analysis.total_repos} "
                f"(dont {original_count} originaux) | "
                f"Langages: {', '.join(github_analysis.main_languages)} | "
                f"Activité: {github_analysis.activity_score}/5 | "
                f"Pertinence stack: {github_analysis.relevance_score}%"
            )

        # Bloc certifications vérifiées — section dédiée dans le prompt
        cert_block = ""
        if certification_texts:
            valid_certs = [c for c in certification_texts if c and len(c.strip()) > 5]
            if valid_certs:
                cert_block = (
                    "\n=== CERTIFICATIONS VÉRIFIÉES (documents officiels fournis) ===\n"
                    "Ces certifications ont été soumises comme pièces justificatives.\n"
                    "Leur poids dans l'évaluation doit être SUPÉRIEUR à une simple mention dans le CV.\n\n"
                    + "\n\n".join(
                        f"[Certification #{i+1}]\n{c.strip()}"
                        for i, c in enumerate(valid_certs[:5])
                    )
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
{cert_block}
=== PROFIL DÉCLARÉ ===
Expérience déclarée : {years_exp} ans

=== GITHUB — ANALYSE OBJECTIVE ===
{github_ctx}

=== RÈGLES STRICTES ===
1. Réponds UNIQUEMENT en JSON valide — pas de markdown, pas de backticks.
2. Base-toi UNIQUEMENT sur les extraits RAG, certifications vérifiées et données GitHub.
3. "certifications" = liste d'OBJETS (jamais de strings).
4. "projects"       = liste d'OBJETS (jamais de strings).
5. Si aucune certification/projet : retourne [] pour ces champs.
6. Domaine totalement étranger → "is_out_of_field"=true et overall_score<30.
7. Détecte incohérences de dates, rôles, expérience.
8. Les certifications vérifiées augmentent le score CV si pertinentes au poste.

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
  {
    "name": "",
    "issuer": "",
    "year": null,
    "level": "",
    "relevance": "",
    "suspicious": false,        
    "suspicion_reason": "",      
    "credibility_score": 100      
  }
]
  "projects": []
}}
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

        # verification supprimée — jamais utilisée
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
    ) -> Dict[str, Any]:

        def clamp(v: float) -> float:
            return max(0.0, min(100.0, v))

        # Poids par défaut selon présence GitHub
        has_github = github_analysis is not None
        if weights is None:
            weights = (
                {"cv": 0.40, "motivation": 0.10, "softskills": 0.10,
                 "github": 0.30, "coherence": 0.10}
                if has_github else
                {"cv": 0.50, "motivation": 0.25, "softskills": 0.15,
                 "github": 0.00, "coherence": 0.10}
            )

        cv_score  = clamp(cv_analysis.score)
        mot_score = clamp(motivation_analysis.score) if motivation_analysis else 50.0
        avg_soft  = sum([
            softskills_analysis.leadership,
            softskills_analysis.autonomy,
            softskills_analysis.teamwork,
            softskills_analysis.problem_solving,
            softskills_analysis.communication,
        ]) / 5
        soft_score = clamp(avg_soft * 10)
        gh_score   = (
            clamp(github_analysis.score + github_analysis.stack_match_bonus)
            if github_analysis else 0.0
        )
        coh_score = clamp(coherence_check.overall_score)

        raw = (
            weights["cv"]         * cv_score   +
            weights["motivation"] * mot_score  +
            weights["softskills"] * soft_score +
            weights["github"]     * gh_score   +
            weights["coherence"]  * coh_score
        )

        # ── PÉNALITÉS ────────────────────────────────────────────────────────
        penalty         = 0
        penalty_details: List[str] = []

        # Écart expérience déclarée vs CV > 2 ans
        if not coherence_check.experience_match:
            penalty += 10
            penalty_details.append("Écart expérience déclarée/CV supérieur à 2 ans (−10pts)")

        # 2 red flags ou plus dans le CV
        if len(cv_analysis.red_flags) >= 2:
            penalty += 5
            penalty_details.append(f"Red flags CV détectés : {', '.join(cv_analysis.red_flags[:2])} (−5pts)")

        # Hors domaine — is_out_of_field déjà plafonne le score cohérence à 28
        # donc overall_score < 55 sera vrai → pénalité cohérence sérieuse ci-dessous
        # Pas de pénalité séparée pour éviter le double comptage

        # Cohérence sérieuse : score < 55 (junior sur senior, domaine inadapté)
        if coherence_check.overall_score < 55:
            penalty += 10
            penalty_details.append(
                f"Cohérence insuffisante (score={coherence_check.overall_score}/100) (−10pts)"
            )
        # Cohérence modérée : entre 55 et 65 avec au moins 1 flag
        elif coherence_check.overall_score <= 65 and len(coherence_check.flags) >= 1:
            penalty += 5
            penalty_details.append(
                f"Cohérence modérée avec alerte : {coherence_check.flags[0]} (−5pts)"
            )

        if penalty_details:
            logger.info("[Score] Pénalités appliquées: %s", " | ".join(penalty_details))

        final_score = int(round(clamp(raw - penalty)))

        decision = (
            "VALIDATED" if final_score >= 80 else
            "TO_REVIEW" if final_score >= 58 else
            "REJECTED"
        )

        return {
            "final_score":  final_score,
            "decision":     decision,
            "weights_used": weights,
            "breakdown": {
                "cv_score":            cv_score,
                "motivation_score":    mot_score,
                "softskills_score":    round(soft_score, 1),
                "github_score":        gh_score,
                "coherence_score":     coh_score,
                "penalty_applied":     penalty,
                "penalty_details":     penalty_details,    # ← affiché dans le rapport
                "weighted_cv":         round(weights["cv"]         * cv_score,   2),
                "weighted_motivation": round(weights["motivation"] * mot_score,  2),
                "weighted_softskills": round(weights["softskills"] * soft_score, 2),
                "weighted_github":     round(weights["github"]     * gh_score,   2),
                "weighted_coherence":  round(weights["coherence"]  * coh_score,  2),
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
        cv         = analysis.cv_analysis
        score      = analysis.final_score
        has_github = analysis.github_analysis is not None
        sources    = "CV et lettre de motivation" + (" et profil GitHub" if has_github else "")

        msg = (
            f"**Analyse préliminaire de votre candidature**\n\n"
            f"Votre dossier a obtenu un score de **{score}/100** sur la base de l'analyse "
            f"automatisée de votre {sources}. "
            f"**Ce score est une aide à la décision** pour notre équipe RH.\n\n"
        )

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

        next_steps = (
            "**Prochaines étapes :**\n"
            "• Notre équipe RH examine votre dossier complet dans les 48h\n"
            "• Vous recevrez un email avec la décision finale\n"
            "• En cas de sélection, nous vous contacterons pour planifier un entretien\n\n"
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
        company_name: str = "L'entreprise",
        weights: Optional[Dict[str, float]] = None,
        candidate_form_data: Optional[Dict[str, Any]] = None,
        recommendation_files: Optional[List] = None,
        certification_texts: Optional[List[str]] = None,
        candidate_id: Optional[str] = None,
        credential_url: Optional[List[str]] = None,

    ) -> FinalAnalysis:

        logger.info("[Pipeline] Début analyse — poste: %s", job_title)

        if candidate_form_data  is None: candidate_form_data  = {}
        if recommendation_files is None: recommendation_files = []
        if certification_texts  is None: certification_texts  = []

        rag_id = (
            str(candidate_id) if candidate_id
            else f"tmp_{int(datetime.now().timestamp())}"
        )

        # ── 1. Extraction PDF ─────────────────────────────────────────────────
        logger.info("[Pipeline] Étape 1 — extraction PDF")
        cv_text     = self.extract_text_from_pdf(cv_file)
        letter_text = self.extract_text_from_pdf(cover_letter_file) if cover_letter_file else ""
        rec_texts   = [
            t for f in recommendation_files
            if (t := self.extract_text_from_pdf(f)) and "[Erreur" not in t
        ]
        cert_verifications = self.verify_all_certifications(credential_url)
        if cert_verifications:
            verified_count = sum(1 for c in cert_verifications if c.get("verified") is True)
            fake_count = sum(1 for c in cert_verifications if c.get("verified") is False)
            logger.info(
                "[Pipeline] Certifications vérifiées: %d OK, %d fake/introuvable",
                verified_count, fake_count
            )
        # Stocker dans final pour le frontend
        final.cert_verifications = cert_verifications

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
            certification_texts=certification_texts,  # ← transmis au prompt
        )
        groq_raw    = _call_groq_json(self.api_key, prompt, max_tokens=4000)
        groq_result = self._sanitize_result(groq_raw or {})

        # ── 6. Parsing ────────────────────────────────────────────────────────
        logger.info("[Pipeline] Étape 6 — parsing résultats")
        cv_analysis     = self._parse_cv(groq_result)
        mot_analysis    = self._parse_motivation(groq_result) if letter_text else None
        soft_analysis   = self._parse_softskills(groq_result, cv_text, letter_text)
        coherence_check = self._parse_coherence(
            groq_result, candidate_form_data, cv_analysis.total_years_experience
        )

        score_result = self.calculate_final_score(
            cv_analysis, mot_analysis, soft_analysis,
            github_analysis, coherence_check, weights=weights,
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
        elif final.decision == "VALIDATED":
            logger.info(
                "[Pipeline] VALIDATED — candidat=%s | GitHub=%s | strengths=%s",
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