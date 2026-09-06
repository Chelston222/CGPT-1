# 222Emails LinkedIn PDF Carousel Publishing Workflow | ULTRA Playbook

**Status:** canonical reusable operating playbook  
**Hardened:** 6 September 2026  
**Owner:** Chelston / 222Emails

> For any 222Emails LinkedIn document post, PDF carousel, PDF packaging, governed PDF intake, Buffer scheduling or publication-verification task, use this pathway by default unless Chelston explicitly replaces it. Do not invent a parallel production route.

## Canonical architecture

```text
Approved final PDF + approved final caption
  -> authorised Gmail transport from tripletwochelston@gmail.com
  -> hello@222emails.com
  -> PrivateEmail IMAP
  -> exact sender/subject/filename/bytes/SHA verification
  -> revision-scoped GitHub media promotion
  -> immutable Git-commit media URL pin
  -> governed GitHub LinkedIn queue
  -> live Notion quality and drift gate
  -> repository-owner [APPROVED LINKEDIN] gate
  -> durable Buffer dispatch intent
  -> Buffer createPost
  -> durable Buffer acceptance ledger
  -> LinkedIn
  -> separate due-time publication verifier
```

Use these states precisely:

1. `exact media verified`
2. `queued in governed GitHub layer`
3. `accepted/scheduled by Buffer`
4. `publication verified`

Never call a post published merely because Gmail sent the message, IMAP found the attachment, GitHub promoted the PDF, or Buffer accepted it.

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
scripts/linkedin-media-preflight.cjs
scripts/linkedin-notion-quality-gate.cjs
scripts/linkedin-buffer-acceptance-ledger.cjs
scripts/linkedin-buffer-capacity.cjs
apps/linkedin-review/queue.json
apps/linkedin-review/media/intake/<post-id>/r<revision>/
tests/linkedin-imap-intake-config.test.cjs
tests/linkedin-pdf-intake.test.cjs
tests/linkedin-media-preflight.test.cjs
tests/linkedin-notion-quality-gate.test.cjs
tests/linkedin-buffer-acceptance-ledger.test.cjs
tests/linkedin-hardening-static.test.cjs
docs/LINKEDIN_PDF_INTAKE.md
```

The older `.github/workflows/linkedin-pdf-intake.yml` direct-repository route and `.github/workflows/linkedin-pdf-share-now.yml` immediate route are retired. They must not reconstruct, schedule or publish a PDF. The canonical production entry is the owner-gated IMAP route above.

## Production and packaging gate

Before transport, the PDF and caption must already be final. Carousel production inherits the 222Emails Full / Preview First / Fast Batch mode gate, sequential red-team and verification discipline, one-page-per-generation rule, no-collage rule, post-generation QA and full-resolution/no-additional-loss packaging contract.

Package from approved source page assets. Preserve native dimensions and aspect ratio where practical. Use one source image per PDF page. Avoid unnecessary resampling or lossy recompression. Verify page count, order, orientation, cover, mobile readability, caption pairing and that the PDF opens correctly.

Record the exact filename, byte count, page count and SHA-256. Changed bytes, caption, schedule, destination or release material require a new revision. A same-revision replay is allowed only when the stable release fingerprint is identical.

## Public-media confidentiality boundary

The current canonical Buffer media host is the public `raw.githubusercontent.com` surface of the public `Chelston222/CGPT-1` repository.

That means promoted PDF bytes can be publicly reachable before the scheduled LinkedIn publication. This is a deliberate transport property, not a privacy boundary.

Therefore:

- use this lane only for material that is safe to expose publicly before publication
- the intake manifest must explicitly set `publicMediaApproved: true`
- confidential, embargoed or private material must not enter this lane
- a private capability-based media bridge exists elsewhere in the stack, but it is not canonical until its Buffer PDF ingestion route is separately live-proven and approved

## Notion live source-of-truth gate

Use the existing TTE LinkedIn Content Calendar. The concrete Notion page URL becomes the queue `sourceUrl`.

Before a governed PDF may reach Buffer, the live Notion page must still satisfy the release contract, including:

- `Content Decision = Keep`
- `Approval = Approved`
- `Anti-DNA | Pass = checked`
- `Asset Ready = checked`
- `Automation Ready = checked`
- `Automation Status` must be automation-capable for this governed PDF lane, not `Manual`
- `Buffer Status` must be a permitted release state
- `Final Copy` must exactly match the locked queue caption after line-ending normalisation
- `Publish Payload` must exactly match the locked queue caption after line-ending normalisation
- `Scheduled At` must represent the exact same instant as the locked queue schedule

The production Buffer release fails closed if the Notion API credential is absent. It does not silently fall back to queue-only authority for normal governed PDF intake.

After confirmed Buffer acceptance, the matching Notion row should record the returned Buffer post ID and queued state. Do not mark Published until publication verification succeeds.

## Authorised transport

Send the exact final PDF:

```text
FROM: tripletwochelston@gmail.com
TO: hello@222emails.com
SUBJECT: TTE LINKEDIN PDF INTAKE <id>
ATTACHMENT: <exact final PDF filename>
```

Transport is not publication authority.

## Governed intake issue

Repository-owner issue title:

```text
[IMAP PDF INTAKE] <id>
```

The body contains exactly one locked JSON block:

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
    "category": "<category>",
    "funnelStage": "<stage>",
    "targets": ["secondary"],
    "mode": "schedule",
    "scheduledAt": {"secondary": "<ISO 8601 timestamp with Z or explicit UTC offset>"},
    "copy": {"default": "<exact approved caption>"},
    "mediaAlt": "<carousel description>",
    "expectedSha256": "<same exact SHA-256>",
    "publicMediaApproved": true,
    "sourceUrl": "https://app.notion.com/<concrete-page-id>"
  }
}
<!-- INTAKE_CONFIG_END -->
```

