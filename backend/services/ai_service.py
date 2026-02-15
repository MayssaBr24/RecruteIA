"""
Service d'analyse de CV avec IA
Analyse sémantique des CV et scoring automatique par rapport aux offres d'emploi
"""

import os
import json
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
import openai
from pypdf import PdfReader

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class AnalysisResult:
    """Résultat structuré de l'analyse CV"""
    score: int
    summary: str
    missing_skills: List[str]
    decision: str
    strengths: Optional[List[str]] = None
    weaknesses: Optional[List[str]] = None
    recommendations: Optional[str] = None


class CVAnalyzer:
    """
    Service central pour l'analyse de CV.
    Utilise l'API OpenAI pour le scoring sémantique et l'extraction d'informations.

    Fonctionnalités:
    - Extraction de texte depuis PDF
    - Analyse sémantique du CV par rapport à l'offre
    - Scoring automatique (0-100)
    - Identification des compétences manquantes
    - Recommandations RH
    """

    # Constantes de décision
    THRESHOLD_REJECTED = 30
    THRESHOLD_VALIDATED = 80

    # Modèles OpenAI disponibles
    MODEL_GPT35 = "gpt-3.5-turbo"
    MODEL_GPT4 = "gpt-4-turbo-preview"
    MODEL_GPT4O = "gpt-4o"

    def __init__(self, model: str = MODEL_GPT35, temperature: float = 0.3):
        """
        Initialise le service d'analyse.

        Args:
            model: Modèle OpenAI à utiliser (défaut: gpt-3.5-turbo)
            temperature: Température pour la génération (0.0-1.0, défaut: 0.3)
        """
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("La variable d'environnement OPENAI_API_KEY n'est pas définie")

        self.client = openai.OpenAI(api_key=self.api_key)
        self.model = model
        self.temperature = temperature

        logger.info(f"CVAnalyzer initialisé avec le modèle {model}")

    def _call_openai(self, prompt: str, response_format: str = "json") -> Dict[str, Any]:
        """
        Appel sécurisé à l'API OpenAI avec gestion d'erreurs.

        Args:
            prompt: Le prompt à envoyer
            response_format: Format de réponse attendu ("json" ou "text")

        Returns:
            Dictionnaire contenant la réponse parsée
        """
        try:
            messages = [
                {
                    "role": "system",
                    "content": "Tu es un expert RH spécialisé dans l'analyse de CV et le recrutement. "
                               "Tu fournis des analyses objectives, structurées et pertinentes."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]

            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                response_format={"type": "json_object"} if response_format == "json" else None
            )

            content = response.choices[0].message.content

            if response_format == "json":
                return json.loads(content)
            return {"text": content}

        except openai.APIError as e:
            logger.error(f"Erreur API OpenAI: {e}")
            return self._get_error_response("Erreur de l'API OpenAI")
        except json.JSONDecodeError as e:
            logger.error(f"Erreur de parsing JSON: {e}")
            return self._get_error_response("Réponse IA invalide")
        except Exception as e:
            logger.error(f"Erreur inattendue lors de l'appel OpenAI: {e}")
            return self._get_error_response("Service IA temporairement indisponible")

    def _get_error_response(self, message: str) -> Dict[str, Any]:
        """Retourne une réponse d'erreur structurée"""
        return {
            "score": 0,
            "summary": message,
            "missing_skills": [],
            "decision": "PENDING",
            "strengths": [],
            "weaknesses": ["Analyse impossible - Erreur technique"],
            "recommendations": "Veuillez réessayer ultérieurement ou analyser manuellement."
        }

    def extract_text_from_pdf(self, pdf_file) -> str:
        """
        Extraction de texte depuis un fichier PDF.

        Args:
            pdf_file: Chemin du fichier ou objet file-like

        Returns:
            Texte extrait du PDF
        """
        try:
            reader = PdfReader(pdf_file)
            text = ""

            for page_num, page in enumerate(reader.pages, 1):
                try:
                    page_text = page.extract_text()
                    if page_text:
                        text += f"\n--- Page {page_num} ---\n{page_text}"
                except Exception as e:
                    logger.warning(f"Erreur extraction page {page_num}: {e}")
                    continue

            if not text.strip():
                logger.warning("Aucun texte extrait du PDF")
                return "[PDF vide ou illisible - OCR nécessaire]"

            logger.info(f"Texte extrait avec succès ({len(text)} caractères)")
            return text.strip()

        except Exception as e:
            logger.error(f"Erreur lors de l'extraction du PDF: {e}")
            return "[Erreur d'extraction du PDF]"

    def calculate_score(
            self,
            cv_text: str,
            job_title: str,
            job_description: str,
            required_skills: Optional[List[str]] = None
    ) -> AnalysisResult:
        """
        Calcule le score de correspondance entre un CV et une offre d'emploi.

        Args:
            cv_text: Texte extrait du CV
            job_title: Titre du poste
            job_description: Description complète du poste
            required_skills: Liste optionnelle des compétences requises

        Returns:
            AnalysisResult contenant le score et l'analyse complète
        """
        if not cv_text or cv_text.startswith("["):
            logger.warning("CV invalide ou vide")
            return AnalysisResult(
                score=0,
                summary="CV illisible ou vide",
                missing_skills=[],
                decision="PENDING",
                recommendations="Demandez au candidat de soumettre un CV lisible."
            )

        # Construction du prompt
        skills_section = ""
        if required_skills:
            skills_section = f"\n**Compétences requises :** {', '.join(required_skills)}"

        prompt = f"""
Analyse ce CV pour le poste suivant et fournis une évaluation détaillée.

**POSTE :** {job_title}

**DESCRIPTION DU POSTE :**
{job_description}
{skills_section}

**CV DU CANDIDAT :**
{cv_text[:8000]}  # Limite pour éviter les dépassements de tokens

**INSTRUCTIONS D'ANALYSE :**

1. **Extraction des compétences** : Identifie toutes les compétences techniques et soft skills du candidat
2. **Comparaison** : Compare les compétences du candidat avec celles requises pour le poste
3. **Scoring** : Attribue un score de 0 à 100 basé sur :
   - Adéquation des compétences (40%)
   - Expérience pertinente (30%)
   - Formation académique (20%)
   - Autres facteurs (projets, certifications, langues) (10%)

4. **Analyse qualitative** :
   - Points forts du candidat (3-5 points)
   - Points faibles ou lacunes (2-4 points)
   - Compétences manquantes critiques

5. **Décision automatique** :
   - Score < {self.THRESHOLD_REJECTED} → "REJECTED"
   - Score ≥ {self.THRESHOLD_VALIDATED} → "VALIDATED"
   - Sinon → "TO_REVIEW"

6. **Recommandations RH** : Conseils concrets pour la suite du processus

**FORMAT DE RÉPONSE (JSON strict) :**
{{
    "score": <nombre entre 0 et 100>,
    "summary": "<résumé en 2-3 phrases du profil>",
    "strengths": ["<point fort 1>", "<point fort 2>", "..."],
    "weaknesses": ["<point faible 1>", "<point faible 2>", "..."],
    "missing_skills": ["<compétence manquante 1>", "<compétence manquante 2>", "..."],
    "decision": "<VALIDATED|REJECTED|TO_REVIEW>",
    "recommendations": "<recommandations RH pour la suite>"
}}

Assure-toi que ta réponse soit un JSON valide et complet.
"""

        # Appel à l'IA
        result = self._call_openai(prompt, response_format="json")

        # Validation et structuration de la réponse
        try:
            return AnalysisResult(
                score=int(result.get("score", 0)),
                summary=result.get("summary", "Analyse incomplète"),
                missing_skills=result.get("missing_skills", []),
                decision=result.get("decision", "TO_REVIEW"),
                strengths=result.get("strengths", []),
                weaknesses=result.get("weaknesses", []),
                recommendations=result.get("recommendations", "")
            )
        except (ValueError, TypeError) as e:
            logger.error(f"Erreur lors de la structuration du résultat: {e}")
            return AnalysisResult(
                score=0,
                summary="Erreur de traitement",
                missing_skills=[],
                decision="PENDING"
            )

    def extract_candidate_info(self, cv_text: str) -> Dict[str, Any]:
        """
        Extrait les informations structurées du candidat depuis le CV.

        Args:
            cv_text: Texte du CV

        Returns:
            Dictionnaire avec les informations du candidat
        """
        prompt = f"""
Extrais les informations suivantes du CV ci-dessous :

**CV :**
{cv_text[:6000]}

**INFORMATIONS À EXTRAIRE :**
- Nationalité
- Université/École
- Niveau de diplôme (Licence, Master, Doctorat, etc.)
- Année d'obtention du diplôme
- Années d'expérience professionnelle (nombre)
- URL LinkedIn (si mentionné)
- URL Portfolio/GitHub (si mentionné)
- Localisation actuelle
- Prétention salariale (si mentionnée, en euros)
- Date de disponibilité (format YYYY-MM-DD si mentionnée)

**FORMAT DE RÉPONSE (JSON strict) :**
{{
    "nationality": "<nationalité ou null>",
    "university": "<nom de l'université ou null>",
    "degree_level": "<niveau de diplôme ou null>",
    "graduation_year": "<année ou null>",
    "experience_years": <nombre d'années ou 0>,
    "linkedin_url": "<URL ou null>",
    "portfolio_url": "<URL ou null>",
    "current_location": "<ville, pays ou null>",
    "salary_expectation": <nombre en euros ou null>,
    "availability_date": "<YYYY-MM-DD ou null>"
}}

Si une information n'est pas trouvée, utilise null. Sois précis et extrait uniquement ce qui est explicitement mentionné.
"""

        result = self._call_openai(prompt, response_format="json")
        return result

    def generate_interview_questions(
            self,
            cv_text: str,
            job_title: str,
            analysis_result: AnalysisResult
    ) -> List[str]:
        """
        Génère des questions d'entretien personnalisées basées sur le CV et l'analyse.

        Args:
            cv_text: Texte du CV
            job_title: Titre du poste
            analysis_result: Résultat de l'analyse précédente

        Returns:
            Liste de questions d'entretien
        """
        prompt = f"""
Génère 5-7 questions d'entretien pertinentes pour ce candidat.

**POSTE :** {job_title}

**RÉSUMÉ DU PROFIL :** {analysis_result.summary}

**POINTS FORTS :** {', '.join(analysis_result.strengths or [])}

**POINTS À CLARIFIER :** {', '.join(analysis_result.weaknesses or [])}

**COMPÉTENCES MANQUANTES :** {', '.join(analysis_result.missing_skills)}

**INSTRUCTIONS :**
- Pose des questions pour approfondir les points forts
- Clarifie les zones d'ombre ou lacunes
- Évalue la motivation et l'adéquation culturelle
- Questions techniques si pertinent
- Questions comportementales (STAR)

**FORMAT DE RÉPONSE (JSON) :**
{{
    "questions": [
        "Question 1 ?",
        "Question 2 ?",
        "..."
    ]
}}
"""

        result = self._call_openai(prompt, response_format="json")
        return result.get("questions", [])


