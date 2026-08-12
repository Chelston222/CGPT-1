"""Static QA for TTE capture and Fit Check integration source.

This does not deploy or call external services. It catches accidental private-key
exposure, wrong account/list/form IDs, missing consent, missing webhook auth,
missing idempotency and event-name drift.
"""
import json
import pathlib

ROOT=pathlib.Path(__file__).parent
capture=(ROOT/"capture"/"tte-email-capture.html").read_text(encoding="utf-8")
bridge=(ROOT/"bridge"/"netlify"/"functions"/"jotform-fit-check.mjs").read_text(encoding="utf-8")

checks={
    "capture_public_site_id_exact":"Ra4Qrb" in capture,
    "capture_list_id_exact":"SjerhA" in capture,
    "capture_uses_client_subscription_endpoint":"/client/subscriptions" in capture,
    "capture_does_not_contain_private_key_name":"KLAVIYO_PRIVATE_API_KEY" not in capture,
    "capture_email_marketing_consent":"marketing: { consent: 'SUBSCRIBED' }" in capture,
    "capture_explicit_checkbox":"id=\"tte-consent\"" in capture and "required" in capture,
    "capture_double_opt_in_success_copy":"confirm your subscription" in capture.lower(),
    "capture_locale_en_gb":"locale: 'en-GB'" in capture,
    "bridge_form_id_exact":"262067771632056" in bridge,
    "bridge_metric_name_exact":"TTE Fit Check Submitted" in bridge,
    "bridge_requires_server_secret":"JOTFORM_WEBHOOK_SECRET" in bridge,
    "bridge_uses_server_side_private_key":"process.env.KLAVIYO_PRIVATE_API_KEY" in bridge,
    "bridge_private_key_not_literal":"Klaviyo-API-Key sk_" not in bridge and "pk_" not in bridge,
    "bridge_event_idempotency":"stableUuidFromSubmission" in bridge and "unique_id" in bridge,
    "bridge_form_validation":"wrong_form" in bridge,
    "bridge_email_validation":"validEmail" in bridge,
    "bridge_post_only":"req.method !== \"POST\"" in bridge,
}
failed=[k for k,v in checks.items() if not v]
print(json.dumps({
    "system":"222 Lifecycle Revenue Engine",
    "gate":"INTEGRATION_SOURCE_QA",
    "checks":checks,
    "status":"PASS" if not failed else "FAIL",
    "failures":failed,
    "note":"Source QA passing does not equal deployed/end-to-end QA.",
},indent=2))
if failed:
    raise SystemExit("INTEGRATION SOURCE QA FAILED: "+", ".join(failed))
