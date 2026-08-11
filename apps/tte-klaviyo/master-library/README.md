# 222 Emails Master HTML Library

Production-oriented HTML email masters for client lifecycle work.

## What this contains
- 30 outcome-led master templates
- Klaviyo CODE-template compatible HTML
- responsive table-based layouts
- Outlook/MSO fallbacks
- dark-mode metadata and guarded styles
- accessibility essentials
- reusable brand/content tokens
- automated static QA
- source and licence ledger

## Commercial taxonomy
Every master has one primary commercial job:
1. Revenue Recovered
2. Conversion Lift
3. Automated Revenue
4. Customer Retention
5. Lifecycle Revenue

The email is not the product. The commercial outcome and lifecycle system are the product.

## Client workflow
1. Choose the template whose job matches the customer journey problem.
2. Duplicate it into a client workstream.
3. Replace all `__TOKEN__` values.
4. Replace generic modules with client-specific copy, proof, products and imagery.
5. Keep only truthful urgency and verified claims.
6. Build and run static QA.
7. Preview in Klaviyo desktop/mobile.
8. Send controlled seed tests.
9. Run inbox/render QA across the client mix.
10. Only then attach the template to a campaign/flow.

## Required brand tokens
- `__BRAND_NAME__`
- `__HOME_URL__`
- `__LOGO_URL__`
- `__HERO_ALT__`
- `__PREHEADER__`
- `__PRIMARY_CTA_URL__`
- `__SUPPORT_EMAIL__`
- `__POSTAL_ADDRESS__`

Journey-specific masters can also contain tokens such as `__PRODUCT_NAME__`, `__PRODUCT_BENEFIT__`, `__PRODUCT_PRICE__`, `__ORDER_REFERENCE__`, `__CORE_PROBLEM__`, and `__DESIRED_OUTCOME__`.

## Safety
These are master assets, not permission to send. A master can pass code QA and still fail commercially or render differently in a specific client. Never claim universal pixel-perfect rendering without a current render test.

## Klaviyo
The Templates API supports CODE templates with HTML. The master deployer is idempotent by exact master name so repeat runs update existing masters rather than endlessly creating duplicates.

API revision used: `2026-07-15`.
