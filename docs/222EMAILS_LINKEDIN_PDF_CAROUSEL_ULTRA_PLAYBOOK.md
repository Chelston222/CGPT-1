# 222Emails LinkedIn PDF Carousel Publishing Workflow | ULTRA Playbook

**Status:** canonical reusable operating playbook  
**Locked:** 6 September 2026  
**Owner:** Chelston / 222Emails

> If this file is opened in a future session, treat it as the canonical 222Emails LinkedIn PDF carousel publishing playbook. For any LinkedIn post, LinkedIn document post, PDF carousel, LinkedIn PDF packaging, governed PDF intake, Buffer scheduling, or LinkedIn publication verification task, use this pathway by default unless Chelston explicitly overrides it. Do not invent a parallel upload route.

## Canonical architecture

```text
Approved production surface
  -> exact final PDF + exact final caption
  -> authorised Gmail transport from tripletwochelston@gmail.com
  -> hello@222emails.com
  -> PrivateEmail IMAP
  -> GitHub exact-media intake and verification
  -> governed GitHub LinkedIn queue
  -> Notion live quality gate
  -> repository-owner [APPROVED LINKEDIN] gate
  -> Buffer
  -> LinkedIn
  -> separate due-time publication verifier
```

Use these states precisely:

1. `exact media verified`
2. `queued in governed GitHub layer`
3. `accepted/scheduled by Buffer`
4. `publication verified`

Never call a post published merely because Gmail sent the message, IMAP found the attachment, GitHub promoted the PDF, or Buffer accepted it.

## Repository surfaces

```text
.github/workflows/linkedin-imap-pdf-intake.yml
.github/workflows/linkedin-buffer-autopost.yml
scripts/linkedin-imap-intake-config.cjs
scripts/linkedin-imap-intake-from-issue.mjs
scripts/linkedin-imap-pdf-intake.mjs
scripts/linkedin-pdf-intake.cjs
scripts/linkedin-notion-quality-gate.cjs
apps/linkedin-review/queue.json
apps/linkedin-review/media/intake/<post-id>/
tests/linkedin-imap-intake-config.test.cjs
tests/linkedin-pdf-intake.test.cjs
tests/linkedin-media-preflight.test.cjs
docs/LINKEDIN_PDF_INTAKE.md
```

## Production and packaging gate

Before transport, the PDF and caption must already be final. For carousel production inherit the 222Emails Full / Preview First / Fast Batch mode gate, Double Red, Double Verify, one-page-per-generation discipline, no-collage rule, post-generation QA and full-resolution/no-additional-loss packaging contract.

Package from original approved page assets. Preserve native dimensions and aspect ratio where practical. Use one source image per PDF page. Avoid unnecessary resampling or lossy recompression. Verify page count, page order, orientation, first page, mobile readability, caption pairing, CTA/destination links where applicable and that the PDF opens correctly.

Record the exact PDF filename, byte count, page count and SHA-256. Those values are the authoritative identity of that revision. Changed bytes require a new verified revision.

## Notion source row

Use the existing TTE LinkedIn Content Calendar. Store approved Final Copy/Publish Payload, Content Decision, Approval, Anti-DNA pass, Asset Ready, Automation Ready, scheduled time, media metadata and release context. The Notion page URL becomes the live `sourceUrl` used by the GitHub quality gate.

After confirmed Buffer acceptance set:

```text
Automation Status = Synced
Buffer Status = Queued in Buffer
External Post ID = <Buffer post ID>
```

Do not mark Published until publication verification succeeds.

## Authorised transport

Send the exact PDF:

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

