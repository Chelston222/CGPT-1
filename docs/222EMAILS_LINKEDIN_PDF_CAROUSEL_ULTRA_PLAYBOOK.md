# 222Emails LinkedIn PDF Carousel Publishing Workflow | CANONICAL VERIFIED v1.0.1

**Operating status:** canonical reusable production route
**Verification refreshed:** 8 September 2026
**Owner:** Chelston / 222Emails
**Repository:** `Chelston222/CGPT-1`

For any 222Emails LinkedIn document post, PDF carousel, PDF packaging, governed PDF intake, Buffer scheduling or publication-verification task, use this pathway by default unless Chelston explicitly replaces it. Do not invent a parallel production route.

Current `main` is authoritative. Superseded hardening branches and pull requests must not be merged over newer production state.

## Canonical architecture

Approved final PDF + approved final caption -> authorised Gmail transport -> PrivateEmail IMAP -> exact sender/subject/filename/bytes/SHA verification -> revision-scoped GitHub media promotion -> immutable Git-commit PDF and thumbnail pin -> governed GitHub LinkedIn queue -> repository-owner approval -> exact current-queue fingerprint verification -> Notion defence-in-depth when credentialled -> remote media and Buffer capacity preflight -> durable Buffer dispatch intent -> Buffer createPost -> durable Buffer acceptance ledger -> LinkedIn -> separate publication verification.

Use these states precisely: exact media verified; queued in governed GitHub layer; owner approved; accepted/scheduled by Buffer; publication verified.

Never call a post published merely because Gmail sent the message, IMAP found the attachment, GitHub promoted the PDF, the owner approved it, or Buffer accepted it.

## Trigger scope

Apply this route automatically to LinkedIn document posts, LinkedIn PDF carousels, approved carousel PDF packaging, governed PDF intake, Buffer scheduling, failed-release recovery, publication-status checks, and LinkedIn Content Calendar updates for these assets.

Only depart from this route when Chelston explicitly requests another method or a verified platform constraint makes it impossible.

## Hard locks

- one LinkedIn target per canonical governed PDF item
- exact sender, subject, filename, byte count, PDF signature and SHA-256
- explicit positive revision
- identical same-revision replay is idempotent
- changed same revision fails closed and requires a higher revision
- schedule requires explicit UTC offset or Z and stays inside verifier horizon
- caption must fit LinkedIn's 3,000-character ceiling
- approved copy contains no em dash
- `copy.default` is the only canonical copy variant
- release metadata is parser-safe
- public-media and public release-metadata exposure must be explicitly acknowledged
- confidential or embargoed material does not use the public raw-GitHub lane
- media is revision-scoped and pinned to an immutable Git commit
- remote PDF and thumbnail are re-verified after promotion
- queue writes rebuild against latest `main`
- media readiness and owner publication authority remain separate
- owner approval must exactly match current queue fingerprint
- Notion may provide drift protection when credentialled but cannot override locked GitHub authority
- `Automation Status = Manual` does not authorise automated governed PDF release
- media preflight occurs before Buffer write
- durable dispatch intent is recorded before provider mutation
- durable acceptance is recorded immediately after Buffer returns an ID
- unresolved intent blocks blind recreation
- reconciliation is owner-gated, read-only and exact-match only
- publication verification is separate and read-only
- only Buffer `sent` plus `sentAt` may become publication verified
- direct-repository PDF and immediate-share production routes are retired

## Canonical transport

FROM: tripletwochelston@gmail.com
TO: hello@222emails.com
SUBJECT: TTE LINKEDIN PDF INTAKE <id>
ATTACHMENT: <exact final PDF filename>

Transport is not publication authority.

## Exact media identity

Before intake record exact filename, byte count, page count and SHA-256. Changed release material requires a new revision.

## Governed intake

Create a repository-owner issue titled `[IMAP PDF INTAKE] <id>` with exactly one locked config block containing exact transport identity, schema version 1, explicit positive revision, safe release metadata, exactly one target, exactly one matching schedule key, explicit timezone, exact `copy.default`, concrete Notion source URL where used, `publicMediaApproved: true`, and `publicReleaseMaterialApproved: true`.

The IMAP bridge accepts only a candidate that matches sender, subject, filename, bytes, `%PDF-` signature and SHA-256.

Promote verified media under `apps/linkedin-review/media/intake/<id>/r<revision>/`, pin PDF and thumbnail to the immutable commit containing them, then re-download and verify exact PDF bytes/SHA/pages/type and thumbnail bytes/SHA/type.

A successful intake creates `[PDF INTAKE READY] <id>@<revision>`. This proves media readiness only.

## Owner approval and Buffer release

Only after media readiness create `[APPROVED LINKEDIN] <id>@<revision>`. The approval must exactly match the current locked queue revision across target, schedule, caption and media identity.

Before Buffer creation validate current queue identity, owner approval fingerprint, applicable Notion drift checks, remote media integrity and capacity. Write a durable dispatch intent immediately before Buffer creation and durable acceptance immediately after Buffer returns the post ID.

Accepted placements are not recreated. Unresolved intents block blind recreation. Reconciliation is read-only and succeeds only on exactly one locked identity match.

## Publication verification

Buffer acceptance means `accepted/scheduled by Buffer`, not published. Only a separate read-only verifier observing provider `sent` plus `sentAt` may mark `publication verified`.

## Failure handling

When a stage fails, identify it, preserve audit evidence, correct it, retry that stage, then continue. Do not invent a parallel route. Changed release material gets a new revision.

## Retired routes

Historical direct-repository PDF intake and immediate share-now workflows are retired compatibility surfaces and must not schedule or publish production PDFs.

## Canonical repository surfaces

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

## Proven Retention School run

Part 1: `rs-li-retention-school-part-1`, 10 pages, 3,562,430 bytes, SHA `cd8dc92f4dbfb6adf7706dbb08aa1acc329fe770d71a0cdc706df91617bd422f`, Buffer `6a9d238a6aba27483202f89a`, due 11 September 2026 at 08:45 BST.

Part 2: `rs-li-retention-school-part-2`, 10 pages, 22,244,922 bytes, SHA `653432b489b7df73e1bcf52b78c413b2dc14517c8ee65ffdf96eb5f038b27b66`, Buffer `6a9d25c8fd1c461b0090193b`, due 14 September 2026 at 08:45 BST.

Part 3: `rs-li-retention-school-part-3`, 10 pages, 16,934,427 bytes, SHA `65a74d59078008c23c6a3c9a905e25ff16924ff5bfbfa73149f31470242cf609`, Buffer `6a9d2cf141e2718ea379a7a9`, due 16 September 2026 at 08:45 BST.

These posts prove the production route but not every hardening layer added later.

## Reuse command

Use the canonical 222Emails LinkedIn PDF Carousel Publishing Workflow. Take this LinkedIn PDF through the governed IMAP route. Do not invent a parallel upload or immediate-publish path. Preserve exact-media verification, immutable commit-pinned PDF and thumbnail media, repository-owner approval, exact current-queue fingerprint matching, Notion defence-in-depth when credentialled, durable Buffer dispatch-intent and acceptance proof, read-only exact-match intent reconciliation, and separate publication verification. Diagnose and repair a failed stage rather than skipping it. Return only verified status.

## Stopping rule

Current `main` is authoritative. Relevant production CI must be green. Documentation must match production behaviour. No known material defect should remain that can be corrected without changing the intended public-media trade-off. Future changes restart regression testing.
