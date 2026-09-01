"""Explicit activation controller for canonical 222Emails Klaviyo candidate.

Only the manual go-live workflow should call this after automated verification.
"""
import json
import os
import urllib.error
import urllib.request

REVISION = "2026-07-15"
FLOW_ID = "VbBAhU"
KEY = os.environ["KLAVIYO_PRIVATE_API_KEY"]

required = {
    "VISUAL_QA": "PASS",
    "SEED_QA": "PASS",
    "DOMAIN_QA": "PASS",
    "DIAGNOSTIC_QA": "PASS",
    "CAPTURE_QA": "PASS",
    "EXIT_QA": "PASS",
    "ONE_CLICK_QA": "PASS",
    "MONITORING_QA": "PASS",
    "ACTIVATION_CONFIRMATION": f"GO-LIVE-{FLOW_ID}",
}
failed = [name for name, expected in required.items() if os.environ.get(name) != expected]
if failed:
    raise SystemExit("ACTIVATION BLOCKED. Missing or incorrect gates: " + ", ".join(failed))

payload = {"data": {"type": "flow", "id": FLOW_ID, "attributes": {"status": "live"}}}
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
    raise SystemExit(f"Klaviyo activation failed with {exc.code}: {body}") from exc

attrs = result.get("data", {}).get("attributes", {})
if attrs.get("status") != "live":
    raise SystemExit(f"Activation response did not confirm LIVE status: {attrs.get('status')}")
print(json.dumps({
    "activation": "SUCCESS",
    "flow_id": FLOW_ID,
    "flow_name": attrs.get("name"),
    "status": attrs.get("status"),
    "warning": "Real eligible subscribers may now enter this flow.",
}, indent=2))
