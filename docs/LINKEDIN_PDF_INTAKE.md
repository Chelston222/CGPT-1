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
-> revision-scoped private GitHub source media
-> immutable commit pin for PDF and thumbnail
-> governed queue
-> provider-safe media promotion
-> optional live Notion defence when GitHub credential exists
-> owner [APPROVED LINKEDIN] issue
-> exact current-queue fingerprint lock
-> optional final pre-mutation Notion recheck when credentialed
-> Buffer intent + provider write + durable acceptance
-> separate publication verifier
```

Transport, exact-media readiness, owner approval, Buffer acceptance and LinkedIn publication are separate states.

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

## Private operations / public media boundary

The operations repository is private. Queue state, captions, schedules, source URLs, automation logic and audit metadata are internal.

Provider-facing media is a separate transport surface. Only exact approved binaries may be promoted there. The preferred dedicated public-media repository is `Chelston222/222emails-public-media`; a capability-gated media bridge may be used when separately verified. No operating code, prompts, AI/tooling metadata, queue state or approval logic belongs on the public media surface.

The legacy fields `publicMediaApproved` and `publicReleaseMaterialApproved` remain schema-compatible acknowledgements that the exact release asset is safe to expose to the delivery provider. They do not authorise public archival of internal operational metadata.

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

## Immutable private source proof and provider export

After promotion, PDF and thumbnail are pinned to the same full 40-character Git commit containing the exact source bytes.

The intake verifies those private source bytes locally against locked byte count, SHA-256, page count and thumbnail identity.

`[PDF INTAKE READY] <id>@<revision>` proves exact private-source media and queue readiness only. It is **not** Buffer-ready while the queue still points to a private operations URL.

Before owner Buffer approval, the exact PDF and thumbnail must be promoted to a provider-safe media surface and the governed queue must advance to a revision that locks those provider-facing URLs without changing the approved bytes.

## Notion operating record and optional live gate

The Notion source page remains the operational calendar and audit record. It should remain active and release-ready:

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

If GitHub has `NOTION_API_KEY`, production checks this during planning and again immediately before each provider write. A failing live gate blocks release.

If that secret is absent, the standalone Notion preflight reports `SKIPPED_NO_SECRET` and production records `owner-approved-current-queue-no-notion-secret`. It then relies on exact current-queue fingerprinting plus repository-owner approval and must not claim a live Notion pass.

In no-secret mode, changing only Notion is not a guaranteed machine revocation mechanism. Revoke by withdrawing the owner approval or changing the governed queue revision.

## Owner approval and Buffer release

After `[PDF INTAKE READY]`, create the owner approval:

```text
[APPROVED LINKEDIN] <id>@<revision>
```

It must exactly match the current queue revision, target, schedule, caption, provider-safe media URLs, document metadata, byte count and SHA-256. Raw URLs from the private operations repository are never valid provider release URLs.

`BUFFER_API_KEY` is mandatory. Before Buffer mutation, all selected media is remotely preflighted. A durable `BUFFER_DISPATCH_INTENT` is written before the provider write. When Buffer returns a post ID, `BUFFER_ACCEPTED` is written to the trusted durable ledger first and then mirrored to the approval issue.

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

A canonical PDF revision is production-ready only when exact attachment identity is proven, revision-scoped private source media is promoted, replay rules pass, PDF and thumbnail are immutably pinned, exact approved binaries are promoted to a provider-safe media surface, owner approval exactly matches that provider-ready queue revision, Buffer acceptance is durably recorded, and the later verifier independently proves the LinkedIn outcome. If the optional GitHub Notion credential is configured, its live quality checks must also pass. If it is absent, the audit must explicitly state the owner-approved current-queue fallback rather than implying Notion was checked.
