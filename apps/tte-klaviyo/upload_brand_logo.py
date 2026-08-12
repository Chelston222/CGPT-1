"""Idempotently upload the real 222 Emails V3 logo to Klaviyo Images.

Reads the committed email-optimised derivative of the canonical Drive asset.
Creates exactly one visible image asset by canonical name, or reuses it when
already present. It does not send email or change flow status.

Required secret: KLAVIYO_PRIVATE_API_KEY with images:read and images:write.
"""
import base64
import json
import os
import pathlib
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://a.klaviyo.com/api"
REVISION = "2026-07-15"
KEY = os.environ["KLAVIYO_PRIVATE_API_KEY"]
ROOT = pathlib.Path(__file__).parent
B64_PATH = ROOT / "assets" / "02_primary_logo_light_email.b64"
CANONICAL_NAME = "222 Emails V3 Primary Light Email"


def headers(content=False):
    h = {
        "Authorization": f"Klaviyo-API-Key {KEY}",
        "accept": "application/vnd.api+json",
        "revision": REVISION,
    }
    if content:
        h["content-type"] = "application/vnd.api+json"
    return h


def request_json(method, path, payload=None):
    req = urllib.request.Request(
        BASE + path,
        data=None if payload is None else json.dumps(payload).encode("utf-8"),
        method=method,
        headers=headers(content=payload is not None),
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Klaviyo image API failed with {exc.code} on {method} {path}: {body}") from exc


def find_existing():
    query = urllib.parse.urlencode({"filter": f'equals(name,"{CANONICAL_NAME}")', "page[size]": 20})
    items = request_json("GET", f"/images?{query}").get("data", [])
    exact = [x for x in items if x.get("attributes", {}).get("name") == CANONICAL_NAME]
    if len(exact) > 1:
        raise SystemExit(f"Duplicate canonical logo assets found; refusing ambiguity: {[x['id'] for x in exact]}")
    return exact[0] if exact else None


existing = find_existing()
if existing:
    attrs = existing.get("attributes", {})
    print(json.dumps({
        "action": "REUSED",
        "id": existing.get("id"),
        "name": attrs.get("name"),
        "image_url": attrs.get("image_url"),
        "size": attrs.get("size"),
    }, indent=2))
    raise SystemExit(0)

b64 = "".join(B64_PATH.read_text(encoding="utf-8").split())
# Validate source before transmission.
raw = base64.b64decode(b64, validate=True)
if not raw.startswith(b"\x89PNG\r\n\x1a\n"):
    raise SystemExit("Canonical logo derivative is not a valid PNG")
if len(raw) > 5_000_000:
    raise SystemExit("Canonical logo derivative exceeds Klaviyo's 5MB image limit")

data_uri = "data:image/png;base64," + b64
payload = {
    "data": {
        "type": "image",
        "attributes": {
            "import_from_url": data_uri,
            "name": CANONICAL_NAME,
            "hidden": False,
        },
    }
}
created = request_json("POST", "/images", payload).get("data", {})
attrs = created.get("attributes", {})
print(json.dumps({
    "action": "CREATED",
    "id": created.get("id"),
    "name": attrs.get("name"),
    "image_url": attrs.get("image_url"),
    "size": attrs.get("size"),
    "source": "canonical V3 Drive logo derivative",
}, indent=2))
