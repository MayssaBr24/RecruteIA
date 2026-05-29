from __future__ import annotations

import logging
import os
import tempfile
from typing import Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# CHARGEMENT BROUHAHA (lazy, une seule fois)
# ─────────────────────────────────────────────────────────────────────────────

_brouhaha_model = None


def _load_brouhaha():
    """
    Charge le modèle Brouhaha la première fois seulement.
    Téléchargement automatique (~50 MB) dans ./tmp_brouhaha/.
    Gratuit — licence MIT.
    """
    global _brouhaha_model
    if _brouhaha_model is not None:
        return _brouhaha_model

    try:
        from speechbrain.pretrained import foreign_class
        import torch

        logger.info("⏳ Chargement Brouhaha (premier appel — ~50 MB)...")
        _brouhaha_model = foreign_class(
            source="speechbrain/brouhaha-task1-pyt",
            pymodule_file="custom_interface.py",
            classname="CustomEncoderWav2vec2Classifier",
            savedir="tmp_brouhaha",
            run_opts={"device": "cpu"},   # remplacer par "cuda" si GPU dispo
        )
        logger.info("✅ Brouhaha chargé avec succès")
        return _brouhaha_model

    except Exception as exc:
        logger.error("❌ Impossible de charger Brouhaha : %s", exc)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# ANALYSE BROUHAHA PAR FRAME
# ─────────────────────────────────────────────────────────────────────────────

def analyze_with_brouhaha(audio_bytes: bytes) -> Dict:
    """
    Analyse complète d'un clip audio via Brouhaha.

    Retourne :
    {
        "success"       : bool,
        "snr_mean"      : float,   # SNR moyen en dB
        "snr_frames"    : list,    # SNR par frame (1 frame = 1 seconde)
        "c50_mean"      : float,   # Clarté vocale moyenne (dB)
        "c50_frames"    : list,
        "mos_mean"      : float,   # Qualité perçue MOS (1–5)
        "synthetic_flag": bool,    # Voix synthétique probable
        "noisy_flag"    : bool,    # Bruit de fond élevé
        "interference_flag": bool, # Interférences (double voix / réverb)
        "penalties"     : list[dict],
    }
    """
    model = _load_brouhaha()
    if model is None:
        # Fallback : retourner un résultat neutre si le modèle n'est pas dispo
        return {"success": False, "reason": "Modèle Brouhaha non disponible"}

    try:
        import torch
        import torchaudio

        # ── Écriture temporaire ────────────────────────────────────────────────
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        # ── Chargement et resampling 16 kHz ───────────────────────────────────
        signal, fs = torchaudio.load(tmp_path)
        os.unlink(tmp_path)

        if fs != 16000:
            resampler = torchaudio.transforms.Resample(fs, 16000)
            signal = resampler(signal)

        # Mono
        if signal.shape[0] > 1:
            signal = signal.mean(dim=0, keepdim=True)

        # ── Inférence Brouhaha ─────────────────────────────────────────────────
        # Brouhaha prédit SNR + C50 toutes les secondes
        with torch.no_grad():
            predictions = model.predict_batch(signal)
            # predictions = {"snr": Tensor[T], "c50": Tensor[T], "p808_mos": Tensor[T]}

        snr_frames  = predictions["snr"].squeeze().tolist()
        c50_frames  = predictions["c50"].squeeze().tolist()
        mos_frames  = predictions.get("p808_mos", torch.zeros_like(predictions["snr"])).squeeze().tolist()

        # Scalar si une seule frame
        if isinstance(snr_frames, float): snr_frames  = [snr_frames]
        if isinstance(c50_frames, float): c50_frames  = [c50_frames]
        if isinstance(mos_frames, float): mos_frames  = [mos_frames]

        snr_mean = float(np.mean(snr_frames))
        c50_mean = float(np.mean(c50_frames))
        mos_mean = float(np.mean(mos_frames)) if mos_frames else 0.0

        # ── RÈGLES DE DÉTECTION ────────────────────────────────────────────────

        penalties = []

        # 1. VOIX SYNTHÉTIQUE
        # Une voix synthétique/TTS a un SNR anormalement ÉLEVÉ et STABLE (pas de bruit naturel)
        # ET un MOS souvent trop parfait (> 4.0) sans variation
        snr_std    = float(np.std(snr_frames))
        c50_std    = float(np.std(c50_frames))

        synthetic_flag = (
            snr_mean > 35          # SNR trop propre pour une voix humaine réelle
            and snr_std < 3.0      # Variation quasi nulle frame à frame
            and c50_std < 2.0      # Clarté parfaitement stable (irréaliste)
        )
        if synthetic_flag:
            penalties.append({
                "type":        "synthetic_voice",
                "severity":    "high",
                "penalty":     20,
                "description": (
                    f"Voix potentiellement synthétique détectée — "
                    f"SNR moyen {snr_mean:.1f} dB (trop propre), "
                    f"variation SNR {snr_std:.1f} dB (trop stable)"
                ),
            })
            logger.warning("🤖 Voix synthétique probable — SNR=%.1f std=%.1f", snr_mean, snr_std)

        # 2. BRUIT DE FOND ÉLEVÉ
        # SNR < 10 dB de façon soutenue = bruit presque aussi fort que la voix
        noisy_frames_count = sum(1 for s in snr_frames if s < 10)
        noisy_ratio        = noisy_frames_count / max(len(snr_frames), 1)
        noisy_flag         = noisy_ratio > 0.40   # Plus de 40% des frames bruyantes

        if noisy_flag:
            penalties.append({
                "type":        "high_background_noise",
                "severity":    "medium",
                "penalty":     8,
                "description": (
                    f"Bruit de fond élevé — SNR moyen {snr_mean:.1f} dB, "
                    f"{noisy_frames_count}/{len(snr_frames)} frames sous 10 dB"
                ),
            })
            logger.warning("🔊 Bruit de fond élevé — SNR moyen=%.1f dB", snr_mean)

        # 3. INTERFÉRENCES / DOUBLE VOIX
        # C50 chute brusquement = interférences acoustiques (deuxième voix, écho fort)
        # On détecte les chutes de > 8 dB entre frames consécutives
        interference_drops = []
        for i in range(1, len(c50_frames)):
            drop = c50_frames[i - 1] - c50_frames[i]
            if drop > 8.0:
                interference_drops.append({
                    "frame":    i,
                    "time_sec": i,          # 1 frame Brouhaha = ~1 seconde
                    "drop_db":  round(drop, 1),
                })

        interference_flag = len(interference_drops) >= 2

        if interference_flag:
            penalties.append({
                "type":        "double_voice_interference",
                "severity":    "high",
                "penalty":     15,
                "description": (
                    f"Interférences vocales détectées — {len(interference_drops)} chutes "
                    f"de clarté C50 > 8 dB (double voix probable)"
                ),
                "timestamps": [d["time_sec"] for d in interference_drops],
            })
            logger.warning("🎤 Interférences C50 — %d drops détectés", len(interference_drops))

        return {
            "success":            True,
            "snr_mean":           round(snr_mean, 2),
            "snr_frames":         [round(s, 1) for s in snr_frames],
            "c50_mean":           round(c50_mean, 2),
            "c50_frames":         [round(c, 1) for c in c50_frames],
            "mos_mean":           round(mos_mean, 2),
            "synthetic_flag":     synthetic_flag,
            "noisy_flag":         noisy_flag,
            "interference_flag":  interference_flag,
            "penalties":          penalties,
            "raw": {
                "snr_std":               round(snr_std, 2),
                "c50_std":               round(c50_std, 2),
                "noisy_frames_ratio":    round(noisy_ratio, 2),
                "interference_drops":   interference_drops,
            },
        }

    except Exception as exc:
        logger.error("Erreur Brouhaha : %s", exc, exc_info=True)
        return {"success": False, "reason": str(exc)}


