
from __future__ import annotations

import logging
import os
import subprocess
import tempfile
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import numpy as np
import chromadb
from chromadb.config import Settings

os.environ["ANONYMIZED_TELEMETRY"] = "False"
os.environ["CHROMA_TELEMETRY"] = "False"

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

CHROMA_PERSIST_DIR  = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
SPEAKER_COLLECTION  = "speaker_profiles"
EMBED_DIM           = 256          # dimension Resemblyzer (vs 192 SpeechBrain)
SIM_THRESHOLD       = 0.75         # seuil similarité cosinus (Resemblyzer est plus discriminant)
DUPLICATE_THRESHOLD = 0.88         # seuil détection doublon inter-entretiens
SUDDEN_DROP         = 0.20         # chute brusque de similarité → alerte

# ─────────────────────────────────────────────────────────────────────────────
# SINGLETON CHROMADB
# ─────────────────────────────────────────────────────────────────────────────

_chroma_client      = None
_speaker_collection = None


def _get_speaker_collection():
    global _chroma_client, _speaker_collection
    if _speaker_collection is not None:
        return _speaker_collection

    from pathlib import Path
    Path(CHROMA_PERSIST_DIR).mkdir(parents=True, exist_ok=True)

    _chroma_client = chromadb.PersistentClient(
        path=CHROMA_PERSIST_DIR,
        settings=Settings(anonymized_telemetry=False, allow_reset=True),
    )
    _speaker_collection = _chroma_client.get_or_create_collection(
        name=SPEAKER_COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )
    logger.info(
        "✅ Collection ChromaDB '%s' prête — %d embeddings vocaux",
        SPEAKER_COLLECTION, _speaker_collection.count(),
    )
    return _speaker_collection


# ─────────────────────────────────────────────────────────────────────────────
# SINGLETON RESEMBLYZER
# ─────────────────────────────────────────────────────────────────────────────

_encoder = None


def _get_encoder():
    """
    Charge Resemblyzer une seule fois (singleton).
    Le modèle pèse ~17 MB et se charge en ~1s sur CPU.
    """
    global _encoder
    if _encoder is not None:
        return _encoder
    try:
        from resemblyzer import VoiceEncoder
        logger.info("⏳ Chargement Resemblyzer VoiceEncoder...")
        _encoder = VoiceEncoder(device="cpu")
        logger.info("✅ Resemblyzer chargé (CPU, embeddings 256-D)")
        return _encoder
    except ImportError:
        logger.error(
            "❌ Resemblyzer non installé. "
            "Exécute : pip install git+https://github.com/resemble-ai/Resemblyzer.git"
        )
        return None
    except Exception as exc:
        logger.error("❌ Impossible de charger Resemblyzer : %s", exc)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# UTILITAIRES AUDIO
# ─────────────────────────────────────────────────────────────────────────────

def _audio_bytes_to_wav_array(audio_bytes: bytes) -> Tuple[Optional[np.ndarray], int]:
    """
    Convertit n'importe quel format (webm, ogg, mp4…) en numpy array PCM 16kHz mono.
    Utilise ffmpeg → soundfile (même pipeline que audio_service.py).
    Retourne (array float32, sample_rate) ou (None, 0) si échec.
    """
    import soundfile as sf

    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp_in:
        tmp_in.write(audio_bytes)
        tmp_in_path = tmp_in.name

    tmp_out_path = tmp_in_path.replace(".webm", "_spk.wav")

    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", tmp_in_path,
             "-ar", "16000", "-ac", "1", "-f", "wav", tmp_out_path],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )
        y, sr = sf.read(tmp_out_path, dtype="float32")
        return y, sr

    except subprocess.CalledProcessError as exc:
        logger.error("[Speaker] ffmpeg échoué : %s", exc)
        # Fallback librosa
        try:
            import librosa
            y, sr = librosa.load(tmp_in_path, sr=16000, mono=True)
            return y, sr
        except Exception as e2:
            logger.error("[Speaker] Fallback librosa échoué : %s", e2)
            return None, 0

    finally:
        for p in (tmp_in_path, tmp_out_path):
            try:
                os.unlink(p)
            except FileNotFoundError:
                pass


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


