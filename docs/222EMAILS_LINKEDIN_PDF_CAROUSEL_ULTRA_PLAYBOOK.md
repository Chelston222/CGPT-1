# 222Emails LinkedIn PDF Carousel Publishing Workflow | CANONICAL VERIFIED v1.0.1

**Operating status:** canonical reusable production route  
**Verification refreshed:** 8 September 2026  
**Owner:** Chelston / 222Emails  
**Repository:** `Chelston222/CGPT-1`

> For any 222Emails LinkedIn document post, PDF carousel, PDF packaging, governed PDF intake, Buffer scheduling or publication-verification task, use this pathway by default unless Chelston explicitly replaces it. Do not invent a parallel production route.

**Source-of-truth rule:** current `main` is authoritative. Obsolete hardening branches and superseded PRs must not be merged back over newer production state.

## Canonical architecture

Approved final PDF + approved final caption -> authorised Gmail transport -> PrivateEmail IMAP -> exact media verification -> revision-scoped GitHub promotion -> immutable commit-pinned PDF and thumbnail -> governed GitHub queue -> repository-owner approval -> exact queue-fingerprint validation -> Notion defence-in-depth when credentialled -> remote media and Buffer capacity preflight -> durable Buffer dispatch intent -> Buffer createPost -> durable acceptance ledger -> LinkedIn -> separate publication verification.

Use states precisely: exact media verified; queued in governed GitHub layer; owner approved; accepted/scheduled by Buffer; publication verified.

Never call a post published merely because Gmail sent the message, IMAP found the attachment, GitHub promoted the PDF, the owner approved it, or Buffer accepted it.

## Trigger scope

Use this workflow automatically for LinkedIn document posts, LinkedIn PDF carousels, approved carousel PDF packaging, governed PDF intake, Buffer scheduling, failed-release recovery, publication-status checks, and LinkedIn Content Calendar updates for these assets.

Only depart from this route when Chelston explicitly requests another method or a verified platform constraint makes it impossible.

## Production and packaging gate

Before transport, the PDF and caption must already be final. Carousel production inherits the standing 222Emails rules: Full / Preview First / Fast Batch mode gate for new multi-image generation; sequential red-team and verification; one standalone page per generation; no collage; no contact-sheet deliverables; post-generation visual QA; full-resolution/no-additional-loss packaging; UK English; no em dash; no invented metrics, benchmarks, proof or social proof; current 222Emails branding.

Record the exact filename, byte count, page count and SHA-256. Changed release material requires a new revision. Do not silently mutate a locked revision.

## Public-media confidentiality boundary

The canonical media host is the public GitHub repository via `raw.githubusercontent.com`. Promoted PDF bytes and associated release metadata can therefore become publicly reachable before LinkedIn publication. Use this lane only for material safe to expose publicly before publication. The intake must explicitly acknowledge public media exposure and public release-metadata exposure. Confidential or embargoed material must not use this lane.

## Canonical transport

```text
FROM: tripletwochelston@gmail.com
TO: hello@222emails.com
SUBJECT: TTE LINKEDIN PDF INTAKE <id>
ATTACHMENT: <exact final PDF filename>
```

Transport is not publication authority.

## Governed intake issue

Create:

```text
[IMAP PDF INTAKE] <id>
```

with exactly one locked config block containing the ID, exact subject/sender/filename/SHA/bytes/pages, explicit positive revision, title, document title, safe category/funnel metadata where used, exactly one target, schedule with explicit UTC offset or Z, exact `copy.default`, mediaAlt, concrete Notion source URL where used, `publicMediaApproved: true`, and `publicReleaseMaterialApproved: true`.

Do not place secrets, raw PDF bytes, arbitrary download URLs or operator-supplied chunks in the issue.

## Permanent validation contract

Fail closed unless the relevant checks pass: repository-owner author; exact title/ID match; one config block; exact authorised sender; exact subject; plain PDF filename; valid SHA; valid byte/page counts; schema version 1; explicit positive revision; header-safe release metadata; one `copy.default` variant only; caption non-empty and within LinkedIn's 3,000-character ceiling; no em dash; no reserved target-section markers hidden in copy; exactly one target; exactly one matching schedule key; explicit timezone; schedule inside the supported verifier horizon; public-exposure acknowledgements true; concrete source page ID where used; manifest SHA equals transport SHA; no arbitrary download URL or user-provided chunks.

## IMAP attachment selection

The PrivateEmail bridge scans eligible recent mailboxes while excluding Sent, Drafts, Trash and Junk special-use mailboxes. A candidate must match exact sender, subject and filename, then exact byte count, `%PDF-` signature and SHA-256. Same-name or lookalike attachments with wrong identity are rejected.

## Reconstruction and immutable media proof

Promote verified media under:

```text
apps/linkedin-review/media/intake/<id>/r<revision>/
```

Revision rules: identical same revision is an idempotent replay; changed same revision fails closed; changed release material requires a higher revision. Same-revision replay must preserve already-governed media identity.

Queue writes rebuild against latest `main` before mutation and retry safely if another governed writer advances `main`.

After promotion, pin PDF and thumbnail URLs to the exact immutable 40-character Git commit containing those files. Download those pinned URLs and re-verify PDF bytes/SHA/pages/type plus thumbnail bytes/SHA/type.

A successful intake creates `[PDF INTAKE READY] <id>@<revision>`. That proves exact media and queue readiness only.

## Repository-owner approval

Only after media readiness create:

```text
[APPROVED LINKEDIN] <id>@<revision>
```

The approval must exactly match the current locked queue revision, including target, schedule, caption, media URL, document title, thumbnail, page count, bytes and SHA. Legacy issue-only dispatch that cannot be tied to current queue state is rejected.

