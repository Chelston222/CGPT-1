# 222Emails LinkedIn PDF Carousel Publishing Workflow | CANONICAL VERIFIED v1.0.1

**Operating status:** canonical reusable production route
**Verification refreshed:** 8 September 2026
**Owner:** Chelston / 222Emails
**Repository:** `Chelston222/CGPT-1`

> For any 222Emails LinkedIn document post, PDF carousel, PDF packaging, governed PDF intake, Buffer scheduling or publication-verification task, use this pathway by default unless Chelston explicitly replaces it. Do not invent a parallel production route.

## Source-of-truth rule

Current `main` is authoritative. Obsolete hardening branches and superseded pull requests must never be merged back over newer production state.

## Canonical architecture

```text
Approved final PDF + approved final caption
-> authorised Gmail transport
-> PrivateEmail IMAP
-> exact media verification
-> revision-scoped GitHub media promotion
-> immutable Git-commit PDF and thumbnail pin
-> governed GitHub LinkedIn queue
-> repository-owner approval
-> exact current-queue fingerprint verification
-> Notion defence-in-depth when credentialled
-> remote media and Buffer capacity preflight
-> durable Buffer dispatch intent
-> Buffer createPost
-> durable Buffer acceptance ledger
-> LinkedIn
-> separate publication verification
```

Use these states precisely:

1. exact media verified
2. queued in governed GitHub layer
3. owner approved
4. accepted/scheduled by Buffer
5. publication verified

Never call a post published merely because Gmail sent the message, IMAP found the attachment, GitHub promoted the PDF, the owner approved it, or Buffer accepted it.

## Trigger scope

Apply this route automatically to LinkedIn document posts, LinkedIn PDF carousels, approved carousel PDF packaging, governed PDF intake, Buffer scheduling, failed-release recovery, publication-status checks, and LinkedIn Content Calendar updates for these assets.

Only depart from this route when Chelston explicitly requests another method or a verified platform constraint makes it impossible.

## Hard locks

- canonical PDF intake uses exactly one LinkedIn target per governed item
- exact sender, subject, filename, byte count, PDF signature and SHA-256 are required
- explicit positive revision required
- identical same-revision replay is idempotent
- changed same revision fails closed and requires a higher revision
- scheduled timestamps require an explicit UTC offset or Z
- canonical schedules remain inside the supported publication-verifier horizon
- captions must fit LinkedIn's 3,000-character ceiling
- approved copy must not contain em dashes
- `copy.default` is the only canonical copy variant for this lane
- release metadata must be parser-safe and header-safe
- public-media use requires explicit acknowledgement that media and release metadata can become publicly reachable before publication
- confidential or embargoed material must not use the public raw-GitHub media lane
- promoted PDF and thumbnail are revision-scoped and pinned to an immutable Git commit before release
- remote PDF and thumbnail are re-verified after promotion
- queue writes rebuild against latest `main` to avoid stale-state races
- owner approval is separate from media readiness
- exact current-queue fingerprint must match approval before release
- Notion is defence-in-depth when credentialled and must not silently override the locked GitHub release contract
- `Automation Status = Manual` does not authorise automated governed PDF release
- media is preflighted before the first Buffer write
- durable dispatch intent is written before provider mutation
- durable acceptance is written immediately after Buffer returns an ID
- unresolved dispatch intent blocks blind recreation
- owner-gated reconciliation is read-only toward Buffer and requires exactly one identity match
- publication verification is separate and read-only toward Buffer
- only Buffer `sent` state plus `sentAt` evidence may become publication verified
- parallel direct-repository PDF and immediate-share routes are retired

## Canonical transport

```text
FROM: tripletwochelston@gmail.com
TO: hello@222emails.com
SUBJECT: TTE LINKEDIN PDF INTAKE <id>
ATTACHMENT: <exact final PDF filename>
```

Transport is not publication authority.

## Exact media identity

Before intake record the exact filename, byte count, page count and SHA-256. Changed release material requires a new revision. Do not silently mutate a locked revision.

## Governed intake issue

Create a repository-owner issue titled:

```text
[IMAP PDF INTAKE] <id>
```

