"""Guarded status controller for the canonical 222 Emails Klaviyo flow.

Supported targets:
- manual: canary mode. Eligible profiles can enter and queue for review, but the
  flow does not automatically send messages.
- draft: emergency stop / rollback. New recipients are not scheduled.

This script is deliberately separate from production-live activation.
"""
import json
import os
import urllib.error
import urllib.request

REVISION = "2026-07-15"
FLOW_ID = "TWM6Yx"
KEY = os.environ["KLAVIYO_PRIVATE_API_KEY"]
TARGET = os.environ.get("TARGET_STATUS", "").strip().lower()
CONFIRMATION = os.environ.get("STATUS_CONFIRMATION", "")

allowed = {"manual", "draft"}
if TARGET not in allowed:
    raise SystemExit(f"STATUS CHANGE BLOCKED. TARGET_STATUS must be one of {sorted(allowed)}")
expected = f"SET-{FLOW_ID}-{TARGET.upper()}"
if CONFIRMATION != expected:
    raise SystemExit(f"STATUS CHANGE BLOCKED. Type exactly {expected}")

payload = {"data": {"type": "flow", "id": FLOW_ID, "attributes": {"status": TARGET}}}
req = urllib.request.Request(
    f"https://a.klaviyo.com/api/flows/{FLOW_ID}",
    data=json.dumps(payload).encode("utf-8"),
    method="PATCH",
    headers={
        "Authorization": f"Klaviyo-API-Key {KEY}",
        "accept": "application/vnd.api+json",
        "content-type": "application/vnd.api+json",
        "revision": REVISION,
    },
)
try:
    with urllib.request.urlopen(req, timeout=30) as res:
        result = json.loads(res.read())
except urllib.error.HTTPError as exc:
    body = exc.read().decode("utf-8", errors="replace")
    raise SystemExit(f"Klaviyo status update failed with {exc.code}: {body}") from exc

attrs = result.get("data", {}).get("attributes", {})
actual = attrs.get("status")
if actual != TARGET:
    raise SystemExit(f"Status response mismatch. Expected {TARGET}, got {actual}")
print(json.dumps({
    "status_change": "SUCCESS",
    "flow_id": FLOW_ID,
    "flow_name": attrs.get("name"),
    "status": actual,
    "meaning": "review-required canary" if TARGET == "manual" else "sending stopped / draft",
}, indent=2))