# ─────────────────────────────────────────────────────────────────────────────
# ANALYSEUR VOCAL — Resemblyzer + ChromaDB
# ─────────────────────────────────────────────────────────────────────────────

class SpeakerEmbeddingAnalyzerV2:


    # ── Extraction embedding ───────────────────────────────────────────────────

    def extract_embedding(self, audio_bytes: bytes) -> Optional[np.ndarray]:
        """
        Extrait un embedding voix 256-D depuis un clip audio.

        Resemblyzer découpe le clip en frames de 160ms et produit
        un embedding moyen robuste aux variations de prosodie.
        Durée minimale recommandée : 1.5s. En dessous → résultat moins fiable.
        """
        encoder = _get_encoder()
        if encoder is None:
            return None

        try:
            from resemblyzer import preprocess_wav

            y, sr = _audio_bytes_to_wav_array(audio_bytes)
            if y is None or len(y) < sr * 0.5:
                logger.warning("[Speaker] Audio trop court pour embedding fiable (<0.5s)")
                return None

            # preprocess_wav : normalisation + VAD Resemblyzer
            wav = preprocess_wav(y, source_sr=sr)
            if len(wav) < 1600:  # moins de 0.1s après VAD
                logger.warning("[Speaker] Audio silencieux après VAD")
                return None

            embedding = encoder.embed_utterance(wav)
            return embedding  # shape (256,) float32

        except Exception as exc:
            logger.error("[Speaker] Erreur extract_embedding : %s", exc)
            return None

    # ── Persistance ChromaDB ───────────────────────────────────────────────────

    def _save_embedding(
        self,
        interview_id: str,
        embedding:    np.ndarray,
        timestamp:    float,
        is_reference: bool,
        similarity:   float,
        candidate_id: Optional[str] = None,
    ) -> str:
        collection = _get_speaker_collection()
        chroma_id  = f"{interview_id}_{timestamp:.3f}"
        try:
            collection.upsert(
                ids        = [chroma_id],
                embeddings = [embedding.tolist()],
                metadatas  = [{
                    "interview_id": interview_id,
                    "candidate_id": candidate_id or "",
                    "timestamp":    float(timestamp),
                    "is_reference": int(is_reference),
                    "similarity":   round(float(similarity), 4),
                    "created_at":   datetime.utcnow().isoformat(),
                    "model":        "resemblyzer_256d",
                }],
                documents  = [f"voice_{interview_id}_{timestamp:.1f}"],
            )
        except Exception as exc:
            logger.error("[Speaker] Erreur save_embedding ChromaDB : %s", exc)
        return chroma_id

    def _get_reference_embedding(self, interview_id: str) -> Optional[np.ndarray]:
        collection = _get_speaker_collection()
        try:
            results = collection.get(
                where={"$and": [
                    {"interview_id": {"$eq": interview_id}},
                    {"is_reference": {"$eq": 1}},
                ]},
                include=["embeddings"],
            )
            if results.get("embeddings"):
                return np.array(results["embeddings"][0])
        except Exception as exc:
            logger.error("[Speaker] Erreur get_reference_embedding : %s", exc)
        return None

    def _get_recent_embeddings(self, interview_id: str, n: int = 3) -> List[np.ndarray]:
        collection = _get_speaker_collection()
        try:
            results = collection.get(
                where={"$and": [
                    {"interview_id": {"$eq": interview_id}},
                    {"is_reference": {"$eq": 0}},
                ]},
                include=["embeddings", "metadatas"],
            )
            if not results.get("embeddings"):
                return []
            pairs = list(zip(results["metadatas"], results["embeddings"]))
            pairs.sort(key=lambda x: x[0].get("timestamp", 0), reverse=True)
            return [np.array(emb) for _, emb in pairs[:n]]
        except Exception as exc:
            logger.error("[Speaker] Erreur get_recent_embeddings : %s", exc)
            return []

    # ── Vérification cohérence vocale ─────────────────────────────────────────

    def verify_speaker_consistency(
        self,
        interview_id:  str,
        audio_bytes:   bytes,
        timestamp:     float,
        candidate_id:  Optional[str] = None,
    ) -> Tuple[bool, float, dict]:
        """
        Vérifie que la voix correspond au candidat de référence.

        Retourne (is_consistent, similarity_pct, details).
        API identique à la v1 — aucune modification dans audio_service.py.
        """
        current_emb = self.extract_embedding(audio_bytes)
        if current_emb is None:
            # Ne pas bloquer l'entretien si l'embedding échoue
            return True, 50.0, {"error": "Extraction embedding impossible", "model": "resemblyzer"}

        ref_emb = self._get_reference_embedding(interview_id)

        # ── Premier enregistrement → référence ────────────────────────────────
        if ref_emb is None:
            self._save_embedding(
                interview_id=interview_id,
                embedding=current_emb,
                timestamp=timestamp,
                is_reference=True,
                similarity=1.0,
                candidate_id=candidate_id,
            )
            duplicates = self.find_duplicate_candidate(
                audio_bytes=audio_bytes,
                exclude_interview_id=interview_id,
            )
            logger.info("[%s] Voix de référence Resemblyzer enregistrée", interview_id)
            return True, 100.0, {
                "is_first":   True,
                "duplicates": duplicates,
                "model":      "resemblyzer_256d",
                "message":    "Voix de référence enregistrée",
            }

        # ── Comparaison avec la référence ─────────────────────────────────────
        similarity    = _cosine_similarity(ref_emb, current_emb)
        is_consistent = similarity >= SIM_THRESHOLD

        # Détection changement brusque (vs 3 dernières réponses)
        recent_embs  = self._get_recent_embeddings(interview_id, n=3)
        recent_sims  = [_cosine_similarity(e, current_emb) for e in recent_embs]
        avg_recent   = float(np.mean(recent_sims)) if recent_sims else 1.0
        sudden_change = (similarity < SIM_THRESHOLD - 0.10) and (avg_recent > SIM_THRESHOLD)

        self._save_embedding(
            interview_id=interview_id,
            embedding=current_emb,
            timestamp=timestamp,
            is_reference=False,
            similarity=similarity,
            candidate_id=candidate_id,
        )

        if not is_consistent or sudden_change:
            logger.warning(
                "⚠️ [%s] Changement voix t=%.1fs — sim=%.2f avg_recent=%.2f sudden=%s",
                interview_id, timestamp, similarity, avg_recent, sudden_change,
            )

        return is_consistent, round(similarity * 100, 1), {
            "similarity":     round(similarity, 3),
            "threshold":      SIM_THRESHOLD,
            "avg_recent_sim": round(avg_recent, 3),
            "sudden_change":  sudden_change,
            "is_first":       False,
            "model":          "resemblyzer_256d",
            "storage":        "ChromaDB",
        }

    # ── Détection multi-locuteurs dans un clip ────────────────────────────────

    def detect_multiple_speakers_in_audio(
        self,
        audio_bytes:     bytes,
        window_duration: float = 1.5,
    ) -> Dict:
        """
        Détecte si plusieurs locuteurs parlent dans le même clip.

        Stratégie :
          1. Découpe le clip en fenêtres glissantes de 1.5s
          2. Extrait un embedding Resemblyzer par fenêtre
          3. DBSCAN sur la matrice de similarité cosinus
          4. N clusters > 1 → plusieurs locuteurs

        CORRIGÉ vs SpeechBrain :
          - Resemblyzer.embed_utterance() par fenêtre (vs encode_batch)
          - Pas de torchaudio — uniquement numpy + soundfile
        """
        encoder = _get_encoder()
        if encoder is None:
            return {"unique_speakers": 1, "has_multiple": False, "segments": [], "error": "Resemblyzer non chargé"}

        try:
            from resemblyzer import preprocess_wav
            from sklearn.cluster import DBSCAN

            y, sr = _audio_bytes_to_wav_array(audio_bytes)
            if y is None:
                return {"unique_speakers": 1, "has_multiple": False, "segments": []}

            wav = preprocess_wav(y, source_sr=sr)
            total_samples  = len(wav)
            window_samples = int(window_duration * 16000)
            hop_samples    = window_samples // 2  # 50% overlap

            if total_samples < window_samples:
                # Clip trop court pour analyse multi-locuteurs
                return {"unique_speakers": 1, "has_multiple": False, "segments": [], "too_short": True}

            embeddings: List[np.ndarray] = []
            timestamps: List[float]      = []

            for start in range(0, total_samples - window_samples, hop_samples):
                segment = wav[start:start + window_samples]
                if len(segment) < window_samples * 0.8:
                    continue
                try:
                    emb = encoder.embed_utterance(segment)
                    embeddings.append(emb)
                    timestamps.append(start / 16000)
                except Exception:
                    continue

            if len(embeddings) < 2:
                return {"unique_speakers": 1, "has_multiple": False, "segments": []}

            # Matrice de distances cosinus
            emb_matrix = np.array(embeddings)
            distance_matrix = np.array([
                [1.0 - _cosine_similarity(e1, e2) for e2 in embeddings]
                for e1 in embeddings
            ])
            distance_matrix = np.clip(distance_matrix, 0, 2)

            # DBSCAN : eps=0.30 calibré sur Resemblyzer (plus discriminant que SpeechBrain)
            labels = DBSCAN(
                eps=0.30,
                min_samples=2,
                metric="precomputed",
            ).fit_predict(distance_matrix)

            unique_speakers = len(set(l for l in labels if l != -1))
            unique_speakers = max(1, unique_speakers)  # au moins 1

            # Segments par locuteur
            segments_by_speaker: Dict[int, List[float]] = {}
            for label, ts in zip(labels, timestamps):
                if label == -1:
                    continue
                segments_by_speaker.setdefault(label, []).append(ts)

            logger.info(
                "[Speaker] detect_multiple — %d fenêtres, %d locuteurs détectés",
                len(embeddings), unique_speakers,
            )

            return {
                "unique_speakers": unique_speakers,
                "has_multiple":    unique_speakers > 1,
                "total_segments":  len(embeddings),
                "segments":        {
                    f"speaker_{k}": v
                    for k, v in segments_by_speaker.items()
                },
            }

        except Exception as exc:
            logger.error("[Speaker] Erreur detect_multiple_speakers : %s", exc)
            return {"unique_speakers": 1, "has_multiple": False, "segments": [], "error": str(exc)}

    # ── Rapport de cohérence vocale ────────────────────────────────────────────

    def get_speaker_consistency_report(self, interview_id: str) -> dict:
        """
        Rapport complet lu depuis ChromaDB.
        Disponible même après redémarrage Django.
        API identique à la v1.
        """
        collection = _get_speaker_collection()
        try:
            results = collection.get(
                where={"interview_id": {"$eq": interview_id}},
                include=["metadatas"],
            )
        except Exception as exc:
            logger.error("[Speaker] Erreur rapport ChromaDB : %s", exc)
            return {"status": "error", "message": str(exc)}

        metas = results.get("metadatas", [])
        if not metas:
            return {
                "status":  "no_data",
                "message": "Aucune donnée vocale — Resemblyzer n'a pas pu extraire d'embeddings",
            }

        metas.sort(key=lambda m: m.get("timestamp", 0))
        similarities = [m.get("similarity", 0.0) for m in metas]
        avg_sim      = float(np.mean(similarities)) if similarities else 0.0

        if avg_sim >= SIM_THRESHOLD:
            status, message = "consistent", "Voix cohérente tout au long de l'entretien"
        elif avg_sim >= SIM_THRESHOLD - 0.15:
            status, message = "partial_inconsistency", "Variations vocales — vérification RH recommandée"
        else:
            status, message = "high_inconsistency", "⚠️ FORTES VARIATIONS — possible changement de personne"

        # Chutes brusques > SUDDEN_DROP
        drops = []
        for i in range(1, len(similarities)):
            drop = similarities[i - 1] - similarities[i]
            if drop > SUDDEN_DROP:
                drops.append({
                    "at_response": i,
                    "timestamp":   metas[i].get("timestamp", 0),
                    "drop":        round(drop, 3),
                    "new_sim":     round(similarities[i], 3),
                })

        return {
            "status":                 status,
            "message":                message,
            "model":                  "resemblyzer_256d",
            "average_similarity":     round(avg_sim, 3),
            "similarity_threshold":   SIM_THRESHOLD,
            "embeddings_count":       len(metas),
            "similarities_over_time": [round(s, 3) for s in similarities],
            "suspicious_drops":       drops,
            "has_changed_speaker":    avg_sim < SIM_THRESHOLD,
            "data_source":            "ChromaDB (persistant)",
            "recommendation":         "À vérifier par RH" if avg_sim < SIM_THRESHOLD - 0.05 else "OK",
        }

    # ── Détection doublons inter-entretiens ───────────────────────────────────

    def find_duplicate_candidate(
        self,
        audio_bytes:          bytes,
        exclude_interview_id: Optional[str] = None,
        min_similarity:       float = DUPLICATE_THRESHOLD,
        top_k:                int = 5,
    ) -> List[Dict]:
        """
        Cherche si cette voix correspond à un candidat déjà enregistré.
        Cas d'usage : candidat revenant sous un faux nom.
        """
        emb = self.extract_embedding(audio_bytes)
        if emb is None:
            return []

        collection = _get_speaker_collection()
        if collection.count() == 0:
            return []

        try:
            results = collection.query(
                query_embeddings=[emb.tolist()],
                n_results=min(top_k, collection.count()),
                where={"is_reference": {"$eq": 1}},
                include=["metadatas", "distances"],
            )
        except Exception as exc:
            logger.error("[Speaker] Erreur find_duplicate_candidate : %s", exc)
            return []

        metas     = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        duplicates = []
        for meta, dist in zip(metas, distances):
            # ChromaDB cosine distance [0,2] → similarité = 1 - dist/2
            similarity = 1.0 - dist / 2.0

            if exclude_interview_id and meta.get("interview_id") == exclude_interview_id:
                continue

            if similarity >= min_similarity:
                duplicates.append({
                    "interview_id": meta.get("interview_id"),
                    "candidate_id": meta.get("candidate_id"),
                    "timestamp":    meta.get("created_at"),
                    "similarity":   round(similarity, 3),
                })
                logger.warning(
                    "🔴 Doublon probable — interview=%s sim=%.2f",
                    meta.get("interview_id"), similarity,
                )

        return duplicates

    # ── Suppression RGPD ──────────────────────────────────────────────────────

    def reset_session(self, interview_id: str):
        """Supprime tous les embeddings d'un entretien (RGPD)."""
        collection = _get_speaker_collection()
        try:
            existing = collection.get(
                where={"interview_id": {"$eq": interview_id}},
            )
            ids = existing.get("ids", [])
            if ids:
                collection.delete(ids=ids)
                logger.info("🗑️ %d embeddings supprimés pour interview=%s", len(ids), interview_id)
        except Exception as exc:
            logger.error("[Speaker] Erreur reset_session : %s", exc)


# ─────────────────────────────────────────────────────────────────────────────
# ALIASES DE COMPATIBILITÉ
# ─────────────────────────────────────────────────────────────────────────────

SpeakerEmbeddingAnalyzer = SpeakerEmbeddingAnalyzerV2


class SpeakerProfile:
    """Conservé uniquement pour compatibilité d'import — ne plus utiliser."""
    pass


speaker_analyzer = SpeakerEmbeddingAnalyzerV2()