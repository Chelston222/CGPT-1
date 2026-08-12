"""Static APEX QA for 222 Emails Klaviyo source files.

No network access and no secrets required. This catches brand drift, unresolved
source requirements, broken compliance primitives and obvious template mistakes
before any Klaviyo deployment is attempted.
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).parent
TEMPLATE_DIR = ROOT / "templates"
FILES = {
    "w01": TEMPLATE_DIR / "w01-founder-welcome.html",
    "w02": TEMPLATE_DIR / "w02-revenue-leak.html",
    "w03": TEMPLATE_DIR / "w03-fix-first.html",
    "w04": TEMPLATE_DIR / "w04-proof.html",
    "w05": TEMPLATE_DIR / "w05-audit-conversion.html",
}

V3 = {"#06173D", "#FF6600", "#F7F3EC", "#F5F5F5", "#222222"}
BANNED_LEGACY = {"#2EB8BD", "#0D2025", "#132B31", "#EEF7F7", "#EAF0F0", "#F1F5F5"}
FIT_CHECK_CTAS = {
    "START MY FREE FIT CHECK",
    "SHOW ME WHAT YOU WOULD FIX",
    "FIND MY FOLLOW-UP GAP",
}

results = {}
failures = []

for key, path in FILES.items():
    source = path.read_text(encoding="utf-8")
    upper = source.upper()
    colours = {c.upper() for c in re.findall(r"#[0-9A-Fa-f]{6}", source)}
    checks = {
        "doctype": source.lstrip().lower().startswith("<!doctype html>"),
        "viewport": 'name="viewport"' in source.lower(),
        "unsubscribe": "unsubscribe" in source.lower(),
        "no_dead_href": 'href="#"' not in source,
        "no_em_dash": "—" not in source,
        "no_legacy_teal_palette": not bool(colours & BANNED_LEGACY),
        "reasonable_width": bool(re.search(r"max-width:(620|640)px", source)),
    }

    if key == "w01":
        # Deliberate founder/plain-text-style exception: no image dependency.
        checks["founder_plain_style_no_logo_dependency"] = "__TTE_LOGO_URL__" not in source
        checks["asks_for_reply"] = "reply to this email" in source.lower()
    else:
        checks["real_v3_logo_required"] = "__TTE_LOGO_URL__" in source
        checks["uses_core_v3_navy"] = "#06173D" in upper
        checks["uses_core_v3_orange"] = "#FF6600" in upper
        checks["no_fake_tte_wordmark"] = not bool(re.search(r">\s*TTE\s*<", source, flags=re.I))

    if key in {"w02", "w03", "w04", "w05"}:
        checks["fit_check_destination_placeholder"] = "__FREE_AUDIT_URL__" in source
        checks["utm_source_klaviyo"] = "utm_source=klaviyo" in source
        checks["fit_check_language"] = any(cta in upper for cta in FIT_CHECK_CTAS)

    if key in {"w01", "w02", "w05"}:
        checks["first_name_fallback"] = "first_name|default:'there'" in source

    # Flag colours outside the V3 core only when they are obvious brand accents.
    # Neutral whites/greys and border colours remain permitted for email rendering.
    results[key] = {"checks": checks, "colours": sorted(colours)}
    failed = [name for name, ok in checks.items() if not ok]
    if failed:
        failures.append({"template": key, "failed": failed})

# Cross-template hard gates.
combined = "\n".join(path.read_text(encoding="utf-8") for path in FILES.values())
cross = {
    "five_templates_present": all(path.exists() for path in FILES.values()),
    "proof_over_promises_present": "PROOF &gt; PROMISES" in combined or "PROOF > PROMISES" in combined,
    "brand_navy_present": "#06173D" in combined.upper(),
    "brand_orange_present": "#FF6600" in combined.upper(),
    "no_legacy_teal_anywhere": not any(c in combined.upper() for c in BANNED_LEGACY),
}
for name, ok in cross.items():
    if not ok:
        failures.append({"cross_template": name})

report = {
    "system": "222 Lifecycle Revenue Engine",
    "gate": "SOURCE_APEX_QA",
    "brand_core": sorted(V3),
    "templates": results,
    "cross_template_checks": cross,
    "status": "PASS" if not failures else "FAIL",
    "failures": failures,
}
print(json.dumps(report, indent=2))
if failures:
    raise SystemExit("SOURCE APEX QA FAILED")
