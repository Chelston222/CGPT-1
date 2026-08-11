"""Idempotent deployment of 222 Emails master HTML templates to Klaviyo."""
from pathlib import Path
import json, os, urllib.parse, urllib.request, urllib.error, subprocess, sys

ROOT=Path(__file__).parent
REGISTRY=json.loads((ROOT/'library'/'registry.json').read_text(encoding='utf-8'))
GENERATED=ROOT/'generated'
API='https://a.klaviyo.com/api'
REVISION='2026-07-15'

def request(method,path,payload=None):
    key=os.environ.get('KLAVIYO_PRIVATE_API_KEY')
    if not key: raise SystemExit('Missing KLAVIYO_PRIVATE_API_KEY')
    data=None if payload is None else json.dumps(payload).encode()
    req=urllib.request.Request(API+path,method=method,data=data,headers={'Authorization':f'Klaviyo-API-Key {key}','accept':'application/vnd.api+json','content-type':'application/vnd.api+json','revision':REVISION})
    try:
        with urllib.request.urlopen(req,timeout=30) as res: return json.loads(res.read())
    except urllib.error.HTTPError as exc:
        body=exc.read().decode('utf-8',errors='replace'); raise RuntimeError(f'Klaviyo {exc.code}: {body}') from exc

def existing(name):
    filt=urllib.parse.quote(f'equal(name,"{name}")',safe='(),"')
    items=request('GET',f'/templates?filter={filt}&fields[template]=name').get('data',[])
    return items[0]['id'] if items else None

def create_payload(name,html):
    return {'data':{'type':'template','attributes':{'name':name,'editor_type':'CODE','html':html}}}

def main():
    subprocess.run([sys.executable,str(ROOT/'validate_library.py')],check=True)
    done=[]
    for item in REGISTRY:
        if item['status']!='master-approved': continue
        filename=f"{item['id'].lower()}-{item['slug']}.html"; content=(GENERATED/filename).read_text(encoding='utf-8')
        name=f"222 MASTER | {item['id']} | {item['name']} | v{item['version']}"; template_id=existing(name)
        if template_id:
            body=create_payload(name,content); body['data']['id']=template_id; result=request('PATCH',f'/templates/{template_id}',body); action='updated'
        else:
            result=request('POST','/templates',create_payload(name,content)); action='created'
        done.append({'id':result['data']['id'],'name':name,'action':action}); print(action.upper(),name,result['data']['id'])
    print(json.dumps({'count':len(done),'templates':done},indent=2))

if __name__=='__main__': main()
