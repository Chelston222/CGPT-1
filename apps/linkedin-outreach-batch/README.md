# 222Emails LinkedIn Prospect Batch Engine

Purpose: prepare a fresh, high-quality LinkedIn connection batch for 222Emails without automating any LinkedIn action.

## Recommended operating cadence

Default: **10 primary prospects per weekday + 2 backups**.

Why not 20 every day by default:

- LinkedIn applies invitation limits and can temporarily restrict invitation sending when limits are reached.
- 20 per weekday would create 100 new invitations per week before accounting for reply handling, accepted connections and other outreach.
- 10 per weekday creates a sustainable 50-per-week baseline while protecting time for replies and follow-up, which should outrank new cold outreach.
- The engine generates 2 backups so Chelston can still reach 10 when a profile is unsuitable at the point of sending.
- Review the volume after 10 business days using acceptance rate, reply quality, qualified conversations, restriction warnings and manual workload. Scale to 12-15 per day only if evidence supports it.

The workflow prepares the batch at **07:35 Europe/London, Monday-Friday**. The intended human execution window is **08:15-08:50** after the existing 08:00-08:15 calendar commitment.

## Architecture

`GitHub schedule -> OpenAI Responses API + web search -> candidate pass -> independent verification/red-team pass -> deterministic QA -> prepared batch`

The two model passes are deliberately separate:

1. **Research + Red Team 1**: build a broad candidate pool, reject weak or uncertain prospects.
2. **Independent verification + Red Team 2**: re-check current role, LinkedIn identity, ICP fit, personalisation evidence, source URLs, score and message safety. Weak candidates are removed rather than rescued with invented claims.

A deterministic final gate then rejects:

- malformed or non-canonical LinkedIn profile URLs
- duplicates from the current seed or prior generated batches
- scores below 95/100
- connection notes above the configured account limit
- overlong post-accept messages
- em dashes in outbound copy
- blocked names/organisations
- prospects without sources

## Current 222Emails rules built in

- Positioning: Turnkey Client Return Systems for appointment-led businesses.
- Primary proving ground: Lancashire and North West England, with strong wider-UK prospects allowed when local quality drops.
- Priority categories: salons, barbers, beauty, aesthetics, dental and relevant beauty-training operators.
- Hospitals excluded.
- No generic email-marketing pitch.
- No unsupported revenue-leak claim.
- No invented statistics, awards, client counts, platform usage or social proof.
- First-touch score must remain >=95/100 after the second verification pass.
- No call ask on first touch.
- Clean canonical `https://www.linkedin.com/in/.../` links so names can be tapped from an iPhone and handed to the LinkedIn app when iOS universal links are honoured.
- Connection-note cap is 280 characters because the current account UI has shown a 300-character field. Keeping 20 characters spare protects against counting differences.

## Hard human-send boundary

This engine **never**:

- clicks Connect
- sends a connection request
- sends a LinkedIn note
- sends InMail
- sends a LinkedIn message
- scrapes LinkedIn through browser automation

It prepares research and copy. Chelston remains the human sender. This also preserves the existing 222Emails rule that live sends require human approval.

## Privacy gate

`Chelston222/CGPT-1` is currently a **public repository**.

The convenient delivery mode would create a GitHub issue containing the daily target names, profile links, evidence and outreach copy. That would make the live commercial target list public and permanently discoverable in repository history/issues.

For that reason the automation is intentionally fail-closed:

```json
"public_output_acknowledged": false
```

The workflow will stop **before spending API money or publishing anything** until one of these is true:

1. the owner explicitly accepts public GitHub-issue delivery and changes the flag to `true`; or
2. the workflow is moved to a private repository/private delivery destination.

A private destination is preferred.

## Required secret

The generator requires one GitHub Actions secret:

`OPENAI_API_KEY`

ChatGPT Plus and OpenAI API billing are separate. The key should be stored only as a GitHub Actions secret, never committed to the repository.

## Files

- `config.json` - schedule, ICP, QA and privacy policy
- `seed-contacted.json` - the 20 profiles contacted on 5 September 2026 so they cannot be regenerated
- `generate.py` - research, second-pass verification, dedupe and rendering
- `.github/workflows/linkedin-daily-prospect-batch.yml` - weekday scheduler and delivery workflow

## Manual test

After a private delivery path is selected and `OPENAI_API_KEY` is present, run the workflow manually with 10 primary + 2 backups before enabling scheduled production.

Success means:

- at least 10 verified prospects survive
- all scores are >=95
- every name links to a canonical LinkedIn profile
- all notes fit the configured character cap
- no seeded/prior profile repeats
- issue/output contains explicit evidence and source URLs
- LinkedIn actions remain manual
