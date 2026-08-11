"""Update the five cloned message templates used by the TTE flagship DRAFT flow.

This changes template HTML only. It does not activate the flow or send email.
"""
import json
import os
import pathlib
import urllib.error
import urllib.request

KEY=os.environ["KLAVIYO_PRIVATE_API_KEY"]
REVISION="2026-07-15"
ROOT=pathlib.Path(__file__).parent
AUDIT_URL="https://form.jotform.com/262067771632056"

FLOW_TEMPLATES=[
    ("XDsnu8", ROOT/"templates"/"w01-founder-welcome.html"),
    ("SNywdU", ROOT/"templates"/"w02-revenue-leak.html"),
    ("YbQaKm", ROOT/"templates"/"w03-fix-first.html"),
    ("VLpeCf", ROOT/"templates"/"w04-proof.html"),
    ("TkWiv9", ROOT/"templates"/"w05-audit-conversion.html"),
]


def patch(template_id, html):
    html=html.replace("__FREE_AUDIT_URL__", AUDIT_URL)
    payload={"data":{"type":"template","id":template_id,"attributes":{"html":html}}}
    req=urllib.request.Request(
        f"https://a.klaviyo.com/api/templates/{template_id}",
        data=json.dumps(payload).encode(),
        method="PATCH",
        headers={
            "Authorization":f"Klaviyo-API-Key {KEY}",
            "accept":"application/vnd.api+json",
            "content-type":"application/vnd.api+json",
            "revision":REVISION,
        },
    )
    try:
        with urllib.request.urlopen(req,timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as exc:
        body=exc.read().decode("utf-8",errors="replace")
        raise SystemExit(f"PATCH template {template_id} failed {exc.code}: {body}") from exc

for template_id,path in FLOW_TEMPLATES:
    patch(template_id,path.read_text(encoding="utf-8"))
    print(f"UPDATED {template_id}")
print("FLOW_MESSAGE_TEMPLATE_UPDATE=PASS")
