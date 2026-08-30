# Upwork Application OS

Turnkey application-prep engine for Chelston / 222Emails.

## Operating mode

Default mode: `READY_TO_SUBMIT`.

The system may discover, score, deduplicate, draft, QA and queue Upwork applications. It must not scrape Upwork, replay credentials, use headless/browser auto-clicking, or submit a proposal through unapproved automation.

`API_AUTO_SUBMIT` is locked until official Upwork API credentials with proposal-submission permission are present and the mode is explicitly enabled.

## Positioning

Headline outcome: Revenue Recovery / Client Return Systems.

Primary problems:
- unconverted enquiries
- weak lead follow-up
- cancellations and no-shows
- rebooking leakage
- dormant-client reactivation
- lifecycle gaps
- CRM/email/SMS automation

Implementation tools such as Klaviyo, Mailchimp, HubSpot, MailerLite and Make.com are supporting capabilities, not the headline.

## States

`DISCOVERED -> SCORED -> REJECTED | NEEDS_HUMAN_FACT | PROPOSAL_READY -> READY_TO_SUBMIT -> SUBMITTED -> REPLIED -> INTERVIEW -> WON | LOST | SUPPRESSED`

## Scoring

100 points total:
- positioning fit: 25
- active pain / urgency: 15
- budget / effective rate: 15
- recurring / expansion potential: 15
- client quality: 10
- competitive timing: 10
- proof match: 5
- delivery feasibility: 5

Thresholds:
- 85-100 APEX
- 75-84 STRONG
- 65-74 SELECTIVE
- below 65 REJECT

## Hard gates

Reject or stop when:
- job is closed
- duplicate job URL/id already exists in an active or submitted state
- required facts cannot be verified
- requested proof/case study would require fabrication
- capability materially exceeds source-of-truth evidence
- role is commodity scraping / spam blasting / obvious bad fit
- client requests prohibited or deceptive behaviour

## Manual submission lane

Daily flow:
1. Discover current jobs from permitted public sources and approved feeds.
2. Normalise job record.
3. Score against `config.json`.
4. Apply hard gates.
5. Generate proposal and visible screening answers.
6. Run fact/proof QA.
7. Save to `queue.json` as `READY_TO_SUBMIT`.
8. Morning Action Pack surfaces APEX and STRONG jobs.
9. Chelston opens the direct job URL, checks the prepared application and performs the final Upwork submit action.
10. Update the queue state to `SUBMITTED`.

## API mode

Future mode only. Before activation verify:
- official Upwork API access is approved
- OAuth credentials are present outside the repository
- submit-proposal permission/scope is confirmed
- duplicate check passes immediately before submission
- job-open check passes immediately before submission
- proposal has no unresolved human facts

Never store secrets in this repository.

## Queue contract

Each record contains:
- `job_key`
- `source_url`
- `title`
- `client`
- `country`
- `budget`
- `discovered_at`
- `score_breakdown`
- `score_total`
- `tier`
- `state`
- `hard_gate_reason`
- `recommended_bid`
- `proposal`
- `screening_answers`
- `missing_facts`
- `submitted_at`
- `outcome`

## Success metrics

Track applications, replies, interviews, wins, revenue won, Connects spent, revenue per Connect, response rate and win rate by job archetype.
