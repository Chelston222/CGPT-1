"""Canonical intake -> recommendation -> HTML -> QA pack builder for 222 Emails.

Safe by default: creates files only. It never calls Klaviyo, edits flows, activates or sends.
"""
from __future__ import annotations
from pathlib import Path
import argparse, json, shutil
import recommend_client_pack as recommender
import build_client_email as renderer
import qa_client_pack as packqa


def build_pack(intake_path: Path, out_dir: Path) -> dict:
    intake=json.loads(intake_path.read_text(encoding='utf-8'))
    result=recommender.recommend(intake)
    manifest=result['manifest']; creative=result['creative']
    out_dir.mkdir(parents=True,exist_ok=True)
    (out_dir/'intake.json').write_text(json.dumps(intake,indent=2,ensure_ascii=False),encoding='utf-8')
    (out_dir/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf-8')
    (out_dir/'creative.json').write_text(json.dumps({**creative,'rationale':result['rationale']},indent=2,ensure_ascii=False),encoding='utf-8')
    html=renderer.build(manifest)
    leftovers=renderer.unresolved(html)
    if leftovers: raise ValueError('Unresolved tokens: '+', '.join(leftovers))
    if 'placehold.co' in html.lower(): raise ValueError('Placeholder imagery remains after client materialisation')
    (out_dir/'email.html').write_text(html,encoding='utf-8')
    qa=packqa.inspect_pack(out_dir)
    (out_dir/'qa.json').write_text(json.dumps(qa,indent=2,ensure_ascii=False),encoding='utf-8')
    readme=f"""# 222 Emails client email pack\n\nClient: `{intake['client_id']}`\n\nGoal: `{intake['primary_goal']}`\n\nTemplate: `{manifest['template_slug']}`\n\nLayout: `{manifest['layout_variant']}`\n\nQA: **{qa['status']}**\n\n## Contents\n- `intake.json`: source facts supplied for this build\n- `manifest.json`: deterministic production manifest\n- `creative.json`: subject/preheader options and selection rationale\n- `email.html`: materialised custom HTML\n- `qa.json`: hard-gate report and SHA-256 hashes\n\nThis pack is a draft production artefact. It is not permission to send. Real inbox/render testing, audience/flow checks and explicit go-live approval remain separate gates.\n"""
    (out_dir/'README.md').write_text(readme,encoding='utf-8')
    if qa['status']!='PASS': raise ValueError('Client pack QA failed: '+'; '.join(qa['errors']))
    return {'pack':str(out_dir),'qa':qa,'rationale':result['rationale']}


def main():
    p=argparse.ArgumentParser(); p.add_argument('intake'); p.add_argument('--out',required=True); p.add_argument('--clean',action='store_true')
    a=p.parse_args(); out=Path(a.out)
    if a.clean and out.exists(): shutil.rmtree(out)
    print(json.dumps(build_pack(Path(a.intake),out),indent=2,ensure_ascii=False))

if __name__=='__main__': main()
