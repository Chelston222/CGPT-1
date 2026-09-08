# LinkedIn / Buffer Reliability Rollout Verification

The permanent hardening is complete only when all of these checks have passed on `main`:

- [x] Hourly live sentinel workflow parses and runs
- [x] Live Buffer provider state resolves for personal, main and secondary
- [x] Every current scheduled placement maps to a trusted acceptance record
- [x] Every mapped acceptance record resolves to an effective locked queue revision
- [x] Due times match exactly
- [x] Fixed/custom schedule invariant passes
- [x] Cadence passes
- [x] No duplicate live destination exists
- [x] Regression workflow parses and runs
- [x] New reliability unit tests pass
- [x] Existing LinkedIn regression suite remains green
- [x] QA-bank audit remains green
- [x] No reliability incident remains open after verification

## Production verification

Verified on 2026-09-08 after RED TEAM and independent double verification.

- Regression check: owner-triggered issue #653 closed `completed` after the current default-branch regression suite, LinkedIn hardening suite and QA-bank checks passed.
- Live reliability check: owner-triggered issue #654 closed `completed` after the production sentinel returned GREEN.
- Live scheduled placements at verification: 7.
- Trusted acceptance-to-queue mapping: 7/7.
- Buffer pagination: complete.
- Personal, main and secondary providers: connected, timezone PASS and identity PASS.
- Hard invariants: all pass.
- Runway warnings: none.
- Queue fingerprint: `01678f428cb926ca08ac032a36896bb5a1d7d7a03d48f275697d05ca585ea226`.
- Open `[LINKEDIN REGRESSION INCIDENT]` issues after verification: 0.
- Open `[LINKEDIN RELIABILITY INCIDENT]` issues after verification: 0.
- Equivalent repeated bot acceptance evidence is now idempotent; genuinely conflicting evidence for the same Buffer ID still fails closed.

The hourly sentinel remains read-only against Buffer. It may report and manage GitHub incident state, but it does not edit copy, delete posts, alter destinations, alter due times or bypass the owner approval gate.

This checklist is intentionally evidence-driven. A checked item reflects a production or regression execution, not code inspection alone.
