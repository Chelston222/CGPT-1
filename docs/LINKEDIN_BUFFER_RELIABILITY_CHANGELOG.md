# LinkedIn / Buffer Reliability Changelog

## 2026-09-05

Permanent reliability hardening added:

- deterministic live Buffer integrity evaluator
- hourly read-only reliability sentinel
- recurring regression watchdog
- canonical incident lifecycle for live/provider drift
- canonical incident lifecycle for regression failure
- exact queue/approval/due-time mapping enforcement
- duplicate live-destination detection
- provider identity, connection and timezone checks
- cadence and Buffer-capacity checks
- fixed/custom-schedule enforcement
- media metadata integrity checks
- explicit safe self-healing boundary

Rollout is not considered complete until both the live sentinel and recurring regression trigger pass on the production main branch.
