#!/usr/bin/env python3
import json
import os
import re
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

from openai import OpenAI

ROOT = Path(__file__).resolve().parent
CONFIG = json.loads((ROOT / "config.json").read_text())
SEED = json.loads((ROOT / "seed-contacted.json").read_text())
OUT = ROOT / "out"
OUT.mkdir(exist_ok=True)

TARGET = int(os.getenv("BATCH_TARGET", CONFIG["schedule"]["daily_primary_target"]))
BACKUPS = int(os.getenv("BATCH_BACKUPS", CONFIG["schedule"]["daily_backups"]))
TOTAL = TARGET + BACKUPS
REPO = os.getenv("GITHUB_REPOSITORY", "Chelston222/CGPT-1")
GH_TOKEN = os.getenv("GITHUB_TOKEN", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

if not OPENAI_API_KEY:
    raise SystemExit("OPENAI_API_KEY is required. Refusing to generate a batch without an authenticated model call.")

client = OpenAI(api_key=OPENAI_API_KEY)


def canonical_url(url: str) -> str:
    url = (url or "").strip().split("?")[0]
    if not url:
        return ""
    url = url.replace("https://uk.linkedin.com/", "https://www.linkedin.com/")
    if url.startswith("http://www.linkedin.com/"):
        url = "https://" + url[len("http://"):]
    if url.startswith("https://linkedin.com/"):
        url = url.replace("https://linkedin.com/", "https://www.linkedin.com/", 1)
    if url.startswith("https://www.linkedin.com/in/") and not url.endswith("/"):
        url += "/"
    return url


def previous_issue_urls() -> set[str]:
    urls = set()
    if not GH_TOKEN:
        return urls
    endpoint = f"https://api.github.com/repos/{REPO}/issues?state=all&per_page=100"
    req = urllib.request.Request(
        endpoint,
        headers={
            "Authorization": f"Bearer {GH_TOKEN}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "222Emails-linkedin-batch"
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            issues = json.load(response)
        for issue in issues:
            if not str(issue.get("title", "")).startswith("LinkedIn Prospect Batch"):
                continue
            body = issue.get("body") or ""
            for match in re.findall(r"https://(?:www\.)?linkedin\.com/in/[A-Za-z0-9_%\-]+/?", body):
                urls.add(canonical_url(match))
    except Exception as exc:
        print(f"Warning: could not read prior batch issues for dedupe: {exc}", file=sys.stderr)
    return urls


def excluded_urls() -> list[str]:
    urls = {canonical_url(p["linkedin_url"]) for p in SEED["prospects"]}
    urls |= previous_issue_urls()
    return sorted(u for u in urls if u)


def parse_json_output(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("Model did not return a JSON object")
    return json.loads(text[start:end + 1])


def model_json(model: str, prompt: str) -> dict:
    response = client.responses.create(
        model=model,
        tools=[{"type": CONFIG["model"]["tool"]}],
        input=prompt,
    )
    return parse_json_output(response.output_text)


def candidate_prompt(exclusions: list[str]) -> str:
    return f"""
You are the prospect research engine for 222Emails, a UK business that builds Turnkey Client Return Systems for appointment-led businesses.

Create a candidate pool of at least {max(TOTAL * 2, 24)} CURRENT decision-makers for a LinkedIn connection-outreach batch.

Commercial fit:
- appointment-led businesses where repeat visits, rebooking, reminders, lapsed-client reactivation or return timing materially matter
- strongest categories: hair salons, barbers, beauty salons, aesthetics clinics, dental practices, and beauty training academies where owner authority is clear
- exclude hospitals
- prefer owner, founder, director, managing director, clinic owner or similarly authoritative operator
- primary geography: Lancashire and North West England
- if the local pool becomes weak, use strong UK prospects rather than padding the list
- aim roughly 60-80% North West and 20-40% wider UK when evidence quality allows

Hard rules:
- research the live public web using web search
- every person must have a real, canonical https://www.linkedin.com/in/... profile URL supported by current public evidence
- use clean LinkedIn profile URLs with no tracking parameters
- do not include anyone in the exclusion list below
- do not include anyone whose first name is Chris or Lynn as a fail-safe
- do not include organisations containing CVS
- do not claim a specific revenue leak unless public evidence proves it
- do not invent metrics, awards, booking-platform usage, client counts or social proof
- no em dashes in outreach copy
- first-touch note must be specific, natural and at most {CONFIG['quality']['connection_note_max_chars']} characters
- post-accept message must be at most {CONFIG['quality']['post_accept_message_max_chars']} characters
- no call ask on first touch; permission-based one-page breakdown is acceptable
- score only genuinely strong prospects; 95/100 is the minimum acceptable score
- reject ambiguous identities rather than guessing

Exclusion LinkedIn URLs:
{json.dumps(exclusions, indent=2)}

Return JSON only in this exact top-level shape:
{{
  "prospects": [
    {{
      "name": "Full name",
      "first_name": "First name",
      "linkedin_url": "https://www.linkedin.com/in/.../",
      "business": "Business name",
      "location": "Town/region",
      "role": "Current role",
      "tier": "A or B",
      "score": 95,
      "why_fit": "One concise evidence-grounded reason",
      "personalisation_hook": "Specific public fact worth referencing",
      "evidence": ["fact 1", "fact 2"],
      "source_urls": ["https://...", "https://..."],
      "connection_note": "Note text",
      "post_accept_message": "Message text"
    }}
  ]
}}

RED TEAM PASS 1 before returning: remove weak fit, uncertain identities, stale roles, generic hooks, duplicate businesses without a clear reason, unsupported claims and anything below 95/100. Quality beats volume.
"""


def verification_prompt(candidates: dict, exclusions: list[str]) -> str:
    return f"""
You are the independent verification and red-team gate for a 222Emails LinkedIn prospect batch.

Use live web search to challenge every candidate below. Do not trust the first research pass.

Your job is to return exactly {TOTAL} VERIFIED prospects if that many survive: the strongest {TARGET} as primary and up to {BACKUPS} as backups.

Verification requirements for every survivor:
1. The person's identity and current decision-making role are supported by current public evidence.
2. The canonical LinkedIn URL resolves to the same person and is exactly in https://www.linkedin.com/in/... form with no tracking parameters.
3. The business is appointment-led and has credible repeat-visit economics.
4. The personalisation hook is supported, specific and not creepy or over-researched.
5. The connection note contains no unsupported claim, no em dash and is <= {CONFIG['quality']['connection_note_max_chars']} characters.
6. The post-accept message is <= {CONFIG['quality']['post_accept_message_max_chars']} characters, commercially relevant, permission based and does not force a call.
7. The candidate is not in the exclusion list, is not named Chris or Lynn, is not a hospital and is not connected to an organisation containing CVS.
8. Score must remain >= {CONFIG['quality']['minimum_first_touch_score']}/100 after verification.
9. Prefer North West prospects, but never keep a weak local prospect over a clearly stronger UK prospect.
10. Never invent evidence to preserve a candidate. Reject instead.

RED TEAM PASS 2: actively try to disqualify each candidate for identity mismatch, weak ICP fit, stale evidence, generic personalisation, duplicate history, unsupported proof, bad LinkedIn URL or low decision authority.

DOUBLE VERIFY: only return facts and URLs you can independently support from current public sources.

Exclusion LinkedIn URLs:
{json.dumps(exclusions, indent=2)}

Candidate pool:
{json.dumps(candidates, indent=2)}

Return JSON only:
{{
  "prospects": [
    {{
      "name": "Full name",
      "first_name": "First name",
      "linkedin_url": "https://www.linkedin.com/in/.../",
      "business": "Business name",
      "location": "Town/region",
      "role": "Current role",
      "tier": "A or B",
      "score": 95,
      "why_fit": "Verified reason",
      "personalisation_hook": "Verified hook",
      "evidence": ["verified fact 1", "verified fact 2"],
      "source_urls": ["https://...", "https://..."],
      "connection_note": "Final note",
      "post_accept_message": "Final message",
      "batch_position": "primary or backup"
    }}
  ],
  "rejected_count": 0,
  "verification_summary": "Short summary of what was rejected or tightened"
}}
"""


def validate(final: dict, exclusions: list[str]) -> list[dict]:
    ex = set(exclusions)
    seen = set()
    valid = []
    for p in final.get("prospects", []):
        url = canonical_url(p.get("linkedin_url", ""))
        p["linkedin_url"] = url
        note = (p.get("connection_note") or "").strip()
        post = (p.get("post_accept_message") or "").strip()
        score = int(p.get("score", 0))
        first = (p.get("first_name") or p.get("name", "").split(" ")[0]).strip()
        if not re.fullmatch(r"https://www\.linkedin\.com/in/[A-Za-z0-9_%\-]+/", url):
            continue
        if url in ex or url in seen:
            continue
        if first.lower() in {"chris", "lynn"}:
            continue
        if any(term.lower() in (p.get("business") or "").lower() for term in CONFIG["safety"]["blocked_organisation_terms"]):
            continue
        if score < CONFIG["quality"]["minimum_first_touch_score"]:
            continue
        if "—" in note or "—" in post:
            continue
        if len(note) > CONFIG["quality"]["connection_note_max_chars"]:
            continue
        if len(post) > CONFIG["quality"]["post_accept_message_max_chars"]:
            continue
        if not p.get("source_urls"):
            continue
        seen.add(url)
        valid.append(p)
    return valid[:TOTAL]


def render_markdown(prospects: list[dict], summary: str) -> str:
    date = datetime.now().astimezone().strftime("%Y-%m-%d")
    lines = [
        f"# LinkedIn Prospect Batch - {date}",
        "",
        f"**Operating target:** send up to {TARGET} high-quality connection requests today. {BACKUPS} backups are included only if a primary is unsuitable.",
        "",
        "**Human-send lock:** this system researches and prepares outreach only. It never clicks Connect, sends a LinkedIn invitation, sends InMail or sends a LinkedIn message.",
        "",
        "**Execution rule:** replies and accepted connections waiting for a response outrank new cold connections. Stop early if the live reply queue becomes more valuable than additional prospecting.",
        "",
        f"**Verification:** {summary}",
        "",
    ]
    for i, p in enumerate(prospects, 1):
        position = "PRIMARY" if i <= TARGET else "BACKUP"
        lines += [
            f"## {i}. [{p['name']}]({p['linkedin_url']}) - {p['business']} - {position}",
            f"**Role:** {p.get('role','')}  ",
            f"**Location:** {p.get('location','')}  ",
            f"**Tier / First-Touch Score:** {p.get('tier','')} / {p.get('score','')}/100  ",
            f"**Why it fits:** {p.get('why_fit','')}",
            "",
            f"**Connection note ({len(p.get('connection_note',''))} chars):**",
            "```text",
            p.get("connection_note", ""),
            "```",
            "",
            "**Send after acceptance:**",
            "```text",
            p.get("post_accept_message", ""),
            "```",
            "",
            "**Evidence:**",
        ]
        for fact in p.get("evidence", []):
            lines.append(f"- {fact}")
        lines.append("")
        lines.append("**Sources:**")
        for url in p.get("source_urls", []):
            lines.append(f"- {url}")
        lines += [
            "",
            "- [ ] Connection sent",
            "- [ ] Accepted",
            "- [ ] Follow-up sent",
            "- [ ] Replied",
            "",
        ]
    return "\n".join(lines).rstrip() + "\n"


def main():
    exclusions = excluded_urls()
    pool = model_json(CONFIG["model"]["candidate_model"], candidate_prompt(exclusions))
    verified = model_json(CONFIG["model"]["verification_model"], verification_prompt(pool, exclusions))
    prospects = validate(verified, exclusions)
    if len(prospects) < TARGET:
        raise SystemExit(f"Fail closed: only {len(prospects)} prospects passed all gates; need at least {TARGET}.")
    summary = verified.get("verification_summary") or "Two research passes completed; only verified 95+ prospects retained."
    payload = {
        "generated_at": datetime.now().astimezone().isoformat(),
        "target": TARGET,
        "backups": BACKUPS,
        "prospects": prospects,
        "verification_summary": summary,
    }
    (OUT / "batch.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    (OUT / "batch.md").write_text(render_markdown(prospects, summary))
    print(f"Generated {len(prospects)} verified prospects ({TARGET} primary, {max(0, len(prospects)-TARGET)} backup).")


if __name__ == "__main__":
    main()
