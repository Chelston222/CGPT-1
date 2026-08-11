"""Idempotently deploy one QA-passed client pack as a Klaviyo CODE template.

This creates/updates a template only. It does not attach to a flow, activate a flow or send.
After deployment it calls Klaviyo template-render as an independent platform-side render check.
"""
from __future__ import annotations
from pathlib import Path
import argparse, json, os, re, urllib.error, urllib.parse, urllib.request
import qa_client_pack as packqa

API='https://a.klaviyo.com/api'; REVISION='2026-07-15'

def request(method,path,payload=None):
    key=os.environ.get('KLAVIYO_PRIVATE_API_KEY')
    if not key: raise SystemExit('Missing KLAVIYO_PRIVATE_API_KEY')
    data=None if payload is None else json.dumps(payload).encode('utf-8')
    req=urllib.request.Request(API+path,method=method,data=data,headers={
        'Authorization':f'Klaviyo-API-Key {key}','accept':'application/vnd.api+json',
        'content-type':'application/vnd.api+json','revision':REVISION})
    try:
        with urllib.request.urlopen(req,timeout=30) as res: return json.loads(res.read())
    except urllib.error.HTTPError as exc:
        body=exc.read().decode('utf-8',errors='replace'); raise RuntimeError(f'Klaviyo {exc.code}: {body}') from exc

def exact_existing(name:str):
    filt=urllib.parse.quote(f'equals(name,"{name}")',safe='(),"')
    items=request('GET',f'/templates?filter={filt}&fields[template]=name').get('data',[])
    exact=[x for x in items if x.get('attributes',{}).get('name')==name]
    return exact[0]['id'] if exact else None

def deploy(pack:Path):
    report=packqa.inspect_pack(pack)
    if report['status']!='PASS': raise SystemExit('Pack QA failed: '+'; '.join(report['errors']))
    manifest=json.loads((pack/'manifest.json').read_text(encoding='utf-8'))
    html=(pack/'email.html').read_text(encoding='utf-8')
    name=f"222 CLIENT DRAFT | {manifest['client_id']} | {manifest['template_slug']} | {manifest['layout_variant']}"
    payload={'data':{'type':'template','attributes':{'name':name,'editor_type':'CODE','html':html}}}
    tid=exact_existing(name)
    if tid:
        payload['data']['id']=tid; result=request('PATCH',f'/templates/{tid}',payload); action='updated'
    else:
        result=request('POST','/templates',payload); tid=result['data']['id']; action='created'
    render_payload={'data':{'type':'template','id':tid,'attributes':{'context':{'person':{'first_name':'QA'}}}}}
    rendered=request('POST','/template-render',render_payload)
    rendered_html=rendered.get('data',{}).get('attributes',{}).get('html','')
    render_errors=[]
    if not rendered_html: render_errors.append('Klaviyo returned no rendered HTML')
    if re.search(r'__[A-Z0-9_]+__',rendered_html): render_errors.append('rendered HTML contains unresolved build tokens')
    if 'placehold.co' in rendered_html.lower(): render_errors.append('rendered HTML contains placeholder imagery')
    if render_errors: raise SystemExit('Platform render verification failed: '+'; '.join(render_errors))
    receipt={'status':'PASS','action':action,'template_id':tid,'name':name,'revision':REVISION,
             'local_qa':report,'platform_render':{'html_bytes':len(rendered_html.encode('utf-8')),'status':'PASS'}}
    (pack/'klaviyo-draft-receipt.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
    return receipt

def main():
    p=argparse.ArgumentParser(); p.add_argument('pack'); p.add_argument('--confirmation',required=True); a=p.parse_args()
    if a.confirmation!='DEPLOY-CLIENT-DRAFT-ONLY': raise SystemExit('Exact confirmation required: DEPLOY-CLIENT-DRAFT-ONLY')
    print(json.dumps(deploy(Path(a.pack)),indent=2))

if __name__=='__main__': main()
