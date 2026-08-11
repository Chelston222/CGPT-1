"""Recommend a safe 222 Revenue Template OS pack from structured client intake.

Deterministic by design: this does not invent proof, urgency, guarantees or claims.
"""
from __future__ import annotations
from pathlib import Path
import json, re, sys

ROOT = Path(__file__).parent
VARIANTS = json.loads((ROOT/'revenue-os'/'layout_variants.json').read_text(encoding='utf-8'))

GOALS = {
    'recover_cart': ('abandoned-cart-objections','proof-first',['objection_faq']),
    'recover_checkout': ('abandoned-checkout','performance-minimal',['delivery_reassurance']),
    'browse_recovery': ('browse-abandonment','commerce-product',[]),
    'improve_welcome': ('welcome-hero','premium-editorial',['benefit_stack']),
    'build_trust': ('case-study','proof-first',[]),
    'launch_product': ('product-launch','premium-editorial',['mechanism','benefit_stack']),
    'promote_offer': ('promotional-offer','commerce-product',['benefit_stack']),
    'educate': ('education-value','premium-editorial',['mechanism']),
    'post_purchase': ('post-purchase-education','performance-minimal',['next_steps']),
    'cross_sell': ('cross-sell','commerce-product',['benefit_stack']),
    'review': ('review-request','founder-human',[]),
    'referral': ('referral','founder-human',[]),
    'win_back': ('winback','founder-human',['benefit_stack']),
    'replenish': ('replenishment','commerce-product',[]),
    'back_in_stock': ('back-in-stock','performance-minimal',[]),
    'transaction': ('order-confirmation','performance-minimal',['next_steps']),
    'vip': ('vip-retention','proof-first',['vip_access']),
}

REQUIRED = {
    'client_id', 'business_model', 'primary_goal', 'brand', 'assets', 'offer', 'evidence', 'tracking'
}
BRAND_REQUIRED = {'BRAND_NAME','HOME_URL','LOGO_URL','SUPPORT_EMAIL','POSTAL_ADDRESS'}
OFFER_REQUIRED = {'desired_outcome','core_problem','primary_cta_url'}


def _url(v: str) -> bool:
    return bool(re.match(r'^https://[^\s]+$', str(v or '')))


def validate_intake(d: dict) -> list[str]:
    errors=[]
    for k in sorted(REQUIRED - set(d)):
        errors.append(f'missing {k}')
    if errors: return errors
    for k in sorted(BRAND_REQUIRED - set(d['brand'])):
        errors.append(f'missing brand.{k}')
    for k in sorted(OFFER_REQUIRED - set(d['offer'])):
        errors.append(f'missing offer.{k}')
    if d['primary_goal'] not in GOALS:
        errors.append('unsupported primary_goal')
    for field in ('HOME_URL','LOGO_URL'):
        if field in d['brand'] and not _url(d['brand'][field]): errors.append(f'brand.{field} must use https')
    if 'primary_cta_url' in d['offer'] and not _url(d['offer']['primary_cta_url']): errors.append('offer.primary_cta_url must use https')
    if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', d['brand'].get('SUPPORT_EMAIL','')): errors.append('invalid support email')
    return errors


def subject_pack(goal: str, brand: str, product: str='') -> dict:
    product = product or 'what you were looking at'
    pools = {
        'recover_cart': [f'Still deciding on {product}?', 'A quick answer before you decide', 'Your basket is still easy to return to'],
        'recover_checkout': ['You were one step away', 'Need anything before you finish?', 'Your checkout is ready when you are'],
        'improve_welcome': [f'Welcome to {brand}', 'Start here', 'The fastest way to get value from us'],
        'launch_product': [f'Meet {product}', f'Why we built {product}', f'A new way to solve the problem'],
        'win_back': ['Still working on the same goal?', 'A useful update for you', 'What has changed since we last spoke'],
        'post_purchase': ['How to get the best result from your order', 'Your next step', 'Make the most of what you bought'],
    }
    subjects = pools.get(goal, [f'An update from {brand}', 'One useful thing for you', 'Worth a quick look'])
    return {'subjects': subjects, 'preheaders': [
        'Useful context before you decide what to do next.',
        'Clear information, one next step, no unnecessary friction.',
        'Everything you need to make the next decision confidently.'
    ]}


def evidence_modules(evidence: dict) -> list[dict]:
    out=[]
    t=evidence.get('testimonial')
    if t and t.get('verified') is True and t.get('quote') and t.get('name'):
        out.append({'type':'testimonial','verified':True,'data':{'TESTIMONIAL_QUOTE':t['quote'],'TESTIMONIAL_NAME':t['name']}})
    p=evidence.get('proof_points') or []
    if len(p) >= 3 and all(x.get('verified') is True and x.get('text') for x in p[:3]):
        out.append({'type':'proof_strip','verified':True,'data':{f'PROOF_{i+1}':p[i]['text'] for i in range(3)}})
    g=evidence.get('guarantee')
    if g and g.get('verified') is True and g.get('title') and g.get('body'):
        out.append({'type':'guarantee','verified':True,'data':{'GUARANTEE_TITLE':g['title'],'GUARANTEE_BODY':g['body']}})
    u=evidence.get('urgency')
    if u and u.get('verified') is True and u.get('title') and u.get('body'):
        out.append({'type':'urgency_truth','verified':True,'data':{'URGENCY_TITLE':u['title'],'URGENCY_BODY':u['body']}})
    return out


def recommend(d: dict) -> dict:
    errs=validate_intake(d)
    if errs: raise ValueError('; '.join(errs))
    slug, variant, default_modules = GOALS[d['primary_goal']]
    if variant not in VARIANTS: raise ValueError(f'configured variant missing: {variant}')
    brand=d['brand']; offer=d['offer']; assets=d['assets']; evidence=d['evidence']
    content={
        'DESIRED_OUTCOME': offer['desired_outcome'], 'CORE_PROBLEM': offer['core_problem'],
        'PRODUCT_NAME': offer.get('product_name',''), 'PRODUCT_BENEFIT': offer.get('product_benefit',''),
        'PRODUCT_PRICE': offer.get('product_price',''), 'ORDER_REFERENCE': offer.get('order_reference','')
    }
    manifest={
        'client_id': d['client_id'], 'template_slug': slug, 'layout_variant': variant,
        'brand': {**brand, 'HERO_ALT': assets.get('HERO_ALT', f"{brand['BRAND_NAME']} email image"),
                  'PREHEADER': subject_pack(d['primary_goal'],brand['BRAND_NAME'],offer.get('product_name',''))['preheaders'][0],
                  'PRIMARY_CTA_URL': offer['primary_cta_url']},
        'assets': assets, 'content': content, 'modules': [], 'tracking': d['tracking']
    }
    # Default modules only when their data is explicitly supplied in intake.
    supplied=d.get('module_data',{})
    for kind in default_modules:
        if kind in supplied:
            manifest['modules'].append({'type':kind,'data':supplied[kind]})
    manifest['modules'].extend(evidence_modules(evidence))
    return {'manifest':manifest,'creative':subject_pack(d['primary_goal'],brand['BRAND_NAME'],offer.get('product_name','')),
            'rationale':{'goal':d['primary_goal'],'template_slug':slug,'layout_variant':variant,
                         'why':'Selected for the stated lifecycle problem and available evidence. Sensitive proof modules are included only when explicitly verified.'}}


def main():
    if len(sys.argv)!=3: raise SystemExit('usage: recommend_client_pack.py intake.json output.json')
    d=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    result=recommend(d)
    Path(sys.argv[2]).write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps(result['rationale'],indent=2))

if __name__=='__main__': main()
