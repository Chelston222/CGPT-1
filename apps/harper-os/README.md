# HARPER OS

HARPER OS is the 222 Emails control plane for a consent-led AI revenue agent. It combines a secure operator dashboard, persistent prospect and suppression storage, guarded Retell calling, signed webhook ingestion, call outcome tracking and follow-up handoff.

## Recovered Harper configuration

The 28 July 2026 recovery handoff confirmed the original Harper V3.3 Retell configuration and historical service locators:

- Historical agent: `agent_d4cd49d68dc5a1b497a9e7456f`
- Conversation flow: `conversation_flow_eb9c7e0af6e0`
- Historical outbound number: `+441254963222`
- Booking route: `https://calendly.com/tripletwochelston/10min`
- Portable export SHA-256: `46a567cfac7522f47a77fc3549f8df1dfa839d4372b435543b25e142d37e7372`

The release contract is stored in `config/harper-v3.3-manifest.json`. Historical identifiers are recovery locators, not proof that current authentication or telephone binding is healthy.

## Included

- Responsive management dashboard
- Prospect intelligence and human approval queue
- Permission-aware call gating
- Permanent suppression register
- Persistent Netlify Blobs storage
- Guarded Retell outbound-call endpoint
- Signed Retell webhook processing and idempotency
- Call outcomes, QA and follow-up handoff
- Truthful `/api/health` readiness endpoint
- Security headers and environment contract
- GitHub continuous validation workflow

## Production environment

Required secrets and settings:

```text
HARPER_ADMIN_TOKEN
RETELL_API_KEY
RETELL_AGENT_ID
RETELL_FROM_NUMBER
RETELL_WEBHOOK_SECRET
OPENAI_API_KEY
CALENDAR_BOOKING_URL
FOLLOWUP_WEBHOOK_URL
```

Optional CRM settings may be added through the follow-up webhook or a dedicated CRM adapter.

## Non-negotiable release gates

Live dialling must remain disabled until all of these pass:

1. Retell credentials verified against the intended account.
2. Agent and telephone binding verified.
3. Signed webhook delivery verified.
4. Internal opted-in QA call completed.
5. Immediate opt-out suppression tested end to end.
6. Calendar and follow-up delivery tested.
7. UK compliance review recorded for the intended campaign.

The application is deliberately fail-closed. A missing credential, unknown permission status, unapproved prospect or suppressed number prevents dialling.

## Validation

Run:

```bash
npm install
npm run check
```

GitHub Actions repeats source validation for every Harper OS pull request and push to `main`.

## Deployment

The dedicated Netlify project is `harper-os-222emails` with site ID `5d178d96-a548-4f4b-bc95-08e810541586`. A live deploy still requires the repository/build connection and encrypted environment values. Never commit secrets to GitHub.
