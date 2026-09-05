# LinkedIn / Buffer Reliability Rollout Verification

The permanent hardening is complete only when all of these checks have passed on `main`:

- [ ] Hourly live sentinel workflow parses and runs
- [ ] Live Buffer provider state resolves for personal, main and secondary
- [ ] Every current scheduled placement maps to a trusted acceptance record
- [ ] Every mapped acceptance record resolves to an effective locked queue revision
- [ ] Due times match exactly
- [ ] Fixed/custom schedule invariant passes
- [ ] Cadence passes
- [ ] No duplicate live destination exists
- [ ] Regression workflow parses and runs
- [ ] New reliability unit tests pass
- [ ] Existing LinkedIn regression suite remains green
- [ ] QA-bank audit remains green
- [ ] No reliability incident remains open after verification

This checklist is intentionally evidence-driven. Do not mark a box from code inspection alone when a production execution can verify it.