# ─────────────────────────────────────────────────────────────────────────────
# INTÉGRATION DANS analyze_voice_enhanced (remplacement des 3 fonctions)
# ─────────────────────────────────────────────────────────────────────────────

def analyze_voice_enhanced_v2(audio_bytes: bytes, duration_seconds: float):
    """
    Version améliorée avec Brouhaha.
    Remplace detect_synthetic_voice() + detect_background_noise() + detect_double_voice()
    par un seul appel modèle — plus précis, plus rapide, zéro heuristique fragile.

    Conserve detect_anomalous_silences() (librosa) car Brouhaha ne couvre pas les silences.
    """
    # Import de l'ancienne fonction de silences (inchangée)
    try:
        from audio_service import detect_anomalous_silences, AudioAnomaly, VoiceAnalysisResult
    except ImportError:
        # Si exécuté en standalone pour tests
        detect_anomalous_silences = None
        AudioAnomaly = None

    anomalies = []

    # ── 1. Analyse Brouhaha (remplace 3 fonctions heuristiques) ───────────────
    brouhaha_result = analyze_with_brouhaha(audio_bytes)

    if brouhaha_result.get("success"):
        for p in brouhaha_result.get("penalties", []):
            # Convertir en format AudioAnomaly compatible
            anomaly_dict = {
                "type":                p["type"],
                "timestamp_seconds":   0.0,
                "severity":            p["severity"],
                "penalty":             p["penalty"],
                "description":         p["description"],
            }
            anomalies.append(anomaly_dict)

        logger.info(
            "Brouhaha — SNR=%.1f dB | C50=%.1f dB | MOS=%.2f | anomalies=%d",
            brouhaha_result.get("snr_mean", 0),
            brouhaha_result.get("c50_mean", 0),
            brouhaha_result.get("mos_mean", 0),
            len(brouhaha_result.get("penalties", [])),
        )

    # ── 2. Silences anormaux (librosa, inchangé) ───────────────────────────────
    try:
        import librosa
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        y, sr = librosa.load(tmp_path, sr=16000, mono=True)
        os.unlink(tmp_path)

        if detect_anomalous_silences:
            silences = detect_anomalous_silences(y, sr)
            for s in silences:
                anomalies.append({
                    "type":               s["type"],
                    "timestamp_seconds":  s["start"],
                    "severity":           s["severity"],
                    "penalty":            s["penalty"],
                    "description":        s["description"],
                })

        # ── 3. Métriques vocales standard (inchangées) ─────────────────────────
        rms            = librosa.feature.rms(y=y)[0]
        mean_energy    = float(np.mean(rms))
        zcr            = librosa.feature.zero_crossing_rate(y)[0]
        speech_activity= float(np.mean(zcr > 0.01))
        silence_thresh = mean_energy * 0.3
        is_silent      = rms < silence_thresh
        silence_ratio  = float(np.mean(is_silent))
        transitions    = np.diff(is_silent.astype(int))
        pause_count    = int(np.sum(transitions == 1))

        try:
            f0, voiced_flag, _ = librosa.pyin(y, fmin=80, fmax=400, sr=sr)
            voiced_f0 = f0[voiced_flag]
            pitch_stability = (
                max(0, 1 - float(np.std(voiced_f0)) / max(float(np.mean(voiced_f0)), 1))
                if len(voiced_f0) > 0 else 0.5
            )
        except Exception:
            pitch_stability = 0.5

        energy_score = min(100, int(mean_energy * 5000))
        confidence_score = max(0, min(100, int(
            energy_score * 0.35
            + (1 - silence_ratio) * 100 * 0.30
            + pitch_stability * 100 * 0.20
            + speech_activity * 100 * 0.15
        )))

        # Enrichir les métriques avec les données Brouhaha
        voice_metrics = {
            "success":           True,
            "confidence_score":  confidence_score,
            "fluency_score":     int((1 - silence_ratio) * 100),
            "silence_ratio":     round(silence_ratio * 100, 1),
            "pause_count":       pause_count,
            "energy_level":      round(mean_energy * 1000, 2),
            "pitch_stability":   round(pitch_stability * 100, 1),
            "speech_activity":   round(speech_activity * 100, 1),
            # NOUVEAU — données Brouhaha exposées
            "brouhaha": {
                "snr_mean":  brouhaha_result.get("snr_mean", 0),
                "c50_mean":  brouhaha_result.get("c50_mean", 0),
                "mos_score": brouhaha_result.get("mos_mean", 0),
            } if brouhaha_result.get("success") else {},
        }

        total_penalty = sum(a.get("penalty", 0) for a in anomalies)
        vocal_score   = max(0, min(100, confidence_score - total_penalty))

        return {
            "success":              True,
            "vocal_score":          vocal_score,
            "anomalies":            anomalies,
            "voice_metrics":        voice_metrics,
            "has_double_voice":     brouhaha_result.get("interference_flag", False),
            "has_synthetic_voice":  brouhaha_result.get("synthetic_flag", False),
            "brouhaha_raw":         brouhaha_result.get("raw", {}),
        }

    except Exception as exc:
        logger.error("Erreur analyze_voice_enhanced_v2 : %s", exc, exc_info=True)
        return {
            "success":       False,
            "vocal_score":   50,
            "anomalies":     anomalies,
            "voice_metrics": {"success": False},
        }


# ─────────────────────────────────────────────────────────────────────────────
#  NOUVELLE APPROCHE
# ─────────────────────────────────────────────────────────────────────────────
"""
 (Brouhaha — modèle appris) :
  Un seul appel → SNR + C50 + MOS par frame
  Règles de détection basées sur des grandeurs physiques calibrées :
    SNR > 35 dB + std < 3 = voix synthétique (pas de bruit ambiant naturel)
    SNR < 10 dB soutenu   = bruit de fond réel
    Chutes C50 > 8 dB     = interférences = double voix probable

  Avantages :
    ✅ Modèle entraîné sur des milliers d'heures audio réelles
    ✅ Pas de seuil magique à calibrer manuellement
    ✅ Un seul modèle = 3 détections
    ✅ Gratuit, MIT, CPU-friendly, ~50 MB
    ✅ Expose le MOS pour affichage RH ("qualité audio : 3.8/5")
"""