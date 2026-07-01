"""
=================
Génération du rapport RH complet pour un entretien IA.

Contenu du rapport :
  1. Résumé exécutif (candidat, poste, score global, recommandation)
  2. Scores détaillés par phase avec justifications
  3. Transcription complète Q/R (toutes phases orales)
  4. Analyse vocale détaillée (métriques + anomalies horodatées)
  5. Warnings de sécurité (type, moment exact, détails)
  6. Incohérences de profil (non pénalisantes, à explorer)
  7. QCM : questions + réponses du candidat + corrections
  8. Recommandation finale (IA + override RH)
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _fmt_seconds(seconds: float) -> str:
    """Formate en mm:ss."""
    if not seconds:
        return "00:00"
    return str(timedelta(seconds=int(seconds)))[2:7]  # mm:ss


def _reco_label(reco: str) -> str:
    return {
        "VALIDATED": "✅ Candidat validé",
        "TO_REVIEW": "🟡 À revoir en entretien humain",
        "REJECTED":  "❌ Candidat rejeté",
        "PENDING":   "⏳ En attente d'évaluation",
    }.get(reco, reco)


def _severity_icon(sev: str) -> str:
    return {"low": "🔵", "medium": "🟡", "high": "🔴", "critical": "⛔"}.get(sev, "⚪")


def _phase_label(phase: str) -> str:
    return {
        "communication":    "Communication & Motivation",
        "cv_clarification": "Clarification du parcours",
        "technical":        "Questions techniques orales",
        "scenario":         "Mises en situation",
        "qcm":              "QCM technique",
    }.get(phase, phase.capitalize())


# ─────────────────────────────────────────────────────────────────────────────
# CONSTRUCTION DES SECTIONS DU RAPPORT
# ─────────────────────────────────────────────────────────────────────────────

def build_report_data(interview, profile_inconsistencies: list = None) -> Dict[str, Any]:
    """
    Construit un dict structuré contenant toutes les données du rapport.
    Ce dict est renvoyé directement par l'API et consommé par le frontend React.
    """
    application = interview.application
    offer       = application.job_offer

    # ── Score final & recommandation ──────────────────────────────────────────
    final_score  = interview.ai_interview_score or 0
    ai_reco      = _extract_reco(interview.ai_interview_feedback)
    final_reco   = getattr(interview, "override_recommendation", None) or ai_reco

    # ── Breakdown des scores ──────────────────────────────────────────────────
    vocal_score  = _extract_vocal_score(interview.transcript)
    scores = {
        "communication": interview.communication_score or 0,
        "cv_clarification": interview.clarification_score or 0,
        "technical":     getattr(interview, "technical_score", None) or 0,
        "scenario":      getattr(interview, "scenario_score", None) or 0,
        "qcm":           interview.qcm_score or 0,
        "vocal":         vocal_score,
        "global":        final_score,
    }

    # ── Transcription Q/R par phase ───────────────────────────────────────────
    transcript_by_phase = _build_transcript_sections(interview.transcript)

    # ── Analyse vocale ────────────────────────────────────────────────────────
    voice_analysis = _build_voice_analysis(interview.transcript)

    # ── Warnings de sécurité ──────────────────────────────────────────────────
    warnings = _build_warnings(interview)

    # ── QCM détaillé ─────────────────────────────────────────────────────────
    qcm_detail = _build_qcm_detail(interview)

    # ── Incohérences de profil ────────────────────────────────────────────────
    inconsistencies_data = []
    if profile_inconsistencies:
        for inc in profile_inconsistencies:
            inconsistencies_data.append({
                "type":               inc.type.value,
                "description":        inc.description,
                "severity":           inc.severity,
                "suggested_question": inc.suggested_question,
                "rh_note":            inc.rh_note,
            })

    # ── Durée totale ─────────────────────────────────────────────────────────
    duration_seconds = 0
    if interview.started_at and interview.completed_at:
        duration_seconds = (interview.completed_at - interview.started_at).total_seconds()

    return {
        # Méta
        "generated_at":    _now_iso(),
        "interview_token": str(interview.token),
        "interview_id":    interview.id,
        "status":          interview.status,

        # Candidat
        "candidate": {
            "id":               application.id,
            "full_name":        application.full_name,
            "email":            application.email or "",
            "phone":            getattr(application, "phone", "") or "",
            "current_position": application.current_position or "",
            "experience_years": application.experience_years or 0,
            "degree":           application.degree_level or "",
            "university":       application.university or "",
            "location":         application.current_location or "",
            "linkedin_url":     str(application.linkedin_url) if application.linkedin_url else "",
            "github_username":  application.github_username or "",
            "ai_summary":       application.ai_summary or "",
            "ai_strengths":     application.ai_strengths or [],
            "ai_weaknesses":    application.ai_weaknesses or [],
            "ai_missing_skills":application.ai_missing_skills or [],
        },

        # Offre
        "job_offer": {
            "id":           offer.id,
            "title":        offer.title,
            "domain":       getattr(offer, "domain", "") or "",
            "requirements": getattr(offer, "requirements", "") or "",
            "city":         getattr(offer, "city", "") or "",
        },

        # Timing
        "timing": {
            "started_at":       interview.started_at.isoformat() if interview.started_at else None,
            "completed_at":     interview.completed_at.isoformat() if interview.completed_at else None,
            "duration_seconds": int(duration_seconds),
            "duration_label":   _fmt_seconds(duration_seconds),
        },

        # Scores
        "scores":           scores,
        "score_breakdown":  _build_score_breakdown(interview, scores),

        # Transcription
        "transcript_phases": transcript_by_phase,

        # Vocal
        "voice_analysis":    voice_analysis,

        # Sécurité
        "security_warnings": warnings,

        # QCM
        "qcm_detail":        qcm_detail,

        # Incohérences profil
        "profile_inconsistencies": inconsistencies_data,

        # Recommandation
        "recommendation": {
            "ai_recommendation":       ai_reco,
            "override_recommendation": getattr(interview, "override_recommendation", None),
            "final_recommendation":    final_reco,
            "rh_annotation":           getattr(interview, "rh_annotation", None),
            "rh_rating":               getattr(interview, "rh_rating", None),
            "ai_feedback_full":        interview.ai_interview_feedback or "",
        },

        # Vidéo
        "has_video": bool(interview.video_url),
    }


def _build_transcript_sections(transcript: list) -> List[Dict]:
    """
    Organise le transcript brut en sections par phase.
    Chaque entrée Q/R est enrichie avec les métriques vocales adjacentes.
    """
    phases_order = ["communication", "cv_clarification", "technical", "scenario"]
    phase_entries: Dict[str, List] = {ph: [] for ph in phases_order}

    # Indexer les analyses vocales par timestamp approx
    voice_analyses = [e for e in transcript if e.get("type") == "voice_analysis"]

    for entry in transcript:
        if entry.get("type") == "voice_analysis":
            continue
        phase = entry.get("phase", "")
        if phase in phase_entries:
            # Chercher l'analyse vocale la plus proche (même phase)
            q_index = entry.get("question_index", 0)
            matching_voice = next(
                (v for v in voice_analyses
                 if v.get("phase") == phase and v.get("question_index") == q_index),
                None,
            )
            phase_entries[phase].append({
                "question_index":      entry.get("question_index", 0),
                "question":            entry.get("question", ""),
                "answer":              entry.get("answer", ""),
                "response_time_sec":   entry.get("response_time_seconds", 0),
                "response_time_label": _fmt_seconds(entry.get("response_time_seconds", 0)),
                "timestamp":           entry.get("timestamp", ""),
                # Métriques vocales si dispo
                "vocal_score":         matching_voice.get("vocal_score") if matching_voice else None,
                "voice_metrics":       matching_voice.get("voice_metrics") if matching_voice else None,
                "word_count":          matching_voice.get("word_count") if matching_voice else None,
            })

    sections = []
    for phase in phases_order:
        entries = phase_entries[phase]
        if not entries:
            continue
        sections.append({
            "phase":       phase,
            "phase_label": _phase_label(phase),
            "entries":     entries,
            "count":       len(entries),
        })
    return sections


def _build_voice_analysis(transcript: list) -> Dict:
    """
    Agrège toutes les analyses vocales du transcript.
    """
    voice_entries = [e for e in transcript if e.get("type") == "voice_analysis"]

    if not voice_entries:
        return {"available": False, "entries": [], "summary": {}}

    all_scores     = [e.get("vocal_score", 0) for e in voice_entries if e.get("vocal_score") is not None]
    all_wpm        = [e.get("voice_metrics", {}).get("wpm", 0) for e in voice_entries if e.get("voice_metrics")]
    all_confidence = [e.get("voice_metrics", {}).get("confidence_score", 0) for e in voice_entries if e.get("voice_metrics")]
    all_fluency    = [e.get("voice_metrics", {}).get("fluency_score", 0) for e in voice_entries if e.get("voice_metrics")]
    all_anomalies  = []

    for e in voice_entries:
        for a in (e.get("anomalies") or []):
            all_anomalies.append({
                **a,
                "phase": e.get("phase", ""),
                "phase_label": _phase_label(e.get("phase", "")),
            })

    def avg(lst): return round(sum(lst) / len(lst), 1) if lst else 0

    entries_formatted = []
    for idx, e in enumerate(voice_entries):
        m = e.get("voice_metrics") or {}
        entries_formatted.append({
            "index":              idx + 1,
            "phase":              e.get("phase", ""),
            "phase_label":        _phase_label(e.get("phase", "")),
            "vocal_score":        e.get("vocal_score", 0),
            "word_count":         e.get("word_count", 0),
            "duration_seconds":   e.get("duration_seconds", 0),
            "duration_label":     _fmt_seconds(e.get("duration_seconds", 0)),
            "timestamp":          e.get("timestamp", ""),
            "wpm":                m.get("wpm", 0),
            "wpm_label":          m.get("wpm_label", ""),
            "confidence_score":   m.get("confidence_score", 0),
            "confidence_label":   m.get("confidence_label", ""),
            "fluency_score":      m.get("fluency_score", 0),
            "fluency_label":      m.get("fluency_label", ""),
            "pitch_stability":    m.get("pitch_stability", 0),
            "speech_activity":    m.get("speech_activity", 0),
            "silence_ratio":      m.get("silence_ratio", 0),
            "pause_count":        m.get("pause_count", 0),
            "anomalies":          e.get("anomalies") or [],
            # Identité vocale
            "speaker_consistent": (e.get("speaker_consistency") or {}).get("is_consistent", True),
            "speaker_confidence": (e.get("speaker_consistency") or {}).get("confidence", 100),
            "has_speaker_change": e.get("has_speaker_change", False),
            "has_double_voice":   e.get("has_double_voice", False),
        })

    return {
        "available": True,
        "entries":   entries_formatted,
        "anomalies": all_anomalies,
        "summary": {
            "avg_vocal_score":    avg(all_scores),
            "avg_wpm":            avg(all_wpm),
            "avg_confidence":     avg(all_confidence),
            "avg_fluency":        avg(all_fluency),
            "total_anomalies":    len(all_anomalies),
            "has_double_voice":   any(a.get("type") == "double_voice" for a in all_anomalies),
            "has_speaker_change": any(a.get("type") == "speaker_change" for a in all_anomalies),
            "critical_anomalies": [a for a in all_anomalies if a.get("severity") in ("high", "critical")],
        },
    }


def _build_warnings(interview) -> Dict:
    """
    Construit la section warnings de sécurité.
    """
    django_warnings = list(interview.warnings.all().order_by("timestamp"))
    TYPE_LABELS = {
        "face_not_visible":   "Visage non visible",
        "multiple_faces":     "Plusieurs visages détectés",
        "face_not_centered":  "Visage hors cadre",
        "tab_switch":         "Changement d'onglet",
        "window_blur":        "Perte de focus fenêtre",
        "fullscreen_exit":    "Sortie plein écran",
        "copy_paste":         "Copier-coller détecté",
        "double_voice":       "Double voix audio",
        "remote_access":      "Accès distant détecté",
        "anydesk_teamviewer": "AnyDesk / TeamViewer",
        "multi_screen":       "Multi-écran détecté",
        "vm_detected":        "Machine virtuelle détectée",
        "robot_mouse":        "Souris automatisée (bot)",
        "time_exceeded":      "Dépassement du temps",
        "screen_share_stopped": "Partage écran arrêté",
        "phone_detected":     "Téléphone détecté",
    }

    SEVERITY_MAP = {
        "face_not_visible":   "medium",
        "multiple_faces":     "high",
        "tab_switch":         "high",
        "copy_paste":         "high",
        "double_voice":       "critical",
        "remote_access":      "critical",
        "anydesk_teamviewer": "critical",
        "vm_detected":        "critical",
        "robot_mouse":        "critical",
        "multi_screen":       "high",
        "window_blur":        "medium",
        "fullscreen_exit":    "medium",
        "time_exceeded":      "medium",
    }

    entries = []
    for w in django_warnings:
        wtype    = w.warning_type
        severity = SEVERITY_MAP.get(wtype, "medium")
        ts = getattr(w, 'created_at', None) or getattr(w, 'timestamp', None)

        entries.append({
            "id":           w.id,
            "type":         wtype,
            "label":        TYPE_LABELS.get(wtype, wtype),
            "severity":     severity,
            "severity_icon": _severity_icon(severity),
            "details":      w.details or "",
            "created_at": ts.isoformat() if ts else "",
            "penalty_pts":  5,
        })

    total_penalty = min(len(entries) * 5, 15)
    terminated    = interview.status == "fraud_terminated"

    return {
        "entries":          entries,
        "count":            len(entries),
        "total_penalty":    total_penalty,
        "terminated":       terminated,
        "termination_reason": interview.ai_interview_feedback if terminated else None,
        "by_severity": {
            "critical": [e for e in entries if e["severity"] == "critical"],
            "high":     [e for e in entries if e["severity"] == "high"],
            "medium":   [e for e in entries if e["severity"] == "medium"],
            "low":      [e for e in entries if e["severity"] == "low"],
        },
    }


def _build_qcm_detail(interview) -> Dict:
    """
    Détail du QCM : chaque question avec réponse candidat et correction.
    """
    questions = interview.qcm_questions or []
    answers   = interview.qcm_answers or {}

    if not questions:
        return {"available": False, "questions": [], "score": 0, "correct": 0, "total": 0}

    items = []
    correct_count = 0

    for idx, q in enumerate(questions):
        if not isinstance(q, dict):
            continue
        candidate_answer = answers.get(str(idx))
        correct_idx      = q.get("correct", 0)
        is_correct       = candidate_answer == correct_idx

        if is_correct:
            correct_count += 1

        options = q.get("options", [])
        items.append({
            "index":              idx,
            "question":           q.get("question", ""),
            "options":            options,
            "correct_index":      correct_idx,
            "correct_option":     options[correct_idx] if 0 <= correct_idx < len(options) else "",
            "candidate_index":    candidate_answer,
            "candidate_option":   options[candidate_answer] if candidate_answer is not None and 0 <= candidate_answer < len(options) else "Non répondu",
            "is_correct":         is_correct,
            "difficulty":         q.get("difficulty", "medium"),
            "domain":             q.get("domain", ""),
            "explanation":        q.get("explanation", ""),
        })

    total = len(items)
    return {
        "available":    True,
        "questions":    items,
        "score":        interview.qcm_score or 0,
        "correct":      correct_count,
        "total":        total,
        "by_difficulty": {
            "easy":   [q for q in items if q["difficulty"] == "easy"],
            "medium": [q for q in items if q["difficulty"] == "medium"],
            "hard":   [q for q in items if q["difficulty"] == "hard"],
        },
        "by_domain": _group_by_domain(items),
    }


def _group_by_domain(items: list) -> Dict:
    result: Dict[str, list] = {}
    for item in items:
        d = item.get("domain") or "Général"
        result.setdefault(d, []).append(item)
    return result


def _build_score_breakdown(interview, scores: Dict) -> List[Dict]:
    """
    Tableau des scores avec poids et justifications.
    """
    has_vocal = scores.get("vocal") is not None
    has_technical = (scores.get("technical") or 0) > 0

    if has_technical and has_vocal:
        WEIGHTS = {"communication": (0.19, "Communication"), "cv_clarification": (0.14, "Parcours CV"),
                   "technical": (0.24, "Technique oral"), "scenario": (0.19, "Scénarios"), "qcm": (0.19, "QCM")}
    elif has_technical:
        WEIGHTS = {"communication": (0.20, "Communication"), "cv_clarification": (0.15, "Parcours CV"),
                   "technical": (0.25, "Technique oral"), "scenario": (0.20, "Scénarios"), "qcm": (0.20, "QCM")}
    elif has_vocal:
        WEIGHTS = {"communication": (0.24, "Communication"), "cv_clarification": (0.19, "Parcours CV"),
                   "technical": (0.00, "Technique oral"), "scenario": (0.24, "Scénarios"), "qcm": (0.28, "QCM")}
    else:
        WEIGHTS = {"communication": (0.25, "Communication"), "cv_clarification": (0.20, "Parcours CV"),
                   "technical": (0.00, "Technique oral"), "scenario": (0.25, "Scénarios"), "qcm": (0.30, "QCM")}

    breakdown = []
    for key, (weight, label) in WEIGHTS.items():
        score = scores.get(key, 0) or 0
        breakdown.append({
            "phase":        key,
            "label":        label,
            "score":        score,
            "weight":       weight,
            "contribution": round(score * weight, 1),
            "bar_width":    score,
        })

    if scores.get("vocal") is not None:
        breakdown.append({
            "phase":       "vocal",
            "label":       "Vocal",
            "score":       scores["vocal"],
            "weight":      0.05,
            "contribution": round(scores["vocal"] * 0.05, 1),
            "bar_width":   scores["vocal"],
        })
    return breakdown

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS INTERNES
# ─────────────────────────────────────────────────────────────────────────────

def _extract_reco(feedback_text: str) -> str:
    if not feedback_text:
        return "PENDING"
    for tag in ["VALIDATED", "TO_REVIEW", "REJECTED"]:
        if f"[{tag}]" in feedback_text:
            return tag
    return "PENDING"


def _extract_vocal_score(transcript: list):
    vocal  = [e for e in transcript if e.get("type") == "voice_analysis"]
    scores = [e.get("vocal_score", 0) for e in vocal if e.get("vocal_score") is not None]
    return int(sum(scores) / len(scores)) if scores else None


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()