Canonical IMAP PDF intake accepts exactly one target. If the same document needs more than one destination, use separately locked governed items so each destination has one unambiguous Notion schedule and approval record.

Do not supply arbitrary `downloadUrl` or `chunks` in this owner issue. The verified IMAP attachment creates the internal chunks.

## Permanent validation contract

Fail closed unless all of the following are true:

- issue author is the repository owner
- title prefix is exact and title ID equals `config.id`
- exactly one config block exists
- sender is exactly `tripletwochelston@gmail.com`
- subject is exactly `TTE LINKEDIN PDF INTAKE <id>`
- filename is an ordinary PDF filename with no path separators or control characters
- expected SHA-256, bytes and pages are valid and match the attachment
- `schemaVersion` is exactly 1
- revision is an explicit positive integer
- title, document title and default caption exist
- approved caption contains no em dash
- exactly one target is present and is `personal`, `main` or `secondary`
- mode is `schedule`
- schedule uses ISO 8601 with `Z` or an explicit UTC offset and is more than ten minutes in the future at intake
- `publicMediaApproved` is true
- `sourceUrl` contains a concrete Notion page ID

The IMAP bridge scans selectable mailboxes in its recent 72-hour window, excluding Sent, Drafts, Trash and Junk special-use mailboxes. A candidate is accepted only after the exact sender, subject, filename, PDF signature, byte count and SHA-256 all match. A lookalike email or attachment is rejected rather than selected first and validated later.

## Reconstruction, revision safety and immutable media proof

The verified bytes are reconstructed under:

```text
apps/linkedin-review/media/intake/<id>/r<revision>/
```

The queue update is replay-safe:

- identical same revision: idempotent replay
- changed same revision: fail closed
- changed release: strictly higher revision required

The intake workflow rebuilds against the latest `main` before each push and retries if another governed writer advances `main`.

After the media commit succeeds, a second stage pins the queue media and thumbnail URLs to a full 40-character Git commit SHA that already contains the promoted files. The public verification step then downloads those commit-pinned URLs and re-checks bytes, SHA-256, page count and file type.

A successful intake creates or refreshes:

```text
[PDF INTAKE READY] <id>@<revision>
```

Its proof includes the immutable media commit, PDF URL, thumbnail URL, exact bytes, pages and SHA-256. This is media and queue readiness only. It is not publication approval.

## Repository-owner publication approval

Only after `[PDF INTAKE READY]` exists should the owner create:

```text
[APPROVED LINKEDIN] <id>@<revision>
```

The approval body must exactly match the current locked queue copy, target, schedule and media identity. The release workflow rejects legacy issue-only dispatch that cannot be tied back to the current queue revision.

Canonical body shape:

```text
POST_ID: <id>
REVISION: <revision>
CATEGORY: <category>
TARGETS: <single target>
MODE: schedule
CONTENT_QA: PASS
SCHEDULE_AT: <ISO 8601 timestamp with Z or explicit UTC offset>
MEDIA_URL: <immutable commit-pinned raw GitHub PDF URL>
MEDIA_KIND: document
DOCUMENT_TITLE: <document title>
DOCUMENT_THUMBNAIL_URL: <immutable commit-pinned thumbnail URL>
DOCUMENT_PAGE_COUNT: <page count>
MEDIA_BYTES: <exact bytes>
MEDIA_SHA256: <exact SHA-256>
---
<exact final caption>
```

