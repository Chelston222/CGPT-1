# Operator Runbook

## Normal daily state

- Health is `READY`.
- Emergency stop is off.
- Gmail accounts are `ACTIVE` or intentionally `WARMING`.
- `DELIVERY_UNKNOWN` is zero.
- Pending first touches are reviewed before scheduled delivery.
- Scheduled provider delivery occurs only inside the configured Europe/London window, 08:00–18:00 by default, weekends included.

## REAUTH_REQUIRED

1. Leave the account out of routing.
2. Use **Connect Gmail account** and authenticate the same Google account.
3. The existing account record is recovered rather than duplicated.
4. Safe queued work can continue after reauthorisation; no blind resend is required.
5. Confirm status and audit events before deliberately changing limits.

## DELIVERY_UNKNOWN

Never auto-retry. Check the sender's Sent folder for the prospect and timestamp. If it was sent, reconcile upstream. If it definitely was not sent, deliberately create a new idempotency key and requeue after review.

## PAYLOAD_DECRYPT_FAILED

Do not retype and send immediately. First check the current and optional previous encryption keys. If the original payload cannot be recovered, cancel/reconstruct it from the upstream source under a new reviewed queue record.

## Spam/bounce signals rise

Enable emergency stop, pause affected senders, lower caps, inspect targeting/message quality/authentication, then resume only when the cause is understood.

## Prospect opts out

Record `kind=opt_out` through `/api/tte/reply-event` or add the address in the console suppression panel. The address becomes blocked across the entire sender pool and queued follow-ups for that lead are cancelled.

## Scheduled dispatch appears idle

Check in this order: delivery window, public health, emergency stop, READY queue due times, account state, daily/rolling limits, minimum interval, recipient-domain cap, then audit events for the exact block code. Outside the configured window, idle dispatch is expected and queued work remains intact.
