"""Build the 30 222 Emails master HTML templates from the registry."""
from pathlib import Path
import json
import html

ROOT = Path(__file__).parent
REGISTRY = json.loads((ROOT / "library" / "registry.json").read_text(encoding="utf-8"))
OUT = ROOT / "generated"

COPY = {
"welcome-hero":("Welcome. Here’s the fastest way to get value.","Start with the result your customer wants most, then make the next action obvious.","Show me the best place to start"),
"welcome-founder":("A quick note from the founder","Explain why the brand exists in terms of the customer problem you refuse to leave unsolved.","See what we built for you"),
"welcome-offer":("Your welcome benefit is ready","Frame the offer as a lower-friction path to the desired result, not as a random discount.","Use my welcome benefit"),
"welcome-discovery":("Find the right option in under a minute","Reduce choice overload and help the subscriber self-select confidently.","Help me choose"),
"welcome-proof":("Why customers choose __BRAND_NAME__","Use credible proof to reduce perceived risk and make the purchase feel safer.","See why it works"),
"abandoned-cart-minimal":("Still deciding? Your selection is easy to return to.","A clean reminder for shoppers who already showed intent. Keep friction low.","Return to my basket"),
"abandoned-cart-product":("The item you picked solves a specific problem","Bring the product benefit back into focus instead of merely saying you forgot something.","Continue where I left off"),
"abandoned-cart-objections":("Before you decide, here are the answers that matter","Resolve the most common real objection around fit, delivery, returns, quality or support.","Review my basket"),
"abandoned-cart-urgency":("If you still want it, now is the best time to check","Only use urgency that is true, such as genuine stock or an expiring offer.","Check availability"),
"abandoned-checkout":("You were one step away","Make returning to checkout simple and reassure the buyer about the final friction point.","Complete checkout"),
"browse-abandonment":("Worth another look?","Reconnect the reader to what caught their attention without pretending they abandoned a basket.","View it again"),
"product-recommendation":("Picked for what you’re trying to achieve","Curate a small set of relevant options and explain why each one earns its place.","Shop recommendations"),
"new-collection":("Meet the new collection","Lead with the customer use case and make discovery feel exciting, not overwhelming.","Explore the collection"),
"product-launch":("Built to solve __CORE_PROBLEM__","Make the launch about the mechanism, proof and outcome, not feature overload.","See the new release"),
"flash-sale":("A short window on something worth buying","State the genuine deadline clearly and keep the offer easy to understand.","Shop the offer"),
"promotional-offer":("A better path to __DESIRED_OUTCOME__","Tie the incentive to a valuable outcome so the promotion does not cheapen the brand.","Claim the offer"),
"newsletter-editorial":("One useful idea for this week","Earn attention between promotions by making the email independently useful.","Read the full idea"),
"education-value":("The mistake that makes __CORE_PROBLEM__ harder","Teach one practical idea, then bridge to the product only where it genuinely helps.","Put this into practice"),
"founder-hybrid":("A quick personal note","Keep this visually light so it feels human while retaining robust HTML, analytics and accessibility.","Take a look"),
"case-study":("From problem to measurable outcome","Make proof easy to scan: what was wrong, what changed and what happened commercially.","See the approach"),
"post-purchase-thanks":("You’re in. Here’s what happens next.","Reduce buyer anxiety with clear expectations and one immediate success action.","View my order"),
"post-purchase-education":("Get the best result from your purchase","Teach the first high-leverage behaviour that helps the customer realise value faster.","Show me how"),
"cross-sell":("The logical next addition","Recommend only products that improve the value of what the customer already owns.","Complete the setup"),
"review-request":("How did we do?","Ask for feedback when the customer has had enough time to experience the promised value.","Leave feedback"),
"referral":("Know someone who’d value this too?","Make the referral benefit clear to both sides and keep the mechanics simple.","Share with a friend"),
"winback":("Still working on __DESIRED_OUTCOME__?","Lead with relevance and new value before reaching for a blanket discount.","See what’s changed"),
"replenishment":("Running low?","Time the reminder around realistic usage and make reordering effortless.","Reorder now"),
"back-in-stock":("It’s back","The demand already exists. Confirm availability quickly and minimise distractions.","Get it while available"),
"order-confirmation":("Order confirmed","Make the customer feel certain that the transaction worked and show what happens next.","View order details"),
"vip-retention":("You’re one of our most valued customers","Recognise loyalty with meaningful access, treatment or value rather than empty status language.","Access your VIP benefit"),
}

