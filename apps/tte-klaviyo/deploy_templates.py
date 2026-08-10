"""Deploy approved 222 Emails templates to Klaviyo.

Required environment variable:
  KLAVIYO_PRIVATE_API_KEY

This script creates templates only. It deliberately does not activate flows.
"""
import json
import os
import pathlib
import urllib.request

API = "https://a.klaviyo.com/api/templates"
REVISION = "2026-07-15"
ROOT = pathlib.Path(__file__).parent

TEMPLATES = [
    ("TTE-WELCOME-01-FOUNDER-v1", ROOT / "templates" / "w01-founder-welcome.html"),
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
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read())


if __name__ == "__main__":
    for name, path in TEMPLATES:
        result = create_template(name, path.read_text(encoding="utf-8"))
        print(name, "=>", result["data"]["id"])
