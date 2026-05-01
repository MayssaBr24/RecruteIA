# services/audio_service.py - VERSION AMÉLIORÉE
import os
import io
import json
import logging
import tempfile
import numpy as np
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import timedelta

logger = logging.getLogger(__name__)


# ==============================================
# DATA CLASSES POUR LES RAPPORTS
# ==============================================

@dataclass
class AudioAnomaly:
    """Anomalie détectée dans l'audio"""
    type: str  # 'double_voice', 'silence', 'robot_voice', 'background_noise'
    timestamp_seconds: float  # Quand l'anomalie se produit
    severity: str  # 'low', 'medium', 'high'
    penalty: int
    description: str

    def to_dict(self):
        return {
            'type': self.type,
            'timestamp': str(timedelta(seconds=int(self.timestamp_seconds))),
            'timestamp_seconds': self.timestamp_seconds,
            'severity': self.severity,
            'penalty': self.penalty,
            'description': self.description
        }


@dataclass
class VoiceAnalysisResult:
    """Résultat complet de l'analyse vocale"""
    success: bool
    text: str
    word_count: int
    duration_seconds: float
    vocal_score: int
    anomalies: List[AudioAnomaly]
    voice_metrics: Dict
    transcript_segments: List[Dict]


# ==============================================
# TRANSCRIPTION — GROQ WHISPER (inchangée)
# ==============================================

def transcribe_audio(audio_file) -> dict:
    try:
        from groq import Groq
        client = Groq(api_key=os.getenv('GROQ_API_KEY'))

        transcription = client.audio.transcriptions.create(
            file=audio_file,
            model="whisper-large-v3",
            language="fr",
            response_format="verbose_json",
            temperature=0.0
        )

        text = transcription.text.strip()
        segments = getattr(transcription, 'segments', [])

        # Formater les segments avec timestamps
        formatted_segments = []
        for seg in segments:
            formatted_segments.append({
                'start': seg.get('start', 0),
                'end': seg.get('end', 0),
                'text': seg.get('text', ''),
                'confidence': seg.get('confidence', 0)
            })

        logger.info(f"✅ Transcription: {len(text)} caractères, {len(segments)} segments")

        return {
            'success': True,
            'text': text,
            'duration_seconds': getattr(transcription, 'duration', 0),
            'segments': formatted_segments,
            'word_count': len(text.split()),
        }
    except Exception as e:
        logger.error(f"Erreur transcription: {e}")
        return {'success': False, 'text': '', 'error': str(e), 'segments': []}


