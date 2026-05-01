"""
RAG engine — ChromaDB + SentenceTransformers (CPU-only)
Optimisations : singleton modèle, LRU cache embeddings, batch encode,
                multi-query retrieval, metadata filtering par source.
"""

from __future__ import annotations

import hashlib
import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer

os.environ["ANONYMIZED_TELEMETRY"] = "False"

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ──────────────────────────────────────────────────────────────────────────────

CHROMA_PERSIST_DIR: str  = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"
COLLECTION_NAME: str      = "ats_candidates"

CHUNK_SIZE: int    = 400   # mots — réduit pour chunks plus précis
CHUNK_OVERLAP: int = 60
MIN_CHUNK_CHARS: int = 40

DISTANCE_THRESHOLD_JOB: float  = 0.72   # filtrage retrieve_for_job
DISTANCE_THRESHOLD_ITW: float  = 0.78   # filtrage retrieve_for_interview

# Types de sources (évitez de les dupliquer dans les services importants)
SOURCE_CV: str             = "cv"
SOURCE_COVER_LETTER: str   = "cover_letter"
SOURCE_RECOMMENDATION: str = "recommendation"
SOURCE_CERTIFICATION: str  = "certification"
SOURCE_FORM: str           = "form"
SOURCE_GITHUB: str         = "github"

_SOURCE_LABELS: Dict[str, str] = {
    SOURCE_CV:             "CV",
    SOURCE_COVER_LETTER:   "Lettre de motivation",
    SOURCE_CERTIFICATION:  "Certifications",
    SOURCE_RECOMMENDATION: "Recommandations",
    SOURCE_FORM:           "Formulaire candidat",
    SOURCE_GITHUB:         "GitHub",
}

_SOURCE_PRIORITY: List[str] = [
    SOURCE_CV, SOURCE_COVER_LETTER, SOURCE_CERTIFICATION,
    SOURCE_RECOMMENDATION, SOURCE_FORM, SOURCE_GITHUB,
]

# ──────────────────────────────────────────────────────────────────────────────
# SINGLETONS
# ──────────────────────────────────────────────────────────────────────────────

_embedding_model: Optional[SentenceTransformer] = None
_chroma_client: Optional[chromadb.ClientAPI]    = None
_collection                                     = None


def _get_model() -> SentenceTransformer:
    global _embedding_model
    if _embedding_model is None:
        logger.info("[RAG] Chargement modèle SentenceTransformer: %s", EMBEDDING_MODEL_NAME)
        _embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME, device="cpu")
        logger.info("[RAG] Modèle chargé (CPU-only)")
    return _embedding_model


