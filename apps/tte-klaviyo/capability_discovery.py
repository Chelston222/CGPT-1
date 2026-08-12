"""Read-only discovery for permissions/resources needed by the APEX TTE build.

Never creates, edits, subscribes, sends or changes flow status. It reports whether
the current private key can read resources needed for brand assets, forms,
profiles, metrics, account/site identity and sending-domain health.
"""
import json
import os
import urllib.error
import urllib.request

BASE="https://a.klaviyo.com/api"
REVISION="2026-07-15"
KEY=os.environ["KLAVIYO_PRIVATE_API_KEY"]

ENDPOINTS={
    "accounts_read":"/accounts",
    "images_read":"/images?page[size]=5",
    "forms_read":"/forms?page[size]=5",
    "profiles_read":"/profiles?page[size]=1",
    "metrics_read":"/metrics",
    "sending_domains_read":"/sending-domains",
}

def probe(path):
    req=urllib.request.Request(BASE+path,headers={
        "Authorization":f"Klaviyo-API-Key {KEY}",
        "accept":"application/vnd.api+json",
        "revision":REVISION,
    })
    try:
        with urllib.request.urlopen(req,timeout=30) as res:
            body=json.loads(res.read())
            data=body.get("data",[])
            if isinstance(data,list):
                sample=[{"id":x.get("id"),"attributes":x.get("attributes",{})} for x in data[:5]]
                count=len(data)
            else:
                sample=data
                count=1 if data else 0
            return {"ok":True,"http":res.status,"count_returned":count,"sample":sample}
    except urllib.error.HTTPError as exc:
        raw=exc.read().decode("utf-8",errors="replace")
        try:
            detail=json.loads(raw).get("errors",[])
        except Exception:
            detail=raw[:500]
        return {"ok":False,"http":exc.code,"detail":detail}

report={name:probe(path) for name,path in ENDPOINTS.items()}
print(json.dumps({"mode":"READ_ONLY","capabilities":report},indent=2))