# ==============================================
# DÉTECTION DOUBLE VOIX (NOUVEAU)
# ==============================================
def detect_double_voice(y: np.ndarray, sr: int, hop_length: int = 512) -> List[Tuple[float, float, float]]:
    """
    Détecte les segments où plusieurs voix parlent simultanément.

    Approche robuste en 3 couches :
      1. Ratio harmonique  — deux voix mélangées dégradent la cohérence harmonique
      2. Modulation d'amplitude croisée — deux f0 distincts créent des battements
      3. Variance de pitch inter-frames — instabilité anormale = superposition

    Retourne une liste de (start_sec, end_sec, confidence_pct).
    Ne déclenche PAS sur la parole normale, les pauses, ou les consonnes.
    """
    try:
        import librosa
        from scipy.signal import find_peaks

        frame_length = 2048
        time_per_frame = hop_length / sr
        min_voiced_energy = 0.002          # ignorer les frames silencieuses
        min_segment_duration = 0.25        # ignorer les détections < 250 ms
        merge_gap = 0.4                    # fusionner si écart < 400 ms

        # ── 1. Énergie RMS par frame (filtre silence) ──────────────────────────
        rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]

        # ── 2. Composante harmonique vs percussive ──────────────────────────────
        # margin=8 = séparation agressive : la composante harmonique est très propre
        # pour une seule voix ; deux voix l'altèrent significativement.
        y_harm, y_perc = librosa.effects.hpss(y, margin=8)
        rms_harm = librosa.feature.rms(y=y_harm, frame_length=frame_length, hop_length=hop_length)[0]

        n_frames = min(len(rms), len(rms_harm))

        # ── 3. Pitch tracking (PYIN) ────────────────────────────────────────────
        # fmin/fmax couvrent homme + femme + enfant
        f0, voiced_flag, voiced_probs = librosa.pyin(
            y,
            fmin=librosa.note_to_hz('C2'),   # ~65 Hz
            fmax=librosa.note_to_hz('C6'),   # ~1047 Hz
            sr=sr,
            frame_length=frame_length,
            hop_length=hop_length,
            fill_na=0.0
        )
        n_frames = min(n_frames, len(f0))

        # ── 4. Score de double voix par frame ──────────────────────────────────
        frame_scores = np.zeros(n_frames)

        for i in range(n_frames):
            # Ignorer les frames silencieuses
            if rms[i] < min_voiced_energy:
                continue

            score = 0.0

            # Critère A : ratio harmonique bas pendant la parole voixée
            # Une voix propre → harm_ratio proche de 1
            # Deux voix superposées → interférences → harm_ratio chute
            if rms[i] > 0:
                harm_ratio = rms_harm[i] / (rms[i] + 1e-9)
                voiced_prob = float(voiced_probs[i]) if i < len(voiced_probs) else 0.0

                if harm_ratio < 0.45 and voiced_prob > 0.4:
                    # Basse harmonicité PENDANT la parole = suspect
                    score += (0.45 - harm_ratio) / 0.45 * 50   # jusqu'à 50 pts

            # Critère B : instabilité de pitch sur une fenêtre glissante de 5 frames
            # Une voix stable varie lentement ; deux voix créent des sauts brusques
            if i >= 2 and i < n_frames - 2:
                window_f0 = f0[max(0, i-2): i+3]
                voiced_window = voiced_flag[max(0, i-2): i+3] if i < len(voiced_flag) else []
                active_f0 = window_f0[voiced_window > 0] if len(voiced_window) > 0 else np.array([])

                if len(active_f0) >= 3:
                    f0_std = np.std(active_f0)
                    f0_mean = np.mean(active_f0)
                    # Variation relative > 15% = instabilité anormale
                    relative_variation = f0_std / (f0_mean + 1e-9)
                    if relative_variation > 0.15:
                        score += min(30, relative_variation * 100)   # jusqu'à 30 pts

            # Critère C : énergie percussive élevée SANS transitoire consonantique
            # (les consonnes créent de l'énergie percussive ponctuellement ;
            #  une deuxième voix crée une énergie percussive soutenue)
            perc_ratio = librosa.feature.rms(
                y=y_perc, frame_length=frame_length, hop_length=hop_length
            )[0]
            if i < len(perc_ratio) and rms[i] > 0:
                sustained_perc = perc_ratio[i] / (rms[i] + 1e-9)
                if sustained_perc > 0.35:
                    # Vérifier que ce n'est pas une consonne isolée
                    # (les consonnes durent < 80ms = ~3 frames à hop=512/16000)
                    window_perc = perc_ratio[max(0, i-2): i+3]
                    if np.mean(window_perc / (rms[max(0, i-2): i+3] + 1e-9)) > 0.30:
                        score += min(20, sustained_perc * 40)    # jusqu'à 20 pts

            frame_scores[i] = score

        # ── 5. Seuil de décision et fusion des segments ─────────────────────────
        # Score > 55/100 = double voix probable
        DETECTION_THRESHOLD = 55.0

        raw_segments = []
        for i in range(n_frames):
            if frame_scores[i] >= DETECTION_THRESHOLD:
                ts = i * time_per_frame
                raw_segments.append((ts, frame_scores[i]))

        if not raw_segments:
            return []

        # Fusionner les détections proches
        merged: List[Tuple[float, float, float]] = []
        seg_start, seg_end, seg_conf = raw_segments[0][0], raw_segments[0][0], raw_segments[0][1]

        for ts, conf in raw_segments[1:]:
            if ts - seg_end <= merge_gap:
                seg_end = ts
                seg_conf = max(seg_conf, conf)
            else:
                duration = seg_end - seg_start
                if duration >= min_segment_duration:
                    merged.append((seg_start, seg_end + time_per_frame, min(100, seg_conf)))
                seg_start, seg_end, seg_conf = ts, ts, conf

        # Dernier segment
        duration = seg_end - seg_start
        if duration >= min_segment_duration:
            merged.append((seg_start, seg_end + time_per_frame, min(100, seg_conf)))

        logger.info(f"detect_double_voice : {len(merged)} segment(s) détecté(s)")
        return merged

    except Exception as e:
        logger.error(f"Erreur detect_double_voice: {e}", exc_info=True)
        return []

