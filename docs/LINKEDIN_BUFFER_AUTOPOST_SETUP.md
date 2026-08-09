# LinkedIn review, GitHub approval and Buffer scheduling

## What this system does

The mobile Content Swiper presents one scheduled week at a time across all three LinkedIn accounts. Chelston presses YES or NO after reviewing the category, destination, time, copy and media. Each choice is saved on that device and the next post appears automatically. When the week is complete, one GitHub record carries only the YES selections; only Chelston's final submission can start the Buffer workflow.

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
- Weekly trigger title prefix: `[APPROVED LINKEDIN WEEK]`
- Single-post fallback prefix: `[APPROVED LINKEDIN]`

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
3. YES or NO saves locally and immediately advances to the next undecided item in the selected week. NO never contacts Buffer. **Next** moves to another card without saving any decision or changing the weekly hand-off.
4. The weekly hand-off stays disabled until every review item has a decision and at least one item is YES.
5. “Send approved week” opens one compact `[APPROVED LINKEDIN WEEK]` record containing locked `post-id@revision` references, not the full post copy.
6. Chelston checks the weekly summary and submits the issue while signed into GitHub.
7. GitHub checks the exact queue version, every post revision, destination, secret, time, copy variant and media URL for the complete week before the first Buffer request.
8. A carousel is not eligible for YES or weekly dispatch until its promoted six-slide source has a verified publishable PDF. Missing media fails closed instead of producing a text-only post.
9. The issue records every returned Buffer post ID and closes only after every requested destination succeeds.
10. Failure or partial success leaves the issue open with exact recovery information. Never retry a partial batch blindly.

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

- Only a newly opened issue beginning `[APPROVED LINKEDIN WEEK]` or the single-post fallback `[APPROVED LINKEDIN]` can trigger the workflow.
- The issue author must be the repository owner.
- Local YES/NO choices cannot contact Buffer and persist across refreshes on the same device.
- A queue version or revision change invalidates the affected saved approval.
- NO selections are excluded from the batch and do not match either trigger.
- Posts over 3,000 characters fail validation.
- Schedules must be valid future ISO date/times.
- Media must use HTTPS.
- All inputs are preflighted before the first Buffer mutation.
- Buffer cannot provide an atomic transaction across channels. If a later network/API call fails, every earlier Buffer post ID is recorded and the issue warns against a blind retry.
- Buffer acceptance proves queue or schedule creation, not LinkedIn publication. Publication needs separate evidence.

## Activation status — 9 August 2026

- Personal, main and secondary routing checks passed before activation.
- Every two-channel combination and the three-channel combination passed before activation.
- The mobile Content Swiper, initial 18-post queue and three-channel workflow are implemented.
- `BUFFER_LINKEDIN_SECONDARY_CHANNEL_ID` is securely configured.
- No scheduled or live post has been approved by this build.
