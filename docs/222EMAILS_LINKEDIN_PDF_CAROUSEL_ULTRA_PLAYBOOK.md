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

## 3. Authority model

These states remain separate:

- final asset approved
- exact media verified
- governed queue locked
- repository owner approved
- Buffer accepted/scheduled
- LinkedIn publication verified

No earlier state proves a later one.

## 4. Production and packaging gate

Before transport, the PDF and caption must already be final.

Carousel production inherits the standing 222Emails visual rules:

- Full / Preview First / Fast Batch mode gate for new multi-image generation
- sequential red-team and verification discipline
- one standalone page per generation
- no collage
- no contact-sheet deliverables
- post-generation visual QA
- full-resolution/no-additional-loss packaging
- UK English
- no em dash
- no invented metrics, benchmarks, proof or social proof
- current 222Emails branding

Before the PDF is accepted as final:

- use approved source page assets
- preserve native dimensions and aspect ratio where practical
- use one source image per PDF page
- avoid unnecessary resampling or lossy recompression
- verify page count
- verify page order
- verify orientation
- verify cover/first page
- verify mobile readability
- verify caption-to-asset pairing
- verify destination and CTA where applicable
- verify the PDF opens correctly

Record:

```text
PDF filename
PDF byte count
PDF page count
PDF SHA-256
```

These values become the authoritative identity of the revision.

Changed release material requires a new revision. Do not silently mutate a locked revision.

## 5. Public-media confidentiality boundary

The canonical public media host is the public GitHub repository via `raw.githubusercontent.com`.

That means the promoted PDF and associated release metadata can become publicly reachable before the scheduled LinkedIn publication.

Therefore:

- use this lane only for material safe to expose publicly before publication
- the intake manifest must explicitly acknowledge public media exposure
- the intake manifest must explicitly acknowledge public release-metadata exposure
- confidential, embargoed or private material must not use this lane
- a more private capability-based media bridge may exist elsewhere, but it is not canonical until separately live-proven for Buffer PDF ingestion and explicitly adopted

## 6. Canonical transport

Send the exact final PDF:

```text
FROM: tripletwochelston@gmail.com
TO: hello@222emails.com
SUBJECT: TTE LINKEDIN PDF INTAKE <id>
ATTACHMENT: <exact final PDF filename>
```

The email is transport only. It is not publication authority.

## 7. Governed intake issue

Create the repository-owner issue:

```text
[IMAP PDF INTAKE] <id>
```

The body contains exactly one locked config block:

```html
<!-- INTAKE_CONFIG_START -->
{
  "id": "<id>",
  "expectedSubject": "TTE LINKEDIN PDF INTAKE <id>",
  "expectedSender": "tripletwochelston@gmail.com",
  "expectedFilename": "<exact filename.pdf>",
  "expectedSha256": "<64-character SHA-256>",
  "expectedBytes": 12345678,
  "expectedPages": 10,
  "manifest": {
    "schemaVersion": 1,
    "id": "<id>",
    "revision": 1,
    "title": "<post title>",
    "documentTitle": "<LinkedIn document title>",
    "category": "<approved category>",
    "funnelStage": "<approved funnel stage>",
    "targets": ["secondary"],
    "mode": "schedule",
    "scheduledAt": {
      "secondary": "<ISO 8601 timestamp with Z or explicit UTC offset>"
    },
    "copy": {
      "default": "<exact approved caption>"
    },
    "mediaAlt": "<clear document/carousel description>",
    "expectedSha256": "<same exact SHA-256>",
    "sourceUrl": "https://app.notion.com/<concrete-page-id>",
    "publicMediaApproved": true,
    "publicReleaseMaterialApproved": true
  }
}
<!-- INTAKE_CONFIG_END -->
```

Do not place API keys, mailbox passwords, raw PDF bytes, arbitrary download URLs or user-supplied base64 chunks in the issue.

## 8. Permanent intake validation contract

The canonical intake fails closed unless the relevant conditions pass:

- issue authored by repository owner
- exact issue-title prefix
- title ID exactly equals config ID
- exactly one locked config block
- exact authorised sender
- exact subject derived from the ID
- exact plain PDF filename with no path/control characters
- valid SHA-256
- valid byte count
- valid page count
- schema version exactly 1
- explicit positive integer revision
- title and document title present and header-safe
- category/funnel metadata parser-safe where supplied
- `copy.default` is the sole canonical copy variant
- caption non-empty and within LinkedIn's 3,000-character ceiling
- no em dash in approved copy
- no reserved target-section marker hidden inside the caption
- exactly one target
- target is one of `personal`, `main`, `secondary`
- mode is `schedule`
- exactly one schedule key matching the target
- schedule uses ISO 8601 with `Z` or explicit UTC offset
- schedule remains inside the supported verifier horizon
- public media acknowledgement is true
- public release-material acknowledgement is true
- Notion source URL contains a concrete page ID
- manifest SHA matches transport SHA
- no arbitrary `downloadUrl`
- no operator-provided chunks

## 9. IMAP attachment selection

The PrivateEmail IMAP bridge:

