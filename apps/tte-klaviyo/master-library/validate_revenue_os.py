"""Exhaustive static QA for the 222 Revenue Template OS.

Builds every 30-template x 5-layout combination plus every reusable module.
No network calls, deployments, flow edits or sends occur.
"""
from __future__ import annotations
import re
import build_client_email as client

BASE_BRAND = {
    "BRAND_NAME": "QA Brand",
    "HOME_URL": "https://example.com",
    "LOGO_URL": "https://example.com/logo.png",
    "HERO_ALT": "QA Brand product",
    "PREHEADER": "Useful preview text",
    "PRIMARY_CTA_URL": "https://example.com/action",
    "SUPPORT_EMAIL": "support@example.com",
    "POSTAL_ADDRESS": "1 Example Street, London, UK",
}
ASSETS = {
    "HERO_URL": "https://example.com/hero.jpg",
    "PRODUCT_IMAGE_URL": "https://example.com/product.jpg",
    "PRODUCT_1_IMAGE_URL": "https://example.com/product-1.jpg",
    "PRODUCT_2_IMAGE_URL": "https://example.com/product-2.jpg",
}
CONTENT = {
    "PRODUCT_NAME": "QA Product",
    "PRODUCT_BENEFIT": "A clear customer benefit.",
    "PRODUCT_PRICE": "£49",
    "DESIRED_OUTCOME": "a better result",
    "CORE_PROBLEM": "the costly problem",
    "ORDER_REFERENCE": "QA-001",
}
MODULE_DATA = {
    "proof_strip": {"PROOF_1":"Verified proof one","PROOF_2":"Verified proof two","PROOF_3":"Verified proof three"},
    "testimonial": {"TESTIMONIAL_QUOTE":"A genuine verified testimonial.","TESTIMONIAL_NAME":"Verified Customer"},
    "benefit_stack": {"BENEFIT_1":"Benefit one","BENEFIT_2":"Benefit two","BENEFIT_3":"Benefit three"},
    "objection_faq": {"OBJECTION_Q1":"Question one?","OBJECTION_A1":"Truthful answer one.","OBJECTION_Q2":"Question two?","OBJECTION_A2":"Truthful answer two."},
    "guarantee": {"GUARANTEE_TITLE":"Real guarantee","GUARANTEE_BODY":"Only state a guarantee the client actually honours."},
    "offer_box": {"OFFER_TITLE":"Real offer","OFFER_BODY":"Only state a genuine current offer."},
    "social_proof_quote": {"SOCIAL_PROOF_TEXT":"Verified third-party proof.","SOCIAL_PROOF_SOURCE":"Verified source"},
    "urgency_truth": {"URGENCY_TITLE":"Real deadline","URGENCY_BODY":"Only state objective stock, access or deadline urgency."},
    "founder_note": {"FOUNDER_NAME":"Founder Name","FOUNDER_NOTE":"A concise genuine founder note."},
    "next_steps": {"NEXT_STEP_1":"First action","NEXT_STEP_2":"Second action","NEXT_STEP_3":"Third action"},
    "delivery_reassurance": {"DELIVERY_TITLE":"Delivery clarity","DELIVERY_BODY":"State the real fulfilment expectation."},
    "comparison": {"OPTION_A":"Option A","OPTION_A_BENEFIT":"Best for one need.","OPTION_B":"Option B","OPTION_B_BENEFIT":"Best for another need."},
    "vip_access": {"VIP_TITLE":"Real VIP access","VIP_BODY":"State the genuine benefit earned by this segment."},
    "mechanism": {"MECHANISM_TITLE":"Why it works","MECHANISM_BODY":"Explain the real mechanism simply."},
}


def manifest(slug: str, variant: str, modules=None) -> dict:
    return {
        "client_id": "qa",
        "template_slug": slug,
        "layout_variant": variant,
        "brand": dict(BASE_BRAND),
        "assets": dict(ASSETS),
        "content": dict(CONTENT),
        "modules": modules or [],
        "tracking": {"utm_source":"klaviyo","utm_medium":"email","utm_campaign":"qa"},
    }


def hard_gates(html: str) -> list[str]:
    errors = []
    low = html.lower()
    checks = {
        "doctype": "<!doctype html" in low,
        "viewport": "name=\"viewport\"" in low,
        "presentation tables": "role=\"presentation\"" in low,
        "mso fallback": "<!--[if mso]>" in low,
        "dark-mode metadata": "color-scheme" in low,
        "unsubscribe": "unsubscribe" in low,
        "manage preferences": "manage_preferences" in low,
        "mobile media query": "max-width:620px" in low,
        "real image assets": "placehold.co" not in low,
        "no scripts": "<script" not in low,
        "no iframe": "<iframe" not in low,
        "no forms": "<form" not in low,
        "no javascript urls": "javascript:" not in low,
        "no flexbox dependency": "display:flex" not in low and "display: flex" not in low,
        "no grid dependency": "display:grid" not in low and "display: grid" not in low,
        "no unresolved tokens": not client.unresolved(html),
        "tracking added": "utm_source=klaviyo" in html,
    }
    for name, ok in checks.items():
        if not ok:
            errors.append(name)
    for tag in re.findall(r"<img\b[^>]*>", html, flags=re.I):
        if not re.search(r"\balt=", tag, flags=re.I):
            errors.append("image missing alt")
    return errors


def main() -> None:
    failures = []
    count = 0
    for slug in client.REGISTRY:
        for variant in client.VARIANTS:
            count += 1
            try:
                html = client.build(manifest(slug, variant))
                errs = hard_gates(html)
                if errs:
                    failures.append(f"{slug}/{variant}: {', '.join(errs)}")
            except Exception as exc:
                failures.append(f"{slug}/{variant}: exception: {exc}")

    # Independently exercise every conversion module renderer and its required-data contract.
    anchor = next(iter(client.REGISTRY))
    variant = next(iter(client.VARIANTS))
    for kind in client.MODULES:
        count += 1
        try:
            html = client.build(manifest(anchor, variant, [{"type":kind,"data":MODULE_DATA[kind]}]))
            errs = hard_gates(html)
            if errs:
                failures.append(f"module/{kind}: {', '.join(errs)}")
        except Exception as exc:
            failures.append(f"module/{kind}: exception: {exc}")

    if failures:
        print("Revenue Template OS QA FAILED")
        for failure in failures:
            print(" -", failure)
        raise SystemExit(1)
    print(f"Revenue Template OS QA PASS: {count} builds checked | {len(client.REGISTRY)} revenue jobs x {len(client.VARIANTS)} layouts + {len(client.MODULES)} modules")


if __name__ == "__main__":
    main()