PRODUCT_FAMILY = {"abandoned-cart-minimal","abandoned-cart-product","abandoned-cart-objections","abandoned-cart-urgency","abandoned-checkout","browse-abandonment","cross-sell","replenishment","back-in-stock"}
NO_HERO = {"welcome-founder","founder-hybrid","order-confirmation"}

def module(slug):
    if slug in {"product-recommendation","new-collection"}:
        return '''<tr><td class="mobile-px" style="padding:8px 36px 20px"><table role="presentation" width="100%"><tr><td class="stack" width="50%" valign="top" style="padding:0 8px 16px 0"><img src="https://placehold.co/520x520/png?text=Product+1" width="252" alt="Product one" style="width:100%;max-width:252px;height:auto;border-radius:12px"><p style="margin:12px 0 4px;font-size:17px;font-weight:700">Product one</p><p style="margin:0;color:#667085;font-size:14px;line-height:21px">One-line reason this product is worth considering.</p></td><td class="stack" width="50%" valign="top" style="padding:0 0 16px 8px"><img src="https://placehold.co/520x520/png?text=Product+2" width="252" alt="Product two" style="width:100%;max-width:252px;height:auto;border-radius:12px"><p style="margin:12px 0 4px;font-size:17px;font-weight:700">Product two</p><p style="margin:0;color:#667085;font-size:14px;line-height:21px">Second recommendation with a benefit-led reason.</p></td></tr></table></td></tr>'''
    if slug == "case-study":
        return '''<tr><td class="mobile-px" style="padding:8px 36px 22px"><table role="presentation" width="100%" style="background:#f5f7fb;border-radius:14px"><tr><td style="padding:22px"><p style="margin:0 0 6px;color:#667085;font-size:12px;font-weight:700;text-transform:uppercase">Before</p><p style="margin:0 0 18px">Describe the costly friction or missed opportunity.</p><p style="margin:0 0 6px;color:#667085;font-size:12px;font-weight:700;text-transform:uppercase">System</p><p style="margin:0 0 18px">Explain what changed without drowning the reader in implementation detail.</p><p style="margin:0 0 6px;color:#667085;font-size:12px;font-weight:700;text-transform:uppercase">Outcome</p><p style="margin:0;font-size:22px;font-weight:800">Put the verified commercial result here.</p></td></tr></table></td></tr>'''
    if slug in {"welcome-founder","founder-hybrid"}:
        return '''<tr><td class="mobile-px" style="padding:0 36px 22px"><p style="margin:0 0 16px;font-size:16px;line-height:26px">Use this space for a concise founder story, the reason the company exists, and the customer problem you care about solving.</p><p style="margin:0;font-size:16px;line-height:26px">Founder name<br><span style="color:#667085">Founder, __BRAND_NAME__</span></p></td></tr>'''
    if slug in {"order-confirmation","post-purchase-thanks","post-purchase-education"}:
        return '''<tr><td class="mobile-px" style="padding:8px 36px 22px"><table role="presentation" width="100%" style="border:1px solid #e5e7eb;border-radius:14px"><tr><td style="padding:20px"><p style="margin:0 0 6px;font-size:13px;color:#667085">Reference</p><p style="margin:0 0 16px;font-size:18px;font-weight:700">__ORDER_REFERENCE__</p><p style="margin:0;font-size:15px;line-height:23px;color:#475467">Use this module for purchase details, onboarding steps, delivery expectations or the single most important success action.</p></td></tr></table></td></tr>'''
    if slug in PRODUCT_FAMILY:
        return '''<tr><td class="mobile-px" style="padding:8px 36px 22px"><table role="presentation" width="100%" style="background:#f8fafc;border-radius:14px"><tr><td width="120" valign="top" style="padding:16px"><img src="https://placehold.co/220x220/png?text=Item" width="104" alt="Selected product" style="width:104px;max-width:100%;height:auto;border-radius:10px"></td><td valign="middle" style="padding:16px 16px 16px 0"><p style="margin:0 0 4px;font-size:17px;font-weight:700">__PRODUCT_NAME__</p><p style="margin:0 0 8px;font-size:14px;line-height:21px;color:#667085">__PRODUCT_BENEFIT__</p><p style="margin:0;font-size:15px;font-weight:700">__PRODUCT_PRICE__</p></td></tr></table></td></tr>'''
    return '''<tr><td class="mobile-px" style="padding:8px 36px 22px"><table role="presentation" width="100%"><tr><td style="border-left:4px solid #111827;padding:4px 0 4px 18px"><p style="margin:0;font-size:17px;line-height:26px;font-weight:700">One message. One commercial job.</p><p style="margin:6px 0 0;color:#667085;font-size:15px;line-height:23px">Replace this module with proof, education, offer detail or reassurance that directly supports the CTA.</p></td></tr></table></td></tr>'''

