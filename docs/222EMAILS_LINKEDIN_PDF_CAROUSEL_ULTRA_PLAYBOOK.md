# 222Emails LinkedIn PDF Carousel Publishing Workflow | CANONICAL VERIFIED v1.0.1

**Operating status:** canonical reusable production route  
**Verification refreshed:** 8 September 2026  
**Owner:** Chelston / 222Emails  
**Repository:** `Chelston222/CGPT-1`

> For any 222Emails LinkedIn document post, PDF carousel, PDF packaging, governed PDF intake, Buffer scheduling or publication-verification task, use this pathway by default unless Chelston explicitly replaces it. Do not invent a parallel production route.

## Canonical architecture

Approved final PDF + approved final caption -> authorised Gmail transport from tripletwochelston@gmail.com -> hello@222emails.com -> PrivateEmail IMAP -> exact sender/subject/filename/bytes/SHA verification -> revision-scoped GitHub media promotion -> immutable Git-commit PDF and thumbnail pin -> governed GitHub LinkedIn queue -> repository-owner approval gate -> exact current-queue fingerprint verification -> live Notion defence-in-depth when credentialled -> remote media and Buffer capacity preflight -> durable Buffer dispatch intent -> Buffer createPost -> durable Buffer acceptance ledger -> LinkedIn -> separate due-time publication verifier.

Use states precisely:
1. exact media verified
2. queued in governed GitHub layer
3. owner approved
4. accepted/scheduled by Buffer
5. publication verified

Never call a post published merely because Gmail sent the message, IMAP found the attachment, GitHub promoted the PDF, the owner approved it, or Buffer accepted it.

## Reuse trigger

Apply this route automatically to LinkedIn document posts, LinkedIn PDF carousels, PDF packaging, governed PDF intake, Buffer scheduling, failed-release recovery, publication-status checks, and LinkedIn Content Calendar updates for these assets.

Only depart from this route when Chelston explicitly requests another method or a verified platform constraint makes it impossible.

## Hard locks

- canonical PDF intake uses exactly one LinkedIn target per governed item
- exact sender, subject, filename, byte count, PDF signature and SHA-256 are required
- explicit positive revision required
- same-revision replay is accepted only when the stable release fingerprint is identical
- changed same revision fails closed and requires a higher revision
- scheduled timestamps require an explicit UTC offset or Z
- canonical schedules remain within the supported publication-verifier horizon
- captions must fit LinkedIn's 3,000-character limit
- approved caption copy may not contain em dashes
- copy.default is the only canonical copy variant for this intake lane
- release metadata must be parser-safe and header-safe
- public-media use requires explicit acknowledgement that governed media and release metadata can become publicly reachable before publication
- confidential or embargoed material must not use the public raw-GitHub media lane
- promoted PDF and thumbnail are revision-scoped and pinned to an immutable Git commit before release
- remote PDF and thumbnail are re-verified after promotion
- queue writes rebuild against latest main to avoid stale-state races
- owner approval is separate from media readiness
- exact current-queue fingerprint must match the approval before release
- live Notion checking is defence-in-depth when configured and must not silently override the locked GitHub release contract
- Automation Status = Manual does not authorise automated governed PDF release
- media is preflighted before the first Buffer write
- durable dispatch intent is written before provider mutation
- durable acceptance is written immediately after Buffer returns an ID
- unresolved dispatch intent blocks blind recreation
- owner-gated reconciliation is read-only toward Buffer and requires exactly one identity match
- publication verification is separate and read-only toward Buffer
- only Buffer sent state plus sentAt evidence may become publication verified
- parallel direct-repository PDF and immediate-share routes are retired

## Canonical repository surfaces

- `.github/workflows/linkedin-imap-pdf-intake.yml`
- `.github/workflows/linkedin-buffer-autopost.yml`
- `.github/workflows/linkedin-buffer-intent-reconcile.yml`
- `.github/workflows/linkedin-publication-verifier.yml`
- `.github/workflows/linkedin-pdf-workflow-ci.yml`
- `scripts/linkedin-imap-intake-config.cjs`
- `scripts/linkedin-imap-intake-from-issue.mjs`
- `scripts/linkedin-imap-pdf-intake.mjs`
- `scripts/linkedin-pdf-intake.cjs`
- `scripts/linkedin-media-preflight.cjs`
- `scripts/linkedin-notion-quality-gate.cjs`
- `scripts/linkedin-buffer-acceptance-ledger.cjs`
- `scripts/linkedin-buffer-capacity.cjs`
- `apps/linkedin-review/queue.json`
- `apps/linkedin-review/media/intake/<post-id>/r<revision>/`
- `docs/LINKEDIN_PDF_INTAKE.md`
- `docs/LINKEDIN_BUFFER_AUTOPOST_SETUP.md`

## Operator reuse command

Use the canonical 222Emails LinkedIn PDF Carousel Publishing Workflow. Take this LinkedIn PDF through the governed IMAP route. Do not invent a parallel upload or immediate-publish path. Preserve exact-media verification, immutable commit-pinned PDF and thumbnail media, repository-owner approval, current-queue fingerprint matching, Notion defence-in-depth when credentialled, durable Buffer dispatch-intent and acceptance proof, read-only exact-match intent reconciliation, and separate publication verification. Diagnose and repair a failed stage rather than skipping it. Return only verified status.

## Verification note

The production system has already completed a real three-document Retention School release sequence through Buffer. Subsequent hardening added replay safety, concurrency protection, immutable media pins, stricter parser and schedule rules, durable provider-write intent, acceptance ledger recovery, and separate publication verification. Current main is the source of truth. Do not revive obsolete hardening branches or parallel PDF routes.
