"""Read-only inventory of canonical 222 Emails reusable Klaviyo templates.

Reports exact-name duplicates and IDs so cleanup/deployment decisions are based
on account state rather than assumptions. Does not edit or delete anything.
"""
import json
import os
import urllib.parse
import urllib.request

BASE="https://a.klaviyo.com/api"
REVISION="2026-07-15"
KEY=os.environ["KLAVIYO_PRIVATE_API_KEY"]
NAMES=[
    "TTE-WELCOME-01-FOUNDER-v1",
    "TTE-WELCOME-02-REVENUE-LEAKS-v1",
    "TTE-WELCOME-03-FIX-FIRST-v1",
    "TTE-WELCOME-04-PROOF-v1",
    "TTE-WELCOME-05-AUDIT-CONVERSION-v1",
]

def get(path):
    req=urllib.request.Request(BASE+path,headers={
        "Authorization":f"Klaviyo-API-Key {KEY}",
        "accept":"application/vnd.api+json",
        "revision":REVISION,
    })
    with urllib.request.urlopen(req,timeout=30) as res:
        return json.loads(res.read())

report={}
for name in NAMES:
    q=urllib.parse.urlencode({"filter":f'equals(name,"{name}")',"page[size]":100})
    items=get(f"/templates?{q}").get("data",[])
    exact=[x for x in items if x.get("attributes",{}).get("name")==name]
    report[name]=[
        {
            "id":x.get("id"),
            "updated_at":x.get("attributes",{}).get("updated_at"),
            "editor_type":x.get("attributes",{}).get("editor_type"),
        }
        for x in exact
    ]

print(json.dumps({
    "mode":"READ_ONLY",
    "templates":report,
    "duplicate_names":[name for name,items in report.items() if len(items)>1],
    "missing_names":[name for name,items in report.items() if not items],
},indent=2))
