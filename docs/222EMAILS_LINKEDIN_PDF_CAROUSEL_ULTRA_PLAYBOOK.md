# 222Emails LinkedIn PDF Carousel Publishing Workflow | CANONICAL VERIFIED v1.0.1

Current `main` is the authoritative source for the 222Emails LinkedIn PDF/document publishing workflow. Use the canonical governed route for LinkedIn PDF carousels and document posts: approved PDF and caption -> authorised Gmail transport -> PrivateEmail IMAP -> exact media verification -> revision-scoped GitHub promotion -> immutable commit-pinned media -> governed queue -> repository-owner approval -> current-queue fingerprint verification -> Notion defence-in-depth when credentialled -> remote media and Buffer capacity preflight -> durable dispatch intent -> Buffer creation -> durable acceptance ledger -> LinkedIn -> separate publication verification.

Do not invent a parallel route. Do not revive superseded hardening branches or retired direct-PDF/share-now workflows over newer production `main`.

Hard locks: one target per canonical governed PDF item; exact sender/subject/filename/bytes/PDF signature/SHA-256; explicit positive revision; idempotent identical replay; changed same revision fails closed; explicit timezone; supported schedule horizon; LinkedIn caption ceiling; no em dash; one canonical `copy.default`; safe release metadata; explicit public-exposure acknowledgement; confidential material excluded from the public raw-GitHub lane; revision-scoped immutable media; remote re-verification; latest-main queue rebuild; separate media readiness and owner authority; exact approval/queue fingerprint match; Notion cannot override locked GitHub authority; Manual automation state does not authorise automated release; preflight before Buffer; durable intent before mutation; durable acceptance immediately after returned Buffer ID; unresolved intent blocks recreation; read-only exact-match reconciliation; separate read-only publication verification; only Buffer sent + sentAt becomes publication verified.

Canonical transport:
FROM: tripletwochelston@gmail.com
TO: hello@222emails.com
SUBJECT: TTE LINKEDIN PDF INTAKE <id>
ATTACHMENT: <exact final PDF filename>

Canonical repository surfaces:
.github/workflows/linkedin-imap-pdf-intake.yml
.github/workflows/linkedin-buffer-autopost.yml
.github/workflows/linkedin-buffer-intent-reconcile.yml
.github/workflows/linkedin-publication-verifier.yml
.github/workflows/linkedin-pdf-workflow-ci.yml
scripts/linkedin-imap-intake-config.cjs
scripts/linkedin-imap-intake-from-issue.mjs
scripts/linkedin-imap-pdf-intake.mjs
scripts/linkedin-pdf-intake.cjs
scripts/linkedin-review-core.cjs
scripts/linkedin-media-preflight.cjs
scripts/linkedin-notion-quality-gate.cjs
scripts/linkedin-buffer-acceptance-ledger.cjs
scripts/linkedin-buffer-capacity.cjs
apps/linkedin-review/queue.json
apps/linkedin-review/media/intake/<post-id>/r<revision>/
docs/LINKEDIN_PDF_INTAKE.md
docs/LINKEDIN_BUFFER_AUTOPOST_SETUP.md

Retention School reference run:
Part 1: rs-li-retention-school-part-1, 10 pages, 3,562,430 bytes, SHA cd8dc92f4dbfb6adf7706dbb08aa1acc329fe770d71a0cdc706df91617bd422f, Buffer 6a9d238a6aba27483202f89a, due 11 Sep 2026 08:45 BST.
Part 2: rs-li-retention-school-part-2, 10 pages, 22,244,922 bytes, SHA 653432b489b7df73e1bcf52b78c413b2dc14517c8ee65ffdf96eb5f038b27b66, Buffer 6a9d25c8fd1c461b0090193b, due 14 Sep 2026 08:45 BST.
Part 3: rs-li-retention-school-part-3, 10 pages, 16,934,427 bytes, SHA 65a74d59078008c23c6a3c9a905e25ff16924ff5bfbfa73149f31470242cf609, Buffer 6a9d2cf141e2718ea379a7a9, due 16 Sep 2026 08:45 BST.

Reuse command:
Use the canonical 222Emails LinkedIn PDF Carousel Publishing Workflow. Take this LinkedIn PDF through the governed IMAP route. Do not invent a parallel upload or immediate-publish path. Preserve exact-media verification, immutable commit-pinned media, repository-owner approval, exact current-queue fingerprint matching, Notion defence-in-depth when credentialled, durable Buffer dispatch-intent and acceptance proof, read-only exact-match intent reconciliation, and separate publication verification. Diagnose and repair a failed stage rather than skipping it. Return only verified status.

Stopping rule: current main authoritative, relevant production CI green, docs aligned, no known material correctable defect remaining. Any future workflow change restarts regression testing.