# ==============================================
# DÉTECTION SILENCES ANORMAUX & COUPURES
# ==============================================

def detect_anomalous_silences(y, sr, frame_length=2048, hop_length=512) -> List[dict]:
    """Détecte les silences trop longs ou les coupures suspectes"""
    import librosa

    rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
    time_per_frame = hop_length / sr

    # Seuil de silence (énergie très faible)
    silence_threshold = np.mean(rms) * 0.2

    # Détecter les zones de silence
    is_silent = rms < silence_threshold

    # Trouver les segments de silence
    anomalies = []
    silence_start = None

    for i, silent in enumerate(is_silent):
        timestamp = i * time_per_frame

        if silent and silence_start is None:
            silence_start = timestamp
        elif not silent and silence_start is not None:
            silence_duration = timestamp - silence_start

            # Silence anormal > 2 secondes
            if silence_duration > 2.0:
                anomalies.append({
                    'type': 'long_silence',
                    'start': silence_start,
                    'end': timestamp,
                    'duration': silence_duration,
                    'severity': 'medium' if silence_duration > 3 else 'low',
                    'penalty': 5 if silence_duration > 3 else 0,
                    'description': f"Silence de {silence_duration:.1f} secondes"
                })
            silence_start = None

    return anomalies


# ==============================================
# DÉTECTION VOIX ROBOTIQUE / SYNTHÉTIQUE
# ==============================================

def detect_synthetic_voice(y, sr) -> Tuple[bool, float]:
    """
    Détecte si la voix semble synthétique/robotique.
    Retourne (is_synthetic, confidence)
    """
    try:
        import librosa

        # 1. Extraire MFCC (caractéristiques vocales)
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)

        # Voix humaine = variation naturelle des MFCC
        mfcc_variance = np.var(mfcc)
        mfcc_std = np.std(mfcc)

        # Voix synthétique = trop stable ou trop bruitée
        is_synthetic = False
        confidence = 0

        if mfcc_variance < 10:  # Trop stable = synthétique
            is_synthetic = True
            confidence = min(100, (10 - mfcc_variance) * 10)
        elif mfcc_variance > 500:  # Trop bruitée = possible distortion
            pass

        # 2. Analyser les formants (fréquences de résonance)
        # Voix synthétique a des formants anormalement réguliers
        D = np.abs(librosa.stft(y))
        spectral_centroids = librosa.feature.spectral_centroid(S=D, sr=sr)
        centroid_variation = np.std(spectral_centroids)

        if centroid_variation < 20:  # Variation trop faible
            is_synthetic = True
            confidence = max(confidence, 50)

        return is_synthetic, confidence

    except Exception as e:
        logger.error(f"Erreur détection voix synthétique: {e}")
        return False, 0


# ==============================================
# DÉTECTION BRUIT DE FOND ANORMAL
# ==============================================

def detect_background_noise(y, sr) -> Optional[dict]:
    """Détecte les bruits de fond suspects"""
    import librosa

    # Séparer parole et bruit de fond (simplifié)
    # On utilise l'énergie dans différentes bandes de fréquence
    stft = librosa.stft(y)

    # Bruit de fond = énergie hors des bandes vocales (homme: 85-180Hz, femme: 165-255Hz)
    freqs = librosa.fft_frequencies(sr=sr)

    # Énergie dans bande vocale vs bruit
    # Correct bands
    voice_band = (freqs >= 80) & (freqs <= 3400)  # full speech band
    noise_band = (freqs > 3400) | (freqs < 60)  # true noise: sub-bass + high-freq hiss

    voice_energy = np.mean(np.abs(stft[voice_band]))
    noise_energy = np.mean(np.abs(stft[noise_band]))

    signal_to_noise = voice_energy / (noise_energy + 0.001)

    if signal_to_noise < 2:  # Bruit presque aussi fort que la voix
        return {
            'type': 'high_background_noise',
            'severity': 'low',
            'penalty': 5,
            'description': f"Bruit de fond élevé (SNR: {signal_to_noise:.1f})"
        }

    return None


