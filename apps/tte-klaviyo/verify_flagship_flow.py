"""Verify the created TTE flagship flow is wired correctly and remains safe in draft.
Read-only. Fails closed if any expected property is wrong.
"""
import json, os, urllib.parse, urllib.request

KEY=os.environ["KLAVIYO_PRIVATE_API_KEY"]
FLOW_ID=os.environ.get("TTE_FLAGSHIP_FLOW_ID","U4ABta")
EXPECTED_TEMPLATES=["THAQ5d","StyJPX","XQQpmq","XdPkJM","SZWx7c"]
EXPECTED_DELAYS=[1,2,2,2]
params=urllib.parse.urlencode({"additional-fields[flow]":"definition"})
url=f"https://a.klaviyo.com/api/flows/{FLOW_ID}/?{params}"
req=urllib.request.Request(url,headers={"Authorization":f"Klaviyo-API-Key {KEY}","accept":"application/vnd.api+json","revision":"2026-07-15"})
with urllib.request.urlopen(req,timeout=30) as r:
    data=json.loads(r.read())["data"]
attrs=data["attributes"]
definition=attrs["definition"]
actions=definition["actions"]
sends=[a for a in actions if a["type"]=="send-email"]
delays=[a for a in actions if a["type"]=="time-delay"]
actual_templates=[a["data"]["message"]["template_id"] for a in sends]
actual_delays=[a["data"]["value"] for a in delays]
statuses=[a["data"]["status"] for a in sends]
assert attrs["status"]=="draft", f"Flow status is {attrs['status']}, expected draft"
assert definition["triggers"]==[{"type":"list","id":"SjerhA"}], definition["triggers"]
assert len(sends)==5, len(sends)
assert len(delays)==4, len(delays)
assert actual_templates==EXPECTED_TEMPLATES, actual_templates
assert actual_delays==EXPECTED_DELAYS, actual_delays
assert set(statuses)=={"draft"}, statuses
assert all(a["data"]["message"]["from_email"]=="hello@222emails.com" for a in sends)
print(json.dumps({"verification":"PASS","flow_id":FLOW_ID,"flow_status":attrs["status"],"trigger_list_id":"SjerhA","send_actions":len(sends),"delays_days":actual_delays,"template_ids":actual_templates,"message_statuses":statuses},indent=2))
