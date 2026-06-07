
from __future__ import annotations

import json
import logging
import os
import tempfile
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import numpy as np
import chromadb
from chromadb.config import Settings

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

CHROMA_PERSIST_DIR   = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")  # même que rag.py
SPEAKER_COLLECTION   = "speaker_profiles"   # collection dédiée aux voix
EMBED_DIM            = 192                  # dimension ECAPA-TDNN
SIM_THRESHOLD        = 0.65                 # seuil similarité cosinus
DUPLICATE_THRESHOLD  = 0.80                 # seuil détection doublon inter-entretiens


# ─────────────────────────────────────────────────────────────────────────────
# SINGLETON CHROMADB — collection "speaker_profiles"
# ─────────────────────────────────────────────────────────────────────────────

_chroma_client     = None
_speaker_collection = None


def _get_speaker_collection():
    """
    Retourne la collection ChromaDB dédiée aux embeddings vocaux.
    Crée la collection si elle n'existe pas encore.
    Réutilise le même client que rag.py (même dossier chroma_db/).
    """
    global _chroma_client, _speaker_collection

    if _speaker_collection is not None:
        return _speaker_collection

    from pathlib import Path
    Path(CHROMA_PERSIST_DIR).mkdir(parents=True, exist_ok=True)

    _chroma_client = chromadb.PersistentClient(
        path=CHROMA_PERSIST_DIR,
        settings=Settings(anonymized_telemetry=False, allow_reset=True),
    )

    # cosine = similarité cosinus (même espace métrique que rag.py)
    _speaker_collection = _chroma_client.get_or_create_collection(
        name=SPEAKER_COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )

    logger.info(
        "✅ Collection ChromaDB '%s' prête — %d embeddings vocaux enregistrés",
        SPEAKER_COLLECTION,
        _speaker_collection.count(),
    )
    return _speaker_collection


# ─────────────────────────────────────────────────────────────────────────────
# UTILITAIRE — similarité cosinus
# ─────────────────────────────────────────────────────────────────────────────

def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


# ─────────────────────────────────────────────────────────────────────────────
# ANALYSEUR VOCAL — version ChromaDB
# ─────────────────────────────────────────────────────────────────────────────