# Exemple d'utilisation
if __name__ == "__main__":
    analyzer = CVAnalyzer(model=CVAnalyzer.MODEL_GPT4O)

    # Exemple 1: Analyse complète
    cv_text = analyzer.extract_text_from_pdf("candidat_cv.pdf")

    analysis = analyzer.calculate_score(
        cv_text=cv_text,
        job_title="Développeur Full Stack Senior",
        job_description="Nous recherchons un développeur expérimenté en React, Node.js et PostgreSQL...",
        required_skills=["React", "Node.js", "PostgreSQL", "Docker", "Git"]
    )

    print(f"Score: {analysis.score}/100")
    print(f"Décision: {analysis.decision}")
    print(f"Résumé: {analysis.summary}")
    print(f"Points forts: {analysis.strengths}")
    print(f"Compétences manquantes: {analysis.missing_skills}")

    # Exemple 2: Extraction d'informations
    candidate_info = analyzer.extract_candidate_info(cv_text)
    print(f"\nInformations extraites: {json.dumps(candidate_info, indent=2, ensure_ascii=False)}")

    # Exemple 3: Questions d'entretien
    questions = analyzer.generate_interview_questions(cv_text, "Développeur Full Stack Senior", analysis)
    print(f"\nQuestions d'entretien suggérées:")
    for i, q in enumerate(questions, 1):
        print(f"{i}. {q}")