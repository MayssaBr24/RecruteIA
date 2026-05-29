import os
import json
from groq import Groq
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor, as_completed  # ← AJOUT

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    print("⚠️ ATTENTION : GROQ_API_KEY non trouvée dans le fichier .env")

client = Groq(api_key=api_key)

def _call_groq(prompt, max_tokens=500):
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "You are an expert recruitment AI."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=max_tokens,
        )
        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.replace("```json", "").replace("```", "").strip()
        return json.loads(content)
    except Exception as e:
        print("Erreur GROQ:", str(e))
        return None


def match_cv_preview(
    title: str,
    requirements: str,
    soft_skills: str = '',
    experience_years: int = 0,
    education_level: str = '',
    rh_user=None
) -> dict:
    from .models import Application

    all_applications = Application.objects.filter(
        ai_score__gt=0
    ).select_related('job_offer').order_by('-ai_score')

    if not all_applications.exists():
        return {'stats': {'total': 0, 'strong_matches': 0,
                          'good_matches': 0, 'weak_matches': 0},
                'matches': []}

    # ──────────────────────────────────────────
    # NOUVEAU : fonction pour traiter 1 candidat
    # ──────────────────────────────────────────
    def process_app(app):
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
- Université : {app.university}
- Score IA précédent : {app.ai_score}/100
- Forces : {app.ai_strengths}
- Compétences manquantes : {app.ai_missing_skills}
- Résumé : {app.ai_summary}

Réponds UNIQUEMENT en JSON :
{{
    "match_score": <0-100>,
    "matching_skills": ["skill1", "skill2"],
    "missing_skills": ["skill_manquant1"],
    "summary": "Résumé court en 2 phrases",
    "recommendation": "STRONG_MATCH|GOOD_MATCH|WEAK_MATCH"
}}
"""
        match_data = _call_groq(prompt, max_tokens=500)

        if not match_data or match_data.get('match_score', 0) < 30:
            return None  # ← on ignore les mauvais matches

        return {
            'id': app.id,
            'match_score': match_data.get('match_score', 0),
            'matching_skills': match_data.get('matching_skills', []),
            'missing_skills': match_data.get('missing_skills', []),
            'summary': match_data.get('summary', ''),
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
        }

    # ──────────────────────────────────────────
    # NOUVEAU : lancement en parallèle
    # ──────────────────────────────────────────
    results = []
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(process_app, app): app for app in all_applications}
        for future in as_completed(futures):
            result = future.result()
            if result is not None:
                results.append(result)

    results.sort(key=lambda x: x['match_score'], reverse=True)
    results = results[:20]

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