This issue is the human publication-authority gate.

## Buffer release, intent safety and acceptance ledger

Before the first Buffer `createPost` call, the release workflow validates current queue state, live Notion state, schedule/cadence, Buffer capacity and exact remote media integrity.

Immediately before each provider write it records a trusted bot `BUFFER_DISPATCH_INTENT` marker in the durable ledger. Once Buffer returns a post ID, it immediately records `BUFFER_ACCEPTED` in both the durable ledger and the source approval issue.

This closes the normal retry/idempotency path across issue replacement and partial batch failures.

If a process fails in the narrow interval after the dispatch intent but before durable acceptance evidence exists, automatic recreation is blocked. The owner-gated `[RECONCILE LINKEDIN BUFFER INTENTS]` workflow is read-only toward Buffer. It may convert an unresolved intent to accepted only when it finds exactly one scheduled provider record matching the locked channel, due instant and caption digest. Zero matches or multiple matches remain blocked for explicit review.

Buffer acceptance means `accepted/scheduled by Buffer`, not published.

## Publication verification

The publication verifier is separate and read-only toward Buffer. It scans the supported recent approval horizon and queries the exact accepted Buffer post IDs.

Only:

```text
Buffer status = sent
AND sentAt exists
```

may become `publication verified`.

`error` is publication failure. An unresolved post more than 30 minutes after its due time is UNKNOWN/pending and must not be counted as published.

PDF analytics remain subject to native LinkedIn checking when Buffer does not provide sufficient document-post metrics.

## Fail-closed rules

- no direct ChatGPT-to-Buffer dependency is required
- no production PDF release without repository-owner approval
- no approval before immutable exact-media proof
- no silent media mutation after revision lock
- exact SHA-256, bytes and pages remain authoritative
- future canonical media URLs are commit-pinned, not mutable `main` URLs
- never bypass the live Notion gate for governed PDF intake
- `Automation Status = Manual` blocks automated governed PDF release
- unresolved Buffer dispatch intents block recreation until positively reconciled
- changed media, caption, destination or schedule requires a new revision
- preserve audit history
- never equate Gmail sent, IMAP found, GitHub queued or Buffer accepted with LinkedIn published
- do not use retired direct-repository or share-now PDF routes
- do not use this public-media lane for confidential or embargoed material

## Proven Retention School reference run

The following three releases proved the earlier canonical path before the final immutable-URL and dispatch-intent hardening was added. They remain useful production evidence, but they are not evidence that those later hardening layers were exercised by these already scheduled posts.

```text
Part 1
ID: rs-li-retention-school-part-1
Pages: 10
Bytes: 3,562,430
SHA: cd8dc92f4dbfb6adf7706dbb08aa1acc329fe770d71a0cdc706df91617bd422f
Buffer: 6a9d238a6aba27483202f89a
Due: 11 Sep 2026 08:45 BST

Part 2
ID: rs-li-retention-school-part-2
Pages: 10
Bytes: 22,244,922
SHA: 653432b489b7df73e1bcf52b78c413b2dc14517c8ee65ffdf96eb5f038b27b66
Buffer: 6a9d25c8fd1c461b0090193b
Due: 14 Sep 2026 08:45 BST

Part 3
ID: rs-li-retention-school-part-3
Pages: 10
Bytes: 16,934,427
SHA: 65a74d59078008c23c6a3c9a905e25ff16924ff5bfbfa73149f31470242cf609
Buffer: 6a9d2cf141e2718ea379a7a9
Due: 16 Sep 2026 08:45 BST
```

At the time of this playbook hardening, all three due times are still in the future. None should be called published until the due-time verifier produces positive sent evidence.

## Reuse command

```text
Use the canonical 222Emails LinkedIn PDF Carousel Publishing Workflow.
Take this LinkedIn PDF through the governed IMAP route.
Do not invent a parallel upload or immediate-publish path.
Preserve exact-media verification, immutable commit-pinned media,
Notion live quality gating, repository-owner approval,
Buffer dispatch-intent and acceptance proof, and separate publication verification.
Diagnose and repair a failed stage rather than skipping it.
Return only verified status.
```

This remains the default governed route for 222Emails LinkedIn PDF/document publishing until Chelston explicitly replaces it.