class SpeakerEmbeddingAnalyzerV2:
    """
    Vérification d'identité vocale avec persistance ChromaDB.

    Ce qui change vs la v1 (dict Python) :
      ✅ Les embeddings survivent aux redémarrages serveur
      ✅ Suppression RGPD native via collection.delete()
      ✅ Recherche inter-entretiens (candidat doublon)
      ✅ Zéro nouvelle dépendance (ChromaDB déjà installé)
      ✅ Filtrage par métadonnée (interview_id, candidate_id, is_reference)
    """

    def __init__(self):
        self._model = None

    # ── Chargement modèle SpeechBrain (inchangé) ──────────────────────────────

    def _load_model(self):
        if self._model is not None:
            return self._model
        try:
            from speechbrain.pretrained import EncoderClassifier
            logger.info("⏳ Chargement ECAPA-TDNN...")
            self._model = EncoderClassifier.from_hparams(
                source="speechbrain/spkrec-ecapa-voxceleb",
                savedir="tmp_speechbrain_model",
                run_opts={"device": "cpu"},
            )
            logger.info("✅ ECAPA-TDNN chargé")
            return self._model
        except Exception as exc:
            logger.error("❌ Impossible de charger ECAPA-TDNN : %s", exc)
            return None

    # ── Extraction embedding (inchangée) ──────────────────────────────────────

    def extract_embedding(self, audio_bytes: bytes) -> Optional[np.ndarray]:
        """Extrait un vecteur 192-D depuis un clip audio."""
        model = self._load_model()
        if model is None:
            return None
        try:
            import torch, torchaudio

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            signal, fs = torchaudio.load(tmp_path)
            os.unlink(tmp_path)

            if fs != 16000:
                signal = torchaudio.transforms.Resample(fs, 16000)(signal)

            embedding = model.encode_batch(signal)
            return embedding.squeeze().detach().numpy()

        except Exception as exc:
            logger.error("Erreur extract_embedding : %s", exc)
            return None

    # ── Sauvegarde embedding dans ChromaDB ────────────────────────────────────

    def _save_embedding(
        self,
        interview_id:  str,
        embedding:     np.ndarray,
        timestamp:     float,
        is_reference:  bool,
        similarity:    float,
        candidate_id:  Optional[str] = None,
    ) -> str:
        """
        Persiste un embedding dans ChromaDB avec ses métadonnées.
        Retourne l'ID ChromaDB généré.
        """
        collection = _get_speaker_collection()

        # ID unique par réponse : interview + timestamp
        chroma_id = f"{interview_id}_{timestamp:.3f}"

        collection.add(
            ids        = [chroma_id],
            embeddings = [embedding.tolist()],
            metadatas  = [{
                "interview_id": interview_id,
                "candidate_id": candidate_id or "",
                "timestamp":    timestamp,
                "is_reference": int(is_reference),   # ChromaDB n'accepte pas bool
                "similarity":   round(similarity, 4),
                "created_at":   datetime.utcnow().isoformat(),
            }],
            documents  = [f"voice_{interview_id}_{timestamp:.1f}"],  # requis par ChromaDB
        )
        return chroma_id

    # ── Récupération embedding de référence ───────────────────────────────────

    def _get_reference_embedding(self, interview_id: str) -> Optional[np.ndarray]:
        """Récupère l'embedding de référence (premier enregistrement) depuis ChromaDB."""
        collection = _get_speaker_collection()
        try:
            results = collection.get(
                where={
                    "$and": [
                        {"interview_id":  {"$eq": interview_id}},
                        {"is_reference":  {"$eq": 1}},
                    ]
                },
                include=["embeddings"],
            )
            if results["embeddings"]:
                return np.array(results["embeddings"][0])
        except Exception as exc:
            logger.error("Erreur get_reference_embedding : %s", exc)
        return None

    # ── Récupération des N derniers embeddings ────────────────────────────────

    def _get_recent_embeddings(self, interview_id: str, n: int = 3) -> List[np.ndarray]:
        """Récupère les N derniers embeddings pour détecter les changements brusques."""
        collection = _get_speaker_collection()
        try:
            results = collection.get(
                where={
                    "$and": [
                        {"interview_id": {"$eq": interview_id}},
                        {"is_reference": {"$eq": 0}},
                    ]
                },
                include=["embeddings", "metadatas"],
            )
            if not results["embeddings"]:
                return []

            # Trier par timestamp décroissant et prendre les N derniers
            pairs = list(zip(results["metadatas"], results["embeddings"]))
            pairs.sort(key=lambda x: x[0].get("timestamp", 0), reverse=True)
            return [np.array(emb) for _, emb in pairs[:n]]

        except Exception as exc:
            logger.error("Erreur get_recent_embeddings : %s", exc)
            return []

    # ── Vérification de cohérence (API identique à la v1) ────────────────────

    def verify_speaker_consistency(
        self,
        interview_id:  str,
        audio_bytes:   bytes,
        timestamp:     float,
        candidate_id:  Optional[str] = None,
    ) -> Tuple[bool, float, dict]:
        """
        Vérifie si la voix correspond au candidat de référence.
        Persiste chaque embedding dans ChromaDB.

        API identique à la v1 — aucune modification dans audio_service.py.
        Retourne (is_consistent, similarity_pct, details).
        """
        current_emb = self.extract_embedding(audio_bytes)
        if current_emb is None:
            return True, 50.0, {"error": "Extraction embedding impossible"}

        ref_emb = self._get_reference_embedding(interview_id)

        # ── Premier enregistrement → devient la référence ──────────────────────
        if ref_emb is None:
            self._save_embedding(
                interview_id=interview_id,
                embedding=current_emb,
                timestamp=timestamp,
                is_reference=True,
                similarity=1.0,
                candidate_id=candidate_id,
            )

            # Vérifier si ce candidat a déjà passé un entretien (doublon)
            duplicates = self.find_duplicate_candidate(
                audio_bytes=audio_bytes,
                exclude_interview_id=interview_id,
            )

            logger.info("[%s] Voix de référence enregistrée dans ChromaDB", interview_id)
            return True, 100.0, {
                "is_first":   True,
                "duplicates": duplicates,
                "message":    "Voix de référence enregistrée (persistée ChromaDB)",
            }

        # ── Comparaison avec la référence ──────────────────────────────────────
        similarity    = _cosine_similarity(ref_emb, current_emb)
        is_consistent = similarity >= SIM_THRESHOLD

        # Détection changement brusque (vs les 3 dernières réponses)
        recent_embs   = self._get_recent_embeddings(interview_id, n=3)
        recent_sims   = [_cosine_similarity(e, current_emb) for e in recent_embs]
        avg_recent    = float(np.mean(recent_sims)) if recent_sims else 1.0
        sudden_change = similarity < 0.50 and avg_recent > 0.70

        # Persister cet embedding
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
            "similarity":      round(similarity, 3),
            "threshold":       SIM_THRESHOLD,
            "avg_recent_sim":  round(avg_recent, 3),
            "sudden_change":   sudden_change,
            "is_first":        False,
            "persisted":       True,
            "storage":         "ChromaDB",   # ← utile pour les logs / soutenance
        }

    # ── Rapport de cohérence depuis ChromaDB ──────────────────────────────────

    def get_speaker_consistency_report(self, interview_id: str) -> dict:
        """
        Rapport complet lu depuis ChromaDB.
        Disponible même après redémarrage du serveur.
        API identique à la v1.
        """
        collection = _get_speaker_collection()
        try:
            results = collection.get(
                where={"interview_id": {"$eq": interview_id}},
                include=["metadatas"],
            )
        except Exception as exc:
            logger.error("Erreur rapport ChromaDB : %s", exc)
            return {"status": "error", "message": str(exc)}

        metas = results.get("metadatas", [])
        if not metas:
            return {"status": "no_data", "message": "Aucune donnée vocale en base ChromaDB"}

        # Trier par timestamp
        metas.sort(key=lambda m: m.get("timestamp", 0))
        similarities = [m.get("similarity", 0.0) for m in metas]
        avg_sim      = float(np.mean(similarities)) if similarities else 0.0

        if avg_sim >= 0.70:
            status, message = "consistent", "Voix cohérente tout au long de l'entretien"
        elif avg_sim >= 0.55:
            status, message = "partial_inconsistency", "Variations vocales — vérification RH recommandée"
        else:
            status, message = "high_inconsistency", "⚠️ FORTES VARIATIONS — possible changement de personne"

        # Détecter les chutes brutales (> 20%)
        drops = []
        for i in range(1, len(similarities)):
            drop = similarities[i - 1] - similarities[i]
            if drop > 0.20:
                drops.append({
                    "at_response": i,
                    "timestamp":   metas[i].get("timestamp", 0),
                    "drop":        round(drop, 3),
                    "new_sim":     round(similarities[i], 3),
                })

        return {
            "status":                 status,
            "message":                message,
            "average_similarity":     round(avg_sim, 3),
            "similarity_threshold":   SIM_THRESHOLD,
            "embeddings_count":       len(metas),
            "similarities_over_time": [round(s, 3) for s in similarities],
            "suspicious_drops":       drops,
            "has_changed_speaker":    avg_sim < SIM_THRESHOLD,
            "data_source":            "ChromaDB (persistant)",
            "recommendation":         "À vérifier par RH" if avg_sim < 0.60 else "OK",
        }

    # ── Détection de doublons inter-entretiens ────────────────────────────────

    def find_duplicate_candidate(
        self,
        audio_bytes:          bytes,
        exclude_interview_id: Optional[str] = None,
        min_similarity:       float = DUPLICATE_THRESHOLD,
        top_k:                int = 5,
    ) -> List[Dict]:
        """
        Cherche si cette voix correspond à un candidat déjà enregistré.

        Utilise ChromaDB query() — recherche vectorielle native.
        Cas d'usage : candidat qui revient sous un faux nom.

        Retourne : liste de {interview_id, candidate_id, timestamp, similarity}
        """
        emb = self.extract_embedding(audio_bytes)
        if emb is None:
            return []

        collection = _get_speaker_collection()
        if collection.count() == 0:
            return []

        try:
            # Chercher uniquement parmi les embeddings de référence
            # pour éviter les faux positifs sur les variations en cours d'entretien
            results = collection.query(
                query_embeddings=[emb.tolist()],
                n_results=min(top_k, collection.count()),
                where={"is_reference": {"$eq": 1}},
                include=["metadatas", "distances"],
            )
        except Exception as exc:
            logger.error("Erreur find_duplicate_candidate : %s", exc)
            return []

        metas     = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        duplicates = []
        for meta, dist in zip(metas, distances):
            # ChromaDB cosine retourne une distance [0,2] : similarité = 1 - dist/2
            similarity = 1.0 - dist / 2.0

            # Exclure l'entretien courant
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
                    "🔴 Candidat doublon probable — interview=%s sim=%.2f",
                    meta.get("interview_id"), similarity,
                )

        return duplicates

    # ── Détection multi-locuteurs dans un clip (inchangée) ────────────────────

    def detect_multiple_speakers_in_audio(
        self,
        audio_bytes:     bytes,
        window_duration: float = 2.0,
    ) -> Dict:
        """
        Détecte si plusieurs locuteurs parlent dans le même clip audio.
        Logique inchangée vs v1 — utilise sklearn DBSCAN.
        """
        model = self._load_model()
        if model is None:
            return {"unique_speakers": 1, "has_multiple": False, "segments": []}

        try:
            import torch, torchaudio

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            signal, fs = torchaudio.load(tmp_path)
            os.unlink(tmp_path)

            if fs != 16000:
                signal = torchaudio.transforms.Resample(fs, 16000)(signal)

            window_samples = int(window_duration * 16000)
            hop_samples    = window_samples // 2

            embeddings, timestamps = [], []
            for start in range(0, signal.shape[1] - window_samples, hop_samples):
                segment = signal[:, start:start + window_samples]
                if segment.shape[1] < window_samples * 0.5:
                    continue
                emb = model.encode_batch(segment)
                embeddings.append(emb.squeeze().detach().numpy())
                timestamps.append(start / 16000)

            if len(embeddings) < 2:
                return {"unique_speakers": 1, "has_multiple": False, "segments": []}

            from sklearn.cluster import DBSCAN

            distance_matrix = 1 - np.array([
                [_cosine_similarity(e1, e2) for e2 in embeddings]
                for e1 in embeddings
            ])
            labels = DBSCAN(eps=0.4, min_samples=2, metric="precomputed").fit_predict(distance_matrix)
            unique = len(set(labels)) - (1 if -1 in labels else 0)

            return {
                "unique_speakers": unique,
                "has_multiple":    unique > 1,
                "total_segments":  len(embeddings),
                "segments":        {},
            }

        except Exception as exc:
            logger.error("Erreur detect_multiple_speakers : %s", exc)
            return {"unique_speakers": 1, "has_multiple": False, "segments": []}

    # ── Suppression RGPD ──────────────────────────────────────────────────────

    def reset_session(self, interview_id: str):
        """
        Supprime tous les embeddings d'un entretien (RGPD).
        ChromaDB supporte la suppression par filtre — impossible avec FAISS.
        """
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
            logger.error("Erreur reset_session : %s", exc)

# ── Aliases de compatibilité (pour __init__.py existant) ──────────────────
SpeakerEmbeddingAnalyzer = SpeakerEmbeddingAnalyzerV2

# SpeakerProfile n'existe plus (dict Python remplacé par ChromaDB)
# On crée une classe vide pour ne pas casser les imports
class SpeakerProfile:
    """
    Classe conservée uniquement pour compatibilité d'import.
    Remplacée par ChromaDB — ne plus utiliser directement.
    """
    pass

speaker_analyzer = SpeakerEmbeddingAnalyzerV2()