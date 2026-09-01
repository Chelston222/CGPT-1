"""Static QA for 222Emails capture and diagnostic integration source.

No network access and no secrets required. The retired Jotform endpoint must
remain fail-closed until a verified Tally-compatible event route replaces it.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).parent
capture = (ROOT / "capture" / "tte-email-capture.html").read_text(encoding="utf-8")
legacy_bridge = (ROOT / "bridge" / "netlify" / "functions" / "jotform-fit-check.mjs").read_text(encoding="utf-8")

checks = {
    "capture_public_site_id_exact": "Ra4Qrb" in capture,
    "capture_list_id_exact": "SjerhA" in capture,
    "capture_uses_client_subscription_endpoint": "/client/subscriptions" in capture,
    "capture_no_private_key": "KLAVIYO_PRIVATE_API_KEY" not in capture,
    "capture_email_marketing_consent": "marketing: { consent: 'SUBSCRIBED' }" in capture,
    "capture_explicit_checkbox": 'id="tte-consent"' in capture and "required" in capture,
    "capture_double_opt_in_success_copy": "confirm your subscription" in capture.lower(),
    "capture_locale_en_gb": "locale: 'en-GB'" in capture,
    "legacy_jotform_bridge_is_retired": "retired_jotform_route" in legacy_bridge,
    "legacy_jotform_bridge_returns_410": "status: 410" in legacy_bridge,
    "legacy_bridge_points_to_current_tally": "https://tally.so/r/44057b" in legacy_bridge,
    "legacy_bridge_has_no_klaviyo_private_key_use": "KLAVIYO_PRIVATE_API_KEY" not in legacy_bridge,
}
failed = [name for name, ok in checks.items() if not ok]
print(json.dumps({
    "system": "222Emails Lifecycle Revenue Engine",
    "gate": "INTEGRATION_SOURCE_QA",
    "checks": checks,
    "status": "PASS" if not failed else "FAIL",
    "failures": failed,
    "production_attribution_state": "BLOCKED_UNTIL_VERIFIED_TALLY_COMPATIBLE_EVENT_ROUTE_EXISTS",
    "note": "Source QA passing does not equal deployed or end-to-end QA.",
}, indent=2))
if failed:
    raise SystemExit("INTEGRATION SOURCE QA FAILED: " + ", ".join(failed))
