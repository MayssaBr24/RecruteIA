from recruitment.models import JobOffer, Application, AIInterview, User
from django.utils import timezone
from datetime import timedelta
from recruitment.tasks import send_interview_invitation_email
import uuid

# --- CONFIGURATION ---
RH_ID = 2
MON_EMAIL = 'benromdhanemayssa23@gmail.com'
FRONTEND_URL = "http://localhost:3000"

print("🛠️ Lancement du test de secours...")

# 1. RÉCUPÉRATION RH
rh = User.objects.get(id=RH_ID)

# 2. CRÉATION OFFRE
job = JobOffer.objects.create(
    title=f"Test Direct {timezone.now().strftime('%H:%M')}",
    requirements="Django",
    department="Informatique",
    created_by=rh,
    offer_deadline=timezone.now().date() - timedelta(days=1),
    agents_needed=1,
    is_active=True,
    interview_type="AI",
    weight_cv=0.5, weight_motivation=0.2, weight_softskills=0.1, weight_github=0.2
)

# 3. CRÉATION CANDIDAT
app = Application.objects.create(
    job_offer=job,
    full_name="Mayssa Live Test",
    email=MON_EMAIL,
    ai_score=95,
    ai_decision='VALIDATED',
    status='shortlisted' # On le met direct en sélectionné
)

# 4. CRÉATION MANUELLE DE L'ENTRETIEN (Pour éviter l'échec de la task)
interview = AIInterview.objects.create(
    application=app,
    token=str(uuid.uuid4()),
    status='pending',
    expires_at=timezone.now() + timedelta(days=7)
)
print(f"✅ Entretien créé manuellement pour {app.full_name}")

# 5. ENVOI EMAIL & AFFICHAGE LIEN
try:
    send_interview_invitation_email(interview.id)
    print("\n" + "⭐" * 35)
    print("🔥 RÉUSSITE ! LE LIEN EST PRÊT :")
    print(f"🔗 {FRONTEND_URL}/interview/{interview.token}")
    print("⭐" * 35)
except Exception as e:
    print(f"⚠️ Email non envoyé mais lien valide : {e}")
    print(f"🔗 {FRONTEND_URL}/interview/{interview.token}")