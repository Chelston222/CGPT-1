# LinkedIn Autopost via ChatGPT, GitHub and Buffer

## What this system does

ChatGPT creates a GitHub issue only after Chelston explicitly approves a final post. GitHub Actions sends the post to Buffer. Buffer publishes or schedules it to LinkedIn Personal, LinkedIn Business, or both.

This gives an auditable approval gate and avoids storing Buffer credentials in ChatGPT messages or repository code.

## Live components

- Workflow: `.github/workflows/linkedin-buffer-autopost.yml`
- Issue template: `.github/ISSUE_TEMPLATE/approved-linkedin-post.md`
- Trigger title prefix: `[APPROVED LINKEDIN]`

## One-time activation

### 1. Connect LinkedIn channels in Buffer

Connect both destinations in Buffer:

- LinkedIn personal profile
- LinkedIn business page

### 2. Create a Buffer API key

In Buffer, open Settings, then API, create a key and copy it once.

Never paste the key into an issue, chat message, Notion page or repository file.

### 3. Find the Buffer channel IDs

Use Buffer’s API Explorer or Get Channels query to identify the channel ID for each LinkedIn destination.

### 4. Add three GitHub Actions secrets

Open the `Chelston222/CGPT-1` repository, then:

`Settings > Secrets and variables > Actions > New repository secret`

Create:

- `BUFFER_API_KEY`
- `BUFFER_LINKEDIN_PERSONAL_CHANNEL_ID`
- `BUFFER_LINKEDIN_BUSINESS_CHANNEL_ID`

## Publishing flow from ChatGPT

1. ChatGPT drafts and quality-checks the post.
2. Chelston explicitly says to approve, schedule or publish it.
3. ChatGPT creates an issue using the approved template.
4. GitHub Actions validates the post, destination, timing and required secrets.
5. GitHub sends it to Buffer.
6. Buffer returns a post ID.
7. The GitHub issue receives a success comment and closes automatically.
8. If any step fails, the issue stays open and nothing is assumed published.

## Supported commands

### Personal LinkedIn

```text
TARGET: personal
MODE: schedule
SCHEDULE_AT: 2026-07-23T08:30:00+01:00
MEDIA_URL:
---
Final approved post text
```

### Business LinkedIn

```text
TARGET: business
MODE: queue
SCHEDULE_AT:
MEDIA_URL:
---
Final approved post text
```

### Both destinations

```text
TARGET: both
MODE: draft
SCHEDULE_AT:
MEDIA_URL: https://public.example.com/approved-image.png
---
Final approved post text
```

## Safety behaviour

- The workflow runs only when the issue title starts with `[APPROVED LINKEDIN]`.
- Invalid targets, dates, media URLs or missing secrets fail closed.
- Posts over 3,000 characters fail validation.
- Media must use a publicly accessible HTTPS URL.
- A failed run leaves the issue open and adds an error comment.
- A successful run records the Buffer post ID.

## Current activation status

The workflow code and issue template are installed.

Publishing remains blocked until the Buffer account has both LinkedIn channels connected and the three GitHub Actions secrets are added.