# ==============================================
# ANALYSE VOCALE COMPLÈTE AMÉLIORÉE
# ==============================================

def analyze_voice_enhanced(audio_bytes: bytes, duration_seconds: float) -> VoiceAnalysisResult:
    """
    Version améliorée avec détection des anomalies.
    Retourne les métriques + anomalies + timestamps.
    """
    anomalies = []

    try:
        import librosa

        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        # Charger audio
        y, sr = librosa.load(tmp_path, sr=16000, mono=True)
        os.unlink(tmp_path)

        # --- LANCER TOUTES LES DÉTECTIONS ---

        # 1. Détection double voix (CRITIQUE)
        double_voice_segments = detect_double_voice(y, sr)
        for start, end, confidence in double_voice_segments:
            anomalies.append(AudioAnomaly(
                type='double_voice',
                timestamp_seconds=start,
                severity='high',
                penalty=25,
                description=f"Double voix détectée de {start:.1f}s à {end:.1f}s (confiance: {confidence:.0f}%)"
            ))

        # 2. Détection silences anormaux
        silences = detect_anomalous_silences(y, sr)
        for silence in silences:
            anomalies.append(AudioAnomaly(
                type=silence['type'],
                timestamp_seconds=silence['start'],
                severity=silence['severity'],
                penalty=silence['penalty'],
                description=silence['description']
            ))

        # 3. Détection voix synthétique
        is_synthetic, synth_confidence = detect_synthetic_voice(y, sr)
        if is_synthetic:
            anomalies.append(AudioAnomaly(
                type='synthetic_voice',
                timestamp_seconds=0,
                severity='high',
                penalty=15,
                description=f"Voix potentiellement synthétique (confiance: {synth_confidence:.0f}%)"
            ))

        # 4. Détection bruit de fond
        background_noise = detect_background_noise(y, sr)
        if background_noise:
            anomalies.append(AudioAnomaly(
                type=background_noise['type'],
                timestamp_seconds=0,
                severity=background_noise['severity'],
                penalty=background_noise['penalty'],
                description=background_noise['description']
            ))

        # --- MÉTRIQUES VOCALES STANDARD (inchangées) ---
        rms = librosa.feature.rms(y=y)[0]
        mean_energy = float(np.mean(rms))

        zcr = librosa.feature.zero_crossing_rate(y)[0]
        speech_activity = float(np.mean(zcr > 0.01))

        silence_threshold = mean_energy * 0.3
        is_silent = rms < silence_threshold
        silence_ratio = float(np.mean(is_silent))

        transitions = np.diff(is_silent.astype(int))
        pause_count = int(np.sum(transitions == 1))

        try:
            f0, voiced_flag, _ = librosa.pyin(y, fmin=80, fmax=400, sr=sr)
            voiced_f0 = f0[voiced_flag]
            if len(voiced_f0) > 0:
                pitch_stability = max(0, 1 - (float(np.std(voiced_f0)) / max(float(np.mean(voiced_f0)), 1)))
            else:
                pitch_stability = 0.5
        except:
            pitch_stability = 0.5

        energy_score = min(100, int(mean_energy * 5000))

        confidence_score = int(
            energy_score * 0.35 +
            (1 - silence_ratio) * 100 * 0.30 +
            pitch_stability * 100 * 0.20 +
            speech_activity * 100 * 0.15
        )
        confidence_score = max(0, min(100, confidence_score))

        # PÉNALITÉS POUR ANOMALIES
        total_penalty = sum(a.penalty for a in anomalies)
        vocal_score = max(0, min(100, confidence_score - total_penalty))

        voice_metrics = {
            'success': True,
            'confidence_score': confidence_score,
            'confidence_label': 'Très confiant' if confidence_score >= 80 else 'Confiant' if confidence_score >= 60 else 'Hésitant' if confidence_score >= 40 else 'Peu confiant',
            'fluency_score': int((1 - silence_ratio) * 100),
            'fluency_label': 'Très fluide' if (1 - silence_ratio) >= 0.8 else 'Fluide' if (
                                                                                                      1 - silence_ratio) >= 0.6 else 'Quelques hésitations' if (
                                                                                                                                                                           1 - silence_ratio) >= 0.4 else 'Nombreuses hésitations',
            'silence_ratio': round(silence_ratio * 100, 1),
            'pause_count': pause_count,
            'energy_level': round(mean_energy * 1000, 2),
            'pitch_stability': round(pitch_stability * 100, 1),
            'speech_activity': round(speech_activity * 100, 1),
        }

        return VoiceAnalysisResult(
            success=True,
            text='',  # Sera rempli par la transcription
            word_count=0,
            duration_seconds=duration_seconds,
            vocal_score=vocal_score,
            anomalies=anomalies,
            voice_metrics=voice_metrics,
            transcript_segments=[]
        )

    except Exception as e:
        logger.error(f"Erreur analyse vocale améliorée: {e}")
        return VoiceAnalysisResult(
            success=False,
            text='',
            word_count=0,
            duration_seconds=duration_seconds,
            vocal_score=50,
            anomalies=[],
            voice_metrics={'success': False},
            transcript_segments=[]
        )