- connects securely
- scans eligible recent mailboxes
- excludes Sent, Drafts, Trash and Junk special-use mailboxes
- matches exact sender
- matches exact subject
- matches exact filename
- validates byte count
- validates `%PDF-` signature
- validates exact SHA-256

The candidate is accepted only after all locked identity checks succeed.

A same-name or lookalike attachment with the wrong bytes or hash is rejected.

## 10. Reconstruction, revision safety and immutable media proof

The verified PDF is reconstructed and promoted under:

```text
apps/linkedin-review/media/intake/<id>/r<revision>/
```

Revision rules:

- identical same revision: idempotent replay
- changed same revision: fail closed
- changed release material: strictly higher revision required

Same-revision replay must preserve the already-governed media identity rather than allowing a renderer-version change to silently alter a locked thumbnail.

The intake workflow rebuilds against latest `main` before queue mutation and retries safely if another governed writer advances `main`.

After promotion, the PDF and thumbnail URLs are pinned to the exact immutable 40-character Git commit containing those files.

The workflow then downloads those immutable URLs and re-verifies:

- PDF byte count
- PDF SHA-256
- PDF page count
- PDF file type
- thumbnail byte count
- thumbnail SHA-256
- thumbnail file type

A successful intake creates or refreshes:

```text
[PDF INTAKE READY] <id>@<revision>
```

That issue proves exact media and queue readiness only. It is not publication approval.

## 11. Repository-owner publication approval

Only after exact-media readiness exists should the repository owner create:

```text
[APPROVED LINKEDIN] <id>@<revision>
```

Canonical body shape:

```text
POST_ID: <id>
REVISION: <revision>
CATEGORY: <category>
TARGETS: <single target>
MODE: schedule
CONTENT_QA: PASS
SCHEDULE_AT: <ISO date/time with explicit offset or Z>
MEDIA_URL: <immutable commit-pinned PDF URL>
MEDIA_KIND: document
DOCUMENT_TITLE: <document title>
DOCUMENT_THUMBNAIL_URL: <immutable commit-pinned thumbnail URL>
DOCUMENT_PAGE_COUNT: <page count>
MEDIA_BYTES: <exact bytes>
MEDIA_SHA256: <exact SHA-256>
---
<exact final caption>
```

The approval must exactly match the current locked queue revision.

Legacy issue-only dispatch that cannot be tied to the current queue is rejected.

## 12. Notion quality and drift gate

The GitHub queue and repository-owner approval remain the governed release authority.

Where the Notion credential is configured, the live source page provides additional drift protection and should confirm release-ready state such as:

- Content Decision = Keep
- Approval = Approved
- Anti-DNA pass
- Asset Ready
- Automation Ready
- Final Copy matches locked caption
- Publish Payload matches locked caption
- Scheduled At represents the same instant as the locked schedule
- automation state is compatible with automated release
- Buffer state is compatible with release/retry

`Automation Status = Manual` does not authorise automated governed PDF release.

A final live Notion recheck immediately before the provider mutation is desirable when credentialled so a last-moment revocation or drift is caught before Buffer creation.

Do not let Notion silently mutate or override the locked GitHub release contract.

## 13. Buffer release safety

Before the first Buffer write, the release workflow validates:

- current queue identity
- owner approval fingerprint
- current schedule
- media integrity
- Buffer capacity
- applicable live quality gates

All release workflows share a global concurrency lock so competing approval runs cannot race provider capacity or duplicate the same placement.

The surviving run drains eligible open approvals under the same global lock rather than processing only its triggering issue.

## 14. Durable dispatch intent and acceptance ledger

Every governed placement has a stable placement key derived from queue ID, revision and destination.

Immediately before the Buffer mutation, the system writes a trusted durable dispatch-intent marker.

Once Buffer returns a post ID, it writes the durable acceptance record immediately.

This creates three important behaviours:

- accepted placements are idempotent and are not recreated
- unresolved intents block blind recreation
- a partial workflow failure cannot silently duplicate a destination later

The durable ledger may be created by the repository owner or GitHub Actions bot. More than one trusted ledger is treated as split-brain state and fails closed.

## 15. Read-only intent reconciliation

The owner-gated reconciler is strictly read-only toward Buffer.

It may repair an unresolved intent only when exactly one provider record matches the locked release identity, including:

- target channel
- exact due instant
- exact caption digest
- exact media source URL for media posts, or no media for text-only posts
- an allowed recoverable provider state

Zero matches or multiple matches stay blocked for explicit review.

The reconciler must never create, edit, reschedule or delete a Buffer post.

## 16. Buffer acceptance semantics

A valid Buffer acceptance record should capture:

- queue post ID
- revision
- target/destination
- Buffer post ID
- due time
- exact media proof where available

Once confirmed, the state is:

```text
accepted/scheduled by Buffer
```

It is not yet:

```text
publication verified
```

## 17. Publication verification

After due time, the separate publication verifier queries the exact accepted Buffer post IDs.

Only positive evidence equivalent to:

```text
Buffer status = sent
AND sentAt exists
```

may become:

```text
publication verified
```

Provider `error` is a publication failure.