Body contains one locked JSON block:

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
    "scheduledAt": {"secondary": "<ISO date/time with local offset>"},
    "copy": {"default": "<exact approved caption>"},
    "mediaAlt": "<carousel description>",
    "expectedSha256": "<same exact SHA-256>",
    "sourceUrl": "https://app.notion.com/p/<source-page-id>"
  }
}
<!-- INTAKE_CONFIG_END -->
```

Do not provide arbitrary `downloadUrl` or `chunks`. The verified attachment creates the chunks.

## Permanent validation contract

Fail closed unless the issue is repository-owner authored, the title prefix is exact, title ID equals config.id, sender is exactly `tripletwochelston@gmail.com`, subject and filename match exactly, filename is a PDF, SHA-256 is exact and matches the manifest, expected bytes/pages are valid, schemaVersion is 1, revision is positive, title/documentTitle/default copy exist, approved copy has no em dash, target is one of `personal`, `main`, `secondary`, mode is `schedule`, every target has a valid schedule more than 10 minutes in the future, and sourceUrl is a Notion page URL.

The IMAP transport scans selectable mailboxes within the recent 72-hour window and excludes Sent, Drafts, Trash and Junk special-use mailboxes. It requires exact sender, subject and filename, verifies PDF attachment content, exact bytes, `%PDF-` header and exact SHA-256. Verified bytes are staged in deterministic 2,000,000-byte base64 chunks.

## Reconstruction and media proof

`scripts/linkedin-pdf-intake.cjs` reconstructs the verified PDF. The workflow validates revision, pages, bytes and SHA, runs governed media regression tests, writes the asset under `apps/linkedin-review/media/intake/<id>/`, updates `apps/linkedin-review/queue.json`, pushes to `main`, fetches the public raw PDF and thumbnail, then re-verifies bytes, SHA, pages and file type.

A successful intake creates/updates:

```text
[PDF INTAKE READY] <id>@<revision>
```

This is exact-media readiness only. It is not publication approval.

## Permanent concurrency hardening

A real multi-carousel Retention School test exposed a stale-main queue race when several PDF intakes were opened close together. The permanent fix is locked in.

The workflow explicitly checks out `main`, refreshes `origin/main` after the GitHub Actions concurrency wait, and immediately before each push rebuilds the governed queue/media state against the newest `origin/main`. If another governed writer advances `main`, it refreshes and retries from the newest queue up to three times.

Never blindly rebase or push a stale `queue.json` snapshot. Never remove this latest-main rebuild behaviour without a verified replacement at least as safe.

## Repository-owner approval

Only after `[PDF INTAKE READY]` exists, create:

```text
[APPROVED LINKEDIN] <id>@<revision>
```

Canonical body:

```text
POST_ID: <id>
REVISION: 1
CATEGORY: <category>
TARGETS: secondary
MODE: schedule
CONTENT_QA: PASS
SCHEDULE_AT: <ISO date/time with local offset>
MEDIA_URL: <raw GitHub PDF URL>
MEDIA_KIND: document
DOCUMENT_TITLE: <document title>
DOCUMENT_THUMBNAIL_URL: <raw GitHub thumbnail URL>
DOCUMENT_PAGE_COUNT: <page count>
MEDIA_BYTES: <exact bytes>
MEDIA_SHA256: <exact SHA-256>
---
<exact final caption>
```

This issue is the human authority gate.

## Buffer release and writeback

The existing Buffer release workflow must run the current governed queue and live Notion quality gates before sending the immutable document media. Require explicit bot evidence containing destination, Buffer post ID, due time, exact media bytes/SHA and queue-slot state.

Buffer acceptance means `accepted/scheduled by Buffer`, not published.

After acceptance, write the Buffer ID and queued status back to the matching Notion row. After the due time, run the separate publication verification layer. Only positive evidence may move the state to `publication verified`.

## Fail-closed rules

- no direct ChatGPT-to-Buffer dependency is required
- no release without repository-owner approval
- no approval before exact media proof
- no silent media mutation after revision lock
- exact SHA-256, bytes and pages are authoritative
- never bypass the Notion live quality gate
- never skip a failed stage; diagnose and retry that stage
- changed media requires a new verified revision
- preserve audit history
- never equate Gmail sent, IMAP found, GitHub queued or Buffer accepted with LinkedIn published
- do not invent a parallel upload route

## Proven Retention School reference run

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

Batch proof: 3 PDFs, 30 pages, 42,741,779 bytes, 3/3 exact-media intakes passed, 3/3 Buffer destinations accepted, zero queue-slot waits, one production concurrency defect found and fixed. At lock time none of the three should be called published because all due times remain in the future.

## Reuse command

```text
Use the canonical 222Emails LinkedIn PDF Carousel Publishing Workflow.
Take this LinkedIn post/carousel through the governed route.
Do not invent a parallel upload method.
Preserve exact-media verification, Notion quality gating, repository-owner approval,
Buffer acceptance proof and separate publication verification.
Diagnose and repair any failed stage rather than skipping it.
Return only verified status.
```

For 222Emails LinkedIn PDF/document publishing, this remains the default governed route until Chelston explicitly replaces it.