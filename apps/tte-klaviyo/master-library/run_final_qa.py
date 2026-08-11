"""Final regression gate for the complete 222 Emails Revenue Template OS."""
from __future__ import annotations
from pathlib import Path
import json, subprocess, sys, tempfile
import recommend_client_pack as rec
import build_client_pack as packer

ROOT=Path(__file__).parent
EXAMPLE=ROOT/'revenue-os'/'client_intake.example.json'

def expect_fail(label,fn):
    try: fn()
    except Exception: return
    raise AssertionError(f'negative test did not fail: {label}')

def main():
    subprocess.run([sys.executable,str(ROOT/'validate_library.py')],check=True)
    subprocess.run([sys.executable,str(ROOT/'validate_revenue_os.py')],check=True)
    intake=json.loads(EXAMPLE.read_text(encoding='utf-8'))
    # Recommendation determinism and verified-evidence policy.
    r1=rec.recommend(intake); r2=rec.recommend(intake)
    assert r1==r2, 'recommendation must be deterministic'
    bad=json.loads(json.dumps(intake)); bad['brand']['HOME_URL']='http://insecure.example.com'
    expect_fail('insecure URL',lambda: rec.recommend(bad))
    bad=json.loads(json.dumps(intake)); bad['primary_goal']='invented_goal'
    expect_fail('unsupported goal',lambda: rec.recommend(bad))
    unverified=json.loads(json.dumps(intake)); unverified['evidence']['testimonial']={'verified':False,'quote':'Amazing','name':'Someone'}
    result=rec.recommend(unverified)
    assert not any(m['type']=='testimonial' for m in result['manifest']['modules']), 'unverified testimonial leaked into manifest'
    verified=json.loads(json.dumps(intake)); verified['evidence']['testimonial']={'verified':True,'quote':'A real verified quote','name':'Verified Customer'}
    result=rec.recommend(verified)
    assert any(m['type']=='testimonial' and m.get('verified') is True for m in result['manifest']['modules']), 'verified testimonial not carried through'
    with tempfile.TemporaryDirectory() as td:
        out=Path(td)/'pack'; result=packer.build_pack(EXAMPLE,out)
        assert result['qa']['status']=='PASS'
        for name in ('intake.json','manifest.json','creative.json','email.html','qa.json','README.md'):
            assert (out/name).exists(), f'missing pack file: {name}'
        qa=json.loads((out/'qa.json').read_text(encoding='utf-8'))
        assert qa['files']['email.html'], 'email hash missing'
    print('FINAL QA PASS: master library + 150-layout OS + module matrix + deterministic intake path + negative safety tests + full client-pack build')

if __name__=='__main__': main()
