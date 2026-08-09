# LinkedIn Content Swiper — multi-device review sync

## Purpose

YES/NO editorial decisions now have a central, private state so Chelston can review on more than one browser or device without losing progress. This does **not** change the publishing authority model.

## Authority model

1. Swiper YES/NO is editorial review state only.
2. Central sync stores only the post ID, revision, decision, optional rejection note and timestamps.
3. Buffer credentials are never exposed to the browser.
4. A synced YES is **not** permission to publish.
5. The final owner-authenticated GitHub `[APPROVED LINKEDIN WEEK]` or `[APPROVED LINKEDIN]` submission remains the only action that can authorise Buffer dispatch.

## Implementation

- Browser add-on: `apps/linkedin-review/sync.js`
- Server endpoint: `/api/review-decisions`
- Netlify function: `apps/linkedin-review/netlify/functions/review-decisions.mts`
- Storage: Netlify Blobs with strong consistency
- Authentication: secret `REVIEW_SYNC_TOKEN` stored in Netlify production environment variables
- Local fallback: the existing browser `localStorage` remains available if remote sync is temporarily unavailable

Each post decision is stored independently under the stable Master LinkedIn Ledger ID. This avoids making queue-generation timestamps part of the identity and reduces the chance that one device overwrites unrelated decisions from another.

## Device use

Press **Sync** in the Content Swiper and enter the private review sync key once on that browser. The key is stored only in that browser. Afterwards:

- remote decisions are merged with valid local decisions for the same post revision;
- the most recent valid decision wins when the same revision has conflicting decisions;
- YES/NO changes are pushed centrally after the local save;
- clearing saved week decisions propagates the resulting local changes;
- the app refreshes remote decisions when the tab regains focus and approximately once per minute while visible;
- an unavailable sync service does not block review and does not weaken the GitHub publishing gate.

If the post revision changes, old decisions are ignored and fresh review is required.

## Failure behaviour

| Scenario | Result |
| --- | --- |
| Sync key missing | Swiper continues locally and shows Sync as disconnected |
| Wrong key | Remote state is not exposed or changed; device is disconnected |
| Netlify/Blob outage | Local decision is retained; Sync shows a retry state |
| Same post changed on two devices | Latest timestamp for the same revision wins |
| Post revision changes | Prior device/remote decision is ignored |
| Public visitor opens the Swiper | They cannot read or mutate central review state without the private key |
| Synced YES exists | Still cannot contact Buffer without the final GitHub owner approval |

## Secret handling

Never commit `REVIEW_SYNC_TOKEN` to GitHub, queue JSON, HTML, JavaScript or documentation. Keep it only in Netlify's secret environment variable and on Chelston's trusted review devices.
