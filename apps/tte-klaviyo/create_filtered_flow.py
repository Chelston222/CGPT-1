"""Create the next 222 Emails APEX flow only when real exit metrics exist.

This script is fail-closed. It will not create a flow until Klaviyo contains
exactly one metric named `TTE Fit Check Submitted` and exactly one metric named
`TTE Client Won`. It then creates a Draft welcome flow whose profile filter is
re-evaluated at every action and requires both metrics to remain at count 0 since
flow start.

Nothing is activated or sent.
"""
import json
import os
import urllib.error
import urllib.parse
import urllib.request

BASE="https://a.klaviyo.com/api"
REVISION="2026-07-15"
KEY=os.environ["KLAVIYO_PRIVATE_API_KEY"]
LIST_ID="SjerhA"
FROM_EMAIL="hello@222emails.com"
FROM_LABEL="Triple Two Emails"
FLOW_NAME=os.environ.get("TTE_FLOW_NAME","TTE Flagship Welcome Series | APEX V3 | EXIT-SAFE PRE-LIVE")

TEMPLATES=[
    ("w01","TTE Welcome 01 | Founder Welcome","Welcome to 222 Emails","A quick hello, and what I’ll actually send you.","TTE-WELCOME-01-FOUNDER-APEX-V2",False),
    ("w02","TTE Welcome 02 | Revenue Leak Diagnostic","5 places revenue quietly disappears","Before buying more traffic, check these five places.","TTE-WELCOME-02-REVENUE-LEAKS-APEX-V2",True),
    ("w03","TTE Welcome 03 | What We Would Fix First","What we’d fix first in your email system","The 4-layer system we use before making anything prettier.","TTE-WELCOME-03-FIX-FIRST-APEX-V2",True),
    ("w04","TTE Welcome 04 | Proof Over Promises","We built this instead of telling you we could","You’re inside the exact kind of system we sell.","TTE-WELCOME-04-PROOF-APEX-V2",True),
    ("w05","TTE Welcome 05 | Fit Check Conversion","Want us to find the leaks?","One simple next step if you want us to look.","TTE-WELCOME-05-FIT-CHECK-APEX-V2",True),
]
DELAYS=[1,2,2,2]
WEEKDAYS=["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]


def headers(content=False):
    h={"Authorization":f"Klaviyo-API-Key {KEY}","accept":"application/vnd.api+json","revision":REVISION}
    if content:h["content-type"]="application/vnd.api+json"
    return h


def api(method,path,payload=None):
    req=urllib.request.Request(BASE+path,data=None if payload is None else json.dumps(payload).encode(),method=method,headers=headers(payload is not None))
    try:
        with urllib.request.urlopen(req,timeout=30) as res:return json.loads(res.read())
    except urllib.error.HTTPError as exc:
        body=exc.read().decode("utf-8",errors="replace")
        raise SystemExit(f"Klaviyo {method} {path} failed {exc.code}: {body}") from exc


def exact_named(path,name,page_size):
    q=urllib.parse.urlencode({"filter":f'equals(name,"{name}")',"page[size]":page_size})
    items=api("GET",f"{path}?{q}").get("data",[])
    exact=[x for x in items if x.get("attributes",{}).get("name")==name]
    if len(exact)!=1:
        raise SystemExit(f"APEX V3 CREATE BLOCKED. Expected exactly one `{name}`, found {[x.get('id') for x in exact]}")
    return exact[0]["id"]


def metric_id(name):
    # Get Metrics does not support name filtering in the current stable endpoint,
    # so inspect the current page and fail if the exact metric is absent/ambiguous.
    items=api("GET","/metrics").get("data",[])
    exact=[x for x in items if x.get("attributes",{}).get("name")==name]
    if len(exact)!=1:
        raise SystemExit(f"APEX V3 CREATE BLOCKED. Expected exactly one metric `{name}`, found {[x.get('id') for x in exact]}")
    return exact[0]["id"]

# Refuse accidental duplicate candidate creation.
exact_named_flow_q=urllib.parse.urlencode({"filter":f'equals(name,"{FLOW_NAME}")',"page[size]":50})
existing=[x for x in api("GET",f"/flows?{exact_named_flow_q}").get("data",[]) if x.get("attributes",{}).get("name")==FLOW_NAME]
if existing:
    raise SystemExit(f"APEX V3 CREATE BLOCKED. Flow already exists: {[x.get('id') for x in existing]}")

fit_check_metric=metric_id("TTE Fit Check Submitted")
client_won_metric=metric_id("TTE Client Won")

messages=[]
for key,name,subject,preview,template_name,smart in TEMPLATES:
    messages.append({
        "key":key,"name":name,"subject":subject,"preview":preview,
        "template_id":exact_named("/templates",template_name,10),"smart":smart,
    })


def metric_zero_since_flow_start(mid):
    return {
        "type":"profile-metric",
        "metric_id":mid,
        "measurement":"count",
        "measurement_filter":{"type":"numeric","operator":"equals","value":0},
        "timeframe_filter":{"type":"date","operator":"flow-start"},
        "metric_filters":None,
    }

profile_filter={
    "condition_groups":[{
        "conditions":[
            metric_zero_since_flow_start(fit_check_metric),
            metric_zero_since_flow_start(client_won_metric),
        ]
    }]
}


def send_action(m,next_id):
    return {
        "temporary_id":m["key"],"type":"send-email",
        "data":{"message":{
            "from_email":FROM_EMAIL,"from_label":FROM_LABEL,"reply_to_email":FROM_EMAIL,
            "cc_email":None,"bcc_email":None,"subject_line":m["subject"],"preview_text":m["preview"],
            "template_id":m["template_id"],"smart_sending_enabled":m["smart"],"transactional":False,
            "add_tracking_params":False,"custom_tracking_params":None,"additional_filters":None,"name":m["name"],
        },"status":"draft"},
        "links":{"next":next_id},
    }


def delay_action(i,days,next_id):
    return {"temporary_id":f"delay-{i}","type":"time-delay","data":{"unit":"days","value":days,"secondary_value":None,"timezone":"profile","delay_until_time":None,"delay_until_weekdays":WEEKDAYS},"links":{"next":next_id}}

actions=[]
for i,m in enumerate(messages):
    next_id=f"delay-{i+1}" if i<len(messages)-1 else None
    actions.append(send_action(m,next_id))
    if i<len(messages)-1:actions.append(delay_action(i+1,DELAYS[i],messages[i+1]["key"]))

payload={"data":{"type":"flow","attributes":{"name":FLOW_NAME,"definition":{"triggers":[{"type":"list","id":LIST_ID}],"profile_filter":profile_filter,"actions":actions,"entry_action_id":"w01"}}}}
created=api("POST","/flows",payload)["data"]
print(json.dumps({
    "status":"CREATED_DRAFT_EXIT_SAFE",
    "flow_id":created.get("id"),"flow_name":created.get("attributes",{}).get("name"),
    "fit_check_metric_id":fit_check_metric,"client_won_metric_id":client_won_metric,
    "profile_filter":profile_filter,"message_count":5,"all_messages":"draft",
},indent=2))
