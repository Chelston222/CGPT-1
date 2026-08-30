"""Official Upwork API submission boundary.

Fail closed by default. This module must never fall back to browser automation,
scraping, credential replay, or UI clicking.
"""
from __future__ import annotations

import os
from typing import Any


def api_enabled() -> bool:
    return os.getenv("UPWORK_API_AUTO_SUBMIT", "false").lower() == "true"


def validate_credentials() -> None:
    required = ["UPWORK_ACCESS_TOKEN"]
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        raise RuntimeError("Official Upwork API credentials unavailable: " + ", ".join(missing))


def submit_proposal(record: dict[str, Any]) -> dict[str, Any]:
    if not api_enabled():
        raise RuntimeError("API_AUTO_SUBMIT is disabled. Keep record in READY_TO_SUBMIT.")
    validate_credentials()
    if record.get("state") != "READY_TO_SUBMIT":
        raise RuntimeError("Only READY_TO_SUBMIT records may be submitted")
    if record.get("hard_gate_reason"):
        raise RuntimeError("Hard-gated records cannot be submitted")
    # Intentionally dormant until Upwork approves the account/key and the exact
    # current GraphQL schema + Submit Proposal scope are verified live.
    # No browser-automation fallback is permitted.
    raise RuntimeError("Official API adapter locked pending approved Submit Proposal scope")
