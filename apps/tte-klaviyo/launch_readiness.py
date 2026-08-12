"""Read-only production readiness gate for the canonical 222 Emails Klaviyo flow.

This script never sends or activates anything. It verifies the canonical flow,
trigger list, consent mode, message state and critical configuration before a
human can approve go-live.
"""
import json
import os
import urllib.parse
import urllib.request

REVISION = "2026-07-15"
BASE = "https://a.klaviyo.com/api"
KEY = os.environ["KLAVIYO_PRIVATE_API_KEY"]
FLOW_ID = os.environ.get("TTE_FLAGSHIP_FLOW_ID", "TWM6Yx")
LIST_ID = "SjerhA"
EXPECTED_FLOW_NAME = "TTE Flagship Welcome Series | FINAL DRAFT | 5 Email Proof System"
EXPECTED_SUBJECTS = [
    "Welcome to 222 Emails",
    "5 places revenue quietly disappears",
    "What we’d fix first in your email system",
    "We built this instead of telling you we could",
    "Want us to find the leaks?",
]
# E01 is the immediate opt-in acknowledgement and must not be suppressed by a
# recent campaign send. Later nurture messages may respect Smart Sending.
EXPECTED_SMART_SENDING = [False, True, True, True, True]


def get(path):
    req = urllib.request.Request(
        BASE + path,
        headers={
            "Authorization": f"Klaviyo-API-Key {KEY}",
            "accept": "application/vnd.api+json",
            "revision": REVISION,
        },
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read())

params = urllib.parse.urlencode({"additional-fields[flow]": "definition"})
flow = get(f"/flows/{FLOW_ID}/?{params}")["data"]
attrs = flow["attributes"]
definition = attrs["definition"]
actions = definition["actions"]
sends = [a for a in actions if a["type"] == "send-email"]
delays = [a for a in actions if a["type"] == "time-delay"]
subjects = [a["data"]["message"]["subject_line"] for a in sends]
message_statuses = [a["data"]["status"] for a in sends]
smart_sending = [bool(a["data"]["message"].get("smart_sending_enabled")) for a in sends]

lists = get("/lists/").get("data", [])
email_list = next((x for x in lists if x.get("id") == LIST_ID), None)
if not email_list:
    raise SystemExit(f"Launch gate FAIL: trigger list {LIST_ID} not found")
opt_in = email_list.get("attributes", {}).get("opt_in_process")

checks = {
    "canonical_flow_exists": flow.get("id") == FLOW_ID,
    "canonical_flow_name_exact": attrs.get("name") == EXPECTED_FLOW_NAME,
    "flow_is_draft": attrs.get("status") == "draft",
    "trigger_is_email_list": definition.get("triggers") == [{"type": "list", "id": LIST_ID}],
    "email_list_double_opt_in": opt_in == "double_opt_in",
    "five_email_actions": len(sends) == 5,
    "four_delays": len(delays) == 4,
    "delay_sequence_1_2_2_2": [d["data"]["value"] for d in delays] == [1, 2, 2, 2],
    "subjects_exact": subjects == EXPECTED_SUBJECTS,
    "all_messages_draft": set(message_statuses) == {"draft"},
    "sender_exact": all(a["data"]["message"]["from_email"] == "hello@222emails.com" for a in sends),
    "reply_to_exact": all(a["data"]["message"]["reply_to_email"] == "hello@222emails.com" for a in sends),
    "from_label_exact": all(a["data"]["message"]["from_label"] == "Triple Two Emails" for a in sends),
    "smart_sending_policy": smart_sending == EXPECTED_SMART_SENDING,
}
failed = [k for k, v in checks.items() if not v]
result = {
    "system": "222 Lifecycle Revenue Engine",
    "flow_id": FLOW_ID,
    "flow_name": attrs.get("name"),
    "flow_status": attrs.get("status"),
    "trigger_list_id": LIST_ID,
    "opt_in_process": opt_in,
    "smart_sending_actual": smart_sending,
    "smart_sending_expected": EXPECTED_SMART_SENDING,
    "checks": checks,
    "automated_gate": "PASS" if not failed else "FAIL",
    "human_gates_required": [
        "visual_rendering_desktop_mobile_dark_mode",
        "seed_inbox_links_and_reply_test",
        "sending_domain_health",
        "fit_check_end_to_end_submission",
        "public_capture_path_to_email_list",
        "audit_and_client_exit_or_suppression_logic",
        "explicit_go_live_approval",
    ],
}
print(json.dumps(result, indent=2))
if failed:
    raise SystemExit("Launch gate FAIL: " + ", ".join(failed))
