# APEX Acceptance Rubric

A release cannot be labelled APEX if any hard gate fails.

## Hard gates

| Gate | Requirement | Target |
|---|---|---|
| Secret safety | No real credentials in repo/browser bundle; strong distinct bearer/encryption secrets | PASS |
| OAuth | Offline OAuth, signed expiring state, encrypted refresh token | PASS |
| Least privilege | Core avoids Gmail restricted read scopes | PASS |
| Duplicate control | Deterministic queue ID, global idempotency, dispatcher election | PASS |
| Ambiguous failure | Unknown delivery quarantined and never auto-retried | PASS |
| Pre-send retry safety | Token/auth transport failures retry only when no message submission occurred | PASS |
| Legal compliance | Unknown category blocked, opt-out mandatory, first-touch review | PASS |
| Provider permission | Lawful basis alone cannot authorise delivery; evidence-backed permission/relationship gate required and rechecked at dispatch | PASS |
| Suppression | One global hard block across all senders | PASS |
| Kill switch | Emergency stop evaluated before routing | PASS |
| Sender safety | daily, rolling, interval, warm-up, health, cooldown and delivery-window gates | PASS |
| Account registry | lane and recovery readiness visible without storing passwords/full recovery phone | PASS |
| Alternate ingress | Mailopoly route enters the same queue and cannot send directly | PASS |
| Preview isolation | non-production cannot mutate production Blob state | PASS |
| Corrupt-state containment | undecryptable queue work is blocked/audited, not loop-crashed | PASS |
| Data minimisation | terminal sensitive payloads, counters and audit logs have bounded cleanup | PASS |
| Key rotation | optional previous-key decrypt path | PASS |
| Test gate | automated core tests green | PASS |
| Deploy gate | CI and production deploy/smoke green | REQUIRED BEFORE LIVE |

## Weighted score

Security/secrets 20; deliverability/sender protection 18; duplicate/idempotency 15; UK compliance and provider-policy rails 12; failure recovery 12; operator usability 10; observability/audit 6; maintainability/testing 5; cost discipline 2. Target **95/100 minimum** plus every hard gate.

## Red-team scenarios

1. Duplicate idempotency key from two upstream systems.
2. Opt-out after touch 1 while follow-ups are queued.
3. Revoked Gmail refresh token.
4. Network/5xx uncertainty after submission.
5. Daily/rolling cap hit mid-sequence.
6. Three consecutive sender failures.
7. Emergency stop with READY work.
8. Sole trader with legitimate interests only.
9. Unknown legal category.
10. OAuth callback replay.
11. Stale `IN_FLIGHT` after interruption.
12. Preview deploy storage write.
13. CRLF header injection.
14. Recipient-domain saturation across senders.
15. Missing legacy SMTP with healthy Gmail pool.
16. Overlapping scheduled invocations.
17. Ciphertext transplanted to another record.
18. Suppression restoration without actor/reason/confirmation.
19. Terminal sensitive payloads/audit exceeding retention.
20. Attempt to bypass serial delivery with an immediate-send flag.
21. Mailopoly hook attempts direct provider delivery.
22. Queue ciphertext is corrupt or key rotation is incomplete.
23. Backlog becomes due outside UK sending hours.
24. Google token endpoint is temporarily unavailable before Gmail submission.
25. Sender health suffers a transient event and must recover after confirmed success.
26. Corporate legitimate interests is present but provider permission/evidence is absent.
27. Permission metadata is malformed or future-dated.
28. An old READY queue item lacks the new provider-permission fields at final dispatch.
29. Operator connects many Gmail accounts and attempts to treat account count as permission to multiply unsolicited traffic.
30. Recovery metadata is incomplete and the account later needs reauthorisation.

Every scenario must be addressed by code or an explicit fail-closed operational rule.
