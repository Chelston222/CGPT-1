"""Materialise one client-ready draft from the 222 Revenue Template OS.

This builds HTML only. It does not deploy, attach to a flow, activate or send.
"""
from __future__ import annotations
from pathlib import Path
import argparse
import json
import re
import urllib.parse
import build_master_library as base

ROOT = Path(__file__).parent
OS = ROOT / "revenue-os"
VARIANTS = json.loads((OS / "layout_variants.json").read_text(encoding="utf-8"))
MODULES = json.loads((OS / "modules.json").read_text(encoding="utf-8"))
REGISTRY = {item["slug"]: item for item in base.REGISTRY}


def esc(value: object) -> str:
    import html
    return html.escape(str(value), quote=True)


def block(kind: str, d: dict) -> str:
    if kind == "testimonial":
        return f'''<tr><td class="mobile-px" style="padding:6px 36px 24px"><table role="presentation" width="100%" style="background:#f8fafc;border-radius:12px"><tr><td style="padding:22px"><p style="margin:0 0 10px;font-size:18px;line-height:28px;font-weight:700">“{esc(d['TESTIMONIAL_QUOTE'])}”</p><p style="margin:0;color:#667085;font-size:14px">{esc(d['TESTIMONIAL_NAME'])}</p></td></tr></table></td></tr>'''
    if kind == "objection_faq":
        return f'''<tr><td class="mobile-px" style="padding:6px 36px 24px;font-family:Arial,Helvetica,sans-serif"><h2 style="margin:0 0 14px;font-size:22px;line-height:28px">Questions worth answering</h2><p style="margin:0 0 5px;font-weight:700">{esc(d['OBJECTION_Q1'])}</p><p style="margin:0 0 16px;color:#667085;line-height:24px">{esc(d['OBJECTION_A1'])}</p><p style="margin:0 0 5px;font-weight:700">{esc(d['OBJECTION_Q2'])}</p><p style="margin:0;color:#667085;line-height:24px">{esc(d['OBJECTION_A2'])}</p></td></tr>'''
    if kind == "proof_strip":
        return f'''<tr><td class="mobile-px" style="padding:6px 36px 24px"><table role="presentation" width="100%"><tr><td class="stack" width="33%" style="padding:12px;text-align:center;font-weight:700">{esc(d['PROOF_1'])}</td><td class="stack" width="33%" style="padding:12px;text-align:center;font-weight:700">{esc(d['PROOF_2'])}</td><td class="stack" width="33%" style="padding:12px;text-align:center;font-weight:700">{esc(d['PROOF_3'])}</td></tr></table></td></tr>'''
    if kind == "benefit_stack":
        return f'''<tr><td class="mobile-px" style="padding:6px 36px 24px;font-family:Arial,Helvetica,sans-serif"><p style="margin:0 0 10px;font-weight:700">✓ {esc(d['BENEFIT_1'])}</p><p style="margin:0 0 10px;font-weight:700">✓ {esc(d['BENEFIT_2'])}</p><p style="margin:0;font-weight:700">✓ {esc(d['BENEFIT_3'])}</p></td></tr>'''
    if kind in {"guarantee","offer_box","urgency_truth","delivery_reassurance","vip_access","mechanism"}:
        prefix = {"guarantee":"GUARANTEE","offer_box":"OFFER","urgency_truth":"URGENCY","delivery_reassurance":"DELIVERY","vip_access":"VIP","mechanism":"MECHANISM"}[kind]
        return f'''<tr><td class="mobile-px" style="padding:6px 36px 24px"><table role="presentation" width="100%" style="border:1px solid #e5e7eb;border-radius:12px"><tr><td style="padding:20px;font-family:Arial,Helvetica,sans-serif"><p style="margin:0 0 6px;font-size:18px;font-weight:800">{esc(d[prefix+'_TITLE'])}</p><p style="margin:0;color:#667085;font-size:15px;line-height:23px">{esc(d[prefix+'_BODY'])}</p></td></tr></table></td></tr>'''
    if kind == "founder_note":
        return f'''<tr><td class="mobile-px" style="padding:6px 36px 24px;font-family:Arial,Helvetica,sans-serif"><p style="margin:0 0 10px;font-size:16px;line-height:26px">{esc(d['FOUNDER_NOTE'])}</p><p style="margin:0;font-weight:700">{esc(d['FOUNDER_NAME'])}</p></td></tr>'''
    if kind == "next_steps":
        return f'''<tr><td class="mobile-px" style="padding:6px 36px 24px;font-family:Arial,Helvetica,sans-serif"><h2 style="margin:0 0 14px;font-size:22px">What happens next</h2><p>1. {esc(d['NEXT_STEP_1'])}</p><p>2. {esc(d['NEXT_STEP_2'])}</p><p>3. {esc(d['NEXT_STEP_3'])}</p></td></tr>'''
    if kind == "comparison":
        return f'''<tr><td class="mobile-px" style="padding:6px 36px 24px"><table role="presentation" width="100%"><tr><td class="stack" width="50%" valign="top" style="padding:16px;border:1px solid #e5e7eb"><p style="margin:0 0 6px;font-weight:800">{esc(d['OPTION_A'])}</p><p style="margin:0;color:#667085">{esc(d['OPTION_A_BENEFIT'])}</p></td><td class="stack" width="50%" valign="top" style="padding:16px;border:1px solid #e5e7eb"><p style="margin:0 0 6px;font-weight:800">{esc(d['OPTION_B'])}</p><p style="margin:0;color:#667085">{esc(d['OPTION_B_BENEFIT'])}</p></td></tr></table></td></tr>'''
    if kind == "social_proof_quote":
        return f'''<tr><td class="mobile-px" style="padding:6px 36px 24px;font-family:Arial,Helvetica,sans-serif"><p style="margin:0 0 8px;font-size:18px;line-height:28px;font-weight:700">{esc(d['SOCIAL_PROOF_TEXT'])}</p><p style="margin:0;color:#667085;font-size:14px">{esc(d['SOCIAL_PROOF_SOURCE'])}</p></td></tr>'''
    raise ValueError(f"Unsupported module renderer: {kind}")


