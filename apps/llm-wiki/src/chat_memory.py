from __future__ import annotations

import csv
import hashlib
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

CHAT_SCHEMA = """
CREATE TABLE IF NOT EXISTS chat_conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  create_time REAL,
  update_time REAL,
  source_hash TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at REAL,
  text TEXT NOT NULL,
  content_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, created_at);
CREATE VIRTUAL TABLE IF NOT EXISTS chat_messages_fts USING fts5(
  text,
  role UNINDEXED,
  conversation_id UNINDEXED,
  message_id UNINDEXED,
  tokenize='porter unicode61'
);
CREATE TABLE IF NOT EXISTS memory_candidates (
  id INTEGER PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  statement TEXT NOT NULL,
  fingerprint TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'review',
  confidence REAL NOT NULL DEFAULT 0.5,
  source_excerpt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  supersedes_fingerprint TEXT
);
CREATE INDEX IF NOT EXISTS idx_memory_candidates_status ON memory_candidates(status, kind);
CREATE TABLE IF NOT EXISTS chat_ingest_runs (
  id INTEGER PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  source TEXT NOT NULL,
  conversations_seen INTEGER NOT NULL DEFAULT 0,
  messages_seen INTEGER NOT NULL DEFAULT 0,
  messages_changed INTEGER NOT NULL DEFAULT 0,
  candidates_added INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running'
);
"""

