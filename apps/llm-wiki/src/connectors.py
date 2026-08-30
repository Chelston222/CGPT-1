from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from .kernel import chunk_text, sha256_text, utcnow

CONNECTOR_SCHEMA = """
CREATE TABLE IF NOT EXISTS connector_documents (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  uri TEXT,
  observed_at TEXT NOT NULL,
  expires_at TEXT,
  content_hash TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(source, external_id)
);
CREATE TABLE IF NOT EXISTS connector_chunks (
  id INTEGER PRIMARY KEY,
  connector_document_id INTEGER NOT NULL REFERENCES connector_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  heading TEXT,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  content TEXT NOT NULL,
  UNIQUE(connector_document_id, chunk_index)
);
CREATE VIRTUAL TABLE IF NOT EXISTS connector_chunks_fts USING fts5(
  content,
  heading,
  source UNINDEXED,
  external_id UNINDEXED,
  title UNINDEXED,
  uri UNINDEXED,
  connector_document_id UNINDEXED,
  chunk_id UNINDEXED,
  tokenize='porter unicode61'
);
"""


def ensure_connector_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(CONNECTOR_SCHEMA)


def _normalise_record(record: dict[str, Any]) -> dict[str, Any]:
    required = ("source", "external_id", "title", "content")
    missing = [k for k in required if not str(record.get(k, "")).strip()]
    if missing:
        raise ValueError(f"connector record missing required fields: {', '.join(missing)}")
    return {
        "source": str(record["source"]).strip(),
        "external_id": str(record["external_id"]).strip(),
        "title": str(record["title"]).strip(),
        "content": str(record["content"]),
        "uri": str(record.get("uri", "")).strip() or None,
        "observed_at": str(record.get("observed_at", "")).strip() or utcnow(),
        "expires_at": str(record.get("expires_at", "")).strip() or None,
        "metadata": record.get("metadata", {}) if isinstance(record.get("metadata", {}), dict) else {},
    }


def upsert_connector_record(conn: sqlite3.Connection, record: dict[str, Any]) -> bool:
    ensure_connector_schema(conn)
    item = _normalise_record(record)
    digest = sha256_text(item["content"])
    existing = conn.execute(
        "SELECT id, content_hash FROM connector_documents WHERE source=? AND external_id=?",
        (item["source"], item["external_id"]),
    ).fetchone()
    if existing and existing["content_hash"] == digest:
        conn.execute(
            "UPDATE connector_documents SET observed_at=?,expires_at=?,uri=?,metadata_json=? WHERE id=?",
            (item["observed_at"], item["expires_at"], item["uri"], json.dumps(item["metadata"]), existing["id"]),
        )
        return False

    if existing:
        doc_id = existing["id"]
        conn.execute("DELETE FROM connector_chunks_fts WHERE connector_document_id=?", (doc_id,))
        conn.execute("DELETE FROM connector_chunks WHERE connector_document_id=?", (doc_id,))
        conn.execute(
            "UPDATE connector_documents SET title=?,uri=?,observed_at=?,expires_at=?,content_hash=?,metadata_json=? WHERE id=?",
            (item["title"], item["uri"], item["observed_at"], item["expires_at"], digest, json.dumps(item["metadata"]), doc_id),
        )
    else:
        cur = conn.execute(
            "INSERT INTO connector_documents(source,external_id,title,uri,observed_at,expires_at,content_hash,metadata_json) VALUES(?,?,?,?,?,?,?,?)",
            (item["source"], item["external_id"], item["title"], item["uri"], item["observed_at"], item["expires_at"], digest, json.dumps(item["metadata"])),
        )
        doc_id = cur.lastrowid

    for i, chunk in enumerate(chunk_text(item["content"])):
        cur = conn.execute(
            "INSERT INTO connector_chunks(connector_document_id,chunk_index,heading,start_line,end_line,content) VALUES(?,?,?,?,?,?)",
            (doc_id, i, chunk.heading, chunk.start_line, chunk.end_line, chunk.content),
        )
        chunk_id = cur.lastrowid
        conn.execute(
            "INSERT INTO connector_chunks_fts(content,heading,source,external_id,title,uri,connector_document_id,chunk_id) VALUES(?,?,?,?,?,?,?,?)",
            (chunk.content, chunk.heading or "", item["source"], item["external_id"], item["title"], item["uri"] or "", doc_id, chunk_id),
        )
    return True


def ingest_snapshot_file(conn: sqlite3.Connection, snapshot: Path) -> dict[str, int]:
    raw = snapshot.read_text(encoding="utf-8")
    if snapshot.suffix.lower() == ".jsonl":
        records = [json.loads(line) for line in raw.splitlines() if line.strip()]
    else:
        payload = json.loads(raw)
        records = payload if isinstance(payload, list) else payload.get("records", [])
    changed = 0
    for record in records:
        changed += int(upsert_connector_record(conn, record))
    conn.commit()
    return {"records_seen": len(records), "records_changed": changed}


def connector_search(conn: sqlite3.Connection, query: str, limit: int = 10) -> list[dict]:
    ensure_connector_schema(conn)
    tokens = [t.replace('"', '""') for t in query.split() if t.strip()]
    if not tokens:
        return []
    fts = " OR ".join(f'"{t}"' for t in tokens)
    rows = conn.execute(
        """
        SELECT f.source, f.external_id, f.title, f.uri, c.heading, c.start_line, c.end_line,
               c.content, d.observed_at, d.expires_at, d.metadata_json,
               bm25(connector_chunks_fts, 1.0, 2.0) AS score
        FROM connector_chunks_fts f
        JOIN connector_chunks c ON c.id=CAST(f.chunk_id AS INTEGER)
        JOIN connector_documents d ON d.id=CAST(f.connector_document_id AS INTEGER)
        WHERE connector_chunks_fts MATCH ?
        ORDER BY score ASC LIMIT ?
        """,
        (fts, limit),
    ).fetchall()
    output = []
    for row in rows:
        item = dict(row)
        item["metadata"] = json.loads(item.pop("metadata_json") or "{}")
        item["volatile"] = True
        item["verification_required"] = True
        output.append(item)
    return output


def connector_stats(conn: sqlite3.Connection) -> dict[str, int]:
    ensure_connector_schema(conn)
    return {
        "connector_documents": conn.execute("SELECT COUNT(*) FROM connector_documents").fetchone()[0],
        "connector_chunks": conn.execute("SELECT COUNT(*) FROM connector_chunks").fetchone()[0],
        "connector_sources": conn.execute("SELECT COUNT(DISTINCT source) FROM connector_documents").fetchone()[0],
    }
