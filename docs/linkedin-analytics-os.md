# 222 Emails LinkedIn Analytics OS

## What this adds

The existing `apps/linkedin-review` Content Swiper becomes the operating screen for LinkedIn approval, scheduling visibility and Buffer performance.

It adds:

- a daily GitHub Action that pulls Buffer scheduled posts, sent posts and post-level metrics
- a separate `buffer-analytics-data` branch for generated JSON and CSV snapshots
- an analytics panel inside the existing Netlify Content Swiper
- an embedded prompt engine that turns the latest winner, weak post and next action into reusable ChatGPT prompts

## Cost-control rule

The analytics refresh must not commit generated data to `main`.

The workflow writes to `buffer-analytics-data` only. The Netlify production site reads that branch through the public GitHub contents API. This keeps normal analytics refreshes away from production Netlify deploys.

A production deploy should only happen when the app code changes are deliberately merged to `main`.

## Data files generated

The data branch contains:

- `apps/linkedin-review/data/analytics-summary.json`
- `apps/linkedin-review/data/posts-scheduled.csv`
- `apps/linkedin-review/data/posts-sent.csv`
- `apps/linkedin-review/data/README.md`

The JSON snapshot is what the Content Swiper reads.

## Required existing secrets

The workflow expects the same Buffer secrets already used by the posting workflow:

- `BUFFER_API_KEY`
- `BUFFER_LINKEDIN_PERSONAL_CHANNEL_ID`
- `BUFFER_LINKEDIN_BUSINESS_CHANNEL_ID`
- `BUFFER_LINKEDIN_SECONDARY_CHANNEL_ID`

No Buffer token is sent to the browser and no secrets are written to the data branch.

## First run

After merging the PR:

1. Go to GitHub Actions.
2. Open `LinkedIn Buffer Analytics Refresh`.
3. Run it manually once.
4. Open the Netlify Content Swiper.
5. Press `Refresh analytics`.

After that, the workflow runs daily at 06:23 UTC.

## Operating rhythm

Use the panel like this:

1. Approve or reject posts in the existing weekly swiper.
2. Check scheduled runway and sent-post performance.
3. Repurpose the winners.
4. Rewrite the weak posts.
5. Use the prompt engine to generate the next stronger batch.

The strategic goal is simple: stop posting blind, use data to sharpen the offer, and turn every winner into more revenue-focused content.
