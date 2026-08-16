# TTE Multi-Gmail Architecture

## System boundary

The mail bridge owns sender authentication, safety routing, send-state, suppression, approval, pacing and operational audit. It does not own prospect research or copy generation.

## Data flow

1. Upstream or the Mailopoly adapter submits one prospect message.
2. `/api/tte/send` or `/api/tte/agent-hook` validates one recipient, opt-out and legal-category fields, then queues it.
3. Sensitive payload fields are encrypted at rest and bound cryptographically to the queue record ID.
4. First touch remains `PENDING_REVIEW` until approved.
5. The serial scheduled dispatcher operates only inside the configured Europe/London delivery window and elects one worker before reading due `READY` items.
6. Emergency stop, suppression and prior-reply markers run before sender selection.
7. Global and recipient-domain caps run.
8. Router scores only eligible senders.
9. Global idempotency is reserved before provider submission.
10. Pre-send authentication/refresh failures are separated from post-submission uncertainty.
11. Provider result is classified as confirmed, explicitly rejected or delivery unknown.
12. Confirmed sends update account/global/domain usage, gradually recover sender health and preserve lead continuity.
13. Audit metadata is recorded without message bodies.

## Sender score and continuity

Eligible sender scoring combines health, remaining daily capacity, continuity, operator priority, idle time and a tiny deterministic tie-break. Follow-ups default to the original sender and thread. If that sender is paused, capped, cooling down or unhealthy, the follow-up waits instead of silently changing identity. A switch requires an explicitly approved `allowSenderSwitch` payload.

## Warm-up

New Gmail accounts begin `WARMING`. The effective cap is the lowest of the account hard cap, warm-up schedule and warm-up maximum. Default ramp is 5/day plus 2 every 3 days, with a default account hard cap of 10. This is an internal deliverability safety policy, not a claim about Google's platform limit.

## Delivery window

Scheduled production delivery is enabled by default from 08:00 inclusive to 18:00 exclusive in `Europe/London`, including weekends. The window uses timezone-aware formatting, so BST/GMT transitions do not require manual clock changes. Queue creation and review can happen outside the window; only provider submission waits.

## Concurrency choice

Netlify Blobs provides strong reads but not transactions or compare-and-swap. The design therefore does not pretend it is a transactional queue: production delivery is queue-only, scheduled batch size is one by default, a short-lived global dispatcher election lease limits overlap, deterministic queue IDs collapse duplicate enqueue attempts, state transitions write the new record before deleting the old record, and ambiguous in-flight work is quarantined rather than retried.

The lease materially reduces accidental overlap but cannot turn object storage into a mathematical transaction. Global provider idempotency and serial execution provide an additional containment layer. Before introducing multiple intentional dispatcher workers or high concurrency, migrate queue reservations and counters to a datastore with native transactions/CAS.

## Storage efficiency

Per-account daily and rolling counters are read once per account. The recipient-domain count is global, so it is read once per routing decision rather than once per sender. Metrics load only operational queue states instead of decrypting terminal history. Terminal encrypted payloads, counters and audit records have bounded retention.

## Providers

Gmail API is primary. An optional legacy SMTP virtual account exists only when the existing SMTP secret is configured, preserving hello@ compatibility without coupling Gmail tokens to SMTP credentials.

The separate direct SMTP verification workflow can deliver only to a fixed internal receipt address. It has no prospect-address input and is not part of outreach delivery.

## Mailopoly compatibility

The existing `/api/tte/agent-hook` endpoint is preserved, but it is an ingress adapter only. It can authenticate a Mailopoly-originated message and enqueue it; it cannot create an SMTP transport or call a mail provider. Therefore Mailopoly cannot bypass review, legal classification, global suppression, emergency stop, pacing, idempotency or sender health.

## Reply boundary

The core requests only `gmail.send` plus identity scopes. It does not request restricted mailbox-reading scopes. The authenticated `reply-event` endpoint accepts reply, opt-out, bounce and complaint signals from an inbox aggregator, CRM or future listener, enabling follow-up cancellation and global suppression without silently widening Google permissions.
