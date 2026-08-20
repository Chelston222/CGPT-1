# 222Emails LinkedIn review, approval and Buffer scheduling

## What this system does

The mobile Content Swiper presents LinkedIn content for human review across the configured destinations. A saved YES/NO decision is review state only. It is never permission to publish. Only a repository-owner GitHub issue beginning `[APPROVED LINKEDIN WEEK]` or `[APPROVED LINKEDIN]` can start the Buffer dispatch path.

The system supports:

- Chelston personal LinkedIn profile
- Main 222Emails LinkedIn Page
- 222Emails | Retention Lab
- Explicit combinations of those destinations
- Text-only posts
- Single-image posts
- LinkedIn PDF/document posts

The repository and review UI do not contain Buffer credentials.

## Live components

- Content Swiper: `apps/linkedin-review/`
- Scheduled queue: `apps/linkedin-review/queue.json`
- Approval/dispatch workflow: `.github/workflows/linkedin-buffer-autopost.yml`
- Publication/analytics verifier: `.github/workflows/linkedin-publication-verifier.yml`
- Read-only Buffer queue diagnostic: `.github/workflows/buffer-usage-check-once.yml`
- Media integrity preflight: `scripts/linkedin-media-preflight.cjs`
- Core request/mutation builder: `scripts/linkedin-review-core.cjs`
- Weekly lock/validation: `scripts/linkedin-week-batch.cjs`
- Approval template: `.github/ISSUE_TEMPLATE/approved-linkedin-post.md`
- Rejection template: `.github/ISSUE_TEMPLATE/rejected-linkedin-post.md`

## Repository secrets

Store these only in `Settings → Secrets and variables → Actions`:

- `BUFFER_API_KEY`
- `BUFFER_LINKEDIN_PERSONAL_CHANNEL_ID`
- `BUFFER_LINKEDIN_BUSINESS_CHANNEL_ID`
- `BUFFER_LINKEDIN_SECONDARY_CHANNEL_ID`
- `NOTION_API_KEY` where the live Notion quality gate is used

Never paste API keys into an issue, chat, Notion page or repository file.

## Human approval flow

1. A candidate post enters the current review queue with a stable ID and revision.
2. Chelston reviews destination, time, copy and media in the Content Swiper.
3. YES/NO saves review state only. NO never contacts Buffer.
4. The weekly hand-off remains disabled until every item in scope has a decision and at least one item is YES.
5. The hand-off creates one owner-controlled approval record containing locked `post-id@revision` references.
6. GitHub validates queue schema, queue generation state, revision, destinations, credentials, schedule, copy, quality state and media metadata before Buffer can be mutated.
7. All media selected for that dispatch plan is remotely fetched and checked **before the first Buffer mutation**. The preflight verifies HTTPS, final URL, HTTP success, expected content type, file size, and where supplied, approved byte count and SHA-256.
8. PDF/document posts additionally require a document title, thumbnail and page count. Current guardrails reject more than 300 pages or more than 100,000,000 bytes.
9. Image posts require useful `ALT_TEXT` and are rejected above 10,000,000 bytes. The alt text is carried into Buffer's image metadata.
10. Buffer acceptance records the returned Buffer post ID for every successful destination. Partial batches preserve accepted-destination idempotency and do not blindly recreate successful destinations.
11. **Buffer acceptance is not publication proof.** After the due time, the publication verifier queries the exact Buffer post ID. Only Buffer state `sent` with `sentAt` is recorded as verified publication. Buffer state `error` is recorded as failed. A post still unresolved more than 30 minutes after due time is marked UNKNOWN/pending and surfaced for review.
12. Post-level metrics are collected when Buffer exposes them. PDF/document posts retain a native LinkedIn analytics requirement because Buffer carousel analytics may be incomplete or unavailable.

## Supported single-post fields

Text-only example:

```text
POST_ID: tte-li-013
REVISION: 1
CATEGORY: buyer_diagnostics
TARGETS: personal,main
MODE: schedule
SCHEDULE_AT_PERSONAL: 2026-09-01T16:00:00+01:00
SCHEDULE_AT_MAIN: 2026-09-02T17:00:00+01:00
---
Fallback copy
---PERSONAL---
Founder-led version
---MAIN---
Company-page version
```

Single-image additions:

```text
MEDIA_URL: https://example.com/visual.png
MEDIA_KIND: image
ALT_TEXT: Clear description of the visual and its useful meaning
MEDIA_BYTES: 845221
MEDIA_SHA256: <64-character SHA-256 when the media is locked>
```

PDF/document additions:

```text
MEDIA_URL: https://example.com/carousel.pdf
MEDIA_KIND: document
DOCUMENT_TITLE: Five places repeat revenue quietly leaks
DOCUMENT_THUMBNAIL_URL: https://example.com/carousel-cover.jpg
DOCUMENT_PAGE_COUNT: 6
MEDIA_BYTES: 5187344
MEDIA_SHA256: <64-character SHA-256>
```

`TARGETS` accepts `personal`, `main`, `secondary` or comma-separated combinations. Legacy `business`, `both` and `all` aliases remain supported.

## Schedule integrity

- `Europe/London` is the operating timezone.
- A schedule must be a valid future ISO date/time.
- The live release path rejects an approved time if it is within five minutes of dispatch or already passed.
- Existing owner-approved schedules must never be silently moved. A change in time requires a new approved revision.
- New, unapproved inventory should use the current later-day testing policy in `LINKEDIN_CONTENT_STRATEGY_2026.md` rather than mechanically reproducing the historical morning-heavy queue.
- Existing per-channel and account capacity guards remain active.

## Failure classes and recovery

The system fails closed rather than guessing. Operational failures should be distinguishable as:

- approval/revision/queue preflight
- quality gate
- media URL/type/size/hash preflight
- Buffer authentication/channel access
- Buffer capacity
- Buffer mutation
- publication verification
- analytics unavailable/native analytics required

A successful Buffer destination is never recreated simply because another destination failed later. A failed or unknown publication must not be counted as published.

## Current verified state — 20 August 2026

- Personal, main and secondary Buffer channel routing is configured.
- Weekly approval and capacity-release logic is live and has returned real Buffer post IDs.
- Verified six-page PDF assets exist in the queue for current carousel records such as `tte-li-002` and `tte-li-005`.
- The PDF/document scheduling path has already been accepted by Buffer. The old statement that the document mutation was unvalidated is superseded.
- A fresh read-only queue diagnostic on 20 August 2026 reported 24 scheduled LinkedIn posts, eight per configured destination, zero past-due scheduled posts and complete pagination.
- The hardened branch adds immutable media preflight, image alt-text enforcement, independent post-publication verification, sent/error/UNKNOWN states and an analytics/native-analytics learning loop.
- A clean single-image end-to-end canary remains an explicit release-gate item. It must be executed safely and must not be confused with permission to publish a new public LinkedIn post.

## Release rule

Do not call the system fully watertight merely because code exists. The v3 hardening release gate remains open until CI passes, the safe image canary succeeds, the current PDF path is regression-tested, publication verification produces real post-publication evidence, documentation matches the implementation and the final supervisor check reports no unexplained backlog.
