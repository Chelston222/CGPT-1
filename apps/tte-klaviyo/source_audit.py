"""Static Email Revenue OS QA for current 222Emails Klaviyo source. No network or secrets."""
import json, pathlib, re
ROOT=pathlib.Path(__file__).parent; TEMPLATE_DIR=ROOT/"templates"
FILES={"w01":TEMPLATE_DIR/"w01-founder-welcome.html","w02":TEMPLATE_DIR/"w02-revenue-leak.html","w03":TEMPLATE_DIR/"w03-fix-first.html","w04":TEMPLATE_DIR/"w04-proof.html","w05":TEMPLATE_DIR/"w05-audit-conversion.html"}
BANNED_LEGACY={"#2EB8BD","#0D2025","#132B31","#EEF7F7","#EAF0F0","#F1F5F5"}; failures=[]; results={}
for key,path in FILES.items():
 source=path.read_text(encoding="utf-8"); upper=source.upper(); colours={c.upper() for c in re.findall(r"#[0-9A-Fa-f]{6}",source)}
 checks={"doctype":source.lstrip().lower().startswith("<!doctype html>"),"viewport":'name="viewport"' in source.lower(),"unsubscribe":"unsubscribe" in source.lower(),"no_dead_href":'href="#"' not in source,"no_em_dash":"—" not in source,"no_legacy_teal_palette":not bool(colours&BANNED_LEGACY),"canonical_brand_spacing":"222 Emails" not in source,"no_jotform":"jotform.com" not in source.lower(),"no_follow_up_fit_check":"Follow-Up Fit Check" not in source,"no_superseded_formal_name":not bool(re.search(r"\bRevenue Recovery Systems?\b",source,re.I)),"reasonable_width":bool(re.search(r"max-width:(620|640)px",source))}
 if key=="w01": checks.update({"founder_plain_style_no_logo_dependency":"__TTE_LOGO_URL__" not in source,"asks_for_reply":"reply to this email" in source.lower()})
 else: checks.update({"real_v3_logo_required":"__TTE_LOGO_URL__" in source,"uses_core_v3_navy":"#06173D" in upper,"uses_core_v3_orange":"#FF6600" in upper,"no_fake_tte_wordmark":not bool(re.search(r">\s*TTE\s*<",source,re.I)),"canonical_logo_alt":'alt="222Emails"' in source})
 if key=="w05": checks.update({"revenue_recovery_destination_placeholder":"__FREE_AUDIT_URL__" in source,"utm_source_klaviyo":"utm_source=klaviyo" in source,"correct_diagnostic_name":"FREE REVENUE RECOVERY CHECK" in upper})
 if key in {"w02","w03","w04"}: checks["no_forced_primary_external_cta"]="__FREE_AUDIT_URL__" not in source
 if key in {"w01","w02","w05"}: checks["first_name_fallback"]="first_name|default:'there'" in source
 results[key]={"checks":checks,"colours":sorted(colours)}; failed=[name for name,ok in checks.items() if not ok]
 if failed: failures.append({"template":key,"failed":failed})
combined="\n".join(path.read_text(encoding="utf-8") for path in FILES.values())
cross={"five_templates_present":all(path.exists() for path in FILES.values()),"client_return_system_present":"Client Return System" in combined,"free_revenue_recovery_check_present":"Free Revenue Recovery Check" in combined,"brand_navy_present":"#06173D" in combined.upper(),"brand_orange_present":"#FF6600" in combined.upper(),"no_legacy_teal_anywhere":not any(c in combined.upper() for c in BANNED_LEGACY),"no_current_public_jotform_anywhere":"jotform.com" not in combined.lower(),"canonical_brand_everywhere":"222 Emails" not in combined,"no_em_dash_anywhere":"—" not in combined}
for name,ok in cross.items():
 if not ok: failures.append({"cross_template":name})
report={"system":"222Emails Email Revenue OS","gate":"SOURCE_EMAIL_REVENUE_OS_QA","templates":results,"cross_template_checks":cross,"status":"PASS" if not failures else "FAIL","failures":failures}
print(json.dumps(report,indent=2))
if failures: raise SystemExit("EMAIL REVENUE OS SOURCE QA FAILED")
