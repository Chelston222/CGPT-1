"""Idempotently deploy approved 222Emails APEX V2 templates to Klaviyo.

Required environment variable:
  KLAVIYO_PRIVATE_API_KEY
Optional environment variables:
  FREE_AUDIT_URL (defaults to the canonical Free Revenue Recovery Check Tally route)
  TTE_LOGO_URL (required whenever a source template contains __TTE_LOGO_URL__)

The deployer updates an exact-name APEX V2 template when it already exists and
creates it only when missing. This avoids collision with legacy proof-build
iterations. It never activates flows or sends messages. A plaintext counterpart
is generated for every CODE template.
"""
import html as html_lib
import json
import os
import pathlib
import re
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser

BASE = "https://a.klaviyo.com/api"
REVISION = "2026-07-15"
ROOT = pathlib.Path(__file__).parent
AUDIT_URL = os.environ.get("FREE_AUDIT_URL", "https://tally.so/r/44057b").rstrip("/")
LOGO_URL = os.environ.get("TTE_LOGO_URL", "").strip()
KEY = os.environ.get("KLAVIYO_PRIVATE_API_KEY")
if not KEY:
    raise SystemExit("Missing KLAVIYO_PRIVATE_API_KEY. Store it as a GitHub secret, never in source control.")

TEMPLATES = [
    ("TTE-WELCOME-01-FOUNDER-APEX-V2", ROOT / "templates" / "w01-founder-welcome.html"),
    ("TTE-WELCOME-02-REVENUE-LEAKS-APEX-V2", ROOT / "templates" / "w02-revenue-leak.html"),
    ("TTE-WELCOME-03-FIX-FIRST-APEX-V2", ROOT / "templates" / "w03-fix-first.html"),
    ("TTE-WELCOME-04-PROOF-APEX-V2", ROOT / "templates" / "w04-proof.html"),
    ("TTE-WELCOME-05-FIT-CHECK-APEX-V2", ROOT / "templates" / "w05-audit-conversion.html"),
]


def headers(content=False):
    h = {
        "Authorization": f"Klaviyo-API-Key {KEY}",
        "accept": "application/vnd.api+json",
        "revision": REVISION,
    }
    if content:
        h["content-type"] = "application/vnd.api+json"
    return h


def api_json(method, path, payload=None):
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
        raise SystemExit(f"Klaviyo API error {exc.code} on {method} {path}: {body}") from exc


def render(source: str) -> str:
    rendered = source.replace("__FREE_AUDIT_URL__", AUDIT_URL)
    if "__TTE_LOGO_URL__" in rendered:
        if not LOGO_URL:
            raise SystemExit("TTE_LOGO_URL is required for V3-branded templates. Refusing to deploy a fake or missing logo.")
        rendered = rendered.replace("__TTE_LOGO_URL__", LOGO_URL)
    unresolved = re.findall(r"__[A-Z0-9_]+__", rendered)
    if unresolved:
        raise SystemExit(f"Unresolved deployment placeholders: {sorted(set(unresolved))}")
    return rendered


class PlainTextParser(HTMLParser):
    BLOCKS = {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4"}

    def __init__(self):
        super().__init__()
        self.parts = []
        self.link_stack = []

    def handle_starttag(self, tag, attrs):
        if tag in self.BLOCKS:
            self.parts.append("\n")
        if tag == "li":
            self.parts.append("• ")
        if tag == "a":
            self.link_stack.append(dict(attrs).get("href", ""))

    def handle_endtag(self, tag):
        if tag == "a" and self.link_stack:
            href = self.link_stack.pop()
            if href and not href.startswith("mailto:"):
                self.parts.append(f" ({href})")
        if tag in self.BLOCKS:
            self.parts.append("\n")

    def handle_data(self, data):
        self.parts.append(data)


def to_plaintext(rendered_html: str) -> str:
    parser = PlainTextParser()
    parser.feed(rendered_html)
    text = html_lib.unescape("".join(parser.parts))
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text


def find_exact(name: str):
    filter_value = f'equals(name,"{name}")'
    query = urllib.parse.urlencode({"filter": filter_value, "page[size]": 10})
    data = api_json("GET", f"/templates?{query}").get("data", [])
    exact = [item for item in data if item.get("attributes", {}).get("name") == name]
    if len(exact) > 1:
        raise SystemExit(f"Duplicate exact-name templates found for {name}; refusing ambiguous update: {[x['id'] for x in exact]}")
    return exact[0] if exact else None


def upsert_template(name: str, source: str) -> dict:
    html = render(source)
    attrs = {"name": name, "editor_type": "CODE", "html": html, "text": to_plaintext(html)}
    existing = find_exact(name)
    if existing:
        template_id = existing["id"]
        payload = {"data": {"type": "template", "id": template_id, "attributes": attrs}}
        api_json("PATCH", f"/templates/{template_id}", payload)
        action = "UPDATED"
    else:
        payload = {"data": {"type": "template", "attributes": attrs}}
        result = api_json("POST", "/templates", payload)
        template_id = result["data"]["id"]
        action = "CREATED"
    return {"name": name, "id": template_id, "action": action, "text_chars": len(attrs["text"])}


if __name__ == "__main__":
    deployed = []
    for name, path in TEMPLATES:
        item = upsert_template(name, path.read_text(encoding="utf-8"))
        deployed.append(item)
        print(item["action"], name, "=>", item["id"])
    print(json.dumps({
        "templates": deployed,
        "audit_url": AUDIT_URL,
        "logo_url": LOGO_URL or None,
        "mode": "IDEMPOTENT_UPSERT_APEX_V2",
    }, indent=2))