# ==============================================
# FONCTION PRINCIPALE (API AMÉLIORÉE)
# ==============================================

def analyze_audio_response(audio_file, audio_bytes: bytes) -> dict:
    """
    Pipeline complet amélioré avec détection d'anomalies.
    """
    # 1. Transcription
    transcription = transcribe_audio(audio_file)

    if not transcription['success']:
        return {
            'success': False,
            'error': transcription.get('error', 'Transcription échouée'),
            'anomalies': []
        }

    # 2. Analyse vocale complète (avec anomalies)
    voice_analysis = analyze_voice_enhanced(
        audio_bytes,
        transcription['duration_seconds']
    )

    # 3. Débit de parole
    duration = transcription['duration_seconds']
    word_count = transcription['word_count']
    wpm = int((word_count / duration) * 60) if duration > 0 else 0

    if wpm >= 180:
        wpm_label = 'Très rapide'
    elif wpm >= 140:
        wpm_label = 'Rapide'
    elif wpm >= 100:
        wpm_label = 'Normal'
    elif wpm >= 60:
        wpm_label = 'Lent'
    else:
        wpm_label = 'Très lent'

    # 4. Score vocal final
    vocal_score = int(
        voice_analysis.voice_metrics.get('confidence_score', 50) * 0.50 +
        voice_analysis.voice_metrics.get('fluency_score', 50) * 0.30 +
        min(100, max(0, 100 - abs(wpm - 130))) * 0.20
    )

    # Ajuster pénalités anomalies
    anomaly_penalty = sum(a.penalty for a in voice_analysis.anomalies)
    vocal_score = max(0, vocal_score - anomaly_penalty)

    # 5. Compiler le résultat
    return {
        'success': True,
        'text': transcription['text'],
        'word_count': word_count,
        'duration_seconds': duration,
        'wpm': wpm,
        'wpm_label': wpm_label,
        'vocal_score': vocal_score,
        'voice_metrics': voice_analysis.voice_metrics,
        'anomalies': [a.to_dict() for a in voice_analysis.anomalies],
        'has_double_voice': any(a.type == 'double_voice' for a in voice_analysis.anomalies),
        'has_synthetic_voice': any(a.type == 'synthetic_voice' for a in voice_analysis.anomalies),
        'transcript_segments': transcription.get('segments', [])
    }


# À AJOUTER À LA FIN DE votre audio_service.py

from .speaker_embedding import speaker_analyzer

