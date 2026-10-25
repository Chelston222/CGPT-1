# Buffer ledger discovery incident, 25 October 2026

## Verified failure

The public-repository publisher, publication verifier and reliability sentinel failed closed because two bot-created issues had the exact durable-ledger title:

- [#677](https://github.com/Chelston222/CGPT-1/issues/677), created 10 September, contains 148 trusted bot comments: 74 dispatch intents and 74 acceptance receipts.
- [#822](https://github.com/Chelston222/CGPT-1/issues/822), created 22 October at 17:08:19 UTC, contains zero comments.

The second issue's creation coincides with [publisher run 39819997585](https://github.com/Chelston222/CGPT-1/actions/runs/39819997585), which logged a successful issue-creation request. The source created a new ledger whenever its paginated discovery returned no trusted match. Why that discovery missed the established ledger is not established by the available logs. Do not assert a pagination bug, race, or provider outage without further evidence.

[Publisher run 40162568736](https://github.com/Chelston222/CGPT-1/actions/runs/40162568736), [publication verifier run 40183570887](https://github.com/Chelston222/CGPT-1/actions/runs/40183570887), and [incident #823](https://github.com/Chelston222/CGPT-1/issues/823) identify both issue numbers in the split-brain refusal.

The health report in [#790](https://github.com/Chelston222/CGPT-1/issues/790) could still describe publication verification as current because it counted approval receipts without validating the durable ledger. An empty provider queue remains separate from a healthy verification system. No content approval or queue refill follows from repairing audit state.

## Completed metadata reconciliation

At 25 October 2026 11:09:17 UTC, after a fresh read confirmed #822 had no comments and there were no open owner-created publisher approval issues, #822 was retitled to `[RETIRED EMPTY DUPLICATE] Buffer acceptance ledger; canonical #677`. Its original body, open state, and history were preserved. No receipts were moved or edited. #677 was untouched.

The subsequent read found exactly one matching trusted durable-ledger title, #677. Closing #822 without retitling would not have removed the ambiguity because readers deliberately include closed issues. No workflow was rerun and no provider write was performed; recovery of scheduled workflows is not established by this metadata readback.

## Preventive change

- Publisher discovery now requires an existing trusted ledger and never creates or reopens a ledger issue. Missing discovery results and duplicate ledgers fail closed before any Buffer write.
- The health gate independently reads all ledger candidates, including bot-created and closed history, validates receipt conflicts and unresolved intents, and reports diagnostic evidence on failure. It cannot claim publication verification is current when that prerequisite fails.
- Durable acceptance without an owner-approval receipt or exact trusted dispatch intent remains unknown. Missing acceptance mirrors use the matching approval's terminal evidence, without double-counting receipts. Approval history is no longer restricted to a 45-day update window.
- Existing exact-copy approvals, provider write controls, concurrency, duplicate protection and content holds remain in force.

Validation: 397 authoritative LinkedIn tests pass, including executable tests of absent, duplicate, untrusted, closed and unavailable discovery; health tests cover duplicate/missing/unreadable ledgers, conflicting acceptance, unresolved intent, orphaned durable acceptance, missing approval mirrors and old approval history. The changed inline JavaScript parses and `git diff --check` passes. Provider recovery and production behavior require later read-only verification; this document is not publishing authority.
