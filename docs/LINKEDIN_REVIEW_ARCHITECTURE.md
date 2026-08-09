# LinkedIn Master Ledger, review and Buffer release

## Architecture decision

The private **Master LinkedIn Ledger** at `../work/master-linkedin-ledger.json` is the canonical inventory for every LinkedIn draft, imported candidate and operational post. It currently reconciles the Mac archive, the Notion calendar and the checked review queue. It stays outside the deployed site because it retains private paths and unreleased copy.

`apps/linkedin-review/queue.json` is the checked, live-ready projection shown in the Content Swiper. GitHub Issues are the authenticated owner-approval and dispatch audit. Notion remains the private strategy, archive and reusable-content reference; its historic Approved field is never permission to publish. This avoids a fragile two-way write while preserving Notion's editorial value.

New copy must enter the Master Ledger before QA or scheduling:

```text
node scripts/add-linkedin-master-post.mjs --input /absolute/path/to/post.json
```

The input requires `id`, `title` and `content`; it may include `category` and `source`. Intake is deduplicated and fail-closed, creates a non-publishable draft and never changes the Swiper. After QA, a new immutable revision is promoted into `queue.json`, then the master and public integrity manifest are rebuilt:

```text
node scripts/build-linkedin-master-ledger.mjs
```

## Human-first approval path

1. A fully checked post enters the Swiper projection with exact copy, channel targets, scheduled times and media.
2. `Next` navigates only. YES/NO is stored on that device and automatically advances to the next item. NO never contacts Buffer.
3. A carousel may receive an editorial YES while its slide preview is visible, but weekly sending remains locked until a publishable PDF and document title pass server validation.
4. Once every item in the selected week is decided, Chelston opens one prefilled GitHub issue and submits it while signed in. This owner action is the explicit approval gate.
5. The workflow locks the queue version and every `post-id@revision`, validates all destinations and schedules, and checks Buffer's live occupancy before creating anything.
6. Buffer acceptance is recorded per post revision and channel. It is not treated as proof that LinkedIn published the post.

No Buffer key or GitHub token is exposed in the browser.

## Buffer Free capacity model

Snapshot verified 9 August 2026 from Buffer's official documentation:

- three connected channels;
- 10 scheduled posts per channel at one time (30 total), not 10 per day;
- one API key, 100 requests per 15 minutes, 250 per day and 3,000 per 30 days;
- one PDF document per LinkedIn post, maximum 100 MB and 300 pages, with a required document title; the API additionally requires a public thumbnail URL;
- Buffer does not provide PDF carousel analytics.

The editorial ceiling is **10 account placements per calendar day across all three accounts**, maximum 70 per week. A single post targeting three accounts consumes three placements. This protects audience quality and makes the load explicit; it does not claim Buffer can hold the full week simultaneously.

The approved week remains locked in GitHub while a capacity window releases only what fits. The workflow rechecks every four hours, fills each channel chronologically up to 10, and resumes automatically as slots open. Previously accepted `post@revision:channel` markers prevent duplicate submission. A concurrency lock prevents two release runs racing.

## Failure and recovery matrix

| Scenario | Result |
| --- | --- |
| Buffer channel has 10 scheduled items | Item waits in the approved ledger; no failed or duplicate submission |
| Approval event repeats or a run restarts | Accepted destination markers are skipped |
| One destination succeeds, next fails | Success is recorded per channel; retry skips it |
| HTTP 429, 5xx or temporary Buffer failure | Issue stays approved and open for the next automatic check |
| Channel authorisation is lost | Dispatch fails closed and requires manual reconnection/new revision |
| PDF/title missing or media rejected | Weekly preflight or dispatch fails closed; no text-only fallback |
| Scheduled time is within five minutes or has passed | No creation; revise the schedule and explicitly approve the new revision |
| More than 10 account placements on one date | Entire weekly batch is rejected before Buffer is contacted |
| Queue/master manifest IDs disagree | Swiper refuses to load the projection |
| Historic Notion item says Approved | It still re-enters QA and Chelston review; never auto-publishes |
| Channel is removed from Buffer | Buffer history/queue can be lost; reconnect rather than remove during recovery |

Capacity-wait comments are deduplicated so the four-hour check does not spam the issue. The system can fail safely and recover deterministically; it cannot guarantee Buffer or LinkedIn uptime.

## States

`draft` → `live_ready` → `review` → `approved` → `scheduled` → `published`

`review` may become `rejected`; any dispatch can become `failed`. Every transition keeps the immutable post ID/revision, time and evidence. Only separate publication evidence may set `published`.
