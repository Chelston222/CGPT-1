from __future__ import annotations

import json
from datetime import datetime, timezone

CANONICAL_MARKERS = ("current canonical", "current_canonical", "canonical")


def _parse_date(value: str | None):
    if not value:
        return None
    raw = str(value).strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(raw)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        try:
            return datetime.strptime(raw[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            return None


def governance_issues(conn, stale_days: int = 180) -> list[dict]:
    """Detect high-confidence governance problems without asking a model to invent conflicts.

    Semantic conflict detection is intentionally evidence-first: documents can declare a
    `canonical_key` and `canonical_value` in frontmatter/metadata. Multiple active values
    for the same key become a blocking conflict with both source paths preserved.
    """
    rows = conn.execute("SELECT path,title,canonical_status,modified_at,metadata_json FROM documents ORDER BY path").fetchall()
    issues: list[dict] = []
    claims: dict[str, list[dict]] = {}
    now = datetime.now(timezone.utc)

    for row in rows:
        meta = json.loads(row["metadata_json"] or "{}")
        status = (row["canonical_status"] or "").lower()
        is_canonical = any(marker in status for marker in CANONICAL_MARKERS)
        key = str(meta.get("canonical_key", "")).strip()
        value = str(meta.get("canonical_value", "")).strip()
        if is_canonical and key and value:
            claims.setdefault(key, []).append({"path": row["path"], "value": value, "title": row["title"]})

        if is_canonical:
            updated = _parse_date(str(meta.get("updated") or meta.get("effective_date") or row["modified_at"] or ""))
            if updated:
                age = (now - updated).days
                if age > stale_days:
                    issues.append({
                        "severity": "warn",
                        "type": "stale_canonical",
                        "path": row["path"],
                        "age_days": age,
                        "threshold_days": stale_days,
                    })

    for key, entries in claims.items():
        values = {entry["value"] for entry in entries}
        if len(values) > 1:
            issues.append({
                "severity": "error",
                "type": "canonical_conflict",
                "canonical_key": key,
                "claims": entries,
                "action": "Do not guess. Resolve the conflict at source before consequential use.",
            })
    return issues
