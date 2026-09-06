# 222Emails LinkedIn PDF intake

## Purpose

This is the canonical intake path for 222Emails LinkedIn PDF and document carousels produced outside GitHub. It preserves exact media identity, keeps publication authority separate from transport, and fails closed when any locked field drifts.

The canonical route is:

```text
final approved PDF + final approved caption
-> authorised Gmail transport from tripletwochelston@gmail.com
-> hello@222emails.com
-> PrivateEmail IMAP
-> repository-owner [IMAP PDF INTAKE] issue
-> exact attachment verification
-> governed GitHub queue and media package
-> immutable Git commit media pin
-> live Notion quality gate
-> repository-owner [APPROVED LINKEDIN] gate
-> Buffer
-> separate publication verification
```

Transport, intake, Buffer acceptance and LinkedIn publication are different states. Never treat one as proof of the next.

## Canonical transport

Send the exact final PDF using:

```text
FROM: tripletwochelston@gmail.com
TO: hello@222emails.com
SUBJECT: TTE LINKEDIN PDF INTAKE <id>
ATTACHMENT: <exact final PDF filename>
```

The email only transports bytes. It is not publication authority.

## Governed intake issue

Create one repository-owner issue with title:

```text
[IMAP PDF INTAKE] <id>
```

The body must contain exactly one locked config block:

```html
<!-- INTAKE_CONFIG_START -->
{
  "id": "<id>",
  "expectedSubject": "TTE LINKEDIN PDF INTAKE <id>",
  "expectedSender": "tripletwochelston@gmail.com",
  "expectedFilename": "<exact filename.pdf>",
  "expectedSha256": "<64-character lowercase SHA-256>",
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
    "scheduledAt": {
      "secondary": "2026-09-16T08:45:00+01:00"
    },
    "copy": {
      "default": "<exact approved caption>"
    },
    "mediaAlt": "<carousel description>",
    "expectedSha256": "<same exact SHA-256>",
    "sourceUrl": "https://app.notion.com/<concrete-page-id>",
    "publicMediaApproved": true
  }
}
<!-- INTAKE_CONFIG_END -->
```

Do not place raw PDF bytes, base64 chunks, arbitrary download URLs or API keys in the issue.

## Permanent validation contract

The intake fails closed unless all of these are true:

- the issue author is the repository owner
- the title starts exactly with `[IMAP PDF INTAKE] `
- the title ID exactly matches `config.id`
- the sender is exactly `tripletwochelston@gmail.com`
- the expected subject is exactly `TTE LINKEDIN PDF INTAKE <id>`
- the filename is a plain PDF filename with no path separators or control characters
- expected SHA-256 is valid and exactly matches `manifest.expectedSha256`
- expected byte count is 1 to 100,000,000
- expected page count is 1 to 300
- `schemaVersion` is exactly 1
- revision is an explicit positive integer
- title, document title and default copy are present
- approved copy contains no em dash
- the canonical IMAP PDF route contains exactly one target
- the target is one of `personal`, `main`, `secondary`
- mode is `schedule`
- the target has a valid ISO 8601 timestamp with an explicit UTC offset or `Z`
- the schedule is more than 10 minutes in the future at intake time
- `sourceUrl` identifies a concrete Notion page
- `publicMediaApproved` is exactly `true`

The one-target rule is deliberate. The live Notion PDF gate has one authoritative `Scheduled At` field, so canonical PDF intake does not permit ambiguous multi-target scheduling.

## IMAP attachment selection

The IMAP bridge scans eligible recent mailboxes while excluding Sent, Drafts, Trash and Junk special-use mailboxes. A candidate message must match the locked sender, subject and filename.

The attachment must then match the exact expected byte count, `%PDF-` signature and SHA-256. A same-name attachment with the wrong bytes is rejected.

Verified bytes are staged internally for deterministic reconstruction. Those staging chunks are implementation detail and are not a second operator-facing intake route.

## Reconstruction and promotion

`scripts/linkedin-pdf-intake.cjs` reconstructs the verified PDF, checks bytes, SHA-256 and page count, renders the first-page thumbnail and writes the revision package under:

```text
apps/linkedin-review/media/intake/<id>/r<revision>/
```

The queue row is created or updated as `status: review`. Same-revision replay is accepted only when the release fingerprint is identical. Any changed copy, schedule, media identity or other release material requires a higher revision.

## Immutable media pin