def analyze_audio_with_speaker_verification(
        audio_file,
        audio_bytes: bytes,
        interview_id: str,
        response_timestamp: float
) -> dict:
    """
    Pipeline complet : analyse standard + vérification d'identité vocale.

    Corrections par rapport à la version précédente :
      - Les pénalités des nouvelles anomalies (speaker_change, multiple_speakers)
        sont calculées SÉPARÉMENT du vocal_score déjà pénalisé par analyze_audio_response.
      - Le champ 'anomalies' final = anomalies existantes + nouvelles anomalies,
        sans double-comptage.
      - Gestion propre des erreurs d'embedding sans planter tout le pipeline.
    """
    from .speaker_embedding import speaker_analyzer

    # ── 1. Analyse standard (transcription + métriques + anomalies audio) ──────
    standard_analysis = analyze_audio_response(audio_file, audio_bytes)

    if not standard_analysis['success']:
        return standard_analysis

    # vocal_score à ce stade est déjà pénalisé par les anomalies audio (double voix, etc.)
    base_vocal_score = standard_analysis.get('vocal_score', 50)
    existing_anomalies: List[dict] = list(standard_analysis.get('anomalies', []))

    # ── 2. Vérification d'identité (embeddings SpeechBrain) ────────────────────
    speaker_consistency: dict = {}
    has_speaker_change = False
    has_multiple_speakers = False
    new_anomalies: List[dict] = []

    try:
        is_consistent, confidence, details = speaker_analyzer.verify_speaker_consistency(
            interview_id=interview_id,
            audio_bytes=audio_bytes,
            timestamp=response_timestamp
        )
        speaker_consistency = {
            'is_consistent': is_consistent,
            'confidence': round(confidence, 1),
            'details': details
        }
        has_speaker_change = not is_consistent

        if not is_consistent and not details.get('is_first', False):
            new_anomalies.append({
                'type': 'speaker_change',
                'timestamp': str(response_timestamp),
                'timestamp_seconds': response_timestamp,
                'severity': 'critical',
                'penalty': 30,
                'description': (
                    f"Changement de locuteur détecté "
                    f"(similarité vocale : {confidence:.0f}% — seuil : "
                    f"{details.get('threshold', 0.65) * 100:.0f}%)"
                ),
                'confidence': round(confidence, 1)
            })

    except Exception as e:
        logger.error(f"Erreur verify_speaker_consistency: {e}", exc_info=True)
        speaker_consistency = {
            'is_consistent': True,
            'confidence': 0,
            'details': {'error': str(e)}
        }

    # ── 3. Détection multi-locuteurs dans le même clip audio ───────────────────
    multiple_speakers_result: dict = {'unique_speakers': 1, 'has_multiple': False, 'segments': []}

    try:
        multiple_speakers_result = speaker_analyzer.detect_multiple_speakers_in_audio(audio_bytes)
        has_multiple_speakers = multiple_speakers_result.get('has_multiple', False)

        if has_multiple_speakers:
            n_speakers = multiple_speakers_result.get('unique_speakers', 2)
            new_anomalies.append({
                'type': 'multiple_speakers_simultaneous',
                'timestamp': str(response_timestamp),
                'timestamp_seconds': response_timestamp,
                'severity': 'high',
                'penalty': 25,
                'description': (
                    f"{n_speakers} locuteurs distincts détectés dans la même réponse audio"
                ),
                'speakers_count': n_speakers
            })

    except Exception as e:
        logger.error(f"Erreur detect_multiple_speakers: {e}", exc_info=True)

    # ── 4. Calcul du vocal_score final sans double-comptage ────────────────────
    # base_vocal_score = déjà pénalisé par les anomalies audio (double voix, etc.)
    # On soustrait UNIQUEMENT les pénalités des NOUVELLES anomalies d'identité.
    additional_penalty = sum(a.get('penalty', 0) for a in new_anomalies)
    final_vocal_score = max(0, base_vocal_score - additional_penalty)

    # ── 5. Résultat consolidé ──────────────────────────────────────────────────
    return {
        **standard_analysis,                          # tous les champs d'origine
        'vocal_score': final_vocal_score,             # score final corrigé
        'anomalies': existing_anomalies + new_anomalies,  # liste complète sans doublons
        'speaker_consistency': speaker_consistency,
        'multiple_speakers': {
            'unique_speakers': multiple_speakers_result.get('unique_speakers', 1),
            'has_multiple': has_multiple_speakers,
            'total_segments_analyzed': multiple_speakers_result.get('total_segments', 0),
        },
        'has_speaker_change': has_speaker_change,
        'has_multiple_speakers': has_multiple_speakers,
        # Flags de commodité pour le frontend
        'identity_flags': {
            'speaker_changed': has_speaker_change,
            'multiple_speakers': has_multiple_speakers,
            'identity_penalty_applied': additional_penalty,
            'requires_hr_review': has_speaker_change or has_multiple_speakers,
        }
    }
def get_interview_speaker_report(interview_id: str) -> dict:
    """
    Génère le rapport de cohérence vocale pour tout l'entretien.
    À utiliser dans le rapport RH final.
    """
    return speaker_analyzer.get_speaker_consistency_report(interview_id)