with exactly one locked config block containing the ID, exact subject/sender/filename/SHA/bytes/pages, schema version 1, explicit positive revision, safe title/document title metadata, exactly one target, exactly one matching schedule key, explicit timezone, exact `copy.default`, concrete Notion source URL where used, `publicMediaApproved: true`, and `publicReleaseMaterialApproved: true`.

Do not place secrets, raw PDF bytes, arbitrary download URLs or operator-supplied chunks in the issue.

## IMAP selection and reconstruction

The PrivateEmail bridge scans eligible recent mailboxes while excluding Sent, Drafts, Trash and Junk special-use mailboxes. A candidate must match exact sender, subject and filename, then exact byte count, `%PDF-` signature and SHA-256.

Promote verified media under:

```text
apps/linkedin-review/media/intake/<id>/r<revision>/
```

Queue writes rebuild against latest `main`. Same-revision replay must preserve already-governed media identity. Changed same revision fails closed.

After promotion, pin PDF and thumbnail URLs to the exact immutable 40-character Git commit containing those files. Re-download and verify PDF bytes/SHA/pages/type plus thumbnail bytes/SHA/type.

A successful intake creates `[PDF INTAKE READY] <id>@<revision>`. This proves media readiness only.

## Repository-owner approval

Only after media readiness create:

```text
[APPROVED LINKEDIN] <id>@<revision>
```

The approval must exactly match the current locked queue revision, including target, schedule, caption, media URL, document title, thumbnail, page count, bytes and SHA. Legacy issue-only dispatch that cannot be tied to current queue state is rejected.

## Buffer release and idempotency

Before Buffer creation, validate current queue identity, owner approval fingerprint, schedule, applicable Notion drift checks, remote media integrity and Buffer capacity.

Immediately before provider mutation write a durable dispatch-intent marker. Once Buffer returns a post ID, write durable acceptance immediately. Accepted placements are not recreated. Unresolved intents block blind recreation. More than one trusted ledger is split-brain state and fails closed.

## Read-only reconciliation

The owner-gated reconciler may repair an unresolved intent only when exactly one provider record matches the locked target channel, due instant, caption digest, exact media source URL for media posts, and an allowed recoverable provider state. Zero or multiple matches remain blocked. It never creates, edits, reschedules or deletes Buffer posts.

## Publication verification

Buffer acceptance means `accepted/scheduled by Buffer`, not published. Publication verification is separate and read-only. Only provider `sent` state plus `sentAt` evidence may become `publication verified`. Provider error is publication failure. Unknown state stays pending.

## Failure handling

When a stage fails: identify the failed stage, preserve audit evidence, diagnose the cause, correct that stage, retry that stage, then continue. Do not invent a parallel route. If release material changes, create a new revision.

## Retired parallel routes

Historical direct-repository PDF intake and immediate share-now workflows are retired compatibility surfaces. They must not reconstruct, schedule or publish production LinkedIn PDFs.

## Canonical repository surfaces

```text
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
```

## Proven Retention School reference run

Part 1: `rs-li-retention-school-part-1`, 10 pages, 3,562,430 bytes, SHA `cd8dc92f4dbfb6adf7706dbb08aa1acc329fe770d71a0cdc706df91617bd422f`, Buffer `6a9d238a6aba27483202f89a`, due 11 September 2026 at 08:45 BST.

Part 2: `rs-li-retention-school-part-2`, 10 pages, 22,244,922 bytes, SHA `653432b489b7df73e1bcf52b78c413b2dc14517c8ee65ffdf96eb5f038b27b66`, Buffer `6a9d25c8fd1c461b0090193b`, due 14 September 2026 at 08:45 BST.

Part 3: `rs-li-retention-school-part-3`, 10 pages, 16,934,427 bytes, SHA `65a74d59078008c23c6a3c9a905e25ff16924ff5bfbfa73149f31470242cf609`, Buffer `6a9d2cf141e2718ea379a7a9`, due 16 September 2026 at 08:45 BST.

These historical posts prove the production route, but not every hardening layer added afterwards.

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

Stop when current `main` is authoritative, relevant production CI is green, documentation matches current production behaviour, and no known material defect remains that can be corrected without changing the intended public-media trade-off. Future changes restart regression testing.

The live repository is the source of truth. Do not revive obsolete hardening branches or retired PDF routes.
