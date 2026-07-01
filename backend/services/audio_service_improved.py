from __future__ import annotations

import logging
from typing import Dict
import numpy as np

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# CHARGEMENT BROUHAHA (lazy, une seule fois)
# ─────────────────────────────────────────────────────────────────────────────

_brouhaha_model = None

def _load_brouhaha():
    logger.warning("⚠️ Brouhaha désactivé — repo HuggingFace inaccessible")
    return None


# ─────────────────────────────────────────────────────────────────────────────
# ANALYSE BROUHAHA PAR FRAME
# ─────────────────────────────────────────────────────────────────────────────
def analyze_with_brouhaha(audio_bytes: bytes) -> Dict:
    try:
        import librosa, numpy as np, tempfile, os

        import subprocess, soundfile as sf, tempfile as _tf

        with _tf.NamedTemporaryFile(suffix='.webm', delete=False) as _tin:
            _tin.write(audio_bytes)
            _tin_path = _tin.name
        _wav_path = _tin_path.replace('.webm', '_b.wav')
        try:
            subprocess.run(
                ['ffmpeg', '-y', '-i', _tin_path, '-ar', '16000', '-ac', '1', '-f', 'wav', _wav_path],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True,
            )
            y, sr = sf.read(_wav_path, dtype='float32')
        except Exception:
            import librosa
            y, sr = librosa.load(_tin_path, sr=16000, mono=True)
        finally:
            for _p in (_tin_path, _wav_path):
                try:
                    os.unlink(_p)
                except FileNotFoundError:
                    pass

        penalties = []

        # Détection bruit de fond (SNR approx)
        rms = librosa.feature.rms(y=y)[0]
        snr_approx = float(np.max(rms) / (np.min(rms) + 1e-8))
        if snr_approx < 5:
            penalties.append({
                "type": "background_noise", "severity": "medium",
                "penalty": 10, "description": "Bruit de fond détecté"
            })

        zcr = librosa.feature.zero_crossing_rate(y)[0]
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_var = float(np.mean(np.var(mfcc, axis=1)))

        # Voix synthétique = ZCR trop régulière ET variance MFCC très faible
        is_synthetic = float(np.std(zcr)) < 0.008 and mfcc_var < 15.0
        if is_synthetic:
            penalties.append({
                "type": "synthetic_voice", "severity": "medium",
                "penalty": 20, "description": "Voix anormalement régulière (TTS suspect)"
            })

        synthetic_flag = is_synthetic

        return {"success": True, "penalties": penalties,
                "interference_flag": False,
                "synthetic_flag": synthetic_flag,
                "snr_mean": snr_approx}

    except Exception as e:
        return {"success": False, "reason": str(e)}
# ─────────────────────────────────────────────────────────────────────────────
# INTÉGRATION DANS analyze_voice_enhanced (remplacement des 3 fonctions)
# ─────────────────────────────────────────────────────────────────────────────

def analyze_voice_enhanced_v2(audio_bytes: bytes, duration_seconds: float):

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

        try:
            from .audio_service import _webm_to_wav
        except ImportError:
            from audio_service import _webm_to_wav

        y, sr = _webm_to_wav(audio_bytes)

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

