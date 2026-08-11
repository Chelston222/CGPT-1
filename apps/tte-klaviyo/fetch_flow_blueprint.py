"""Read the existing Klaviyo standard welcome flow definition for safe cloning.
No writes are performed.
"""
import json, os, urllib.parse, urllib.request
KEY=os.environ["KLAVIYO_PRIVATE_API_KEY"]
FLOW_ID=os.environ.get("KLAVIYO_SOURCE_FLOW_ID","XDpEah")
params=urllib.parse.urlencode({"additional-fields[flow]":"definition"})
url=f"https://a.klaviyo.com/api/flows/{FLOW_ID}/?{params}"
req=urllib.request.Request(url,headers={"Authorization":f"Klaviyo-API-Key {KEY}","accept":"application/vnd.api+json","revision":"2026-07-15"})
with urllib.request.urlopen(req,timeout=30) as r:
    payload=json.loads(r.read())
print(json.dumps(payload,indent=2))
