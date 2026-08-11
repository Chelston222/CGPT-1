"""Static QA for the 222 Emails master HTML library."""
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).parent
GENERATED = ROOT / "generated"
REQUIRED = ("<!doctype html>",'name="viewport"','role="presentation"',"{% unsubscribe %}","max-width:600px","x-apple-disable-message-reformatting","color-scheme","xmlns:v=","__LOGO_URL__","__PRIMARY_CTA_URL__")
BANNED = ("<script","<iframe","<form","javascript:","display:flex","display:grid")

def validate(path):
    text=path.read_text(encoding="utf-8"); low=text.lower(); errors=[]
    for needle in REQUIRED:
        if needle.lower() not in low: errors.append(f"missing required marker: {needle}")
    for needle in BANNED:
        if needle.lower() in low: errors.append(f"banned/risky construct: {needle}")
    for tag in re.findall(r"<img\b[^>]*>",text,flags=re.I):
        if not re.search(r"\balt\s*=",tag,flags=re.I): errors.append("image missing ALT attribute")
    if text.count("<table") != text.count("</table>"): errors.append("table tag count mismatch")
    if text.count("<tr") != text.count("</tr>"): errors.append("row tag count mismatch")
    return errors

def main():
    subprocess.run([sys.executable,str(ROOT / "build_master_library.py")],check=True)
    paths=sorted(GENERATED.glob("*.html"))
    if len(paths) != 30:
        print(f"FAIL: expected 30 templates, found {len(paths)}"); return 1
    failures={p.name:validate(p) for p in paths}; failures={k:v for k,v in failures.items() if v}
    if failures:
        for name,errs in failures.items():
            print(name)
            for err in errs: print("  -",err)
        return 1
    print("PASS: 30/30 master templates passed static QA")
    return 0

if __name__ == "__main__": raise SystemExit(main())
