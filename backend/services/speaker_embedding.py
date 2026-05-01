# services/speaker_embedding.py - À AJOUTER à votre projet
import os
import numpy as np
import logging
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from collections import deque

logger = logging.getLogger(__name__)


# ==============================================
# EMBEDDINGS VOCAUX AVEC SPEECHBRAIN
# ==============================================

@dataclass
class SpeakerProfile:
    """Profil vocal d'un candidat"""
    embeddings: List[np.ndarray]
    timestamps: List[float]
    average_embedding: Optional[np.ndarray] = None

    def compute_average(self):
        """Calcule l'embedding moyen du candidat"""
        if self.embeddings:
            self.average_embedding = np.mean(self.embeddings, axis=0)

    def get_latest_embedding(self) -> Optional[np.ndarray]:
        """Retourne le dernier embedding"""
        return self.embeddings[-1] if self.embeddings else None


class SpeakerEmbeddingAnalyzer:
    """
    Analyseur d'embeddings vocaux pour détecter les changements de locuteur.
    À INTÉGRER dans votre audio_service.py existant.
    """

    def __init__(self):
        self.model = None
        self.speaker_profiles: Dict[str, SpeakerProfile] = {}  # interview_id -> profile
        self.embedding_history: Dict[str, deque] = {}  # historique des embeddings
        self.similarity_threshold = 0.65  # Seuil de similarité (0-1)

    def _load_model(self):
        """Charge le modèle SpeechBrain au premier appel"""
        if self.model is None:
            try:
                from speechbrain.inference.speaker import EncoderClassifier
                import torch

                logger.info("Chargement du modèle d'embeddings vocaux...")
                self.model = EncoderClassifier.from_hparams(
                    source="speechbrain/spkrec-ecapa-voxceleb",
                    savedir="tmp_speechbrain_model",
                    run_opts={"device": "cpu"}  # ou "cuda" si GPU
                )
                logger.info("✅ Modèle chargé avec succès")
            except Exception as e:
                logger.error(f"❌ Erreur chargement modèle: {e}")
                raise

    def extract_embedding(self, audio_bytes: bytes) -> Optional[np.ndarray]:
        """
        Extrait l'embedding vocal unique d'un échantillon audio.
        Retourne un vecteur de 192 dimensions.
        """
        self._load_model()

        if self.model is None:
            return None

        try:
            import torch
            import torchaudio
            import tempfile

            # Sauvegarder les bytes en fichier temporaire
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            # Charger l'audio
            signal, fs = torchaudio.load(tmp_path)
            os.unlink(tmp_path)

            # Redimensionner à 16kHz si nécessaire
            if fs != 16000:
                resampler = torchaudio.transforms.Resample(fs, 16000)
                signal = resampler(signal)

            # Extraire l'embedding (vecteur de 192 dimensions)
            embedding = self.model.encode_batch(signal)
            embedding_np = embedding.squeeze().detach().numpy()

            return embedding_np

        except Exception as e:
            logger.error(f"Erreur extraction embedding: {e}")
            return None

    def verify_speaker_consistency(
            self,
            interview_id: str,
            audio_bytes: bytes,
            timestamp: float
    ) -> Tuple[bool, float, dict]:
        """
        Vérifie si la voix correspond au candidat de référence.

        Retourne:
        - is_consistent: bool (même personne?)
        - confidence: float (0-100)
        - details: dict avec métriques détaillées
        """
        # Extraire l'embedding actuel
        current_embedding = self.extract_embedding(audio_bytes)
        if current_embedding is None:
            return True, 50, {'error': 'Impossible d\'extraire l\'embedding'}

        # Initialiser le profil si premier appel
        if interview_id not in self.speaker_profiles:
            # Premier enregistrement = voix de référence
            self.speaker_profiles[interview_id] = SpeakerProfile(
                embeddings=[current_embedding],
                timestamps=[timestamp]
            )
            self.speaker_profiles[interview_id].compute_average()

            # Initialiser historique
            self.embedding_history[interview_id] = deque(maxlen=10)
            self.embedding_history[interview_id].append(current_embedding)

            return True, 100, {
                'message': 'Voix de référence enregistrée',
                'is_first': True
            }

        # Comparer avec la voix de référence
        profile = self.speaker_profiles[interview_id]
        reference_embedding = profile.average_embedding or profile.embeddings[0]

        # Calculer similarité cosinus
        similarity = self._cosine_similarity(reference_embedding, current_embedding)
        confidence = similarity * 100

        # Stocker dans l'historique
        self.embedding_history[interview_id].append(current_embedding)
        profile.embeddings.append(current_embedding)
        profile.timestamps.append(timestamp)

        # Mettre à jour la moyenne périodiquement
        if len(profile.embeddings) % 5 == 0:
            profile.compute_average()

        # Décision
        is_consistent = similarity >= self.similarity_threshold

        # Détecter les changements brusques (possible autre personne)
        recent_history = list(self.embedding_history[interview_id])
        if len(recent_history) >= 2:
            # Vérifier la cohérence avec les dernières réponses
            recent_similarities = []
            for past_emb in recent_history[-3:-1]:
                sim = self._cosine_similarity(past_emb, current_embedding)
                recent_similarities.append(sim)

            avg_recent_similarity = np.mean(recent_similarities) if recent_similarities else 1
            sudden_change = similarity < 0.5 and avg_recent_similarity > 0.7

            if sudden_change and not is_consistent:
                logger.warning(f"⚠️ Changement soudain de voix détecté à {timestamp:.1f}s")
                return False, confidence, {
                    'sudden_change': True,
                    'previous_similarity': float(avg_recent_similarity),
                    'current_similarity': float(similarity)
                }

        return is_consistent, confidence, {
            'similarity': float(similarity),
            'threshold': self.similarity_threshold,
            'embeddings_count': len(profile.embeddings),
            'sudden_change': False
        }

    def detect_multiple_speakers_in_audio(
            self,
            audio_bytes: bytes,
            window_duration: float = 2.0
    ) -> Dict:
        """
        Détecte si plusieurs locuteurs parlent dans le MÊME audio.
        Utile pour détecter une personne qui aide le candidat.

        Retourne:
        - unique_speakers: nombre de locuteurs distincts
        - segments: liste des segments avec leur locuteur
        - has_multiple: bool
        """
        self._load_model()

        if self.model is None:
            return {'unique_speakers': 1, 'has_multiple': False, 'segments': []}

        try:
            import torch
            import torchaudio
            import tempfile

            # Charger l'audio
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            signal, fs = torchaudio.load(tmp_path)
            os.unlink(tmp_path)

            if fs != 16000:
                resampler = torchaudio.transforms.Resample(fs, 16000)
                signal = resampler(signal)

            # Découper en fenêtres
            window_samples = int(window_duration * 16000)
            hop_samples = window_samples // 2  # 50% overlap

            embeddings = []
            timestamps = []

            for start in range(0, signal.shape[1] - window_samples, hop_samples):
                segment = signal[:, start:start + window_samples]

                if segment.shape[1] < window_samples * 0.5:
                    continue

                emb = self.model.encode_batch(segment)
                embeddings.append(emb.squeeze().detach().numpy())
                timestamps.append(start / 16000)

            if len(embeddings) < 2:
                return {'unique_speakers': 1, 'has_multiple': False, 'segments': []}

            # Clustering des embeddings pour identifier locuteurs distincts
            from sklearn.cluster import DBSCAN

            # Calculer matrice de similarité
            similarities = []
            for i in range(len(embeddings)):
                for j in range(i + 1, len(embeddings)):
                    sim = self._cosine_similarity(embeddings[i], embeddings[j])
                    similarities.append((i, j, sim))

            # DBSCAN clustering basé sur similarité
            # Convertir similarité en distance
            distance_matrix = 1 - np.array([
                [self._cosine_similarity(emb1, emb2) for emb2 in embeddings]
                for emb1 in embeddings
            ])

            clustering = DBSCAN(eps=0.4, min_samples=2, metric='precomputed')
            labels = clustering.fit_predict(distance_matrix)

            unique_speakers = len(set(labels)) - (1 if -1 in labels else 0)

            # Regrouper les segments par locuteur
            segments_by_speaker = {}
            for idx, label in enumerate(labels):
                if label not in segments_by_speaker:
                    segments_by_speaker[label] = []
                segments_by_speaker[label].append({
                    'start': timestamps[idx],
                    'end': timestamps[idx] + window_duration
                })

            return {
                'unique_speakers': unique_speakers,
                'has_multiple': unique_speakers > 1,
                'segments': segments_by_speaker,
                'total_segments': len(embeddings)
            }

        except Exception as e:
            logger.error(f"Erreur détection multiples locuteurs: {e}")
            return {'unique_speakers': 1, 'has_multiple': False, 'segments': []}

    def get_speaker_consistency_report(self, interview_id: str) -> Dict:
        """
        Génère un rapport de cohérence vocale pour tout l'entretien.
        À utiliser dans le rapport final RH.
        """
        if interview_id not in self.speaker_profiles:
            return {'status': 'no_data', 'message': 'Aucune donnée vocale disponible'}

        profile = self.speaker_profiles[interview_id]

        if len(profile.embeddings) < 2:
            return {'status': 'insufficient_data', 'message': 'Pas assez d\'échantillons'}

        # Calculer les similarités entre toutes les réponses
        similarities = []
        reference = profile.average_embedding or profile.embeddings[0]

        for emb in profile.embeddings:
            sim = self._cosine_similarity(reference, emb)
            similarities.append(sim)

        # Détecter les chutes de similarité (changements de personne)
        drops = []
        for i in range(1, len(similarities)):
            if similarities[i] < similarities[i - 1] - 0.2:  # Baisse de 20%
                drops.append({
                    'at_response': i,
                    'timestamp': profile.timestamps[i] if i < len(profile.timestamps) else 0,
                    'similarity_drop': similarities[i - 1] - similarities[i],
                    'new_similarity': similarities[i]
                })

        # Statut global
        avg_similarity = np.mean(similarities)

        if avg_similarity >= 0.7:
            status = 'consistent'
            message = 'Voix cohérente tout au long de l\'entretien'
        elif avg_similarity >= 0.5:
            status = 'partial_inconsistency'
            message = 'Variations vocales détectées - vérification RH recommandée'
        else:
            status = 'high_inconsistency'
            message = '⚠️ FORTES VARIATIONS VOCALES - possible changement de personne'

        return {
            'status': status,
            'message': message,
            'average_similarity': float(avg_similarity),
            'similarity_threshold': self.similarity_threshold,
            'embeddings_count': len(profile.embeddings),
            'similarities_over_time': similarities,
            'suspicious_drops': drops,
            'has_changed_speaker': avg_similarity < self.similarity_threshold,
            'recommendation': 'À vérifier manuellement par RH' if avg_similarity < 0.6 else 'OK'
        }

    def reset_session(self, interview_id: str):
        """Réinitialiser le profil pour un nouvel entretien"""
        if interview_id in self.speaker_profiles:
            del self.speaker_profiles[interview_id]
        if interview_id in self.embedding_history:
            del self.embedding_history[interview_id]
        logger.info(f"Session {interview_id} réinitialisée")

    @staticmethod
    def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        """Calcule la similarité cosinus entre deux vecteurs"""
        if a is None or b is None:
            return 0
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0
        return float(np.dot(a, b) / (norm_a * norm_b))


# ==============================================
# INSTANCE GLOBALE (à initialiser au démarrage)
# ==============================================

speaker_analyzer = SpeakerEmbeddingAnalyzer()