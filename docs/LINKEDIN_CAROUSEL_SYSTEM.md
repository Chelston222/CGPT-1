# 222Emails LinkedIn carousel system

## Decision

Use the promoted `Autonomous Carousel Drafts` library as the visual source of truth for LinkedIn PDF/document posts. Do not redraw promoted slides inside the Content Swiper and do not treat a cover preview as the publishable asset.

The review queue owns scheduling intent, approval state and the immutable link to a carousel library ID. The local carousel folders remain the editorial masters. A publishable LinkedIn asset is a flattened PDF made from the promoted slides, visually verified against those slides and hosted at a stable public HTTPS URL.

## Verified carousel state

The historical statement that the Buffer document mutation was unvalidated is obsolete. Current queue records include real verified carousel packages and the Buffer document scheduling route has already returned accepted Buffer post IDs.

Confirmed current examples include:

| Queue post | Promoted source | Verified state |
| --- | --- | --- |
| `tte-li-002` | `028 - Your Booking Reminder Cannot Do the Job of a Rebooking Email` | `ready`; 6 pages; 6,391,783 bytes; SHA-256 locked |
| `tte-li-005` | `015 - Fix Retention Before You Buy More Leads` | `ready`; 6 pages; 5,187,344 bytes; SHA-256 locked |

Do not infer the state of another carousel from this table. Each queue revision must carry its own current readiness and immutable media metadata.

## Publishing contract

LinkedIn/Buffer document posts use one PDF document asset. The 222Emails release path enforces the current operational limits conservatively:

- HTTPS media only
- PDF content type must be `application/pdf`
- no more than 100,000,000 bytes
- no more than 300 pages
- document title required
- public thumbnail required by the current bridge
- declared page count required
- verified byte count and SHA-256 required for ready queue carousels

Before any Buffer mutation, the hardened media preflight downloads the approved PDF, checks the final URL and MIME type, counts the bytes and recomputes the SHA-256. If the hosted file changed after approval, dispatch fails closed.

The thumbnail is independently checked as a valid image asset. A broken CDN URL, redirect to an HTML error page, oversized file or changed PDF cannot silently reach the Buffer mutation.

## Packaging and readiness gate

Before changing a carousel to `ready`:

1. Assemble only the promoted slides, in intended order, into one flattened PDF.
2. Confirm consistent page dimensions and no accidental extra pages.
3. Confirm the PDF remains below the document byte/page limits.
4. Visually compare every PDF page with its promoted source.
5. Record source/library ID, slide count, PDF byte count, PDF SHA-256, document title, stable HTTPS PDF URL and public thumbnail URL.
6. Verify that the queue revision points to exactly those immutable values.
7. Pass static/unit tests for the document payload and the remote media integrity gate.
8. Do not label Buffer acceptance as publication. The post-publication verifier must later confirm Buffer state `sent` and `sentAt`.

A carousel with missing readiness, URL, thumbnail, page count, byte count or SHA-256 fails closed rather than degrading into a text-only post.

## Proof status

Two separate facts must remain separate:

**Scheduling proof:** the current PDF/document route has already been accepted by Buffer for verified carousel records. This supersedes the old `document payload unvalidated` blocker.

**Publication proof:** a returned Buffer post ID is not enough. The hardened verifier queries the exact post after its due time and records `sent`, `error` or UNKNOWN/pending. Only `sent` with `sentAt` counts as confirmed publication.

## Recommended feed role

Start the rolling content test with approximately three PDF carousels per ten strong feed posts. A carousel should earn its slot by making a framework, comparison, teardown, process or sequence easier to understand visually. Do not convert a strong one-idea native text post into six slides simply to increase the visual ratio.

The wider starting mix is documented in `LINKEDIN_CONTENT_STRATEGY_2026.md`: roughly 70% visual / 30% deliberate text-only, with real-world/photo-led and proof/single-image posts alongside carousels.

## Analytics rule

Track results by channel, format and time-window cohort. Commercial outcomes outrank vanity reach.

For PDF/document posts, retain a native LinkedIn analytics check. Buffer can expose post-level metrics for supported posts, but LinkedIn PDF-carousel analytics may be incomplete or unavailable through Buffer. When the automated analytics route cannot supply useful document metrics, the system must explicitly mark `LINKEDIN_NATIVE_ANALYTICS_REQUIRED` rather than silently treating the data as zero.

Useful fields include:

- impressions
- saves where available
- qualified/target-role comments
- relevant profile or Page visits
- DMs and enquiries
- Revenue Recovery Check progression
- influenced opportunity/revenue where attribution is defensible

## Current blocker status — 20 August 2026

The previous storage-space blocker and `PDF required` state recorded in this document are historical and must not be treated as current. Verified PDFs are already packaged and live at stable HTTPS locations for the ready queue records above.

Remaining release-gate work is different:

- pass CI on the v3 hardening branch
- run one clean, safe single-image canary without publishing a new public post unless separately approved
- regression-test a ready PDF path through the hardened preflight
- activate and observe post-publication verification against real due Buffer IDs
- capture native LinkedIn metrics where document analytics are not supplied through Buffer
- complete the final no-backlog supervisor check

Those gates are tracked in GitHub issue #159.
