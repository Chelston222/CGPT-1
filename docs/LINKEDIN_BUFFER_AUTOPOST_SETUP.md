# LinkedIn review, GitHub approval and Buffer scheduling

## What this system does

The mobile Content Swiper presents one scheduled week at a time across all three LinkedIn accounts. Chelston presses YES or NO after reviewing the category, destination, time, copy and media. A rejection returns the item for revision. An approval opens a pre-filled GitHub record; only Chelston's final submission of that record can start the Buffer workflow.

Buffer can add an approved item to a queue or schedule it for:

- Chelston's personal LinkedIn profile
- Main 222 Emails LinkedIn page
- Secondary TTE LinkedIn page
- Explicit combinations of those destinations

The interface and repository never contain Buffer credentials.

## Live components

- Content Swiper: `apps/linkedin-review/`
- Scheduled queue: `apps/linkedin-review/queue.json`
- Workflow: `.github/workflows/linkedin-buffer-autopost.yml`
- Approval template: `.github/ISSUE_TEMPLATE/approved-linkedin-post.md`
- Rejection template: `.github/ISSUE_TEMPLATE/rejected-linkedin-post.md`
- Trigger title prefix: `[APPROVED LINKEDIN]`

## Repository secrets

Store these only in `Settings → Secrets and variables → Actions`:

- `BUFFER_API_KEY`
- `BUFFER_LINKEDIN_PERSONAL_CHANNEL_ID`
- `BUFFER_LINKEDIN_BUSINESS_CHANNEL_ID`
- `BUFFER_LINKEDIN_SECONDARY_CHANNEL_ID`

Never paste the API key into a GitHub issue, chat, Notion or repository file.

## Human approval flow

1. Codex writes, checks and adds a live-ready post to the review queue.
2. Chelston opens the mobile Content Swiper.
3. NO opens a pre-filled `[REJECTED LINKEDIN]` issue. This can never trigger Buffer.
4. YES opens a plain-language confirmation sheet.
5. Continue opens a pre-filled `[APPROVED LINKEDIN]` issue.
6. Chelston checks the exact version and submits the issue while signed into GitHub.
7. GitHub validates every destination, secret, time, copy variant and media URL before the first Buffer request.
8. The issue records every returned Buffer post ID and closes only after every requested destination succeeds.
9. Failure or partial success leaves the issue open with exact recovery information.

## Supported fields

```text
POST_ID: tte-li-013
REVISION: 1
CATEGORY: buyer_diagnostics
TARGETS: personal,main
MODE: schedule
SCHEDULE_AT_PERSONAL: 2026-09-01T08:15:00+01:00
SCHEDULE_AT_MAIN: 2026-09-02T09:00:00+01:00
MEDIA_URL:
---
Fallback copy
---PERSONAL---
Founder-led version
---MAIN---
Company-page version
```

`TARGETS` accepts `personal`, `main`, `secondary` or comma-separated combinations. Legacy `business`, `both` and `all` remain supported. Live-ready queue items use `MODE: schedule` or `MODE: queue`. A public HTTPS `MEDIA_URL` is optional.

## Safety behaviour

- Only a newly opened issue beginning `[APPROVED LINKEDIN]` can trigger the workflow.
- The issue author must be the repository owner.
- The safe internal test route cannot schedule or publish.
- Rejected issues do not match the trigger.
- Posts over 3,000 characters fail validation.
- Schedules must be valid future ISO date/times.
- Media must use HTTPS.
- All inputs are preflighted before the first Buffer mutation.
- Buffer cannot provide an atomic transaction across channels. If a later network/API call fails, every earlier Buffer post ID is recorded and the issue warns against a blind retry.
- Buffer acceptance proves queue or schedule creation, not LinkedIn publication. Publication needs separate evidence.

## Activation status — 9 August 2026

- Personal, main and secondary non-publishing routing checks passed.
- Every two-channel combination and the three-channel combination passed.
- The mobile Content Swiper, initial 18-post queue and three-channel workflow are implemented.
- `BUFFER_LINKEDIN_SECONDARY_CHANNEL_ID` is securely configured.
- No scheduled or live post has been approved by this build.
