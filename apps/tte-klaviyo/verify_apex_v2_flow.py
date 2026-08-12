"""Read-only live-API verifier for the 222 Emails APEX V2 pre-live flow.

Fails closed on structure, Smart Sending, V3 branding, CTA, compliance or
plaintext regressions. Does not send or change account state.
"""
import json
import os
import urllib.parse
import urllib.request

BASE="https://a.klaviyo.com/api"
REVISION="2026-07-15"
KEY=os.environ["KLAVIYO_PRIVATE_API_KEY"]
FLOW_ID=os.environ.get("TTE_APEX_V2_FLOW_ID","VbBAhU")
EXPECTED_NAME="TTE Flagship Welcome Series | APEX V2 | PRE-LIVE"
LIST_ID="SjerhA"
FIT_CHECK="https://form.jotform.com/262067771632056"
LOGO_HOST="d3k81ch9hvuctc.cloudfront.net/company/Ra4Qrb/images/8dbcf118-be91-4a94-9a23-b8b2526209c9.png"
EXPECTED_SUBJECTS=[
    "Welcome to 222 Emails",
    "5 places revenue quietly disappears",
    "What we’d fix first in your email system",
    "We built this instead of telling you we could",
    "Want us to find the leaks?",
]
EXPECTED_SMART=[False,True,True,True,True]
EXPECTED_MARKERS=[
    "Thanks for joining 222 Emails",
    "Five places we look first",
    "A BETTER SYSTEM IS.",
    "PROOF &gt; PROMISES",
    "the next example can be your business",
]
LEGACY=["#2EB8BD","#0D2025","#132B31","#EEF7F7","#EAF0F0","#F1F5F5"]


def get(path):
    req=urllib.request.Request(BASE+path,headers={
        "Authorization":f"Klaviyo-API-Key {KEY}",
        "accept":"application/vnd.api+json",
        "revision":REVISION,
    })
    with urllib.request.urlopen(req,timeout=30) as res:
        return json.loads(res.read())

params=urllib.parse.urlencode({"additional-fields[flow]":"definition"})
flow=get(f"/flows/{FLOW_ID}?{params}")["data"]
attrs=flow["attributes"]
definition=attrs["definition"]
actions=definition["actions"]
sends=[a for a in actions if a["type"]=="send-email"]
delays=[a for a in actions if a["type"]=="time-delay"]
subjects=[a["data"]["message"]["subject_line"] for a in sends]
statuses=[a["data"]["status"] for a in sends]
smart=[bool(a["data"]["message"].get("smart_sending_enabled")) for a in sends]
template_ids=[a["data"]["message"]["template_id"] for a in sends]

checks={
    "flow_id_exact":flow.get("id")==FLOW_ID,
    "flow_name_exact":attrs.get("name")==EXPECTED_NAME,
    "flow_draft":attrs.get("status")=="draft",
    "trigger_exact":definition.get("triggers")==[{"type":"list","id":LIST_ID}],
    "five_sends":len(sends)==5,
    "four_delays":len(delays)==4,
    "delay_sequence":[x["data"]["value"] for x in delays]==[1,2,2,2],
    "subjects_exact":subjects==EXPECTED_SUBJECTS,
    "all_messages_draft":set(statuses)=={"draft"},
    "smart_sending_policy":smart==EXPECTED_SMART,
    "sender_exact":all(x["data"]["message"]["from_email"]=="hello@222emails.com" for x in sends),
    "reply_to_exact":all(x["data"]["message"]["reply_to_email"]=="hello@222emails.com" for x in sends),
    "from_label_exact":all(x["data"]["message"]["from_label"]=="Triple Two Emails" for x in sends),
}

template_checks=[]
for index,(template_id,marker) in enumerate(zip(template_ids,EXPECTED_MARKERS),start=1):
    template=get(f"/templates/{template_id}")["data"]
    ta=template.get("attributes",{})
    html=ta.get("html") or ""
    text=ta.get("text") or ""
    upper=html.upper()
    one={
        "index":index,
        "template_id":template_id,
        "expected_marker":marker in html,
        "unsubscribe":"unsubscribe" in html.lower(),
        "no_dead_href":'href="#"' not in html,
        "no_unresolved_placeholders":"__FREE_AUDIT_URL__" not in html and "__TTE_LOGO_URL__" not in html,
        "plaintext_present":len(text.strip())>=100,
        "no_legacy_teal":not any(c in upper for c in LEGACY),
    }
    if index==1:
        one["founder_plain_exception"] = LOGO_HOST not in html
    else:
        one["v3_logo_exact"] = LOGO_HOST in html
        one["v3_navy"] = "#06173D" in upper
        one["v3_orange"] = "#FF6600" in upper
        one["fit_check_destination"] = FIT_CHECK in html
        one["utm_source_klaviyo"] = "utm_source=klaviyo" in html
    template_checks.append(one)

checks["all_template_checks_pass"] = all(all(v is True for k,v in row.items() if k not in {"index","template_id"}) for row in template_checks)
failed=[k for k,v in checks.items() if not v]
print(json.dumps({
    "system":"222 Lifecycle Revenue Engine",
    "candidate":"APEX V2",
    "flow_id":FLOW_ID,
    "flow_name":attrs.get("name"),
    "flow_status":attrs.get("status"),
    "template_ids":template_ids,
    "smart_sending":smart,
    "checks":checks,
    "template_checks":template_checks,
    "production_blockers_not_tested_here":[
        "public capture path",
        "Fit Check/client exit bridge and flow filter",
        "sending-domain health",
        "desktop/mobile/dark-mode rendering",
        "seed inbox and reply behaviour",
    ],
    "automated_verification":"PASS" if not failed else "FAIL",
},indent=2))
if failed:
    raise SystemExit("APEX V2 verification failed: "+", ".join(failed))
