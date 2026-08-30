"""Official Upwork API submission boundary. No browser/scraping fallback."""
from __future__ import annotations
import os
from typing import Any


def api_enabled() -> bool:
    return os.getenv("UPWORK_API_AUTO_SUBMIT", "false").lower() == "true"


def approval_confirmed() -> bool:
    return os.getenv("UPWORK_SUBMIT_PROPOSAL_SCOPE_CONFIRMED", "false").lower() == "true"


def validate_credentials() -> None:
    missing=[n for n in ["UPWORK_ACCESS_TOKEN"] if not os.getenv(n)]
    if missing: raise RuntimeError("Official Upwork API credentials unavailable: " + ", ".join(missing))


def submit_proposal(record: dict[str, Any]) -> dict[str, Any]:
    if not api_enabled(): raise RuntimeError("API_AUTO_SUBMIT is disabled. Keep record in READY_TO_SUBMIT.")
    if not approval_confirmed(): raise RuntimeError("Submit Proposal scope has not been explicitly confirmed")
    validate_credentials()
    if record.get("state") != "READY_TO_SUBMIT": raise RuntimeError("Only READY_TO_SUBMIT records may be submitted")
    if record.get("hard_gate_reason"): raise RuntimeError("Hard-gated records cannot be submitted")
    # Deliberately locked until the exact live official mutation/schema is verified
    # after account approval. Never substitute browser automation.
    raise RuntimeError("Official API transport locked pending live schema verification")