## Notion defence-in-depth

The GitHub queue plus repository-owner approval remain the governed authority. When a Notion credential is configured, the exact source page provides additional drift protection for Content Decision, Approval, Anti-DNA, Asset Ready, Automation Ready, Final Copy, Publish Payload, Scheduled At, automation state and Buffer state. `Automation Status = Manual` does not authorise automated governed PDF release. A final Notion recheck immediately before provider mutation is used when credentialled. Notion must not silently override the locked GitHub contract.

## Buffer release safety

Before the first Buffer write, validate current queue identity, owner approval fingerprint, schedule, remote media integrity, Buffer capacity and applicable quality gates. All release workflows share the global capacity lock so competing approvals cannot race.

## Durable dispatch intent and acceptance ledger

Every governed placement has a stable placement key. Immediately before the Buffer mutation, write a durable dispatch-intent marker. Once Buffer returns a post ID, write durable acceptance immediately. Accepted placements are not recreated. Unresolved intents block blind recreation. More than one trusted durable ledger is split-brain state and fails closed.

## Read-only intent reconciliation

The owner-gated reconciler may repair an unresolved intent only when exactly one provider record matches the locked target channel, due instant, caption digest, exact media source URL for media posts, and an allowed recoverable state. Zero or multiple matches remain blocked. The reconciler never creates, edits, reschedules or deletes Buffer posts.

## Buffer acceptance and publication semantics

Buffer acceptance means `accepted/scheduled by Buffer`, not published. Publication verification is separate and read-only. Only provider `sent` state plus `sentAt` evidence may become `publication verified`. Provider error is publication failure. Unknown state stays pending and is not counted as published.

## Failure handling

When a stage fails: identify the failed stage; preserve audit evidence; diagnose the cause; correct that stage; retry that stage; continue only after it passes. Do not invent a parallel route. If release material changes, create a new revision.

## Retired parallel routes

Historical direct-repository PDF intake and immediate share-now workflows are retired compatibility surfaces. They must not reconstruct, schedule or publish production LinkedIn PDFs.

## Canonical repository surfaces

`.github/workflows/linkedin-imap-pdf-intake.yml`
`.github/workflows/linkedin-buffer-autopost.yml`
`.github/workflows/linkedin-buffer-intent-reconcile.yml`
`.github/workflows/linkedin-publication-verifier.yml`
`.github/workflows/linkedin-pdf-workflow-ci.yml`
`scripts/linkedin-imap-intake-config.cjs`
`scripts/linkedin-imap-intake-from-issue.mjs`
`scripts/linkedin-imap-pdf-intake.mjs`
`scripts/linkedin-pdf-intake.cjs`
`scripts/linkedin-review-core.cjs`
`scripts/linkedin-media-preflight.cjs`
`scripts/linkedin-notion-quality-gate.cjs`
`scripts/linkedin-buffer-acceptance-ledger.cjs`
`scripts/linkedin-buffer-capacity.cjs`
`apps/linkedin-review/queue.json`
`apps/linkedin-review/media/intake/<post-id>/r<revision>/`
`docs/LINKEDIN_PDF_INTAKE.md`
`docs/LINKEDIN_BUFFER_AUTOPOST_SETUP.md`

## Proven Retention School reference run

Part 1: `rs-li-retention-school-part-1`, 10 pages, 3,562,430 bytes, SHA `cd8dc92f4dbfb6adf7706dbb08aa1acc329fe770d71a0cdc706df91617bd422f`, Buffer `6a9d238a6aba27483202f89a`, due 11 Sep 2026 08:45 BST.

Part 2: `rs-li-retention-school-part-2`, 10 pages, 22,244,922 bytes, SHA `653432b489b7df73e1bcf52b78c413b2dc14517c8ee65ffdf96eb5f038b27b66`, Buffer `6a9d25c8fd1c461b0090193b`, due 14 Sep 2026 08:45 BST.

Part 3: `rs-li-retention-school-part-3`, 10 pages, 16,934,427 bytes, SHA `65a74d59078008c23c6a3c9a905e25ff16924ff5bfbfa73149f31470242cf609`, Buffer `6a9d2cf141e2718ea379a7a9`, due 16 Sep 2026 08:45 BST.

Do not use those historical posts as proof that every later hardening layer was exercised by those already-scheduled items.

## Reuse command

```text
Use the canonical 222Emails LinkedIn PDF Carousel Publishing Workflow.
Take this LinkedIn PDF through the governed IMAP route.
Do not invent a parallel upload or immediate-publish path.
Preserve exact-media verification, immutable commit-pinned PDF and thumbnail media,
repository-owner approval, exact current-queue fingerprint matching,
Notion defence-in-depth when credentialled,
durable Buffer dispatch-intent and acceptance proof,
read-only exact-match intent reconciliation,
and separate publication verification.
Diagnose and repair a failed stage rather than skipping it.
Return only verified status.
```

## Verification and stopping rule

This workflow has been repeatedly red-teamed across architecture, authority boundaries, concurrency, idempotency, stale state, duplicate prevention, exact-media integrity, IMAP ambiguity, retry/recovery, Notion drift, Buffer dispatch uncertainty, publication semantics, timezone handling, malformed input, source-of-truth drift, audit history and parallel-route bypass.

Material defects discovered were corrected rather than documented away.

The stopping rule is: current `main` is the canonical implementation; relevant production CI is green; documentation matches current production behaviour; no known material defect remains that can be corrected without changing the intended public-media trade-off; and future changes restart regression testing rather than relying on this historical verification label.

The live repository remains the source of truth. Do not revive obsolete hardening branches or retired PDF routes.