def add_tracking(url: str, tracking: dict) -> str:
    if not url.startswith(("http://", "https://")) or not tracking:
        return url
    parts = urllib.parse.urlsplit(url)
    q = dict(urllib.parse.parse_qsl(parts.query, keep_blank_values=True))
    q.update({k: str(v) for k, v in tracking.items() if v not in (None, "")})
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, urllib.parse.urlencode(q), parts.fragment))


def apply_variant(html: str, variant: dict) -> str:
    replacements = {
        "#eef1f5": variant["body_bg"],
        "#ffffff": variant["card_bg"],
        "#111827": variant["text"],
        "#667085": variant["muted"],
    }
    for old, new in replacements.items():
        html = html.replace(old, new)
    html = html.replace("font-family:Arial,Helvetica,sans-serif;color:", f"font-family:{variant['headline_family']};color:", 1)
    return html.replace("border-radius:8px", f"border-radius:{variant['radius']}")


def build(manifest: dict) -> str:
    slug = manifest["template_slug"]
    variant_name = manifest["layout_variant"]
    if slug not in REGISTRY:
        raise ValueError(f"Unknown template_slug: {slug}")
    if variant_name not in VARIANTS:
        raise ValueError(f"Unknown layout_variant: {variant_name}")
    html = apply_variant(base.render(REGISTRY[slug]), VARIANTS[variant_name])

    module_html = []
    for spec in manifest.get("modules", []):
        kind = spec["type"]
        if kind not in MODULES:
            raise ValueError(f"Unknown module: {kind}")
        missing = [k for k in MODULES[kind]["requires"] if not str(spec.get("data", {}).get(k, "")).strip()]
        if missing:
            raise ValueError(f"Module {kind} missing: {', '.join(missing)}")
        module_html.append(block(kind, spec["data"]))
    if module_html:
        marker = '<tr><td class="mobile-px" style="padding:2px 36px 34px'
        pos = html.find(marker)
        if pos < 0:
            raise ValueError("CTA insertion marker not found")
        html = html[:pos] + "".join(module_html) + html[pos:]

    tokens = {}
    tokens.update(manifest.get("brand", {}))
    tokens.update(manifest.get("content", {}))
    tracking = manifest.get("tracking", {})
    if "PRIMARY_CTA_URL" in tokens:
        tokens["PRIMARY_CTA_URL"] = add_tracking(tokens["PRIMARY_CTA_URL"], tracking)

    # Replace builder-only image stand-ins with client assets before hard-gate QA.
    assets = manifest.get("assets", {})
    if assets.get("HERO_URL"):
        html = html.replace("https://placehold.co/1200x680/png?text=Brand+Hero", str(assets["HERO_URL"]))
    if assets.get("PRODUCT_IMAGE_URL"):
        html = html.replace("https://placehold.co/220x220/png?text=Item", str(assets["PRODUCT_IMAGE_URL"]))
    if assets.get("PRODUCT_1_IMAGE_URL"):
        html = html.replace("https://placehold.co/520x520/png?text=Product+1", str(assets["PRODUCT_1_IMAGE_URL"]))
    if assets.get("PRODUCT_2_IMAGE_URL"):
        html = html.replace("https://placehold.co/520x520/png?text=Product+2", str(assets["PRODUCT_2_IMAGE_URL"]))

    for key, value in tokens.items():
        html = html.replace(f"__{key}__", esc(value) if not key.endswith("_URL") else str(value))
    return html


def unresolved(html: str) -> list[str]:
    return sorted(set(re.findall(r"__[A-Z0-9_]+__", html)))


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("manifest")
    p.add_argument("--out", required=True)
    args = p.parse_args()
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    html = build(manifest)
    left = unresolved(html)
    if left:
        raise SystemExit("Unresolved tokens: " + ", ".join(left))
    if "placehold.co" in html:
        raise SystemExit("Placeholder imagery remains. Supply the required client asset URLs.")
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"Built {out} | slug={manifest['template_slug']} | variant={manifest['layout_variant']} | modules={len(manifest.get('modules', []))}")


if __name__ == "__main__":
    main()
