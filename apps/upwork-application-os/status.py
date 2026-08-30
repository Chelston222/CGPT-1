from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app import QUEUE_PATH, load_json, save_json

ALLOWED = {
    "DISCOVERED": {"SCORED", "REJECTED"},
    "SCORED": {"PROPOSAL_READY", "NEEDS_HUMAN_FACT", "REJECTED"},
    "PROPOSAL_READY": {"READY_TO_SUBMIT", "NEEDS_HUMAN_FACT", "REJECTED"},
    "NEEDS_HUMAN_FACT": {"PROPOSAL_READY", "READY_TO_SUBMIT", "REJECTED"},
    "READY_TO_SUBMIT": {"SUBMITTED", "REJECTED"},
    "SUBMITTED": {"REPLIED", "INTERVIEW", "WON", "LOST", "SUPPRESSED"},
    "REPLIED": {"INTERVIEW", "WON", "LOST", "SUPPRESSED"},
    "INTERVIEW": {"WON", "LOST", "SUPPRESSED"},
    "WON": set(), "LOST": set(), "REJECTED": set(), "SUPPRESSED": set(),
}


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def transition(job_key: str, new_state: str, **fields: Any) -> dict[str, Any]:
    queue = load_json(QUEUE_PATH, [])
    for row in queue:
        if row.get("job_key") != job_key:
            continue
        old = row.get("state")
        if new_state not in ALLOWED.get(old, set()):
            raise ValueError(f"Illegal transition {old} -> {new_state}")
        row["state"] = new_state
        row["updated_at"] = now()
        row.update(fields)
        if new_state == "SUBMITTED": row["submitted_at"] = row.get("submitted_at") or now()
        if new_state in {"WON", "LOST"}: row["outcome"] = new_state
        save_json(QUEUE_PATH, queue)
        return row
    raise KeyError(job_key)


def metrics() -> dict[str, Any]:
    q = load_json(QUEUE_PATH, [])
    submitted = [r for r in q if r.get("submitted_at")]
    replies = [r for r in q if r.get("state") in {"REPLIED", "INTERVIEW", "WON"}]
    interviews = [r for r in q if r.get("state") in {"INTERVIEW", "WON"}]
    wins = [r for r in q if r.get("state") == "WON"]
    connects = sum(float(r.get("connects_spent") or 0) for r in q)
    revenue = sum(float(r.get("revenue_won") or 0) for r in wins)
    n = len(submitted)
    return {
        "submitted": n,
        "replies": len(replies),
        "interviews": len(interviews),
        "wins": len(wins),
        "reply_rate": len(replies) / n if n else 0,
        "interview_rate": len(interviews) / n if n else 0,
        "win_rate": len(wins) / n if n else 0,
        "connects_spent": connects,
        "revenue_won": revenue,
        "revenue_per_connect": revenue / connects if connects else 0,
    }
