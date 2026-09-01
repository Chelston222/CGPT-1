"""Retired direct cloned-template updater.

The previous implementation contained hard-coded cloned template IDs and the
superseded Jotform route. It is intentionally fail-closed. Use the current
idempotent reusable-template deployment plus read-only live-account verifier
instead. This file performs no external writes.
"""

raise SystemExit(
    "RETIRED: direct cloned-template patching is blocked. Use deploy_templates.py "
    "through the manual draft-deployment workflow, then verify_apex_v2_flow.py."
)