Unknown/late unresolved state remains pending for review and is not counted as published.

The verifier is read-only toward Buffer.

Where the approval issue lost its acceptance comment after a partial writeback failure, trusted durable-ledger evidence may be used to recover the exact Buffer ID only when ownership can be mapped unambiguously.

PDF/document analytics remain subject to native LinkedIn checking where Buffer does not expose complete document metrics.

## 18. Failure handling

When any stage fails:

1. identify the exact failed stage
2. preserve audit evidence
3. diagnose the actual cause
4. correct that stage
5. retry that stage
6. continue only after it passes

Do not skip forward.

Do not invent a parallel production route because a gate failed.

If release material changes, create a new revision rather than pretending the previous fingerprint still represents the asset.

## 19. Retired parallel routes

Historical direct-repository PDF intake and immediate share-now workflows are retired compatibility surfaces.

They must not reconstruct, schedule or publish production LinkedIn PDFs.

The canonical production entry remains:

```text
Gmail -> PrivateEmail IMAP -> governed GitHub intake -> immutable media pin -> owner approval -> Buffer -> publication verifier
```

## 20. Canonical repository surfaces

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
tests/linkedin-imap-intake-config.test.cjs
tests/linkedin-pdf-intake.test.cjs
tests/linkedin-pdf-replay-preservation.test.cjs
tests/linkedin-review-core.test.cjs
tests/linkedin-media-preflight.test.cjs
tests/linkedin-notion-quality-gate.test.cjs
tests/linkedin-buffer-capacity.test.cjs
tests/linkedin-buffer-acceptance-ledger.test.cjs
tests/linkedin-hardening-static.test.cjs
docs/LINKEDIN_PDF_INTAKE.md
docs/LINKEDIN_BUFFER_AUTOPOST_SETUP.md
```

## 21. Proven Retention School reference run

The Retention School three-document sequence established real production evidence for the governed route before later hardening layers were added.

```text
Part 1
ID: rs-li-retention-school-part-1
Pages: 10
Bytes: 3,562,430
SHA-256: cd8dc92f4dbfb6adf7706dbb08aa1acc329fe770d71a0cdc706df91617bd422f
Buffer ID: 6a9d238a6aba27483202f89a
Due: 11 September 2026, 08:45 BST

Part 2
ID: rs-li-retention-school-part-2
Pages: 10
Bytes: 22,244,922
SHA-256: 653432b489b7df73e1bcf52b78c413b2dc14517c8ee65ffdf96eb5f038b27b66
Buffer ID: 6a9d25c8fd1c461b0090193b
Due: 14 September 2026, 08:45 BST

Part 3
ID: rs-li-retention-school-part-3
Pages: 10
Bytes: 16,934,427
SHA-256: 65a74d59078008c23c6a3c9a905e25ff16924ff5bfbfa73149f31470242cf609
Buffer ID: 6a9d2cf141e2718ea379a7a9
Due: 16 September 2026, 08:45 BST
```

Do not use those historical posts as evidence that every later hardening layer was exercised by those already-scheduled items.

## 22. Operator checklist

### Before packaging

- final copy approved
- final visuals approved
- page order verified
- no collage
- mobile readability checked
- no em dash
- claims verified
- caption and asset pairing verified

### Before intake

- final PDF opens
- page count recorded
- byte count recorded
- SHA-256 recorded
- Notion source row exists if used
- schedule is future-safe
- intended target selected
- exact filename locked
- public exposure explicitly acceptable

### Transport

- sent from authorised Gmail
- sent to hello@222emails.com
- exact subject used
- exact final PDF attached

### GitHub intake

- repository-owner issue created
- IDs match
- sender/subject/filename exact
- bytes/pages/SHA exact
- one target only
- explicit-offset schedule
- intake workflow passed
- immutable media pin created
- public raw verification passed
- `[PDF INTAKE READY]` proof exists

### Approval and Buffer

- repository-owner `[APPROVED LINKEDIN]` issue created
- approval metadata matches locked revision
- exact caption included
- live defence-in-depth gate passed where configured
- remote media preflight passed
- durable dispatch intent written
- Buffer acceptance evidence exists
- Buffer post ID captured
- due time verified
- media identity matches
- Notion/calendar writeback completed where applicable

### After due time

- publication verifier run
- positive sent evidence exists
- only then call it published

## 23. Reuse command

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

## 24. Verification and stopping rule

This workflow was repeatedly red-teamed across architecture, authority boundaries, concurrency, idempotency, stale state, duplicate prevention, exact-media integrity, IMAP ambiguity, retry/recovery, Notion drift, Buffer dispatch uncertainty, publication semantics, timezone handling, malformed input, source-of-truth drift, audit history and parallel-route bypass.

Material defects found during those passes were corrected rather than documented away.

The stopping rule is:

- current `main` is the canonical implementation
- relevant production CI is green
- the canonical playbook matches current production behaviour
- no known material defect remains that can be corrected without changing the architecture's intended public-media trade-off
- future changes restart regression testing rather than relying on this historical verification label

The live repository remains the source of truth. Do not revive obsolete hardening branches or retired PDF routes.
