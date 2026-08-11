"""Safe Klaviyo API smoke test and discovery.

Reads account resources only. It does not create, update, activate or send anything.
Required secret: KLAVIYO_PRIVATE_API_KEY
"""
import json
import os
import urllib.error
import urllib.request

REVISION = "2026-07-15"
BASE = "https://a.klaviyo.com/api"
KEY = os.environ.get("KLAVIYO_PRIVATE_API_KEY")
if not KEY:
    raise SystemExit("KLAVIYO_PRIVATE_API_KEY is not available to this process")


def get(path: str):
    req = urllib.request.Request(BASE + path, method="GET", headers={"Authorization": f"Klaviyo-API-Key {KEY}", "accept": "application/vnd.api+json", "revision": REVISION})
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"GET {path} failed with {exc.code}: {body}") from exc

print("KLAVIYO_CONNECTION=OK")
lists = get("/lists/")
print("LISTS_BEGIN")
for item in lists.get("data", []):
    print(json.dumps({"id": item.get("id"), "name": item.get("attributes", {}).get("name")}))
print("LISTS_END")
templates = get("/templates/")
print(f"TEMPLATE_COUNT_VISIBLE={len(templates.get('data', []))}")
flows = get("/flows/")
print(f"FLOW_COUNT_VISIBLE={len(flows.get('data', []))}")
for item in flows.get("data", [])[:5]:
    attrs = item.get("attributes", {})
    print("FLOW", json.dumps({"id": item.get("id"), "name": attrs.get("name"), "status": attrs.get("status"), "trigger_type": attrs.get("trigger_type")}))
print("SMOKE_TEST=PASS")