CUE_PATTERNS: tuple[tuple[str, re.Pattern[str], float], ...] = (
    ("rule", re.compile(r"\b(always|never|must|do not|don't|from now on|forever|non[- ]negotiable)\b", re.I), 0.82),
    ("decision", re.compile(r"\b(we(?:'|’)ll|we will|let(?:'|’)s|go with|decided|decision:|use this|lock this|approved)\b", re.I), 0.72),
    ("preference", re.compile(r"\b(i prefer|prefer to|i want|i don(?:'|’)t want|i like|i love|default to)\b", re.I), 0.68),
    ("open_loop", re.compile(r"\b(need to|needs to|next step|later|follow up|come back to|todo|to do|still need)\b", re.I), 0.58),
)
SUPERSESSION_RE = re.compile(r"\b(instead of|replace(?:s|d)?|no longer|supersede(?:s|d)?|rather than)\b", re.I)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sha(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def ensure_chat_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(CHAT_SCHEMA)


def _normalise_statement(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()[:1200]


def _fingerprint(kind: str, statement: str) -> str:
    canonical = re.sub(r"[^\w£$]+", " ", statement.lower(), flags=re.UNICODE)
    return _sha(f"{kind}:{' '.join(canonical.split())}")


def _message_text(message: dict[str, Any]) -> str:
    content = message.get("content") or {}
    parts = content.get("parts") or []
    out: list[str] = []
    for part in parts:
        if isinstance(part, str):
            out.append(part)
        elif isinstance(part, dict):
            if isinstance(part.get("text"), str):
                out.append(part["text"])
            elif isinstance(part.get("content"), str):
                out.append(part["content"])
    return "\n".join(x for x in out if x).strip()


def _active_nodes(conversation: dict[str, Any]) -> list[dict[str, Any]]:
    mapping = conversation.get("mapping") or {}
    current = conversation.get("current_node")
    chain: list[dict[str, Any]] = []
    seen: set[str] = set()
    while current and current not in seen and current in mapping:
        seen.add(current)
        node = mapping[current]
        chain.append(node)
        current = node.get("parent")
    if chain:
        chain.reverse()
        return chain
    nodes = [n for n in mapping.values() if isinstance(n, dict)]
    return sorted(nodes, key=lambda n: ((n.get("message") or {}).get("create_time") or 0.0, str(n.get("id", ""))))


def iter_messages(conversation: dict[str, Any]) -> Iterable[dict[str, Any]]:
    for node in _active_nodes(conversation):
        message = node.get("message") or {}
        text = _message_text(message)
        role = ((message.get("author") or {}).get("role") or "unknown").lower()
        if not text or role not in {"user", "assistant", "system", "developer"}:
            continue
        yield {"id": str(message.get("id") or node.get("id") or _sha(text)), "role": role, "created_at": message.get("create_time"), "text": text}


def extract_candidates(text: str) -> list[tuple[str, str, float, str | None]]:
    """Deterministic candidate extraction. Nothing here becomes canonical automatically."""
    candidates: list[tuple[str, str, float, str | None]] = []
    blocks = [b.strip() for b in re.split(r"\n{2,}|(?<=[.!?])\s+(?=[A-Z0-9])", text) if b.strip()]
    for block in blocks:
        statement = _normalise_statement(block)
        if len(statement) < 12:
            continue
        for kind, pattern, confidence in CUE_PATTERNS:
            if pattern.search(statement):
                candidates.append((kind, statement, confidence, "explicit-supersession-cue" if SUPERSESSION_RE.search(statement) else None))
                break
    return candidates


def _upsert_message(conn: sqlite3.Connection, conversation_id: str, msg: dict[str, Any]) -> bool:
    digest = _sha(msg["text"])
    existing = conn.execute("SELECT content_hash FROM chat_messages WHERE id=?", (msg["id"],)).fetchone()
    if existing and existing[0] == digest:
        return False
    if existing:
        conn.execute("DELETE FROM chat_messages_fts WHERE message_id=?", (msg["id"],))
        conn.execute("UPDATE chat_messages SET conversation_id=?,role=?,created_at=?,text=?,content_hash=? WHERE id=?", (conversation_id, msg["role"], msg.get("created_at"), msg["text"], digest, msg["id"]))
    else:
        conn.execute("INSERT INTO chat_messages(id,conversation_id,role,created_at,text,content_hash) VALUES(?,?,?,?,?,?)", (msg["id"], conversation_id, msg["role"], msg.get("created_at"), msg["text"], digest))
    conn.execute("INSERT INTO chat_messages_fts(text,role,conversation_id,message_id) VALUES(?,?,?,?)", (msg["text"], msg["role"], conversation_id, msg["id"]))
    return True


def _insert_candidate(conn: sqlite3.Connection, conversation_id: str, message_id: str, kind: str, statement: str, confidence: float, supersedes: str | None = None) -> int:
    statement = _normalise_statement(statement)
    if not statement:
        return 0
    fp = _fingerprint(kind, statement)
    cur = conn.execute(
        "INSERT OR IGNORE INTO memory_candidates(conversation_id,message_id,kind,statement,fingerprint,status,confidence,source_excerpt,created_at,supersedes_fingerprint) VALUES(?,?,?,?,?,'review',?,?,?,?)",
        (conversation_id, message_id, kind, statement, fp, max(0.0, min(1.0, confidence)), statement[:320], _now(), supersedes),
    )
    return int(cur.rowcount > 0)


def _candidate_rows(conn: sqlite3.Connection, conversation_id: str, msg: dict[str, Any]) -> int:
    if msg["role"] != "user":
        return 0
    return sum(_insert_candidate(conn, conversation_id, msg["id"], kind, statement, confidence, supersedes) for kind, statement, confidence, supersedes in extract_candidates(msg["text"]))


def ingest_export(conn: sqlite3.Connection, export_path: Path) -> dict[str, int]:
    ensure_chat_schema(conn)
    payload = json.loads(export_path.read_text(encoding="utf-8"))
    conversations = payload if isinstance(payload, list) else payload.get("conversations", [])
    if not isinstance(conversations, list):
        raise ValueError("ChatGPT export must be a conversations.json list or an object containing conversations")
    run_id = conn.execute("INSERT INTO chat_ingest_runs(started_at,source) VALUES(?,?)", (_now(), str(export_path))).lastrowid
    messages_seen = changed = candidates = 0
    try:
        for conv in conversations:
            if not isinstance(conv, dict):
                continue
            cid = str(conv.get("id") or conv.get("conversation_id") or _sha(json.dumps(conv, sort_keys=True)))
            title = str(conv.get("title") or "Untitled conversation")
            conv_hash = _sha(json.dumps(conv, ensure_ascii=False, sort_keys=True))
            conn.execute(
                "INSERT INTO chat_conversations(id,title,create_time,update_time,source_hash,ingested_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,create_time=excluded.create_time,update_time=excluded.update_time,source_hash=excluded.source_hash,ingested_at=excluded.ingested_at",
                (cid, title, conv.get("create_time"), conv.get("update_time"), conv_hash, _now()),
            )
            for msg in iter_messages(conv):
                messages_seen += 1
                did_change = _upsert_message(conn, cid, msg)
                changed += int(did_change)
                if did_change:
                    candidates += _candidate_rows(conn, cid, msg)
        conn.execute("UPDATE chat_ingest_runs SET finished_at=?,conversations_seen=?,messages_seen=?,messages_changed=?,candidates_added=?,status='ok' WHERE id=?", (_now(), len(conversations), messages_seen, changed, candidates, run_id))
        conn.commit()
        return {"conversations_seen": len(conversations), "messages_seen": messages_seen, "messages_changed": changed, "candidates_added": candidates}
    except Exception:
        conn.rollback()
        conn.execute("UPDATE chat_ingest_runs SET finished_at=?,status='failed' WHERE id=?", (_now(), run_id))
        conn.commit()
        raise


def ingest_events(conn: sqlite3.Connection, jsonl_path: Path) -> dict[str, int]:
    """Incremental bridge: one JSON object per line with conversation_id, message_id, role, text and optional timestamps/title."""
    ensure_chat_schema(conn)
    run_id = conn.execute("INSERT INTO chat_ingest_runs(started_at,source) VALUES(?,?)", (_now(), str(jsonl_path))).lastrowid
    seen = changed = candidates = 0
    conversation_ids: set[str] = set()
    try:
        with jsonl_path.open("r", encoding="utf-8") as fh:
            for raw in fh:
                if not raw.strip():
                    continue
                item = json.loads(raw)
                cid, mid = str(item["conversation_id"]), str(item["message_id"])
                text, role = str(item["text"]).strip(), str(item.get("role", "user")).lower()
                if not text:
                    continue
                conversation_ids.add(cid)
                seen += 1
                conn.execute(
                    "INSERT INTO chat_conversations(id,title,create_time,update_time,source_hash,ingested_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,update_time=excluded.update_time,source_hash=excluded.source_hash,ingested_at=excluded.ingested_at",
                    (cid, str(item.get("title") or "Incremental conversation"), item.get("conversation_create_time"), item.get("created_at"), _sha(cid), _now()),
                )
                msg = {"id": mid, "role": role, "created_at": item.get("created_at"), "text": text}
                did_change = _upsert_message(conn, cid, msg)
                changed += int(did_change)
                if did_change:
                    candidates += _candidate_rows(conn, cid, msg)
        conn.execute("UPDATE chat_ingest_runs SET finished_at=?,conversations_seen=?,messages_seen=?,messages_changed=?,candidates_added=?,status='ok' WHERE id=?", (_now(), len(conversation_ids), seen, changed, candidates, run_id))
        conn.commit()
        return {"conversations_seen": len(conversation_ids), "messages_seen": seen, "messages_changed": changed, "candidates_added": candidates}
    except Exception:
        conn.rollback()
        conn.execute("UPDATE chat_ingest_runs SET finished_at=?,status='failed' WHERE id=?", (_now(), run_id))
        conn.commit()
        raise


def ingest_migration_csv(conn: sqlite3.Connection, csv_path: Path) -> dict[str, int]:
    """Import the reviewed OMEGA 75-chat migration sheet as historical evidence.

    Structured decisions/open loops become review candidates, never canonical facts.
    """
    ensure_chat_schema(conn)
    run_id = conn.execute("INSERT INTO chat_ingest_runs(started_at,source) VALUES(?,?)", (_now(), str(csv_path))).lastrowid
    rows_seen = messages_changed = candidates = 0
    conversation_ids: set[str] = set()
    try:
        with csv_path.open("r", encoding="utf-8-sig", newline="") as fh:
            for index, row in enumerate(csv.DictReader(fh), start=1):
                if not row:
                    continue
                rows_seen += 1
                cid = str(row.get("chat_id") or row.get("index") or f"legacy-{index}").strip()
                cid = f"migration:{cid}"
                conversation_ids.add(cid)
                title = (row.get("canonical_title") or row.get("original_title") or f"Migration record {index}").strip()
                evidence_fields = [
                    ("Summary", row.get("summary") or ""),
                    ("Decisions", row.get("decisions") or ""),
                    ("Open loops", row.get("open_loops") or ""),
                    ("Next action", row.get("next_action") or ""),
                    ("Current state", row.get("current_state") or ""),
                    ("Superseded by", row.get("superseded_by") or ""),
                ]
                evidence = "\n".join(f"{label}: {value.strip()}" for label, value in evidence_fields if value and value.strip())
                if not evidence:
                    continue
                conn.execute(
                    "INSERT INTO chat_conversations(id,title,create_time,update_time,source_hash,ingested_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,source_hash=excluded.source_hash,ingested_at=excluded.ingested_at",
                    (cid, title, None, None, _sha(json.dumps(row, sort_keys=True)), _now()),
                )
                mid = f"{cid}:record"
                did_change = _upsert_message(conn, cid, {"id": mid, "role": "system", "created_at": None, "text": evidence})
                messages_changed += int(did_change)
                try:
                    confidence = float(row.get("classification_confidence") or 0.75)
                except ValueError:
                    confidence = 0.75
                if did_change:
                    if (row.get("decisions") or "").strip():
                        candidates += _insert_candidate(conn, cid, mid, "decision", row["decisions"], confidence, row.get("superseded_by") or None)
                    if (row.get("open_loops") or "").strip():
                        candidates += _insert_candidate(conn, cid, mid, "open_loop", row["open_loops"], confidence)
                    if (row.get("next_action") or "").strip():
                        candidates += _insert_candidate(conn, cid, mid, "open_loop", row["next_action"], confidence)
        conn.execute("UPDATE chat_ingest_runs SET finished_at=?,conversations_seen=?,messages_seen=?,messages_changed=?,candidates_added=?,status='ok' WHERE id=?", (_now(), len(conversation_ids), rows_seen, messages_changed, candidates, run_id))
        conn.commit()
        return {"conversations_seen": len(conversation_ids), "rows_seen": rows_seen, "messages_changed": messages_changed, "candidates_added": candidates}
    except Exception:
        conn.rollback()
        conn.execute("UPDATE chat_ingest_runs SET finished_at=?,status='failed' WHERE id=?", (_now(), run_id))
        conn.commit()
        raise


def chat_search(conn: sqlite3.Connection, query: str, limit: int = 10) -> list[dict[str, Any]]:
    ensure_chat_schema(conn)
    terms = [t for t in re.findall(r"[\w£$.-]+", query, re.UNICODE) if t.strip(".-")]
    if not terms:
        return []
    fts = " OR ".join(f'"{t.replace(chr(34), chr(34)*2)}"' for t in terms)
    rows = conn.execute(
        "SELECT f.message_id,f.conversation_id,f.role,f.text,c.title,m.created_at,bm25(chat_messages_fts,1.0) AS score FROM chat_messages_fts f JOIN chat_messages m ON m.id=f.message_id JOIN chat_conversations c ON c.id=f.conversation_id WHERE chat_messages_fts MATCH ? ORDER BY score ASC LIMIT ?",
        (fts, limit),
    ).fetchall()
    return [dict(r) for r in rows]


def candidate_stats(conn: sqlite3.Connection) -> dict[str, Any]:
    ensure_chat_schema(conn)
    return {
        "chat_conversations": conn.execute("SELECT COUNT(*) FROM chat_conversations").fetchone()[0],
        "chat_messages": conn.execute("SELECT COUNT(*) FROM chat_messages").fetchone()[0],
        "memory_candidates_review": conn.execute("SELECT COUNT(*) FROM memory_candidates WHERE status='review'").fetchone()[0],
        "memory_candidates_total": conn.execute("SELECT COUNT(*) FROM memory_candidates").fetchone()[0],
        "last_chat_ingest": dict(conn.execute("SELECT * FROM chat_ingest_runs ORDER BY id DESC LIMIT 1").fetchone() or {}),
    }


def list_candidates(conn: sqlite3.Connection, limit: int = 50, status: str = "review") -> list[dict[str, Any]]:
    ensure_chat_schema(conn)
    rows = conn.execute("SELECT id,conversation_id,message_id,kind,statement,fingerprint,status,confidence,source_excerpt,created_at,supersedes_fingerprint FROM memory_candidates WHERE status=? ORDER BY confidence DESC,id DESC LIMIT ?", (status, limit)).fetchall()
    return [dict(r) for r in rows]
