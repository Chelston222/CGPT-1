"""Create the final 222 Emails flagship five-message Klaviyo welcome flow in DRAFT mode.

Safety properties:
- Uses the existing TTE Email List as the trigger.
- Every send-email action is created with status=draft.
- Does not activate any message and does not send email.
- Source templates point to the live TTE Follow-Up Fit Check form.

Required environment variable:
  KLAVIYO_PRIVATE_API_KEY
"""
import json
import os
import urllib.error
import urllib.request

API = "https://a.klaviyo.com/api/flows"
REVISION = "2026-07-15"
KEY = os.environ.get("KLAVIYO_PRIVATE_API_KEY")
if not KEY:
    raise SystemExit("Missing KLAVIYO_PRIVATE_API_KEY")

LIST_ID = "SjerhA"
FROM_EMAIL = "hello@222emails.com"
FROM_LABEL = "Triple Two Emails"

MESSAGES = [
    {"key":"w01","name":"TTE Welcome 01 | Founder Welcome","subject":"Welcome to 222 Emails","preview":"A quick hello, and what I’ll actually send you.","template_id":"RuXaFZ"},
    {"key":"w02","name":"TTE Welcome 02 | Revenue Leak Diagnostic","subject":"5 places revenue quietly disappears","preview":"Before buying more traffic, check these five places.","template_id":"Thp4cu"},
    {"key":"w03","name":"TTE Welcome 03 | What We Would Fix First","subject":"What we’d fix first in your email system","preview":"The 4-layer system we use before making anything prettier.","template_id":"V5NVGX"},
    {"key":"w04","name":"TTE Welcome 04 | Proof Over Promises","subject":"We built this instead of telling you we could","preview":"You’re inside the exact kind of system we sell.","template_id":"QRW85n"},
    {"key":"w05","name":"TTE Welcome 05 | Audit Conversion","subject":"Want us to find the leaks?","preview":"One simple next step if you want us to look.","template_id":"WfdLAP"},
]

DELAYS = [1, 2, 2, 2]
WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def send_action(message, next_id=None):
    return {
        "temporary_id": message["key"],
        "type": "send-email",
        "data": {
            "message": {
                "from_email": FROM_EMAIL,
                "from_label": FROM_LABEL,
                "reply_to_email": FROM_EMAIL,
                "cc_email": None,
                "bcc_email": None,
                "subject_line": message["subject"],
                "preview_text": message["preview"],
                "template_id": message["template_id"],
                "smart_sending_enabled": True,
                "transactional": False,
                "add_tracking_params": False,
                "custom_tracking_params": None,
                "additional_filters": None,
                "name": message["name"],
            },
            "status": "draft",
        },
        "links": {"next": next_id},
    }


def delay_action(index, days, next_id):
    return {
        "temporary_id": f"delay-{index}",
        "type": "time-delay",
        "data": {"unit":"days","value":days,"secondary_value":None,"timezone":"profile","delay_until_time":None,"delay_until_weekdays":WEEKDAYS},
        "links": {"next": next_id},
    }

actions=[]
for idx,message in enumerate(MESSAGES):
    next_id=f"delay-{idx+1}" if idx < len(MESSAGES)-1 else None
    actions.append(send_action(message,next_id))
    if idx < len(MESSAGES)-1:
        actions.append(delay_action(idx+1,DELAYS[idx],MESSAGES[idx+1]["key"]))

payload={"data":{"type":"flow","attributes":{"name":"TTE Flagship Welcome Series | FINAL DRAFT | 5 Email Proof System","definition":{"triggers":[{"type":"list","id":LIST_ID}],"profile_filter":None,"actions":actions,"entry_action_id":"w01"}}}}
req=urllib.request.Request(API,data=json.dumps(payload).encode("utf-8"),method="POST",headers={"Authorization":f"Klaviyo-API-Key {KEY}","accept":"application/vnd.api+json","content-type":"application/vnd.api+json","revision":REVISION})
try:
    with urllib.request.urlopen(req,timeout=30) as res:
        result=json.loads(res.read())
except urllib.error.HTTPError as exc:
    body=exc.read().decode("utf-8",errors="replace")
    raise SystemExit(f"Klaviyo create flow failed with {exc.code}: {body}") from exc
created=result["data"]
print(json.dumps({"status":"CREATED_DRAFT","flow_id":created.get("id"),"name":created.get("attributes",{}).get("name"),"trigger_list_id":LIST_ID,"template_ids":[m["template_id"] for m in MESSAGES],"message_count":len(MESSAGES),"all_messages_created_as":"draft"},indent=2))
