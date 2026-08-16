# 222Emails Multi-Gmail Sender Control Plane

Production-oriented sender orchestration for multiple authorised Gmail accounts, built on the existing `tte-mail-bridge` rather than replacing it.

## What it solves

One central system can connect multiple authorised Gmail accounts, queue reviewed outbound messages, select a healthy sender, preserve follow-up identity/thread continuity, apply global suppression and compliance rails, pace delivery, contain provider failures and maintain an auditable operational state.

The design optimises for sender longevity and controlled delivery, not Google's theoretical maximum throughput. There is no artificial account-count ceiling in application logic. Account activation remains intentionally controlled by sender health, provider permission, recovery readiness, pacing and the global safety cap.

## Provider-policy boundary

This control plane is **not** a cold-email quota multiplier and must not be used to create or rotate Gmail accounts to evade Gmail sending restrictions or anti-abuse controls.

Legal permissibility and provider permission are separate gates. A corporate recipient with a recorded UK lawful basis does not, by itself, satisfy the provider gate. Every queued message must also carry an evidence-backed `recipientPermission`, `permissionEvidence` and `permissionRecordedAt`. The dispatcher revalidates these immediately before provider submission, so old or malformed queue records cannot bypass the rule.

Supported provider-permission bases are deliberately narrow:

- `consent`
- `soft_opt_in`
- `inbound_enquiry`
- `existing_relationship_requested`
- `existing_customer_operational`
- `internal_test`

For acquisition where the recipient has not supplied a qualifying permission/relationship signal, use a provider and workflow whose terms explicitly support that use case rather than using a pool of fresh Gmail accounts.

## Core safety guarantees

- Gmail API + OAuth 2.0 offline access, with only `openid`, `email` and `gmail.send` in the core.
- AES-256-GCM encryption for refresh tokens and queued sensitive payloads, with record-bound authenticated data.
- Separate encryption and operator bearer secrets, with optional previous-key rotation support.
- Queue-only production delivery; no immediate-send or Mailopoly direct-send bypass.
- One-recipient messages only, no CC/BCC surface.
- Human first-touch approval and explicit recipient legal-category/lawful-basis fields.
- Independent evidence-backed provider-permission gate.
- Mandatory sender identification/opt-out copy.
- One global suppression layer across all senders.
- Emergency stop before sender selection.
- Per-sender daily, rolling-24h, interval, warm-up, health and cooldown gates.
- Recipient-domain daily cap across the pool.
- Europe/London provider-delivery window, 08:00–18:00 by default, weekends included.
- Global idempotency, deterministic queue identity and single-dispatch election lease.
- Follow-ups default to the original account/thread; they wait instead of silently changing identity.
- Pre-send token/auth failures are safely retryable without damaging sender health.
- Ambiguous network/5xx outcomes after provider submission become `DELIVERY_UNKNOWN` and are never automatically retried.
- Revoked OAuth becomes `REAUTH_REQUIRED`; an operator cannot bypass that with Resume.
- Corrupt encrypted queue work fails closed instead of crash-looping the scheduler.
- Production/test Blob state isolation and automated retention cleanup for terminal payloads, counters and audits.
- Authenticated metrics/audit surfaces; minimal unauthenticated health response.
- Sender registry fields for lane, friendly label and recovery readiness, without storing passwords or full recovery phone numbers.

## Required GitHub Actions secrets

| Secret | Purpose |
|---|---|
| `NETLIFY_AUTH_TOKEN` | Deploy/synchronise the existing Netlify site. |
| `TTE_BRIDGE_TOKEN` | Strong private bearer token for the operator console and APIs. Minimum 24 characters. |
| `TTE_TOKEN_ENCRYPTION_KEY` | Different strong secret for refresh-token and queue encryption. Minimum 24 characters. |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth Web application client ID. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Matching Google OAuth client secret. |

Optional: `TTE_TOKEN_ENCRYPTION_KEY_PREVIOUS` during controlled key rotation. Existing SMTP compatibility is available only when the optional `TTE_SMTP_*` secrets are present.

Never reuse `TTE_BRIDGE_TOKEN` as the encryption key. Deployment fails closed if they match.

## Unavoidable one-time Google setup

1. Create/select one Google Cloud project.
2. Enable Gmail API.
3. Configure OAuth consent for the accounts that will connect.
4. Create an OAuth client of type **Web application**.
5. Add the exact authorised redirect URI:

   `https://222emails-mail-bridge.netlify.app/api/tte/oauth/callback`

6. Put the OAuth client ID/secret in GitHub Actions secrets.
7. For durable external-account refresh tokens, do not leave the OAuth consent app in Testing.

The application then handles account-by-account authorisation from the control centre.

## Deployment

The existing Netlify project/site ID is prewired. `TTE Mail Bridge Apex Deploy` performs preflight, installs dependencies, reruns tests/typecheck, pushes secrets and safety configuration into Netlify, deploys, then requires a `READY` production health result.

