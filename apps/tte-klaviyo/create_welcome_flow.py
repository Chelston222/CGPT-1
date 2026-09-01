"""Create the 222Emails five-message Email Revenue OS welcome flow in DRAFT mode only."""
import json, os, urllib.error, urllib.parse, urllib.request
BASE="https://a.klaviyo.com/api"; REVISION="2026-07-15"; KEY=os.environ.get("KLAVIYO_PRIVATE_API_KEY")
if not KEY: raise SystemExit("Missing KLAVIYO_PRIVATE_API_KEY")
LIST_ID="SjerhA"; FROM_EMAIL="hello@222emails.com"; FROM_LABEL="222Emails"
FLOW_NAME=os.environ.get("TTE_FLOW_NAME","TTE Flagship Welcome Series | APEX V2 | PRE-LIVE")
MESSAGES=[
 {"key":"w01","name":"TTE Welcome 01 | Founder Welcome","subject":"Welcome to 222Emails","preview":"What I’ll send, what I won’t, and why it matters.","template_name":"TTE-WELCOME-01-FOUNDER-APEX-V2","smart_sending":False},
 {"key":"w02","name":"TTE Welcome 02 | Acquisition Economics","subject":"You already paid to acquire them","preview":"Before buying more demand, inspect the return journey.","template_name":"TTE-WELCOME-02-REVENUE-LEAKS-APEX-V2","smart_sending":True},
 {"key":"w03","name":"TTE Welcome 03 | Appointment Cliff","subject":"The appointment cliff","preview":"What happens after a customer walks out?","template_name":"TTE-WELCOME-03-FIX-FIRST-APEX-V2","smart_sending":True},
 {"key":"w04","name":"TTE Welcome 04 | Client Return Mechanism","subject":"What a Client Return System actually does","preview":"The commercial job comes before the channel.","template_name":"TTE-WELCOME-04-PROOF-APEX-V2","smart_sending":True},
 {"key":"w05","name":"TTE Welcome 05 | Revenue Recovery Check","subject":"Where are your bookings slipping away?","preview":"A three-minute starting point, with no mandatory discovery call.","template_name":"TTE-WELCOME-05-FIT-CHECK-APEX-V2","smart_sending":True},
]
DELAYS=[1,2,2,2]; WEEKDAYS=["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]
def headers(content=False):
 h={"Authorization":f"Klaviyo-API-Key {KEY}","accept":"application/vnd.api+json","revision":REVISION}
 if content: h["content-type"]="application/vnd.api+json"
 return h
def get(path):
 req=urllib.request.Request(BASE+path,headers=headers())
 with urllib.request.urlopen(req,timeout=30) as res: return json.loads(res.read())
def refuse_duplicate_flow_name():
 query=urllib.parse.urlencode({"filter":f'equals(name,"{FLOW_NAME}")',"page[size]":50}); existing=get(f"/flows?{query}").get("data",[]); exact=[x for x in existing if x.get("attributes",{}).get("name")==FLOW_NAME]
 if exact: raise SystemExit(f"FLOW CREATE BLOCKED. Exact-name flow already exists: {[x['id'] for x in exact]}")
def resolve_template_id(name):
 query=urllib.parse.urlencode({"filter":f'equals(name,"{name}")',"page[size]":10}); items=get(f"/templates?{query}").get("data",[]); exact=[x for x in items if x.get("attributes",{}).get("name")==name]
 if len(exact)!=1: raise SystemExit(f"FLOW CREATE BLOCKED. Expected exactly one template named {name}, found {[x.get('id') for x in exact]}")
 return exact[0]["id"]
def send_action(message,next_id=None):
 return {"temporary_id":message["key"],"type":"send-email","data":{"message":{"from_email":FROM_EMAIL,"from_label":FROM_LABEL,"reply_to_email":FROM_EMAIL,"cc_email":None,"bcc_email":None,"subject_line":message["subject"],"preview_text":message["preview"],"template_id":message["template_id"],"smart_sending_enabled":message["smart_sending"],"transactional":False,"add_tracking_params":False,"custom_tracking_params":None,"additional_filters":None,"name":message["name"]},"status":"draft"},"links":{"next":next_id}}
def delay_action(index,days,next_id): return {"temporary_id":f"delay-{index}","type":"time-delay","data":{"unit":"days","value":days,"secondary_value":None,"timezone":"profile","delay_until_time":None,"delay_until_weekdays":WEEKDAYS},"links":{"next":next_id}}
refuse_duplicate_flow_name()
for message in MESSAGES: message["template_id"]=resolve_template_id(message["template_name"])
actions=[]
for idx,message in enumerate(MESSAGES):
 next_id=f"delay-{idx+1}" if idx<len(MESSAGES)-1 else None; actions.append(send_action(message,next_id))
 if idx<len(MESSAGES)-1: actions.append(delay_action(idx+1,DELAYS[idx],MESSAGES[idx+1]["key"]))
payload={"data":{"type":"flow","attributes":{"name":FLOW_NAME,"definition":{"triggers":[{"type":"list","id":LIST_ID}],"profile_filter":None,"actions":actions,"entry_action_id":"w01"}}}}
req=urllib.request.Request(BASE+"/flows",data=json.dumps(payload).encode("utf-8"),method="POST",headers=headers(content=True))
try:
 with urllib.request.urlopen(req,timeout=30) as res: result=json.loads(res.read())
except urllib.error.HTTPError as exc: raise SystemExit(f"Klaviyo create flow failed with {exc.code}: {exc.read().decode('utf-8',errors='replace')}") from exc
created=result["data"]
print(json.dumps({"status":"CREATED_DRAFT_PRE_LIVE","flow_id":created.get("id"),"name":created.get("attributes",{}).get("name"),"trigger_list_id":LIST_ID,"template_ids":[m["template_id"] for m in MESSAGES],"subjects":[m["subject"] for m in MESSAGES],"message_count":len(MESSAGES),"profile_filter":"NOT YET WIRED - production blocker","all_messages_created_as":"draft"},indent=2))
