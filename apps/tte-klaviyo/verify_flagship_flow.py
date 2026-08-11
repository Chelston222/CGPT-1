"""Verify the created TTE flagship flow is wired correctly and remains safe in draft.
Read-only. Fails closed if any expected property is wrong.

Klaviyo clones a supplied template when it is attached to a flow message, so the
flow's message template IDs can differ from the source template IDs. We therefore
verify the resulting message configuration and the cloned template content.
"""
import json, os, urllib.parse, urllib.request

KEY=os.environ["KLAVIYO_PRIVATE_API_KEY"]
FLOW_ID=os.environ.get("TTE_FLAGSHIP_FLOW_ID","U4ABta")
REVISION="2026-07-15"
EXPECTED_DELAYS=[1,2,2,2]
EXPECTED_SUBJECTS=[
    "Welcome to 222 Emails",
    "5 places revenue quietly disappears",
    "What we’d fix first in your email system",
    "We built this instead of telling you we could",
    "Want us to find the leaks?",
]
EXPECTED_MARKERS=[
    "Thanks for joining 222 Emails",
    "Five places we look first",
    "A BETTER SYSTEM IS.",
    "PROOF</span> &gt; PROMISES",
    "the next example can be your business",
]

def get(url):
    req=urllib.request.Request(url,headers={"Authorization":f"Klaviyo-API-Key {KEY}","accept":"application/vnd.api+json","revision":REVISION})
    with urllib.request.urlopen(req,timeout=30) as r:
        return json.loads(r.read())

params=urllib.parse.urlencode({"additional-fields[flow]":"definition"})
data=get(f"https://a.klaviyo.com/api/flows/{FLOW_ID}/?{params}")["data"]
attrs=data["attributes"]
definition=attrs["definition"]
actions=definition["actions"]
sends=[a for a in actions if a["type"]=="send-email"]
delays=[a for a in actions if a["type"]=="time-delay"]
actual_templates=[a["data"]["message"]["template_id"] for a in sends]
actual_delays=[a["data"]["value"] for a in delays]
statuses=[a["data"]["status"] for a in sends]
subjects=[a["data"]["message"]["subject_line"] for a in sends]

assert attrs["status"]=="draft", f"Flow status is {attrs['status']}, expected draft"
assert definition["triggers"]==[{"type":"list","id":"SjerhA"}], definition["triggers"]
assert len(sends)==5, len(sends)
assert len(delays)==4, len(delays)
assert actual_delays==EXPECTED_DELAYS, actual_delays
assert subjects==EXPECTED_SUBJECTS, subjects
assert set(statuses)=={"draft"}, statuses
assert all(a["data"]["message"]["from_email"]=="hello@222emails.com" for a in sends)
assert all(a["data"]["message"]["from_label"]=="Triple Two Emails" for a in sends)

for template_id, marker in zip(actual_templates, EXPECTED_MARKERS):
    template=get(f"https://a.klaviyo.com/api/templates/{template_id}/")["data"]
    html=template.get("attributes",{}).get("html","")
    assert marker in html, f"Expected marker missing from cloned template {template_id}: {marker}"

print(json.dumps({
    "verification":"PASS",
    "flow_id":FLOW_ID,
    "flow_status":attrs["status"],
    "trigger_list_id":"SjerhA",
    "send_actions":len(sends),
    "delays_days":actual_delays,
    "flow_message_template_ids":actual_templates,
    "subjects":subjects,
    "message_statuses":statuses,
    "template_content_checks":"5/5 PASS",
},indent=2))
