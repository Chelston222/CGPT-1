from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

WIKI_LINK_RE = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
FRONTMATTER_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*(?:\n|\Z)", re.S)

SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  canonical_status TEXT NOT NULL DEFAULT 'indexed',
  content_hash TEXT NOT NULL,
  modified_at TEXT,
  indexed_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  heading TEXT,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  content TEXT NOT NULL,
  UNIQUE(document_id, chunk_index)
);
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  content,
  heading,
  path UNINDEXED,
  document_id UNINDEXED,
  chunk_id UNINDEXED,
  tokenize='porter unicode61'
);
CREATE TABLE IF NOT EXISTS links (
  source_document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  target TEXT NOT NULL,
  UNIQUE(source_document_id, target)
);
CREATE TABLE IF NOT EXISTS ingest_runs (
  id INTEGER PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  files_seen INTEGER NOT NULL DEFAULT 0,
  files_changed INTEGER NOT NULL DEFAULT 0,
  files_removed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running'
);
"""


@dataclass(frozen=True)
class Chunk:
    heading: str | None
    start_line: int
    end_line: int
    content: str


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def load_source_config(config_path: Path) -> dict:
    return json.loads(config_path.read_text(encoding="utf-8"))


def _matches_any(path: str, patterns: Iterable[str]) -> bool:
    p = Path(path)
    return any(p.match(pattern) for pattern in patterns)


def discover_sources(repo: Path, config: dict) -> list[Path]:
    include = config.get("include", [])
    exclude = config.get("exclude", [])
    allowed = {e.lower() for e in config.get("extensions", [".md", ".json", ".txt"])}
    found: dict[str, Path] = {}
    for pattern in include:
        for candidate in repo.glob(pattern):
            if not candidate.is_file() or candidate.suffix.lower() not in allowed:
                continue
            rel = candidate.relative_to(repo).as_posix()
            if _matches_any(rel, exclude):
                continue
            found[rel] = candidate
    return [found[k] for k in sorted(found)]


def parse_frontmatter(text: str) -> tuple[dict, str]:
    match = FRONTMATTER_RE.match(text)
    if not match:
        return {}, text
    metadata: dict[str, object] = {}
    for raw in match.group(1).splitlines():
        if ":" not in raw or raw.lstrip().startswith("#"):
            continue
        key, value = raw.split(":", 1)
        value = value.strip().strip('"').strip("'")
        metadata[key.strip()] = value
    return metadata, text[match.end():]


def normalise_json(text: str) -> tuple[str, dict]:
    data = json.loads(text)
    pretty = json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True)
    meta = {"json_root": type(data).__name__}
    if isinstance(data, dict):
        for key in ("title", "name", "version", "status", "effective_date"):
            if key in data and isinstance(data[key], (str, int, float, bool)):
                meta[key] = str(data[key])
    return pretty, meta


def extract_title(path: Path, text: str, metadata: dict) -> str:
    if metadata.get("title"):
        return str(metadata["title"])
    for line in text.splitlines():
        m = HEADING_RE.match(line)
        if m and len(m.group(1)) == 1:
            return m.group(2).strip()
    return path.stem


def chunk_text(text: str, max_chars: int = 4200) -> list[Chunk]:
    lines = text.splitlines()
    chunks: list[Chunk] = []
    current: list[str] = []
    start = 1
    heading: str | None = None

    def flush(end_line: int) -> None:
        nonlocal current, start
        body = "\n".join(current).strip()
        if body:
            chunks.append(Chunk(heading, start, max(start, end_line), body))
        current = []

    for idx, line in enumerate(lines, start=1):
        hm = HEADING_RE.match(line)
        projected = sum(len(x) + 1 for x in current) + len(line)
        if current and (projected > max_chars or (hm and len(current) > 4)):
            flush(idx - 1)
            start = idx
        if hm:
            heading = hm.group(2).strip()
            if not current:
                start = idx
        current.append(line)
    flush(len(lines) or 1)
    return chunks


def index_file(conn: sqlite3.Connection, repo: Path, file_path: Path) -> bool:
    rel = file_path.relative_to(repo).as_posix()
    raw = file_path.read_text(encoding="utf-8", errors="replace")
    source_type = file_path.suffix.lower().lstrip(".") or "text"
    metadata: dict = {}
    index_text = raw
    if file_path.suffix.lower() == ".json":
        try:
            index_text, metadata = normalise_json(raw)
        except json.JSONDecodeError as exc:
            metadata = {"parse_error": str(exc)}
    elif file_path.suffix.lower() == ".md":
        metadata, index_text = parse_frontmatter(raw)

    digest = sha256_text(raw)
    existing = conn.execute("SELECT id, content_hash FROM documents WHERE path=?", (rel,)).fetchone()
    if existing and existing["content_hash"] == digest:
        return False

    title = extract_title(file_path, index_text, metadata)
    canonical_status = str(metadata.get("status", "indexed")).lower()
    mtime = datetime.fromtimestamp(file_path.stat().st_mtime, timezone.utc).isoformat()
    now = utcnow()

    if existing:
        doc_id = existing["id"]
        conn.execute(
            "UPDATE documents SET title=?,source_type=?,canonical_status=?,content_hash=?,modified_at=?,indexed_at=?,metadata_json=? WHERE id=?",
            (title, source_type, canonical_status, digest, mtime, now, json.dumps(metadata), doc_id),
        )
        conn.execute("DELETE FROM chunks_fts WHERE document_id=?", (doc_id,))
        conn.execute("DELETE FROM chunks WHERE document_id=?", (doc_id,))
        conn.execute("DELETE FROM links WHERE source_document_id=?", (doc_id,))
    else:
        cur = conn.execute(
            "INSERT INTO documents(path,title,source_type,canonical_status,content_hash,modified_at,indexed_at,metadata_json) VALUES(?,?,?,?,?,?,?,?)",
            (rel, title, source_type, canonical_status, digest, mtime, now, json.dumps(metadata)),
        )
        doc_id = cur.lastrowid

    for i, chunk in enumerate(chunk_text(index_text)):
        cur = conn.execute(
            "INSERT INTO chunks(document_id,chunk_index,heading,start_line,end_line,content) VALUES(?,?,?,?,?,?)",
            (doc_id, i, chunk.heading, chunk.start_line, chunk.end_line, chunk.content),
        )
        chunk_id = cur.lastrowid
        conn.execute(
            "INSERT INTO chunks_fts(content,heading,path,document_id,chunk_id) VALUES(?,?,?,?,?)",
            (chunk.content, chunk.heading or "", rel, doc_id, chunk_id),
        )

    for target in sorted(set(WIKI_LINK_RE.findall(raw))):
        conn.execute("INSERT OR IGNORE INTO links(source_document_id,target) VALUES(?,?)", (doc_id, target.strip()))
    return True


def ingest(conn: sqlite3.Connection, repo: Path, config: dict) -> dict:
    started = utcnow()
    run_id = conn.execute("INSERT INTO ingest_runs(started_at) VALUES(?)", (started,)).lastrowid
    files = discover_sources(repo, config)
    changed = 0
    seen_paths = set()
    try:
        for file_path in files:
            seen_paths.add(file_path.relative_to(repo).as_posix())
            changed += int(index_file(conn, repo, file_path))
        indexed_paths = {r["path"] for r in conn.execute("SELECT path FROM documents")}
        removed_paths = indexed_paths - seen_paths
        for rel in removed_paths:
            conn.execute("DELETE FROM documents WHERE path=?", (rel,))
        conn.execute(
            "UPDATE ingest_runs SET finished_at=?,files_seen=?,files_changed=?,files_removed=?,status='ok' WHERE id=?",
            (utcnow(), len(files), changed, len(removed_paths), run_id),
        )
        conn.commit()
        return {"files_seen": len(files), "files_changed": changed, "files_removed": len(removed_paths)}
    except Exception:
        conn.rollback()
        conn.execute("UPDATE ingest_runs SET finished_at=?,status='failed' WHERE id=?", (utcnow(), run_id))
        conn.commit()
        raise


def _fts_query(query: str) -> str:
    tokens = re.findall(r"[\w£$.-]+", query, re.UNICODE)
    safe = [t.replace('"', '""') for t in tokens if t.strip(".-")]
    return " OR ".join(f'"{t}"' for t in safe)


def search(conn: sqlite3.Connection, query: str, limit: int = 10) -> list[dict]:
    fts = _fts_query(query)
    if not fts:
        return []
    rows = conn.execute(
        """
        SELECT f.path, f.heading, c.start_line, c.end_line, c.content,
               d.title, d.canonical_status, bm25(chunks_fts, 1.0, 2.0) AS score
        FROM chunks_fts f
        JOIN chunks c ON c.id = CAST(f.chunk_id AS INTEGER)
        JOIN documents d ON d.id = CAST(f.document_id AS INTEGER)
        WHERE chunks_fts MATCH ?
        ORDER BY score ASC
        LIMIT ?
        """,
        (fts, limit),
    ).fetchall()
    return [dict(r) for r in rows]


def lint(conn: sqlite3.Connection) -> list[dict]:
    issues: list[dict] = []
    docs = conn.execute("SELECT * FROM documents ORDER BY path").fetchall()
    titles: dict[str, list[str]] = {}
    paths = {d["path"] for d in docs}
    stems = {Path(p).stem.lower() for p in paths}
    for d in docs:
        titles.setdefault(d["title"].strip().lower(), []).append(d["path"])
        meta = json.loads(d["metadata_json"] or "{}")
        if meta.get("parse_error"):
            issues.append({"severity": "error", "type": "parse_error", "path": d["path"], "detail": meta["parse_error"]})
        if d["source_type"] == "md" and not d["title"].strip():
            issues.append({"severity": "warn", "type": "missing_title", "path": d["path"]})
    for title, dupes in titles.items():
        if title and len(dupes) > 1:
            issues.append({"severity": "info", "type": "duplicate_title", "title": title, "paths": dupes})
    for row in conn.execute("SELECT d.path, l.target FROM links l JOIN documents d ON d.id=l.source_document_id"):
        if row["target"].lower() not in stems:
            issues.append({"severity": "warn", "type": "unresolved_wikilink", "path": row["path"], "target": row["target"]})
    return issues


def stats(conn: sqlite3.Connection) -> dict:
    return {
        "documents": conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0],
        "chunks": conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0],
        "links": conn.execute("SELECT COUNT(*) FROM links").fetchone()[0],
        "last_ingest": dict(conn.execute("SELECT * FROM ingest_runs ORDER BY id DESC LIMIT 1").fetchone() or {}),
    }
