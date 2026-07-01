
import logging
from services.groq_client import _call_groq_json

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────
# ÉTAPE 1 : Score local rapide (sans API)
# ─────────────────────────────────────────────────
from difflib import SequenceMatcher

def _quick_score(app, required_skills: list, experience_years: int) -> float:

    def normalize(text):
        return str(text).lower().strip()

    candidate_skills = []

    if app.ai_strengths:
        if isinstance(app.ai_strengths, list):
            candidate_skills.extend(app.ai_strengths)
        else:
            candidate_skills.append(app.ai_strengths)

    candidate_skills = [normalize(s) for s in candidate_skills]

    # ===============================
    # 1. Match compétences (60 pts)
    # ===============================
    matched = 0

    for skill in required_skills:
        skill = normalize(skill)

        found = False

        for candidate_skill in candidate_skills:

            # Exact
            if skill == candidate_skill:
                found = True
                break

            # Inclusion
            if skill in candidate_skill or candidate_skill in skill:
                found = True
                break

            # Similarité
            if SequenceMatcher(
                None,
                skill,
                candidate_skill
            ).ratio() >= 0.85:
                found = True
                break

        if found:
            matched += 1

    skill_score = (
        matched / max(len(required_skills), 1)
    ) * 60

    # ===============================
    # 2. Expérience (20 pts)
    # ===============================
    exp_score = 0

    if app.experience_years >= experience_years:
        exp_score = 20

    elif app.experience_years >= experience_years * 0.75:
        exp_score = 15

    elif app.experience_years >= experience_years * 0.5:
        exp_score = 10

    elif app.experience_years > 0:
        exp_score = 5

    # ===============================
    # 3. Score IA (20 pts)
    # ===============================
    ai_score = min(app.ai_score, 100) * 0.20

    final_score = skill_score + exp_score + ai_score

    return round(min(final_score, 100), 2)

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
    return _call_groq_json(prompt, max_tokens=400)

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

    app_filter = {'ai_score__gt': 0}
    if rh_user:
        app_filter['job_offer__created_by'] = rh_user

    all_applications = Application.objects.filter(
        **app_filter
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