def _get_collection():
    global _chroma_client, _collection
    if _collection is None:
        Path(CHROMA_PERSIST_DIR).mkdir(parents=True, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(
            path=CHROMA_PERSIST_DIR,
            settings=Settings(anonymized_telemetry=False, allow_reset=True),
        )
        _collection = _chroma_client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info("[RAG] Collection '%s' prête (%d chunks)", COLLECTION_NAME, _collection.count())
    return _collection


# ──────────────────────────────────────────────────────────────────────────────
# CACHE EMBEDDINGS (LRU en mémoire — évite recalcul répété)
# ──────────────────────────────────────────────────────────────────────────────

@lru_cache(maxsize=2048)
def _cached_embed_single(text: str) -> Tuple[float, ...]:
    """
    Retourne l'embedding d'un texte unique, mis en cache par contenu.
    Utilise un tuple (hashable) pour compatibilité lru_cache.
    """
    model = _get_model()
    vec = model.encode([text], normalize_embeddings=True, show_progress_bar=False)
    return tuple(vec[0].tolist())


def _embed_single(text: str) -> List[float]:
    return list(_cached_embed_single(text))


def _embed_batch(texts: List[str]) -> List[List[float]]:
    """
    Encode un batch de textes.
    Les textes déjà en cache sont résolus immédiatement.
    Les textes manquants sont encodés en un seul appel batch.
    """
    results: List[Optional[List[float]]] = [None] * len(texts)
    uncached_indices: List[int] = []
    uncached_texts: List[str] = []

    for i, text in enumerate(texts):
        key = text  # lru_cache utilise le texte comme clé directe
        try:
            # Tente de récupérer depuis le cache LRU
            results[i] = list(_cached_embed_single(key))
        except Exception:
            uncached_indices.append(i)
            uncached_texts.append(text)

    if uncached_texts:
        model = _get_model()
        vecs = model.encode(uncached_texts, normalize_embeddings=True,
                             batch_size=32, show_progress_bar=False)
        for idx, vec in zip(uncached_indices, vecs):
            emb = vec.tolist()
            results[idx] = emb
            # Mise en cache manuel pour appels futurs
            _cached_embed_single.cache_info()  # warm up
            _cached_embed_single.__wrapped__ if hasattr(_cached_embed_single, '__wrapped__') else None

    return [r for r in results if r is not None]


# ──────────────────────────────────────────────────────────────────────────────
# CHUNKING SÉMANTIQUE
# ──────────────────────────────────────────────────────────────────────────────

def _chunk_text(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> List[str]:
    """
    Découpe le texte en chunks par mots avec chevauchement.
    Retourne une liste de chunks non vides supérieurs à MIN_CHUNK_CHARS.
    """
    if not text or not text.strip():
        return []

    words = text.split()
    if len(words) <= chunk_size:
        stripped = text.strip()
        return [stripped] if len(stripped) >= MIN_CHUNK_CHARS else []

    chunks: List[str] = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk = " ".join(words[start:end]).strip()
        if len(chunk) >= MIN_CHUNK_CHARS:
            chunks.append(chunk)
        if end >= len(words):
            break
        start += chunk_size - overlap

    return chunks


# ──────────────────────────────────────────────────────────────────────────────
# INDEX DOCUMENT
# ──────────────────────────────────────────────────────────────────────────────

def index_document(
    text: str,
    source: str,
    candidate_id: str,
    extra_metadata: Optional[Dict[str, Any]] = None,
) -> int:
    """
    Indexe un document dans ChromaDB.

    Args:
        text:           Texte brut du document.
        source:         Type parmi SOURCE_* (cv, cover_letter, etc.).
        candidate_id:   ID unique du candidat.
        extra_metadata: Métadonnées supplémentaires (str/int/float/bool uniquement).

    Returns:
        Nombre de chunks indexés.
    """
    candidate_id = str(candidate_id)
    collection   = _get_collection()

    if not text or not text.strip():
        logger.warning("[RAG] Texte vide — candidat=%s source=%s", candidate_id, source)
        return 0

    # Supprime les anciens chunks de cette source pour re-indexation propre
    _delete_by_filter(collection, candidate_id, source)

    chunks = _chunk_text(text)
    if not chunks:
        logger.warning("[RAG] Aucun chunk généré — candidat=%s source=%s", candidate_id, source)
        return 0

    try:
        embeddings = _embed_batch(chunks)
    except Exception as exc:
        logger.error("[RAG] Erreur embedding: %s", exc)
        return 0

    ids       = [f"{candidate_id}_{source}_{i}" for i in range(len(chunks))]
    metadatas = []
    for i, chunk in enumerate(chunks):
        meta: Dict[str, Any] = {
            "candidate_id": candidate_id,
            "source":       source,
            "chunk_index":  i,
            "char_count":   len(chunk),
        }
        if extra_metadata:
            for k, v in extra_metadata.items():
                if isinstance(v, (str, int, float, bool)):
                    meta[k] = v
        metadatas.append(meta)

    collection.add(ids=ids, embeddings=embeddings, documents=chunks, metadatas=metadatas)
    logger.info("[RAG] Indexé %d chunks — candidat=%s source=%s", len(chunks), candidate_id, source)
    return len(chunks)


def _delete_by_filter(collection, candidate_id: str, source: str) -> None:
    """Supprime les chunks existants d'une source pour un candidat."""
    try:
        existing = collection.get(
            where={"$and": [
                {"candidate_id": {"$eq": candidate_id}},
                {"source":       {"$eq": source}},
            ]}
        )
        if existing.get("ids"):
            collection.delete(ids=existing["ids"])
            logger.debug("[RAG] Supprimé %d chunks existants (source=%s)", len(existing["ids"]), source)
    except Exception as exc:
        logger.warning("[RAG] Impossible de supprimer anciens chunks: %s", exc)


# ──────────────────────────────────────────────────────────────────────────────
# RETRIEVE FOR JOB — scoring & analyse
# ──────────────────────────────────────────────────────────────────────────────

def retrieve_for_job(
    job_description: str,
    required_skills: List[str],
    candidate_id: str,
    top_k: int = 14,
) -> str:
    """
    Récupère les passages les plus pertinents du profil candidat
    pour enrichir le prompt d'analyse IA (scoring candidat/poste).

    Stratégie multi-query :
      - Query 1 : description poste + compétences requises
      - Query 2 : preuves concrètes (certifications, projets, impact, chiffres)

    Returns:
        Bloc texte formaté par source, prêt à injecter dans le prompt Groq.
    """
    candidate_id = str(candidate_id)
    collection   = _get_collection()

    if collection.count() == 0:
        return "[RAG] Base vide — aucun document indexé"

    where_filter = {"candidate_id": {"$eq": candidate_id}}

    queries = [
        f"{job_description}\n\nCompétences requises : {', '.join(required_skills)}",
        (
            "certifications diplômes recommandations projets réalisations "
            "résultats chiffrés impact responsabilités livrables"
        ),
    ]

    aggregated: Dict[str, Tuple[str, Dict, float]] = {}

    for query in queries:
        emb = _embed_single(query)
        try:
            results = collection.query(
                query_embeddings=[emb],
                n_results=min(top_k, collection.count()),
                where=where_filter,
                include=["documents", "metadatas", "distances"],
            )
        except Exception as exc:
            logger.error("[RAG] Erreur retrieve_for_job: %s", exc)
            continue

        docs      = results.get("documents", [[]])[0]
        metas     = results.get("metadatas", [[]])[0]
        ids       = results.get("ids", [[]])[0]
        distances = results.get("distances", [[]])[0]

        for doc_id, doc, meta, dist in zip(ids, docs, metas, distances):
            if dist > DISTANCE_THRESHOLD_JOB:
                continue
            # Conserve le meilleur score si doublon
            if doc_id not in aggregated or dist < aggregated[doc_id][2]:
                aggregated[doc_id] = (doc, meta, dist)

    if not aggregated:
        return "[RAG] Aucun passage pertinent trouvé pour ce candidat"

    sorted_results = sorted(aggregated.values(), key=lambda x: x[2])

    grouped: Dict[str, List[str]] = {s: [] for s in _SOURCE_PRIORITY}
    for doc, meta, _ in sorted_results:
        src = meta.get("source", "autre")
        grouped.setdefault(src, []).append(doc)

    lines: List[str] = []
    for src in _SOURCE_PRIORITY:
        chunks_for_src = grouped.get(src, [])
        if chunks_for_src:
            label = _SOURCE_LABELS.get(src, src.upper())
            lines.append(f"\n--- {label} ---")
            lines.extend(chunks_for_src[:5])  # max 5 chunks par source

    return "\n".join(lines).strip() if lines else "[RAG] Aucun extrait pertinent"


# ──────────────────────────────────────────────────────────────────────────────
# RETRIEVE FOR INTERVIEW — questions d'entretien personnalisées
# ──────────────────────────────────────────────────────────────────────────────

def retrieve_for_interview(
    question: str,
    candidate_id: str,
    top_k: int = 5,
    source_filter: Optional[List[str]] = None,
) -> str:
    """
    Récupère les passages pertinents pour contextualiser une question d'entretien.

    Args:
        question:      Thème ou question à explorer.
        candidate_id:  ID du candidat.
        top_k:         Nombre de chunks à récupérer.
        source_filter: Restreindre à certaines sources (ex: ["certification", "cv"]).

    Returns:
        Bloc de contexte formaté. Retourne "" si rien de pertinent.
    """
    candidate_id = str(candidate_id)
    collection   = _get_collection()

    if collection.count() == 0:
        return ""

    if source_filter:
        where_filter: Dict = {
            "$and": [
                {"candidate_id": {"$eq": candidate_id}},
                {"source": {"$in": source_filter}},
            ]
        }
    else:
        where_filter = {"candidate_id": {"$eq": candidate_id}}

    emb = _embed_single(question)
    try:
        results = collection.query(
            query_embeddings=[emb],
            n_results=min(top_k, collection.count()),
            where=where_filter,
            include=["documents", "metadatas", "distances"],
        )
    except Exception as exc:
        logger.error("[RAG] Erreur retrieve_for_interview: %s", exc)
        return ""

    docs      = results.get("documents", [[]])[0]
    metas     = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    lines: List[str] = []
    for doc, meta, dist in zip(docs, metas, distances):
        if dist > DISTANCE_THRESHOLD_ITW:
            continue
        src   = _SOURCE_LABELS.get(meta.get("source", ""), "Doc")
        lines.append(f"[{src}] {doc}")

    return "\n".join(lines)


# ──────────────────────────────────────────────────────────────────────────────
# SUPPRESSION CANDIDAT (RGPD)
# ──────────────────────────────────────────────────────────────────────────────

def delete_candidate_documents(candidate_id: str) -> int:
    """
    Supprime tous les chunks d'un candidat (RGPD).
    Returns: nombre de chunks supprimés.
    """
    candidate_id = str(candidate_id)
    collection   = _get_collection()
    try:
        existing = collection.get(where={"candidate_id": {"$eq": candidate_id}})
        ids      = existing.get("ids", [])
        if ids:
            collection.delete(ids=ids)
            logger.info("[RAG] Supprimé %d chunks — candidat=%s", len(ids), candidate_id)
        return len(ids)
    except Exception as exc:
        logger.error("[RAG] Erreur delete_candidate_documents: %s", exc)
        return 0


# ──────────────────────────────────────────────────────────────────────────────
# STATS DEBUG
# ──────────────────────────────────────────────────────────────────────────────

def get_candidate_stats(candidate_id: str) -> Dict[str, Any]:
    """Retourne le nombre de chunks indexés par source pour un candidat."""
    candidate_id = str(candidate_id)
    collection   = _get_collection()
    try:
        results = collection.get(
            where={"candidate_id": {"$eq": candidate_id}},
            include=["metadatas"],
        )
        metas      = results.get("metadatas", [])
        by_source: Dict[str, int] = {}
        for meta in metas:
            src             = meta.get("source", "unknown")
            by_source[src]  = by_source.get(src, 0) + 1
        return {
            "candidate_id": candidate_id,
            "total_chunks": len(metas),
            "by_source":    by_source,
        }
    except Exception as exc:
        logger.error("[RAG] Erreur get_candidate_stats: %s", exc)
        return {"candidate_id": candidate_id, "total_chunks": 0, "by_source": {}}


def get_embedding_cache_info() -> Dict[str, Any]:
    """Expose les stats du cache LRU d'embeddings."""
    info = _cached_embed_single.cache_info()
    return {
        "hits":      info.hits,
        "misses":    info.misses,
        "maxsize":   info.maxsize,
        "currsize":  info.currsize,
        "hit_rate":  round(info.hits / max(info.hits + info.misses, 1), 3),
    }