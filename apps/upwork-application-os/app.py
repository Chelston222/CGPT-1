from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "config.json"
QUEUE_PATH = ROOT / "queue.json"


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def canonical_job_key(source_url: str, external_id: str | None = None) -> str:
    seed = (external_id or source_url.strip().lower()).encode("utf-8")
    return hashlib.sha256(seed).hexdigest()[:20]


def tier_for(score: int, thresholds: dict[str, int]) -> str:
    if score >= thresholds["APEX"]: return "APEX"
    if score >= thresholds["STRONG"]: return "STRONG"
    if score >= thresholds["SELECTIVE"]: return "SELECTIVE"
    return "REJECT"


def score_job(parts: dict[str, int], config: dict[str, Any]) -> tuple[int, str]:
    total = 0
    for key, maximum in config["weights"].items():
        value = int(parts.get(key, 0))
        if value < 0 or value > maximum:
            raise ValueError(f"{key} must be between 0 and {maximum}")
        total += value
    return total, tier_for(total, config["thresholds"])


def duplicate_exists(queue: list[dict[str, Any]], job_key: str) -> bool:
    # Deliberately state-agnostic: once a canonical job has entered the ledger,
    # the machine never auto-creates a second application for it. Any exceptional
    # reconsideration must be a deliberate human ledger correction.
    return any(r.get("job_key") == job_key for r in queue)


def hard_gate(job: dict[str, Any], config: dict[str, Any], queue: list[dict[str, Any]]) -> str | None:
    if config["safety"]["require_open_job"] and not job.get("is_open", False):
        return "JOB_CLOSED"
    job_key = canonical_job_key(job["source_url"], job.get("external_id"))
    if config["safety"]["require_duplicate_check"] and duplicate_exists(queue, job_key):
        return "DUPLICATE"
    if config["safety"]["block_missing_required_facts"] and job.get("missing_required_facts"):
        return "MISSING_REQUIRED_FACT"
    if config["safety"]["block_unsupported_proof"] and job.get("unsupported_proof_required"):
        return "UNSUPPORTED_PROOF_REQUIRED"
    haystack = " ".join([str(job.get("title", "")), str(job.get("description", "")), str(job.get("requirements", ""))]).lower()
    for term in config.get("hard_reject_terms", []):
        if term.lower() in haystack:
            return f"HARD_REJECT_TERM:{term}"
    return None


def prepare_record(job: dict[str, Any], score_parts: dict[str, int], proposal: str = "", screening_answers: list[dict[str, str]] | None = None) -> dict[str, Any]:
    config = load_json(CONFIG_PATH, {})
    queue = load_json(QUEUE_PATH, [])
    job_key = canonical_job_key(job["source_url"], job.get("external_id"))
    gate = hard_gate(job, config, queue)
    score_total, tier = score_job(score_parts, config)
    if gate:
        state = "NEEDS_HUMAN_FACT" if gate == "MISSING_REQUIRED_FACT" else "REJECTED"
    elif tier == "REJECT":
        state, gate = "REJECTED", "SCORE_BELOW_THRESHOLD"
    elif not proposal.strip():
        state = "PROPOSAL_READY"
    else:
        state = "READY_TO_SUBMIT"
    return {
        "job_key": job_key, "source_url": job["source_url"], "external_id": job.get("external_id"),
        "title": job.get("title"), "client": job.get("client"), "country": job.get("country"),
        "budget": job.get("budget"), "discovered_at": job.get("discovered_at"),
        "score_breakdown": score_parts, "score_total": score_total, "tier": tier, "state": state,
        "hard_gate_reason": gate, "recommended_bid": job.get("recommended_bid"), "proposal": proposal,
        "screening_answers": screening_answers or [], "missing_facts": job.get("missing_required_facts", []),
        "submitted_at": None, "outcome": None,
    }


def enqueue(record: dict[str, Any]) -> None:
    queue = load_json(QUEUE_PATH, [])
    if duplicate_exists(queue, record["job_key"]):
        raise RuntimeError("Duplicate previously seen job blocked")
    queue.append(record)
    save_json(QUEUE_PATH, queue)


def ready_queue(limit: int | None = None) -> list[dict[str, Any]]:
    config = load_json(CONFIG_PATH, {})
    rows = [r for r in load_json(QUEUE_PATH, []) if r.get("state") == "READY_TO_SUBMIT"]
    rows.sort(key=lambda r: (r.get("score_total", 0), r.get("discovered_at") or ""), reverse=True)
    return rows[: limit or config["daily"]["max_ready_to_submit"]]


if __name__ == "__main__":
    for item in ready_queue():
        print(f"{item['tier']} {item['score_total']}/100 | {item['title']} | {item['source_url']}")
