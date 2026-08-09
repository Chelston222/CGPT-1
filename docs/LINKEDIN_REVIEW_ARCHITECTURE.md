# LinkedIn review control centre

## Decision

The repository-backed queue and mobile review interface are the operational source of truth for LinkedIn review, scheduling intent and state history. GitHub Issues are the authenticated approval and dispatch ledger. Notion remains the strategy, archive and reusable-content library.

Notion is not retired. It is deliberately removed from the runtime path because the current calendar is valuable editorial memory but is not a reliable publishing ledger: it models only the personal channel, duplicates status concepts across two databases and contains historic approvals that must not be treated as current permission to publish.

## Human-first approval path

1. A fully written, channel-specific post enters `apps/linkedin-review/queue.json` as `live_ready`, then `review`.
2. Chelston reviews category, destination, time, copy, channel variants and media in the mobile interface.
3. **YES** or **NO** is stored locally and the next undecided post appears automatically. NO never contacts Buffer.
4. The app keeps choices separate by selected week and queue version, and preserves them across refreshes on the same device.
5. Once the week is fully decided, one weekly hand-off opens a compact GitHub record for Chelston to review and submit while signed in.
6. Only a new issue authored by the repository owner with the `[APPROVED LINKEDIN WEEK]` prefix can start a weekly Buffer run. `[APPROVED LINKEDIN]` remains a single-post fallback.
7. The workflow locks the exact queue version and `post-id@revision` set, then preflights the complete week before its first Buffer request.
8. Buffer post IDs and per-channel results are appended to the issue. Successful issues close; failed or partial issues remain open with explicit recovery instructions.

The interface never contains a GitHub token or Buffer credential. The one weekly GitHub confirmation provides authentication, explicit approval and an immutable audit record without building a custom identity system or forcing one issue per post.

## State model

| State | Evidence |
| --- | --- |
| `live_ready` | Copy, destination and timing are complete; awaits Chelston's decision |
| `review` | Queue history entry; awaiting Chelston |
| `approved` | Local YES selection, followed by an owner-created weekly approval issue awaiting dispatch evidence |
| `rejected` | Local NO selection; the item is excluded from weekly dispatch and returned for revision |
| `scheduled` | Buffer accepted a queue or custom-scheduled post and the approval issue closed |
| `published` | Separate `[PUBLISHED LINKEDIN]` evidence record; Buffer acceptance alone is not publication proof |
| `failed` | `[FAILED LINKEDIN WEEK]`, `[FAILED LINKEDIN]` or an open approval issue with a failed workflow audit |

## Target model

- `personal` → `BUFFER_LINKEDIN_PERSONAL_CHANNEL_ID`
- `main` → `BUFFER_LINKEDIN_BUSINESS_CHANNEL_ID`
- `secondary` → `BUFFER_LINKEDIN_SECONDARY_CHANNEL_ID`

`TARGETS` accepts one slug or comma-separated combinations. Legacy `business`, `both` and `all` inputs remain supported. Multi-channel items can provide channel-specific copy blocks and staggered `SCHEDULE_AT_*` fields.

Buffer does not offer an atomic multi-channel transaction. The workflow therefore validates everything before sending, then records any channel already created if a later network/API call fails. A partial result must never be retried blindly.

## Content consolidation

Run the local-only consolidator against trusted folders and exports:

```text
node scripts/consolidate-linkedin-content.mjs <source paths> --output .local-linkedin-content-library.json
```

It inventories Markdown, text, CSV and JSON records, removes exact duplicates and preserves source paths. The generated library is ignored by Git because Mac paths and source copy may be private. Selected material is rewritten, cited and promoted into the public review queue only after editorial review.

Historic Notion approval is metadata, not live publishing consent. Imported content always re-enters as `live_ready` or `review`.
