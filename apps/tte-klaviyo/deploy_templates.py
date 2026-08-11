"""Deploy approved 222 Emails templates to Klaviyo.

Required environment variable:
  KLAVIYO_PRIVATE_API_KEY

This script creates templates only. It deliberately does not activate flows.
"""
import json
import os
import pathlib
import urllib.error
import urllib.request

API = "https://a.klaviyo.com/api/templates"
REVISION = "2026-07-15"
ROOT = pathlib.Path(__file__).parent

TEMPLATES = [
    ("TTE-WELCOME-01-FOUNDER-v1", ROOT / "templates" / "w01-founder-welcome.html"),
    ("TTE-WELCOME-02-REVENUE-LEAKS-v1", ROOT / "templates" / "w02-revenue-leaks.html"),
    ("TTE-WELCOME-03-FIX-FIRST-v1", ROOT / "templates" / "w03-fix-first.html"),
    ("TTE-WELCOME-04-PROOF-v1", ROOT / "templates" / "w04-proof.html"),
    ("TTE-WELCOME-05-AUDIT-CONVERSION-v1", ROOT / "templates" / "w05-audit-conversion.html"),
]


def create_template(name: str, html: str) -> dict:
    key = os.environ.get("KLAVIYO_PRIVATE_API_KEY")
    if not key:
        raise SystemExit("Missing KLAVIYO_PRIVATE_API_KEY. Store it as a secret, never in source control.")
    payload = {
        "data": {
            "type": "template",
            "attributes": {
                "name": name,
                "editor_type": "CODE",
                "html": html,
            },
        }
    }
    req = urllib.request.Request(
        API,
        data=json.dumps(payload).encode(),
        method="POST",
        headers={
            "Authorization": f"Klaviyo-API-Key {key}",
            "accept": "application/vnd.api+json",
            "content-type": "application/vnd.api+json",
            "revision": REVISION,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Klaviyo API error {exc.code} for {name}: {body}") from exc


if __name__ == "__main__":
    deployed = []
    for name, path in TEMPLATES:
        result = create_template(name, path.read_text(encoding="utf-8"))
        template_id = result["data"]["id"]
        deployed.append({"name": name, "id": template_id})
        print(name, "=>", template_id)
    print(json.dumps({"templates": deployed}, indent=2))
