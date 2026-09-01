"""Read-only verifier for the current 222Emails flagship Klaviyo draft candidate."""
import json, os, urllib.parse, urllib.request
KEY=os.environ["KLAVIYO_PRIVATE_API_KEY"]; FLOW_ID=os.environ.get("TTE_FLAGSHIP_FLOW_ID","TWM6Yx"); REVISION="2026-07-15"
EXPECTED_DELAYS=[1,2,2,2]; EXPECTED_SUBJECTS=["Welcome to 222Emails","You already paid to acquire them","The appointment cliff","What a Client Return System actually does","Where are your bookings slipping away?"]
EXPECTED_MARKERS=["Thanks for joining 222Emails","already crossed the hardest bridge","Appointment Cliff","CLIENT RETURN SYSTEM","Free Revenue Recovery Check"]
AUDIT_DESTINATION="tally.so/r/44057b"
def get(url):
 req=urllib.request.Request(url,headers={"Authorization":f"Klaviyo-API-Key {KEY}","accept":"application/vnd.api+json","revision":REVISION});
 with urllib.request.urlopen(req,timeout=30) as r: return json.loads(r.read())
params=urllib.parse.urlencode({"additional-fields[flow]":"definition"}); data=get(f"https://a.klaviyo.com/api/flows/{FLOW_ID}/?{params}")["data"]; attrs=data["attributes"]; definition=attrs["definition"]; actions=definition["actions"]; sends=[a for a in actions if a["type"]=="send-email"]; delays=[a for a in actions if a["type"]=="time-delay"]
actual_templates=[a["data"]["message"]["template_id"] for a in sends]; actual_delays=[a["data"]["value"] for a in delays]; statuses=[a["data"]["status"] for a in sends]; subjects=[a["data"]["message"]["subject_line"] for a in sends]
assert attrs["status"]=="draft",f"Flow status is {attrs['status']}, expected draft"; assert definition["triggers"]==[{"type":"list","id":"SjerhA"}]; assert len(sends)==5; assert len(delays)==4; assert actual_delays==EXPECTED_DELAYS; assert subjects==EXPECTED_SUBJECTS; assert set(statuses)=={"draft"}; assert all(a["data"]["message"]["from_email"]=="hello@222emails.com" for a in sends); assert all(a["data"]["message"]["from_label"]=="222Emails" for a in sends); assert all(a["data"]["message"]["reply_to_email"]=="hello@222emails.com" for a in sends)
for index,(template_id,marker) in enumerate(zip(actual_templates,EXPECTED_MARKERS),start=1):
 html=get(f"https://a.klaviyo.com/api/templates/{template_id}/")["data"].get("attributes",{}).get("html",""); assert marker in html,f"Expected marker missing in {template_id}: {marker}"; assert "__FREE_AUDIT_URL__" not in html; assert 'href="#"' not in html; assert "unsubscribe" in html.lower(); assert "jotform.com" not in html.lower(); assert "222 Emails" not in html; assert "—" not in html
 if index==5: assert AUDIT_DESTINATION in html,f"Current Free Revenue Recovery Check route missing from {template_id}"
 else: assert AUDIT_DESTINATION not in html,f"Unexpected primary diagnostic CTA in message {index}"
print(json.dumps({"verification":"PASS","flow_id":FLOW_ID,"flow_status":attrs["status"],"subjects":subjects,"template_content_checks":"5/5 PASS","unsubscribe_body_checks":"5/5 PASS","current_route_checks":"1/1 PASS","non_regression_copy_checks":"5/5 PASS"},indent=2))
