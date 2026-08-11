"""Hard-gate QA for one generated 222 Emails client pack."""
from __future__ import annotations
from pathlib import Path
import hashlib, json, re, sys
import validate_revenue_os as osqa

SENSITIVE = {'testimonial','proof_strip','guarantee','urgency_truth','social_proof_quote'}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inspect_pack(pack: Path) -> dict:
    manifest=json.loads((pack/'manifest.json').read_text(encoding='utf-8'))
    creative=json.loads((pack/'creative.json').read_text(encoding='utf-8'))
    html=(pack/'email.html').read_text(encoding='utf-8')
    errors=list(osqa.hard_gates(html))
    warnings=[]
    subjects=creative.get('subjects',[]); preheaders=creative.get('preheaders',[])
    if len(subjects)<3: errors.append('fewer than 3 subject-line candidates')
    if len(preheaders)<3: errors.append('fewer than 3 preheader candidates')
    for s in subjects:
        if not str(s).strip(): errors.append('blank subject line')
        if len(s)>70: warnings.append(f'long subject line ({len(s)}): {s}')
    for p in preheaders:
        if not str(p).strip(): errors.append('blank preheader')
        if len(p)>140: warnings.append(f'long preheader ({len(p)})')
    for m in manifest.get('modules',[]):
        if m.get('type') in SENSITIVE and m.get('verified') is not True:
            errors.append(f"sensitive module not verified: {m.get('type')}")
    if re.search(r'\b(?:guaranteed|guarantee(?:d)? results?|best ever|#1)\b', html, flags=re.I):
        warnings.append('strong claim language detected: verify substantiation')
    if 'placehold.co' in html.lower(): errors.append('placeholder imagery remains')
    if re.search(r'__[A-Z0-9_]+__',html): errors.append('unresolved build token remains')
    if not re.search(r'https://[^"\s]+utm_source=',html): errors.append('tracked primary CTA not found')
    return {
        'status':'PASS' if not errors else 'FAIL', 'errors':errors, 'warnings':warnings,
        'files':{n:sha256(pack/n) for n in ('manifest.json','creative.json','email.html')}
    }


def main():
    if len(sys.argv)!=2: raise SystemExit('usage: qa_client_pack.py PACK_DIR')
    pack=Path(sys.argv[1]); report=inspect_pack(pack)
    (pack/'qa.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps(report,indent=2,ensure_ascii=False))
    if report['status']!='PASS': raise SystemExit(1)

if __name__=='__main__': main()
