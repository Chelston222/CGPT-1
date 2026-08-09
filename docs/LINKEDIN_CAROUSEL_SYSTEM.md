# 222 Emails LinkedIn carousel system

## Decision

Use the promoted `Autonomous Carousel Drafts` library as the visual source of truth for LinkedIn document posts. Do not redraw the slides inside the Content Swiper and do not treat a cover preview as the publishable asset.

The review queue owns scheduling intent, approval state and the immutable link to a carousel library ID. The local carousel folders remain the editorial masters. A publishable LinkedIn asset is a flattened six-page PDF made only from the six promoted PNGs, visually verified against those PNGs and stored at a stable HTTPS URL.

## Verified inventory on 9 August 2026

- 26 continuous promoted carousel folders, IDs `005` through `030`
- 156 PNG renders: exactly six slides per folder
- 26 `carousel-plan.md` files
- 26 `quality-gate.md` files
- approximately 354 MiB of promoted PNGs
- latest completed set: `030 - A Lapsed Client Does Not Need the Same Email as a First-Time Visitor`

Representative benchmark and recent renders were visually inspected. They preserve the locked cream, navy and orange editorial system, large mobile-readable typography and concrete visual explanations. They are materially stronger than generic placeholder cards and should become a regular audience-building format.

## Queue matches now recorded

| Queue post | Promoted source | Current media state |
| --- | --- | --- |
| `tte-li-002` | `028 - Your Booking Reminder Cannot Do the Job of a Rebooking Email` | PDF required |
| `tte-li-005` | `015 - Fix Retention Before You Buy More Leads` | PDF required |
| `tte-li-013` | `017 - 4 Places Rebooking Opportunity Hides Inside Your Client List` | PDF required |

The match is visible in the Content Swiper. YES is disabled until the PDF is verified. The weekly server preflight independently rejects the same item if its PDF is missing, so a carousel cannot silently become a text-only post.

## Publishing contract

LinkedIn and Buffer support one PDF document per LinkedIn post, up to 100 MB and 300 pages. A document title is required in Buffer. LinkedIn recommends converting to PDF for fidelity, flattening layered PDFs and keeping every page the same size.

Before changing a carousel from `pdf_required` to `ready`:

1. Free disk space must be at least 3 GiB under the carousel production guardrail.
2. Assemble only the promoted six PNGs, in numerical slide order, into one flattened PDF.
3. Confirm six same-size pages, a file size below 100 MB and no unexpected metadata or extra pages.
4. Visually compare every PDF page with its promoted source PNG.
5. Record source slide hashes, PDF hash, library ID, document title and HTTPS URL.
6. Validate the exact Buffer document payload in non-publishing mode.
7. Run Buffer saved-item tests for personal, main, secondary and a combination.
8. Set `carousel.readiness` to `ready` only after every check passes.

The present Buffer automation has a validated single-image payload, not a validated document payload. It must not guess a GraphQL field from the Buffer composer. Until the document mutation has passed non-publishing tests, the carousel stays reviewable but unapprovable.

## Recommended publishing mix

Start with three document/carousel posts per ten feed posts for a six-week test because the library is already deep and visually distinctive. Keep the remaining seven posts as concise founder text, proof visuals, buyer diagnostics and occasional native video. A carousel must earn its slot by explaining a framework, comparison, route or teardown that is easier to understand visually; do not turn every thought into six slides.

Track qualified comments, saves, profile or Page visits, target-role engagement, enquiries and influenced opportunities by channel and format. Buffer currently does not provide LinkedIn PDF-carousel analytics, so record post-level results from LinkedIn itself before changing the mix.

## Current blocker

The live storage preflight found only 902 MiB free. The carousel rules require at least 3 GiB before starting image-heavy packaging or generation, so no PDF was created and no carousel manifest, topic ledger or numbered production folder was changed. This is a deliberate fail-closed result, not unfinished production presented as success.

## Sources

- [Buffer: Using LinkedIn with Buffer](https://support.buffer.com/article/560-using-linkedin-with-buffer)
- [Buffer: Scheduling posts](https://support.buffer.com/article/642-scheduling-posts)
- [LinkedIn: Upload and share documents](https://www.linkedin.com/help/linkedin/answer/a519831)

