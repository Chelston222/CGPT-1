# LinkedIn review, GitHub approval and Buffer scheduling

## What this system does

The mobile review desk presents the scheduled 222 Emails queue. Chelston presses YES or NO after reviewing the category, destination, time, copy and media. A rejection returns the item for revision. An approval opens a pre-filled GitHub record; only Chelston's final submission of that record can start the Buffer workflow.

Buffer can save a draft, add to a queue or schedule for:

- Chelston's personal LinkedIn profile
- Main 222 Emails LinkedIn page
- Secondary TTE LinkedIn page
- Explicit combinations of those destinations

The interface and repository never contain Buffer credentials.

## Live components

- Review desk: `apps/linkedin-review/`
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

1. Codex drafts, checks and adds a post to the review queue.
2. Chelston opens the mobile review desk.
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

`TARGETS` accepts `personal`, `main`, `secondary` or comma-separated combinations. Legacy `business`, `both` and `all` remain supported. `MODE` accepts `schedule`, `queue` or `draft`. A public HTTPS `MEDIA_URL` is optional.

## Safety behaviour

- Only a newly opened issue beginning `[APPROVED LINKEDIN]` can trigger the workflow.
- The issue author must be the repository owner.
- Draft mode always uses Buffer's `saveToDraft: true` and cannot schedule.
- Rejected issues do not match the trigger.
- Posts over 3,000 characters fail validation.
- Schedules must be valid future ISO date/times.
- Media must use HTTPS.
- All inputs are preflighted before the first Buffer mutation.
- Buffer cannot provide an atomic transaction across channels. If a later network/API call fails, every earlier Buffer post ID is recorded and the issue warns against a blind retry.
- Buffer acceptance proves draft/queue/schedule creation, not LinkedIn publication. Publication needs separate evidence.

## Activation status — 9 August 2026

- Personal draft validation passed in issue #5.
- Main 222 Emails draft validation passed in issue #6.
- The mobile review desk, initial 18-post queue and three-channel workflow are implemented.
- The `BUFFER_LINKEDIN_SECONDARY_CHANNEL_ID` secret must be present before secondary and combination draft validation can pass.
- No scheduled or live post has been approved by this build.
