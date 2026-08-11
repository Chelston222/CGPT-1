# 222 Emails Revenue Template OS

Production-oriented lifecycle email system for repeatable client delivery.

## What this contains
- 30 outcome-led lifecycle/revenue email jobs
- 5 layout systems, creating 150 core job/layout compositions
- 14 reusable persuasion, proof and reassurance modules
- Klaviyo CODE-template compatible HTML
- responsive table-based layouts
- Outlook/MSO fallbacks
- dark-mode metadata and guarded styles
- accessibility essentials
- client intake, journey recommendation and brand/materialisation pipeline
- subject-line and preheader candidates
- evidence-aware safety controls
- automated static, exhaustive and negative-path QA
- idempotent Klaviyo draft deployment and platform-side render verification
- source/licence ledger and operator runbook

## Commercial taxonomy
Every master has one primary commercial job:
1. Revenue Recovered
2. Conversion Lift
3. Automated Revenue
4. Customer Retention
5. Lifecycle Revenue

The email is not the product. The commercial outcome and lifecycle system are the product.

## Canonical client workflow
Do not manually duplicate masters and replace tokens as the normal production path.

1. Create structured client intake from `revenue-os/client_intake.example.json`.
2. Run `build_client_pack.py INTAKE --out PACK --clean`.
3. The system validates the intake, chooses a journey/layout, carries through only supplied evidence, produces subject/preheader options, materialises the HTML and runs client-pack QA.
4. Review `creative.json`, `email.html` and `qa.json`.
5. For Klaviyo, use the manual `TTE Client Draft Build + Deploy` GitHub workflow with confirmation `DEPLOY-CLIENT-DRAFT-ONLY`.
6. The workflow reruns final QA, creates/updates the client CODE template and asks Klaviyo to render it server-side.
7. Review the uploaded audit pack and Klaviyo draft.
8. Complete real inbox/render, deliverability, data, audience and approval gates before any live activation.

Full operating instructions: `revenue-os/OPERATOR_RUNBOOK.md`.
Completion status: `revenue-os/COMPLETION_MATRIX.md`.

## Safety boundaries
- no automatic flow activation
- no automatic subscriber send
- no invented testimonials, proof, guarantees or urgency
- sensitive evidence enters the recommended manifest only when explicitly verified
- placeholder imagery and unresolved build tokens fail QA
- deployment is template-draft only and requires exact manual confirmation

## Verification
- `validate_library.py`: 30 technical masters
- `validate_revenue_os.py`: 30 jobs x 5 layouts plus module matrix
- `run_final_qa.py`: full regression, deterministic recommendation, negative tests and end-to-end example client pack
- GitHub Actions repeats the final regression independently before merge and on relevant `main` changes

## Klaviyo
The integration targets API revision `2026-07-15`. It uses current Templates API create/update/filtering contracts and the Template Render endpoint for platform-side verification. Template deployment is idempotent by exact generated name.

These assets are production infrastructure, not permission to send. Real-world rendering, authentication, dynamic-data, audience/consent and final approval remain campaign/client-specific gates.
