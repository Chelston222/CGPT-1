# RR14 Content Pool Status — 2026-08-22

Owner-approved Revenue Recovery content batch for Chelston personal, Main 222Emails and Retention Lab.

- Total authored and owner-approved: 42 posts, 14 per channel.
- Current Buffer release: 18 posts, 6 per channel, sized exactly to the free capacity available in the completed replenishment cycle.
- Wave 1 locked source: `apps/linkedin-review/qa-replenishment-2026-08-22.json` containing the 18 posts already accepted by Buffer.
- Wave 2 locked source: `apps/linkedin-review/qa-replenishment-2026-08-22-rr14-wave2.json` containing the remaining 24 posts, 8 per channel, scheduled across 30 August to 6 September.
- Both locked files are loaded by `scripts/linkedin-week-batch.cjs` and are therefore eligible for exact revision/body verification.
- Wave 2 is intentionally not dispatched while Buffer capacity is full. No approval issue should be left open merely waiting for capacity.
- Legacy issue-only dispatch is disabled. Every future release must match the exact current locked queue revision, targets, copy, schedule and media fingerprint.

This status file is operational metadata only. It is not itself a publishing source and must never be parsed as approved post copy.