def render(item):
    slug=item["slug"]; h1,intro,cta=COPY[slug]
    hero="" if slug in NO_HERO else '<tr><td style="padding:0 0 22px"><img src="https://placehold.co/1200x680/png?text=Brand+Hero" width="600" alt="__HERO_ALT__" style="display:block;width:100%;max-width:600px;height:auto"></td></tr>'
    return f'''<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>{html.escape(item['name'])}</title><!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]--><style>html,body{{margin:0!important;padding:0!important;width:100%!important;background:#eef1f5}}*{{-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%}}table,td{{mso-table-lspace:0!important;mso-table-rspace:0!important;border-collapse:collapse!important}}img{{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}}a{{color:inherit}}.preheader{{display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all}}@media screen and (max-width:620px){{.container{{width:100%!important;max-width:100%!important}}.mobile-px{{padding-left:22px!important;padding-right:22px!important}}.stack{{display:block!important;width:100%!important;max-width:100%!important;padding-left:0!important;padding-right:0!important}}.cta{{display:block!important;width:100%!important;box-sizing:border-box!important;text-align:center!important}}h1{{font-size:30px!important;line-height:36px!important}}}}@media (prefers-color-scheme:dark){{.dark-bg{{background:#111827!important}}.dark-card{{background:#18212f!important}}.dark-text{{color:#f8fafc!important}}.dark-muted{{color:#cbd5e1!important}}}}</style></head>
<body class="dark-bg" style="margin:0;padding:0;background:#eef1f5"><div class="preheader">__PREHEADER__</div><center role="article" aria-roledescription="email" lang="en" style="width:100%;background:#eef1f5"><!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]--><table role="presentation" class="container dark-card" width="100%" cellspacing="0" cellpadding="0" border="0" align="center" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff"><tr><td class="mobile-px" style="padding:28px 36px 22px"><a href="__HOME_URL__" aria-label="__BRAND_NAME__ home"><img src="__LOGO_URL__" width="148" alt="__BRAND_NAME__" style="display:block;width:148px;max-width:100%;height:auto"></a></td></tr>{hero}<tr><td class="mobile-px dark-text" style="padding:10px 36px 8px;font-family:Arial,Helvetica,sans-serif;color:#111827"><p style="margin:0 0 10px;color:#667085;font-size:12px;line-height:18px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">{html.escape(item['outcome'])}</p><h1 style="margin:0 0 14px;font-size:38px;line-height:44px;letter-spacing:-.02em;font-weight:800">{html.escape(h1)}</h1><p class="dark-muted" style="margin:0;font-size:17px;line-height:27px;color:#475467">Hi {{{{ person.first_name|default:'there' }}}}, {html.escape(intro)}</p></td></tr>{module(slug)}<tr><td class="mobile-px" style="padding:2px 36px 34px;font-family:Arial,Helvetica,sans-serif"><table role="presentation"><tr><td bgcolor="#111827" style="border-radius:8px"><a class="cta" href="__PRIMARY_CTA_URL__" style="display:inline-block;padding:15px 22px;border:1px solid #111827;border-radius:8px;background:#111827;color:#ffffff;text-decoration:none;font-size:16px;line-height:20px;font-weight:700">{html.escape(cta)}</a></td></tr></table></td></tr><tr><td class="mobile-px" style="padding:0 36px 32px;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" style="border-top:1px solid #e5e7eb"><tr><td style="padding:22px 0 0;color:#667085;font-size:13px;line-height:20px"><p style="margin:0 0 8px">Questions? Reply to this email or contact <a href="mailto:__SUPPORT_EMAIL__" style="color:#344054">__SUPPORT_EMAIL__</a>.</p><p style="margin:0 0 8px">__BRAND_NAME__ · __POSTAL_ADDRESS__</p><p style="margin:0">{{% unsubscribe %}} · {{% manage_preferences %}}</p></td></tr></table></td></tr></table><!--[if mso]></td></tr></table><![endif]--></center></body></html>'''

def build():
    OUT.mkdir(exist_ok=True)
    for old in OUT.glob("*.html"): old.unlink()
    for item in REGISTRY:
        path=OUT / f"{item['id'].lower()}-{item['slug']}.html"
        path.write_text(render(item),encoding="utf-8")
    print(f"Built {len(REGISTRY)} master templates in {OUT}")

if __name__ == "__main__": build()
