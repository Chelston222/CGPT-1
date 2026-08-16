# Security and Failure Model

## Threats explicitly handled

### Secret leakage
- Runtime secrets are environment variables only.
- GitHub contains names/placeholders only.
- The operator bearer token must be at least 24 characters.
- The encryption key must be at least 24 characters and different from the bearer token.
- The operator token is kept in browser `sessionStorage`, not local storage.
- Public health reveals only service/version and coarse configuration readiness, never sender identities, counts, tokens or queue contents.

### Stolen Blob contents
- Gmail refresh tokens use AES-256-GCM and authenticated additional data bound to account ID.
- Queue payloads use AES-256-GCM and are bound to queue ID.
- Optional previous-key decryption supports controlled key rotation.
- Encryption key is separate from the bearer token.
- Corrupt/undecryptable queue items are blocked and audited rather than repeatedly crashing the worker.

### OAuth CSRF/replay
- OAuth state is HMAC signed and expires after ten minutes.
- Server stores a one-use nonce and deletes it on callback.
- Callback origin must match the signed redirect URI.

### Duplicate/cross-account sends
- Queue and send idempotency are global, not per sender.
- Queue IDs are deterministic from the upstream idempotency key.
- Scheduled dispatch uses a global election lease and one-item batches by default.
- State movement writes the destination record before deleting the previous key; temporary duplicates remain contained by global idempotency.
- There is no immediate-send or Mailopoly direct-send bypass.
- Lead continuity and suppression are global.

### Header injection and recipient expansion
- Header-bearing values strip CR/LF.
- Exactly one recipient is allowed.
- No CC/BCC API surface exists.

### Burst and out-of-hours sending
- Per-account minimum interval.
- Per-account daily and rolling-24h caps.
- Per-recipient-domain daily cap.
- Conservative warm-up and serial dispatch.
- Europe/London production delivery window defaults to 08:00–18:00, including weekends.

### Damaged/revoked sender
- `invalid_grant`/401/token-record problems -> `REAUTH_REQUIRED`.
- Authentication/token failures that occur before a Gmail submission are safely retryable and do not damage sender reputation score.
- Provider/reputation failures reduce health; three consecutive failures trip the circuit breaker.
- Confirmed successful Gmail delivery gradually restores a previously degraded health score.
- Rate/quota rejections cool the sender before safe reconsideration.
- Ambiguous post-submission delivery -> quarantine/manual review and no automatic retry.

### Excess retention
- Terminal queue payloads purge after 90 days by default.
- OAuth-state remnants purge after one day.
- Send counters purge after 35 days by default.
- Audit records purge after 90 days by default.
- Suppressions persist until explicit, audited restoration.

### Operator error
- Emergency stop is checked before routing.
- First touch requires human approval.
- Unknown legal category is blocked.
- Suppression is global.
- Suppression restoration requires an explicit confirmation string, actor and reason.
- `REAUTH_REQUIRED` cannot be bypassed with a resume toggle.

## Non-negotiable invariant

`DELIVERY_UNKNOWN` is never automatically retried. An operator first verifies whether the provider delivered it.

A failure is labelled safely retryable only where the system can prove the Gmail message submission did not happen, such as a refresh-token transport failure before `users.messages.send`.

## Production isolation

Production uses site-scoped Netlify Blobs. Preview/non-production contexts use deploy-scoped Blobs so test data cannot mutate production state.

## Upgrade triggers

Move queue/counters to a transactional datastore before any of these: more than one intentional dispatcher worker, sustained active queue above 500, strict atomic reservations across independent services, or materially higher throughput/concurrency.
