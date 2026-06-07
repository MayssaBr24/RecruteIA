import os
import json
import time
import re
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    print("⚠️ ATTENTION : GROQ_API_KEY non trouvée dans le fichier .env")

client = Groq(api_key=api_key)


def _extract_json(text: str):
    text = re.sub(r'```json|```', '', text).strip()
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        return json.loads(match.group())
    raise ValueError("Aucun JSON trouvé dans la réponse")


def _call_groq(prompt, max_tokens=400, retries=3):
    for attempt in range(retries):
        try:
            response = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": "You are an expert recruitment AI. Always respond with valid JSON only, no extra text."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=max_tokens,
            )
            content = response.choices[0].message.content.strip()
            return _extract_json(content)

        except Exception as e:
            err = str(e)
            if '429' in err:
                wait = 10 * (attempt + 1)
                print(f"Rate limit, attente {wait}s... (tentative {attempt+1}/{retries})")
                time.sleep(wait)
            else:
                print(f"Erreur GROQ: {err}")
                return None

    print("Échec après plusieurs tentatives.")
    return None


# ─────────────────────────────────────────────────
# ÉTAPE 1 : Score local rapide (sans API)
# ─────────────────────────────────────────────────
from difflib import SequenceMatcher

def _quick_score(app, required_skills: list, experience_years: int) -> float:
    score = 0.0
    candidate_text = f"""
        {app.ai_strengths} 
        {app.ai_missing_skills}
        {app.degree_level}
    """.lower()

    # ── 1. Compétences (50 pts) ──────────────────────────
    for skill in required_skills:
        skill = skill.lower().strip()

        # Correspondance exacte
        if skill in candidate_text:
            score += 10

        # Correspondance partielle (ex: "react" trouve "reactjs")
        elif any(skill in word or word in skill
                 for word in candidate_text.split()):
            score += 6

        # Correspondance floue (ex: "pyton" trouve "python")
        elif any(
            SequenceMatcher(None, skill, word).ratio() > 0.82
            for word in candidate_text.split()
        ):
            score += 3

    # ── 2. Expérience (25 pts) ───────────────────────────
    if app.experience_years >= experience_years:
        score += 25
    elif app.experience_years >= experience_years - 1:
        score += 15
    elif app.experience_years >= experience_years - 2:
        score += 5

    # ── 3. Score IA existant (25 pts) ────────────────────
    score += app.ai_score * 0.25

    return round(score, 2)

# ─────────────────────────────────────────────────
# ÉTAPE 2 : Analyse approfondie avec GROQ (top 10)
# ─────────────────────────────────────────────────
def _groq_deep_analysis(app, title, requirements, experience_years,
                         education_level, soft_skills) -> dict | None:
    prompt = f"""
Tu es un expert RH. Analyse le matching entre cette offre et ce candidat.

OFFRE :
- Titre : {title}
- Compétences requises : {requirements}
- Expérience requise : {experience_years} ans
- Niveau d'études : {education_level}
- Soft skills : {soft_skills}

CANDIDAT :
- Nom : {app.full_name}
- Expérience : {app.experience_years} ans
- Niveau d'études : {app.degree_level}
- Score IA précédent : {app.ai_score}/100
- Forces : {app.ai_strengths}
- Compétences manquantes : {app.ai_missing_skills}

Réponds UNIQUEMENT en JSON valide :
{{
    "match_score": <0-100>,
    "matching_skills": ["skill1", "skill2"],
    "missing_skills": ["skill1"],
    "summary": "2 phrases max",
    "recommendation": "STRONG_MATCH|GOOD_MATCH|WEAK_MATCH"
}}
"""
    return _call_groq(prompt, max_tokens=400)


# ─────────────────────────────────────────────────
# FONCTION PRINCIPALE
# ─────────────────────────────────────────────────
def match_cv_preview(
    title: str,
    requirements: str,
    soft_skills: str = '',
    experience_years: int = 0,
    education_level: str = '',
    rh_user=None
) -> dict:
    from recruitment.models import Application

    all_applications = Application.objects.filter(
        ai_score__gt=0
    ).select_related('job_offer').order_by('-ai_score')

    if not all_applications.exists():
        return {
            'stats': {'total': 0, 'strong_matches': 0,
                      'good_matches': 0, 'weak_matches': 0},
            'matches': []
        }

    # ── ÉTAPE 1 : Pré-filtrage local (instantané, 0 appel API) ──
    required_skills = [s.strip() for s in requirements.split(',')]

    candidates_scored = []
    for app in all_applications:
        local_score = _quick_score(app, required_skills, experience_years)
        candidates_scored.append((local_score, app))

    # Trie par score local, garde les 10 meilleurs
    candidates_scored.sort(key=lambda x: x[0], reverse=True)
    top_candidates = [app for _, app in candidates_scored[:10]]

    print(f"✅ Pré-filtrage : {len(all_applications)} candidats → TOP 10 sélectionnés")

    # ── ÉTAPE 2 : Analyse GROQ uniquement sur le TOP 10 ──
    results = []
    for app in top_candidates:
        print(f"🔍 Analyse GROQ : {app.full_name}...")

        match_data = _groq_deep_analysis(
            app, title, requirements,
            experience_years, education_level, soft_skills
        )

        if not match_data or match_data.get('match_score', 0) < 30:
            continue

        results.append({
            'id': app.id,
            'match_score': match_data.get('match_score', 0),
            'matching_skills': match_data.get('matching_skills', []),
            'missing_skills': match_data.get('missing_skills', []),
            'summary': match_data.get('summary', ''),
            'recommendation': match_data.get('recommendation', ''),
            'candidate': {
                'id': app.id,
                'full_name': app.full_name,
                'email': app.email,
                'phone': app.phone,
                'experience_years': app.experience_years,
                'degree_level': app.degree_level,
                'university': app.university,
                'current_location': app.current_location,
                'linkedin_url': app.linkedin_url,
                'github_url': app.github_url,
                'ai_score': app.ai_score,
                'ai_decision': app.ai_decision,
                'ai_strengths': app.ai_strengths,
                'ai_weaknesses': app.ai_weaknesses,
                'previous_offer': app.job_offer.title,
                'applied_date': app.applied_date.strftime('%d/%m/%Y'),
            }
        })

        time.sleep(1)  # throttle entre chaque appel

    results.sort(key=lambda x: x['match_score'], reverse=True)

    strong = len([r for r in results if r['match_score'] >= 80])
    good   = len([r for r in results if 60 <= r['match_score'] < 80])
    weak   = len([r for r in results if 30 <= r['match_score'] < 60])

    return {
        'stats': {
            'total': len(results),
            'strong_matches': strong,
            'good_matches': good,
            'weak_matches': weak,
        },
        'matches': results
    }