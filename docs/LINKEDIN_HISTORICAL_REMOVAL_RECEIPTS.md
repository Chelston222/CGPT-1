# Historical Buffer removal receipt compatibility

This draft repairs the 24 historical Post-not-found records in [run 38186299636](https://github.com/Chelston222/CGPT-1/actions/runs/38186299636/job/114609241682): 22 exact owner-listed removals in [#60](https://github.com/Chelston222/CGPT-1/issues/60#issuecomment-5252125825), plus the two REPURPOSE removals in [#386](https://github.com/Chelston222/CGPT-1/issues/386). PR817 remains intact.

Removal evidence requires owner login Chelston222, numeric ID 246655273 and OWNER association. Execution requires github-actions[bot], numeric ID 41898282, Bot type and GitHub Actions app ID 15368/slug github-actions, with the exact issue-comment URL. Both newer DeletePostSuccess lists and legacy count/list receipts must match the full owner-requested DELETE_POST_IDS without duplicates, missing or extra IDs.

REPURPOSE evidence additionally verifies Git blob 9bb89ddf0d8a392f03a4f8c97c5cead8d8faeb1c, the exact owner migration approval, matching INTENT/APPLIED action key and Buffer ID, and the original owner creative/revision/target/schedule and authenticated acceptance receipt. MOVE, KEEP and intent-only evidence cannot resolve a missing post. Manifest drift fails closed.

The verifier records only LINKEDIN_PUBLICATION_SUPERSEDED for these removals. It never records publication or analytics, never creates Buffer posts and preserves unknown missing-post failures. Existing source copy, media, schedules, lifecycle banks, send routes and publishing gates are untouched by this repair.

## Stale selection inspection — 12 October 2026

Issues 100–104 are old scheduled approvals whose latest verifier observations report provider draft state. No owner-abandonment receipt exists. Their latest dispatch checks on 12 October failed CONTENT_QA: PASS before creating any destination. The current publisher selects only open owner-authored APPROVED-family titles; these now have FAILED-family titles. Do not rename/reopen them for release, add QA passes, retire, replay, reschedule or treat provider draft state as owner abandonment. They remain unresolved for a separate owner decision.

## Verification

Run the focused receipt/workflow suite and the existing authoritative regression suite:

~~~sh
node --test tests/linkedin-buffer-removal-receipts.test.cjs tests/linkedin-publication-receipts.test.cjs tests/linkedin-verifier-ledger-role.test.cjs
node --test tests/linkedin-*.test.cjs tests/rr14-content-pool.test.cjs
node scripts/linkedin-qa-bank-audit.cjs
~~~

The minimal contract fixtures reproduce the observed public receipts without credentials or internal notes. Workflow integration exercises the actual verifier with mocked external I/O: all 24 removals resolve as non-publication, unknown missing posts still fail, analytics remains restricted to publication evidence and stale provider drafts remain unresolved.

No merge or live repair execution is authorised by this draft. Visage restoration and scheduling is a separate completed release (#819) and is outside this patch.
