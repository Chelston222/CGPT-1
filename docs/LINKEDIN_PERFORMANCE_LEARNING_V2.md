# LinkedIn Performance Learning V2

## Purpose

The LinkedIn content system should learn from what actually happens after publication without confusing stale analytics, tiny samples or vanity engagement for commercial truth.

The system therefore separates five jobs:

1. Publication truth
2. Analytics evidence quality
3. Performance learning
4. Commercial attribution
5. Replenishment recommendation

No layer is allowed to manufacture truth for the next one.

## Evidence contract

A placement can influence the winner model only when:

- Buffer acceptance exists for the exact post/revision/destination.
- Independent publication verification exists for the exact Buffer post ID.
- The post is at least 24 hours old.
- Buffer exposes a usable analytics snapshot.
- The analytics refresh timestamp is at least five minutes after the due/publication time.

Snapshots that predate publication are excluded rather than interpreted as zero performance.

The daily learning report lists every exclusion reason.

## Statistical safeguards

### Small-sample shrinkage

Observed engagement is pulled towards the current median when impressions/reach are small. A high percentage on a tiny audience cannot dominate the model simply because the denominator is small.

### Final-score confidence

The complete evidence score is also shrunk towards a stable prior. This prevents a second route by which tiny samples could still dominate.

### Recency decay

Evidence has a 28-day half-life. Older posts still contribute, but current audience behaviour matters more.

### Hierarchical channel learning

Personal, Main 222Emails and Retention School each receive a local model. Local evidence is blended with the combined model until the account reaches enough mature records to stand on its own. Three local posts cannot abruptly replace the broader evidence base.

### Day and time learning

The model learns:

- day of week
- hour in Europe/London
- day + hour slot

These are supporting signals, not deterministic scheduling rules.

## Content fatigue controls

Before recommending a future candidate, the learner compares it with recently measured posts from the same account.

It penalises:

- high textual similarity
- repeated recent categories
- repeated primary content traits

This is intentionally separate from within-batch diversity. A batch can be internally varied and still feel repetitive compared with the previous fortnight.

## Quality floor

Empty Buffer capacity is not a reason to publish weak content.

Normal exploit/adjacent recommendations must clear the configured candidate score floor. Exploration has a slightly lower floor because novelty necessarily carries more uncertainty.

If a queue is below target but all candidates are below the floor, the report creates a quality-preserving bank gap. The correct response is better content, not forced publishing.

## Exploration

Target mix:

- 60% exploit proven patterns
- 25% adjacent tests
- 15% deliberate exploration

Exploration exists to prevent premature convergence and discover new winning categories, hooks and formats.

## Commercial outcomes

The true primary metrics are defined in `apps/linkedin-review/distribution-policy.json`:

- qualified conversations
- qualified Revenue Recovery Checks
- paid progression
- attributable revenue where defensible

Supporting engagement metrics remain useful because commercial signals are sparse and delayed.

### Recording an outcome

Create a repository-owner issue beginning:

`[LINKEDIN OUTCOME]`

Body schema:

```text
SOURCE_ISSUE: 123
BUFFER_ID: abc123
TYPE: dm
COUNT: 1
VALUE_GBP:
NOTE: optional context
```

Allowed types:

- `dm`
- `reply`
- `enquiry`
- `fit_check`
- `qualified`
- `proposal`
- `paid`

`VALUE_GBP` is optional. When present, `COUNT` must be 1 so revenue cannot be multiplied ambiguously.

The capture workflow refuses attribution unless the supplied Buffer ID is independently publication-verified by the trusted publication verifier on the supplied source issue.

Commercial markers are then attached to the source issue and become available to the next learning pass.

## Scoring priority once commercial evidence exists

Commercial outcomes can contribute up to 50% of observed performance scoring.

This is intentional. A post that creates a qualified conversation or paid progression should be able to outrank a post that merely generates reactions.

## Account roles

### Chelston personal

Primary job: founder trust, authority, conversation and acquisition.

Use founder stories only when they are real. Never manufacture a story to fill a slot.

### Main 222Emails

Primary job: company proof, Revenue Recovery category education, systems, resources and route clarity.

Do not mirror personal-profile copy verbatim.

### Retention School

Primary job: free retention education, curriculum, resources and audience compounding.

Every post must teach, diagnose or provide a reusable resource. It is not an overflow channel.

## What the learner may do

- read verified historical evidence
- rank QA-eligible future content
- report content-bank gaps
- report current winning categories, traits and time windows
- down-rank fatigue and repetition
- use verified commercial outcomes

## What the learner may not do

- publish
- reschedule
- invent approval
- infer publication from Buffer acceptance
- fabricate private LinkedIn metrics
- fabricate DMs, enquiries or revenue
- fill capacity with sub-floor content

The owner approval gate, Buffer capacity gate, publication verifier and Content OS Green Gate remain authoritative.
