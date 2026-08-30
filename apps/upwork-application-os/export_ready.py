from __future__ import annotations

import json
from pathlib import Path
from app import ready_queue

OUT = Path(__file__).resolve().parent / "ready-to-submit.json"


def export() -> list[dict]:
    rows = ready_queue()
    payload = []
    for r in rows:
        payload.append({
            "job_key": r["job_key"],
            "tier": r["tier"],
            "score": r["score_total"],
            "title": r.get("title"),
            "client": r.get("client"),
            "url": r["source_url"],
            "recommended_bid": r.get("recommended_bid"),
            "proposal": r.get("proposal"),
            "screening_answers": r.get("screening_answers", []),
            "manual_action": "Open URL, verify job is still open, review facts, submit manually on Upwork",
        })
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return payload

if __name__ == "__main__":
    print(json.dumps(export(), indent=2, ensure_ascii=False))
