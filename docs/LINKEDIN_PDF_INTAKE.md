# 222Emails LinkedIn PDF intake

## Purpose

This document describes the canonical intake route for 222Emails LinkedIn PDF/document posts. The full operator playbook is `docs/222EMAILS_LINKEDIN_PDF_CAROUSEL_ULTRA_PLAYBOOK.md` and takes precedence if this summary ever drifts.

Canonical route:

```text
final approved PDF + caption
-> authorised Gmail
-> hello@222emails.com
-> PrivateEmail IMAP
-> owner [IMAP PDF INTAKE] issue
-> exact attachment proof
-> revision-scoped GitHub media
-> immutable commit pin for PDF and thumbnail
-> governed queue
-> live Notion gate
-> owner [APPROVED LINKEDIN] issue
-> final pre-mutation Notion recheck
-> Buffer intent + provider write + durable acceptance
-> separate publication verifier
```

Transport, exact-media readiness, Buffer acceptance and LinkedIn publication are separate states.

## Transport

```text
FROM: tripletwochelston@gmail.com
TO: hello@222emails.com
SUBJECT: TTE LINKEDIN PDF INTAKE <id>
ATTACHMENT: <exact final PDF filename>
```

The IMAP bridge does not trust MIME labelling as the PDF identity. Mail clients may use `application/pdf` or a generic binary type. The authoritative checks are exact filename, byte count, `%PDF-` signature and SHA-256.

## Owner intake issue

Title:

```text
[IMAP PDF INTAKE] <id>
```

Required shape:

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
    "title": "<single-line title>",
    "documentTitle": "<single-line document title>",
    "category": "buyer_diagnostics",
    "funnelStage": "mof",
    "targets": ["secondary"],
    "mode": "schedule",
    "scheduledAt": {"secondary": "<ISO with Z or explicit UTC offset>"},
    "copy": {"default": "<exact approved caption>"},
    "mediaAlt": "<carousel description>",
    "expectedSha256": "<same SHA-256>",
    "publicMediaApproved": true,
    "publicReleaseMaterialApproved": true,
    "sourceUrl": "https://app.notion.com/<concrete-page-id>"
  }
}
<!-- INTAKE_CONFIG_END -->
```

Do not include chunks, arbitrary download URLs, raw PDF bytes or secrets in the issue.

## Locked validation contract

The canonical IMAP route fails closed unless:

- issue is created by the repository owner
- title prefix and ID are exact
- exactly one config block exists
- sender and subject are exact
- filename is a plain PDF filename
- bytes, pages and SHA-256 are valid
- schema version is 1
- revision is a positive integer
- title and document title are single-line header-safe values
- category and funnel stage are header-safe slugs when present
- only `copy.default` exists
- caption is 1 to 3,000 characters
- caption contains no em dash
- caption contains no reserved LinkedIn target-section marker, including whitespace-padded forms
- exactly one target exists
- exactly one schedule key exists and matches that target
- mode is `schedule`
- schedule contains an explicit offset or `Z`
- schedule is more than ten minutes away and no more than 90 days ahead
- `publicMediaApproved` is true
- `publicReleaseMaterialApproved` is true
- `sourceUrl` contains a concrete Notion page ID

The 90-day scheduling ceiling keeps canonical approvals safely inside the current 120-day publication-verifier horizon.

## Public repository boundary

The repository and governed raw media URLs are public. The owner issue and queue can expose caption, schedule, target, title, Notion source URL and media identity before publication. Git history can retain those values afterwards.

Use this lane only when the media and release metadata are safe for public repository archival.

## IMAP selection

The bridge scans eligible mailboxes in its recent 72-hour window, excluding Sent, Drafts, Trash and Junk special-use mailboxes.

A candidate must match:

```text
sender
subject
filename
exact bytes
%PDF- signature
SHA-256
```

Only then is it selected and staged internally for reconstruction.

## Revision and replay safety

Media lives under:

```text
apps/linkedin-review/media/intake/<id>/r<revision>/
```

Rules:

- identical same revision is an idempotent replay
- changed same revision fails closed
- changed release material requires a higher revision

On an idempotent replay, the intake snapshots the already-governed PDF and thumbnail. Once incoming identity and queue fingerprint prove the same release, the existing governed media bytes are restored exactly before commit evaluation. Missing or drifted governed media fails closed.

This prevents PDF-thumbnail renderer changes from silently mutating a locked revision.

## Concurrency safety

Before each media/queue push, the workflow refreshes current `main`, rebuilds the deterministic mutation and retries on concurrent advancement. It never forces a stale queue snapshot over newer state.

## Immutable media proof

After promotion, both PDF and thumbnail are pinned to the same full 40-character Git commit that contains those files.

The public pinned URLs are then fetched and verified again:

- PDF bytes
- PDF SHA-256
- PDF page count
- PDF type/signature
- thumbnail bytes against the promoted local thumbnail
- thumbnail SHA-256 against the promoted local thumbnail
- thumbnail image type

`[PDF INTAKE READY] <id>@<revision>` proves exact media and queue readiness only.

## Notion gate

For governed PDF intake, the live source page must remain active and must pass:

- not archived
- not in trash
- Content Decision = Keep
- Approval = Approved
- Anti-DNA pass
- Asset Ready
- Automation Ready
- automation-capable status, not Manual
- permitted Buffer state
- Final Copy exact-match to locked caption
- Publish Payload exact-match to locked caption
- exactly one target and schedule
- Scheduled At exact instant match

The production Buffer release checks this during planning and again immediately before each provider write.

## Owner approval and Buffer release

After `[PDF INTAKE READY]`, create the owner approval:

```text
[APPROVED LINKEDIN] <id>@<revision>
```

It must exactly match the current queue revision, target, schedule, caption, immutable media URLs, document metadata, byte count and SHA-256.

Before Buffer mutation, all selected media is remotely preflighted. A durable `BUFFER_DISPATCH_INTENT` is written before the provider write. When Buffer returns a post ID, `BUFFER_ACCEPTED` is written to the trusted durable ledger first and then mirrored to the approval issue.

Accepted placement keys are idempotent. Unresolved intent keys block automatic recreation.

## Intent reconciliation

The owner-gated `[RECONCILE LINKEDIN BUFFER INTENTS]` workflow is read-only toward Buffer and shares the release concurrency lock.

For an unresolved intent, it can adopt exactly one Buffer post in `scheduled`, `sent` or `error` state only when channel, due instant, caption digest and media asset source all match the locked placement. For text-only posts it requires no media source.

Zero or multiple matches remain blocked.

## Publication verification

Buffer acceptance is not publication proof.

The separate verifier uses the accepted Buffer ID. If the approval-issue acceptance comment was lost after the durable ledger write, it can recover that ID from the trusted ledger by mapping the dispatch-intent placement key to exactly one governed approval issue.

Only Buffer `sent` with `sentAt` becomes publication verified. Buffer `error` is failure. A late unresolved state remains UNKNOWN/pending.

## Retired routes

`.github/workflows/linkedin-pdf-intake.yml` and `.github/workflows/linkedin-pdf-share-now.yml` are retired compatibility surfaces. They must not reconstruct, schedule or publish PDFs.

Do not create a parallel manifest, immediate-share or arbitrary-download production lane.

## Definition of complete

A canonical PDF revision is complete only when exact attachment identity is proven, revision-scoped media is promoted, replay rules pass, PDF and thumbnail are immutably pinned and publicly reverified, the active Notion source passes both quality checks, owner approval exactly matches the queue, Buffer acceptance is durably recorded, and the later verifier independently proves the LinkedIn outcome.
