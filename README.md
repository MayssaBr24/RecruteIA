# RecrutIA

**AI-Powered Multi-Tenant Recruitment SaaS Platform**

RecrutIA is an end-to-end HR platform that automates and streamlines the entire recruitment lifecycle using Artificial Intelligence — from candidate sourcing and instant CV scoring to AI-driven video interviews, predictive analytics, and employee onboarding.

Built as a final-year engineering capstone project (PFE 2025/2026), developed over **7 Agile Scrum sprints**, at Aziin Engineering Solution.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [AI Scoring Pipeline](#ai-scoring-pipeline)
- [AI Video Interview Engine](#ai-video-interview-engine)
- [Certification Fraud Detection](#certification-fraud-detection)
- [Dynamic Weighting System](#dynamic-weighting-system)
- [Automated LinkedIn Sourcing](#automated-linkedin-sourcing)
- [Multi-Tenant Architecture & Roles](#multi-tenant-architecture--roles)
- [Sprint Roadmap](#sprint-roadmap)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Status](#project-status)
- [Author](#author)

---

## Overview

RecrutIA reimagines the recruitment process as an intelligent, end-to-end pipeline rather than a static applicant tracking system. It combines:

- **Instant AI CV scoring** with full transparency on how each score is calculated
- **Retrieval-Augmented Generation (RAG)** interview engine with real-time voice & face verification
- **Certification fraud detection** across three independent verification layers
- **Predictive HR analytics** with AI-generated forecasts and turnover insights
- **Automated LinkedIn sourcing** via an RPA workflow (n8n + Apify), turning recruitment from reactive to proactive

The platform is designed to be **production-ready**: every processing stage is isolated, failures never interrupt the overall pipeline, and results are persisted even in case of partial failure.

---

## Key Features

| Module | Description |
|---|---|
| **Public Job Portal** | Public-facing job board with a secure, 4-step application form (identity verification via OTP, reCAPTCHA, GitHub OAuth, duplicate detection) |
| **Instant AI CV Scoring** | 7-step scoring pipeline combining GitHub analysis, RAG retrieval, and a single LLM call — results in under 30 seconds |
| **AI Video Interview** | RAG-driven contextual interview engine with speech, acoustic, voice-identity, and facial-presence analysis |
| **Certification Verification** | 3-layer fraud detection: PDF structural analysis, LLM semantic check, Credly OBI API verification |
| **Talent Pool Matching** | AI-powered candidate re-ranking with hybrid local pre-filtering + LLM precision scoring (90% fewer API calls) |
| **Predictive Analytics** | AI-generated summaries, 3-month forecasts, and turnover analysis from historical HR metrics |
| **HR Planning Module** | Interactive calendar, job offer timeline, and intelligent notifications |
| **Employee Management** | One-click transition from qualified candidate to fully managed employee record |
| **Automated LinkedIn Sourcing** | Outbound candidate discovery via n8n/Apify workflow with automatic AI scoring |
| **Multi-Tenant Architecture** | Full data isolation between client companies with 3-tier role hierarchy |

---

## Tech Stack

**Frontend**
- React.js / TypeScript

**Backend**
- Django REST Framework (DRF)
- MySQL (relational data)
- ChromaDB (vector database — RAG + voice embeddings)

**AI / ML**
- LLaMA 3.3 70B (via Groq API)
- `all-MiniLM-L6-v2` — sentence embeddings (CPU-only)
- Whisper — speech-to-text transcription
- librosa — acoustic signal analysis
- Resemblyzer — voice embedding & speaker verification
- face-api.js (TensorFlow.js, TinyFaceDetector) — real-time facial detection

**Infrastructure & DevOps**
- Celery + Redis (asynchronous task queue)
- Cloudinary (interview video storage & delivery)

**Automation & Integrations**
- n8n (RPA workflow orchestration)
- Apify (LinkedIn/Google scraping)
- Google Sheets API
- OAuth 2.0 (GitHub, LinkedIn)
- Credly Open Badge Infrastructure (OBI) API

---

## Architecture

RecrutIA follows a **RESTful, service-oriented architecture** with clear separation between frontend, backend, AI processing, and automation layers.

```
┌─────────────────┐      ┌──────────────────────┐      ┌───────────────────┐
│   React / TS     │ ───▶ │  Django REST Backend  │ ───▶ │      MySQL         │
│   Frontend        │◀─── │   (multi-tenant)      │◀──── │  (relational data) │
└─────────────────┘      └──────────┬───────────┘      └───────────────────┘
                                     │
                    ┌────────────────┼─────────────────┐
                    ▼                ▼                 ▼
            ┌───────────────┐ ┌─────────────┐  ┌────────────────┐
            │   ChromaDB     │ │ Celery/Redis│  │  Groq (LLaMA)   │
            │ (RAG + voice)  │ │ (async tasks)│  │   LLM engine    │
            └───────────────┘ └─────────────┘  └────────────────┘
                    │
            ┌───────┴────────┐
            │  n8n + Apify    │
            │ LinkedIn sourcing│
            └────────────────┘
```

ChromaDB hosts two collections in a single `chroma_db/` store:
- `ats_candidates` — textual documents used for RAG (CVs, cover letters, GitHub content)
- `speaker_profiles` — voice embeddings extracted by Resemblyzer for identity verification

---

## AI Scoring Pipeline

Every submitted application is analyzed automatically through a **7-step pipeline**, completing in under 30 seconds:

1. **PDF Extraction** — raw text extraction from CV, cover letter, and recommendation letters (`pypdf`); scanned/non-extractable PDFs are flagged without halting the pipeline.
2. **GitHub Analysis (no LLM)** — objective, rule-based scoring of tech-stack fit, recent activity, and repository quality; penalizes fork-heavy or low-relevance profiles.
3. **RAG Indexing** — documents chunked into 400-word segments (60-word overlap), embedded via `all-MiniLM-L6-v2`, and indexed in ChromaDB with source metadata. Verified certifications are tagged `[CERTIFICATION VÉRIFIÉE #N]` to prevent confusion with unverified mentions.
4. **RAG Retrieval** — multi-query semantic search (job requirements + concrete evidence), cosine-distance filtering (threshold 0.72), deduplicated and capped at 6,000 characters.
5. **Single LLM Call (Groq / LLaMA 3.3 70B)** — one deterministic call (temperature 0.2), forced structured JSON output covering CV analysis, motivation, soft skills, coherence, certifications, and key projects.
6. **Score Calculation** — weighted formula:

   ```
   Final Score = Σ (weight_i × score_i) − penalties
   ```

   Configurable weights per job offer (CV, motivation, soft skills, GitHub, coherence). Penalties include: declared vs. detected experience mismatch (−10), CV red flags (−5), low coherence score (−5 to −10).
   Decision thresholds: **VALIDATED** (≥80) · **TO_REVIEW** (58–79) · **REJECTED** (<58)

7. **Candidate Messaging** — personalized feedback generated based on strengths, missing skills, and final score; only references sources actually analyzed.

---

## AI Video Interview Engine

A 4-layer architecture powers fully contextual, fraud-resistant AI interviews:

| Layer | Function |
|---|---|
| **Contextual Preparation** | Candidate's CV, cover letter, and GitHub contributions are vectorized into ChromaDB before the interview begins |
| **Intelligent Generation** | RAG engine retrieves relevant candidate context at each stage to generate non-generic, personalized questions |
| **Multimodal Analysis** | Simultaneous transcription (Whisper), acoustic analysis (librosa), and voice-identity verification (Resemblyzer) |
| **Behavioral Security** | Real-time frontend monitoring with backend anomaly flagging |

**Interview structure — 4 progressive phases:**

1. **Communication** (30%) — open-ended, CV-personalized questions on motivation and soft skills
2. **CV Clarification** (20%) — targeted questions on ambiguities or inconsistencies auto-detected in the CV
3. **Technical & Scenario-Based** (30%) — questions grounded in the candidate's real GitHub projects and job-specific technologies
4. **Technical MCQ** (20%) — dynamically generated multiple-choice assessment based on required skills

**Acoustic anomaly detection (librosa):**

| Anomaly | Detection Method | Penalty |
|---|---|---|
| Synthetic voice (TTS) | ZCR std < 0.008 + MFCC variance < 15 | Flagged |
| Background noise | Approximated SNR < 5 (RMS ratio) | −10 pts |
| Double voice / second speaker | F0 std > 40Hz, F0 range > 80Hz, spectral entropy > 5.5 | −25 pts |
| Abnormal silence | Continuous silence > 3s (RMS energy) | −5 pts |

**Voice verification:** Resemblyzer embeddings compared every 12 seconds via cosine similarity against a reference embedding, with persistence in ChromaDB enabling cross-session continuity and duplicate-candidate detection (similarity threshold: 0.73).

**Facial verification:** `face-api.js` + TinyFaceDetector runs fully client-side (no image transmitted to a third-party server), detecting absence, multiple faces, and off-center framing.

**Video archiving:** Interview recordings are automatically uploaded to Cloudinary, keeping the Django backend free of heavy local file storage.

---

## Certification Fraud Detection

RecrutIA applies a **3-layer verification strategy** to reduce document fraud without adding friction for legitimate candidates:

1. **Structural PDF Analysis** — inspects creation metadata, modification dates, and text density to flag suspicious files (e.g., an "AWS certificate" generated from Canva).
2. **LLM Semantic Check** — evaluates temporal coherence (e.g., an AWS certification can't predate 2013), experience-level alignment, and naming conformity against known official certifications.
3. **Credly OBI Verification** — queries the public Credly Open Badge Infrastructure API (no key required) to confirm badge existence, issue date, and expiration for AWS, Google Cloud, Azure, Cisco, and IBM certifications. Non-Credly certifications are flagged for manual HR review.

---

## Dynamic Weighting System

HR managers configure per-job-offer scoring weights across 5 criteria (CV, motivation, soft skills, GitHub, coherence), with the sole constraint that weights sum to 1.0 (±0.01 tolerance).

This allows the platform to fairly adapt scoring logic per role — e.g., a developer role might weight GitHub at 30%, while GitHub can be set to 0% for non-technical roles (accounting, sales) without any code changes.

---

## Automated LinkedIn Sourcing

Introduced in Sprint 7, this module shifts RecrutIA from a **reactive (inbound)** to a **proactive (outbound)** recruitment model.

**Workflow:**
1. React frontend triggers an n8n webhook
2. Google search scraping targets LinkedIn profiles via the Apify API
3. A JavaScript scoring engine extracts and scores profiles automatically
4. Results are persisted to Google Sheets

**Scoring criteria (out of 100):** job title relevance · geographic match · industry alignment.

This enables HR managers to identify and score qualified LinkedIn profiles in seconds — including for roles not yet published — with zero manual search time.

---

## Multi-Tenant Architecture & Roles

RecrutIA enforces complete data isolation between client companies via a central `Company` model, with a 3-tier role hierarchy:

| Role | Scope |
|---|---|
| **RH (HR Manager)** | Manages job offers, candidates, and interviews within their company |
| **ADMIN** | Company-level administrative oversight |
| **SUPERADMIN** | Cross-company, platform-wide visibility and control |

Authentication is handled via JWT with role-based redirection, and OAuth 2.0 integrations (GitHub, LinkedIn) support both candidate verification and profile enrichment.

---

## Sprint Roadmap

| Sprint | Focus |
|---|---|
| **Sprint 1** | JWT authentication, multi-tenant foundation, role-based data isolation |
| **Sprint 2** | Public job portal, secure 4-step application form, anti-fraud safeguards |
| **Sprint 3** | 7-step AI scoring pipeline, dynamic weighting, certification fraud detection |
| **Sprint 4** | AI video interview engine (RAG, Whisper, librosa, Resemblyzer, face-api.js) |
| **Sprint 5** | Qualified candidates space, final interview invitations, employee onboarding |
| **Sprint 6** | Predictive HR analytics, forecasting, turnover analysis, planning module |
| **Sprint 7** | Automated LinkedIn sourcing via n8n/Apify (outbound recruitment) |

---

## Getting Started

> Update the commands below to match your actual local setup (Docker Compose file, service names, ports).

```bash
# Clone the repository
git clone https://github.com/<your-username>/recrutIA.git
cd recrutIA

# Backend (Django)
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend (React)
cd frontend
npm install
npm run dev

# Or run the full stack with Docker
docker-compose up --build
```

## Environment Variables

```env
# Database
DATABASE_URL=

# ChromaDB
CHROMA_PERSIST_DIR=

# LLM (Groq)
GROQ_API_KEY=

# OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# Cloudinary
CLOUDINARY_URL=

# n8n / Apify
N8N_WEBHOOK_URL=
APIFY_API_TOKEN=

# reCAPTCHA
RECAPTCHA_SECRET_KEY=
```

---

## Project Status

Developed as a final-year engineering capstone project (PFE 2025/2026) at Aziin Engineering Solution, Sfax, Tunisia — Software Engineering, ESSAT Gabès.

---

## Author

**Mayssa Ben Romdhane**
Software Engineer — Full Stack & AI
📍 Open to opportunities in France, Belgium, Switzerland, Turkey, and remote roles across Europe

[LinkedIn](#) · [Email](#)
