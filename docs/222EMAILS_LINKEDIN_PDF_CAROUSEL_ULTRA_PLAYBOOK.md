# 222Emails LinkedIn PDF Carousel Publishing Workflow | CANONICAL VERIFIED v1.0.1

**Operating status:** canonical reusable production route
**Verification refreshed:** 8 September 2026
**Owner:** Chelston / 222Emails
**Repository:** `Chelston222/CGPT-1`

> For any 222Emails LinkedIn document post, PDF carousel, PDF packaging, governed PDF intake, Buffer scheduling or publication-verification task, use this pathway by default unless Chelston explicitly replaces it. Do not invent a parallel production route.

## 1. Canonical architecture

```text
Approved final PDF + approved final caption
  -> authorised Gmail transport from tripletwochelston@gmail.com
  -> hello@222emails.com
  -> PrivateEmail IMAP
  -> exact sender/subject/filename/bytes/SHA verification
  -> revision-scoped GitHub media promotion
  -> immutable Git-commit PDF and thumbnail pin
  -> governed GitHub LinkedIn queue
  -> repository-owner [APPROVED LINKEDIN] gate
  -> exact current-queue fingerprint verification
  -> live Notion defence-in-depth when GitHub credential exists
  -> remote media and Buffer capacity preflight
  -> optional final pre-mutation Notion recheck when credentialled
  -> durable Buffer dispatch intent
  -> Buffer createPost
  -> durable Buffer acceptance ledger
  -> LinkedIn
  -> separate due-time publication verifier
```

Use these states precisely:

1. `exact media verified`
2. `queued in governed GitHub layer`
3. `owner approved`
4. `accepted/scheduled by Buffer`
5. `publication verified`

Never call a post published merely because Gmail sent the message, IMAP found the attachment, GitHub promoted the PDF, the owner approved it, or Buffer accepted it.

## 2. Trigger scope

Use this workflow automatically for:

- LinkedIn document posts
- LinkedIn PDF carousels
- packaging approved carousel pages into a LinkedIn PDF
- moving a completed PDF into governed publishing
- Buffer scheduling for a governed LinkedIn document
- recovery of a failed PDF intake or Buffer release
- checking whether a governed PDF is ready, queued, scheduled or published
- updating the LinkedIn Content Calendar for one of these releases

Only depart from this route when Chelston explicitly requests another method or a verified platform constraint makes it impossible.

## 3. Production and packaging gate

Before transport, the PDF and caption must already be final. Carousel production inherits the 222Emails visual-production rules: Full / Preview First / Fast Batch mode gate for new multi-image generation, sequential red-team and verification, one standalone page per generation, no collage, post-generation visual QA, full-resolution/no-additional-loss packaging, UK English, no em dash, and no invented proof or metrics.

Record the exact PDF filename, byte count, page count and SHA-256. Changed release material requires a new revision. Do not silently mutate locked media.

## 4. Public-media confidentiality boundary

The current canonical Buffer media host is the public `raw.githubusercontent.com` surface of the public `Chelston222/CGPT-1` repository. Promoted PDF bytes and locked release metadata can be publicly reachable before the scheduled LinkedIn publication.

Therefore use this lane only for material safe to expose publicly before publication. Canonical intake requires explicit `publicMediaApproved: true` and `publicReleaseMaterialApproved: true`. Confidential, embargoed or private material must not use this lane.

## 5. Canonical transport

```text
FROM: tripletwochelston@gmail.com
TO: hello@222emails.com
SUBJECT: TTE LINKEDIN PDF INTAKE <id>
ATTACHMENT: <exact final PDF filename>
```

The email transports bytes only. It is not publication authority.

## 6. Governed intake issue

Create one repository-owner issue titled:

```text
[IMAP PDF INTAKE] <id>
```

with exactly one locked JSON config block containing the exact ID, subject, sender, filename, SHA-256, bytes, pages, schema version 1, explicit positive revision, title, document title, category/funnel metadata where used, exactly one target, exactly one matching scheduledAt key, explicit timezone, exact `copy.default`, mediaAlt, concrete Notion source page URL where used, `publicMediaApproved: true`, and `publicReleaseMaterialApproved: true`.

Do not put secrets, raw PDF bytes, arbitrary download URLs or user-provided chunks in the issue.

## 7. Permanent validation contract

Fail closed unless all relevant checks pass:

- repository-owner author
- exact title prefix and ID match
- exactly one config block
- exact authorised sender
- exact subject derived from ID
- plain PDF filename with no path/control characters
- valid SHA-256
- valid byte/page counts
- schema version exactly 1
- explicit positive integer revision
- title/document title and release metadata parser-safe
- `copy.default` is the sole canonical copy variant
- caption non-empty and within LinkedIn's 3,000-character ceiling
- no em dash in approved copy
- no reserved target-section marker hidden in copy
- exactly one target
- exactly one schedule key matching the target
- supported target only
- mode `schedule`
- schedule uses ISO 8601 with explicit offset or Z
- schedule remains inside the supported verifier horizon
- public exposure acknowledgements true
- concrete source page ID where used
- manifest SHA matches transport SHA
- no arbitrary download URL or user-supplied chunks

## 8. IMAP attachment selection