The build/runtime target is Node 24. CI uses the current Node-24 GitHub Actions runtime, runs tests, TypeScript checking and a high-severity production dependency audit. A separate scheduled smoke workflow checks the public health surface daily.

A push to `main` skips production deployment cleanly when required secrets are not present; a manual deployment fails fast until they are configured.

## Connect and manage Gmail accounts

1. Deploy successfully.
2. Open `https://222emails-mail-bridge.netlify.app`.
3. Unlock with `TTE_BRIDGE_TOKEN`.
4. Select **Connect Gmail account**.
5. Sign into one Google account and grant the send permission.
6. Repeat for each account that has a legitimate operational role.
7. Use **Profile** to assign its lane and record recovery readiness.

New accounts start in `WARMING`. Default ramp starts at 5/day, increases by 2 every 3 days, while the default account hard cap remains 10/day until deliberately raised. The control centre shows Connected, Active, Sent today, Ready queue and Suppressions at a glance, followed by every sender's lane, status, today/cap, health and recovery state.

The launch pool can be 10 accounts while the architecture remains capable of more. Adding accounts does not automatically increase permitted sending volume and should never be used to bypass provider restrictions. For intentional high concurrency, migrate the state/queue layer from serial Netlify Blobs to a transactional datastore before treating the system as a high-throughput platform.

## Send API

`POST /api/tte/send` always queues.

```json
{
  "to": ["owner@company.co.uk"],
  "subject": "Question about quieter weeks",
  "text": "Hello...\n\nIf you'd rather I didn't follow up, just let me know.",
  "leadId": "lead-123",
  "touchNo": 1,
  "idempotencyKey": "lead-123-touch-1-v1",
  "campaignName": "Client Return",
  "compliance": {
    "companyType": "corporate",
    "legalBasis": "consent",
    "recipientPermission": "consent",
    "permissionEvidence": "CRM consent event #123",
    "permissionRecordedAt": "2026-08-10T10:00:00Z"
  }
}
```

A first touch without review metadata becomes `PENDING_REVIEW`. Approval in the operator console moves it to `READY`. The serial scheduled dispatcher performs all safety checks again before provider submission and waits until the configured London delivery window when necessary.

## Mailopoly agent hook

The existing `/api/tte/agent-hook` endpoint is preserved for compatibility, but it is no longer a second SMTP delivery engine. It only authenticates and normalises the Mailopoly message, then calls the same encrypted queue used by `/api/tte/send`.

Mailopoly-originated work therefore cannot bypass provider-permission validation, legal-category validation, human review, global suppression, emergency stop, idempotency, sender health, pacing or the serial dispatcher. Messages without required permission metadata fail closed rather than being sent directly.

The old query-token digest remains supported so the already-wired integration is not broken; the hook also accepts a bearer token and can use `TTE_AGENT_HOOK_TOKEN_SHA256` to rotate the accepted digest without changing source code.

The separate `TTE Direct SMTP Verify` GitHub workflow remains intentionally isolated as an internal provider test only: its recipient is fixed to the internal receipt inbox and it has no prospect-address input.

## Reply/opt-out integration

`POST /api/tte/reply-event` accepts `reply`, `opt_out`, `bounce` or `complaint` for a lead. It stops future queued follow-ups. Opt-out, bounce and complaint also create a global suppression when an email address is supplied.

Automatic Gmail inbox reading is intentionally not part of the core because Google classifies mailbox-read scopes as restricted. A connected inbox aggregator/CRM can feed this narrow event endpoint without widening the sender application's Gmail permissions.

## Failure model

The Gmail `messages.send` API has no application idempotency key. If transport fails after Google may have received a request, blindly retrying can duplicate an email. Therefore:

- confirmed response -> `SENT`;
- pre-send token refresh/auth failure -> safe retry and, where needed, `REAUTH_REQUIRED`;
- explicit rate/quota rejection -> controlled cooldown and safe later reconsideration;
- ambiguous network or 5xx outcome after Gmail submission -> `DELIVERY_UNKNOWN`, sender quarantine, manual reconciliation;
- stale `IN_FLIGHT` -> `DELIVERY_UNKNOWN`;
- undecryptable queue payload -> `BLOCKED` with `PAYLOAD_DECRYPT_FAILED`.

## UK compliance posture

The bridge is an operational control layer, not legal advice. Default legal rules remain conservative: corporate B2B is the primary category; legitimate interests or consent must be recorded for corporate recipients; sole traders/individual-like categories require consent or soft opt-in; unknown category blocks; first touch requires human review; and one opt-out suppresses the address across every sender. Provider permission is an additional independent hard gate.

## Engineering docs

- `docs/ARCHITECTURE.md`
- `docs/SECURITY_AND_FAILURES.md`
- `docs/OPERATOR_RUNBOOK.md`
- `docs/ACCOUNT_POOL_RUNBOOK.md`
- `docs/APEX_RUBRIC.md`