The first promotion commit may initially produce branch-shaped raw GitHub URLs. The intake workflow then rewrites the queue media URLs to the exact 40-character Git commit that contains the promoted PDF and thumbnail.

The final governed media URL therefore has an immutable commit ref, not mutable `main`.

After pinning, the workflow downloads the exact pinned public PDF and thumbnail and verifies byte count, SHA-256, page count and file type again. The `[PDF INTAKE READY] <id>@<revision>` evidence records that immutable media commit.

Because the repository is public, promoted media is publicly reachable before LinkedIn publication. `publicMediaApproved: true` is an explicit acknowledgement of that confidentiality boundary.

## Live Notion gate

A governed PDF release must resolve to its exact Notion source page. Before Buffer release the live row must prove:

- Content Decision = Keep
- Approval = Approved
- Anti-DNA | Pass = checked
- Automation Status is release-capable and is not Manual for a governed PDF intake
- Buffer Status is Ready for Buffer or Queued in Buffer
- Asset Ready = checked
- Automation Ready = checked
- Final Copy exactly matches the locked queue caption
- Publish Payload exactly matches the locked queue caption
- Scheduled At matches the locked queue schedule

A missing `NOTION_API_KEY`, missing page, wrong page, changed copy, changed schedule or blocked readiness state fails closed.

## Repository-owner approval

`[PDF INTAKE READY]` proves exact media readiness only. Publication authority remains separate.

Only after exact-media readiness exists should a repository-owner approval issue be created:

```text
[APPROVED LINKEDIN] <id>@<revision>
```

Its request must exactly match the current locked queue revision, including target, schedule, caption, media URL, document title, thumbnail, page count, byte count and SHA-256.

Legacy issue-only release that no longer matches the queue is rejected.

## Buffer acceptance and durable idempotency

Before the first Buffer write, all approved media is remotely preflighted.

For every destination placement the release path records a durable dispatch intent before the Buffer mutation. If Buffer returns a post ID, the acceptance record is written immediately to the durable ledger and approval issue.

This protects partial releases. A placement with a durable acceptance marker is not recreated. A placement with an unresolved prior dispatch intent is also not recreated automatically.

An owner-gated intent reconciler can inspect Buffer without creating, editing or deleting posts. It repairs an unresolved intent only when exactly one scheduled Buffer post matches the locked destination, due time and caption digest. Zero or multiple matches remain blocked for explicit review.

Buffer acceptance means scheduled or accepted by Buffer. It is not publication proof.

## Publication verification

After the due time, the separate publication verifier queries the exact Buffer post ID.

Only positive `sent` evidence with a sent timestamp can move the state to publication verified. Buffer `error` is recorded as failed. Unknown or late unresolved state remains pending for review.

PDF and document posts retain a native LinkedIn analytics requirement where Buffer does not expose complete document analytics.

## Retired parallel routes

`.github/workflows/linkedin-pdf-intake.yml` and `.github/workflows/linkedin-pdf-share-now.yml` remain only as retired compatibility surfaces. They must not reconstruct, schedule or publish PDFs.

Do not invent a parallel repository-manifest, immediate share-now or arbitrary download-URL lane for production PDF publishing.

## Current implementation files

- `.github/workflows/linkedin-imap-pdf-intake.yml`
- `.github/workflows/linkedin-buffer-autopost.yml`
- `.github/workflows/linkedin-buffer-intent-reconcile.yml`
- `.github/workflows/linkedin-publication-verifier.yml`
- `scripts/linkedin-imap-intake-config.cjs`
- `scripts/linkedin-imap-intake-from-issue.mjs`
- `scripts/linkedin-imap-pdf-intake.mjs`
- `scripts/linkedin-pdf-intake.cjs`
- `scripts/linkedin-notion-quality-gate.cjs`
- `scripts/linkedin-buffer-acceptance-ledger.cjs`
- `scripts/linkedin-media-preflight.cjs`
- `apps/linkedin-review/queue.json`
- `docs/222EMAILS_LINKEDIN_PDF_CAROUSEL_ULTRA_PLAYBOOK.md`

## Definition of complete

The canonical PDF lane is complete for one revision only when the exact final PDF has been retrieved from the authorised mailbox, exact bytes/SHA/pages are verified, the revision is promoted, the media URLs are pinned to an immutable Git commit, the pinned public media re-verifies, the live Notion row matches the locked release state, the repository owner explicitly approves that current revision, Buffer acceptance is durably recorded, and the separate publication verifier later proves the LinkedIn outcome.
