from __future__ import annotations

import math
import re
from collections import Counter

from .kernel import search

TOKEN_RE = re.compile(r"[\w£$%.-]+", re.UNICODE)


def tokens(text: str) -> list[str]:
    return [t.lower().strip(".-") for t in TOKEN_RE.findall(text) if t.strip(".-")]


def trigrams(text: str) -> Counter[str]:
    compact = " ".join(tokens(text))
    if len(compact) < 3:
        return Counter({compact: 1}) if compact else Counter()
    return Counter(compact[i:i+3] for i in range(len(compact) - 2))


def cosine(a: Counter[str], b: Counter[str]) -> float:
    if not a or not b:
        return 0.0
    common = set(a) & set(b)
    dot = sum(a[k] * b[k] for k in common)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb) if na and nb else 0.0


def token_overlap(query: str, text: str) -> float:
    q = set(tokens(query))
    t = set(tokens(text))
    if not q:
        return 0.0
    return len(q & t) / len(q)


def canonical_boost(status: str) -> float:
    s = (status or "").lower()
    if "current canonical" in s or s == "current_canonical":
        return 0.20
    if "canonical" in s:
        return 0.12
    if "superseded" in s or "historical" in s:
        return -0.10
    return 0.0


def hybrid_search(conn, query: str, limit: int = 10, candidate_pool: int = 60) -> list[dict]:
    """Rerank FTS candidates with zero-cost fuzzy semantic signals.

    This is deliberately model-free. It improves concept/phrase tolerance without
    requiring embeddings, an API key, a vector database or a paid runtime.
    """
    candidates = search(conn, query, max(limit, candidate_pool))
    qgrams = trigrams(query)
    reranked: list[dict] = []
    for rank, hit in enumerate(candidates):
        combined = " ".join(filter(None, [hit.get("title"), hit.get("heading"), hit.get("content")]))
        fuzzy = cosine(qgrams, trigrams(combined))
        overlap = token_overlap(query, combined)
        lexical_rank = 1.0 / (1.0 + rank)
        score = (0.45 * lexical_rank) + (0.30 * overlap) + (0.25 * fuzzy) + canonical_boost(hit.get("canonical_status", ""))
        enriched = dict(hit)
        enriched["hybrid_score"] = round(score, 6)
        enriched["signals"] = {
            "lexical_rank": round(lexical_rank, 6),
            "token_overlap": round(overlap, 6),
            "fuzzy_similarity": round(fuzzy, 6),
            "canonical_boost": canonical_boost(hit.get("canonical_status", "")),
        }
        reranked.append(enriched)
    reranked.sort(key=lambda h: h["hybrid_score"], reverse=True)
    return reranked[:limit]
