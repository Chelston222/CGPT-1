"""Read-only inventory for lifecycle control metrics required by TTE.

No events are created. The output proves whether the Fit Check and client-exit
metrics exist before an exit-safe flow is allowed to be created.
"""
import json
import os
import urllib.request

BASE="https://a.klaviyo.com/api"
REVISION="2026-07-15"
KEY=os.environ["KLAVIYO_PRIVATE_API_KEY"]
TARGETS=["TTE Fit Check Submitted","TTE Client Won"]

req=urllib.request.Request(BASE+"/metrics",headers={
    "Authorization":f"Klaviyo-API-Key {KEY}",
    "accept":"application/vnd.api+json",
    "revision":REVISION,
})
with urllib.request.urlopen(req,timeout=30) as res:
    items=json.loads(res.read()).get("data",[])

by_name={name:[{"id":x.get("id"),"integration":x.get("attributes",{}).get("integration")} for x in items if x.get("attributes",{}).get("name")==name] for name in TARGETS}
print(json.dumps({
    "mode":"READ_ONLY",
    "required_metrics":by_name,
    "ready_for_exit_safe_flow":all(len(v)==1 for v in by_name.values()),
    "total_metrics_visible":len(items),
},indent=2))