The PrivateEmail IMAP bridge scans eligible recent mailboxes while excluding Sent, Drafts, Trash and Junk special-use mailboxes. A candidate must match the locked sender, subject and filename, then the exact byte count, `%PDF-` signature and SHA-256. Lookalike or same-name attachments with wrong bytes/hash are rejected.

## 9. Reconstruction, revision safety and immutable media proof

Promote verified media under:

```text
apps/linkedin-review/media/intake/<id>/r<revision>/
```

Revision rules:

- identical same revision: idempotent replay
- changed same revision: fail closed
- changed release material: higher revision required

Same-revision replay must preserve the already-governed media identity rather than allowing a renderer change to silently alter a locked thumbnail.

Queue writes rebuild against latest `main` before mutation and retry safely if another governed writer advances `main`.

After promotion, PDF and thumbnail URLs are pinned to the exact immutable 40-character Git commit containing those files. The workflow then downloads those immutable URLs and re-verifies PDF bytes, SHA-256, page count and type plus thumbnail bytes, SHA-256 and type.

A successful intake creates or refreshes:

```text
[PDF INTAKE READY] <id>@<revision>
```

That proves exact media and queue readiness only. It is not publication authority.

## 10. Repository-owner publication approval

Only after exact-media readiness exists should the repository owner create:

```text
[APPROVED LINKEDIN] <id>@<revision>
```

The approval must exactly match the current locked queue revision, including target, schedule, caption and media identity. Legacy issue-only release that cannot be tied to the current queue is rejected.

## 11. Notion defence-in-depth

The GitHub queue plus repository-owner approval remain the governed authority. Where the Notion credential is configured, the exact source page provides additional drift protection for Content Decision, Approval, Anti-DNA, Asset Ready, Automation Ready, Final Copy, Publish Payload, Scheduled At, automation state and Buffer state. `Automation Status = Manual` does not authorise automated governed PDF release.

A final Notion recheck immediately before provider mutation is used when credentialled. Notion must not silently mutate or override the locked GitHub release contract.

## 12. Buffer release safety

Before the first Buffer write validate current queue identity, owner approval fingerprint, schedule, remote media integrity, Buffer capacity and applicable live quality checks.

All production Buffer releases share a global concurrency lock so competing approval runs cannot race provider capacity or duplicate a placement.

## 13. Durable dispatch intent and acceptance ledger

Every governed placement has a stable placement key. Immediately before provider mutation, write a durable dispatch-intent marker. Once Buffer returns a post ID, write durable acceptance immediately.

Accepted placements are idempotent and are not recreated. Unresolved intents block blind recreation. More than one trusted durable ledger is treated as split-brain state and fails closed.

## 14. Read-only intent reconciliation

The owner-gated reconciler is read-only toward Buffer. It may repair an unresolved intent only when exactly one provider record matches the locked target channel, exact due instant, exact caption digest, exact media source URL for media posts or no media for text-only posts, and a recoverable provider state. Zero or multiple matches remain blocked for explicit review.

## 15. Buffer acceptance semantics

A valid acceptance record captures the queue item, revision, target, Buffer post ID, due time and available media proof. Buffer acceptance means `accepted/scheduled by Buffer`, not published.

## 16. Publication verification

After due time, the separate publication verifier queries the exact Buffer post ID. Only positive provider `sent` state with a `sentAt` timestamp may become `publication verified`. Provider `error` is a publication failure. Unknown state stays pending and is not counted as published. Verification is read-only toward Buffer.

## 17. Failure handling

When a stage fails: identify the exact stage, preserve audit evidence, diagnose the cause, correct that stage, retry that stage, and continue only after it passes. Do not invent a parallel production route. Changed release material gets a new revision.

## 18. Retired parallel routes

Historical direct-repository PDF intake and immediate share-now workflows are retired compatibility surfaces. They must not reconstruct, schedule or publish production LinkedIn PDFs.

## 19. Canonical repository surfaces

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

## 20. Proven Retention School reference run

Part 1: `rs-li-retention-school-part-1`, 10 pages, 3,562,430 bytes, SHA `cd8dc92f4dbfb6adf7706dbb08aa1acc329fe770d71a0cdc706df91617bd422f`, Buffer `6a9d238a6aba27483202f89a`, due 11 September 2026 at 08:45 BST.

Part 2: `rs-li-retention-school-part-2`, 10 pages, 22,244,922 bytes, SHA `653432b489b7df73e1bcf52b78c413b2dc14517c8ee65ffdf96eb5f038b27b66`, Buffer `6a9d25c8fd1c461b0090193b`, due 14 September 2026 at 08:45 BST.

Part 3: `rs-li-retention-school-part-3`, 10 pages, 16,934,427 bytes, SHA `65a74d59078008c23c6a3c9a905e25ff16924ff5bfbfa73149f31470242cf609`, Buffer `6a9d2cf141e2718ea379a7a9`, due 16 September 2026 at 08:45 BST.

These historical posts prove the production route, but not every later hardening layer.

## 21. Reuse command

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

## 22. Verification and stopping rule

Current `main` is the canonical source of truth. Relevant production CI must be green. Documentation must match production behaviour. No known material defect should remain that can be corrected without changing the intended public-media trade-off. Future workflow changes restart regression testing.

Superseded hardening branches and stale pull requests must not be merged over newer production `main`.