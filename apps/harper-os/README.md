# HARPER OS

HARPER OS is the 222 Emails control plane for a consent-led AI revenue agent. The interface is deliberately safe-by-default: live dialling is locked until telephony, OpenAI, webhook security and UK compliance requirements are connected and validated.

## Included in this first build

- Responsive management dashboard
- Prospect intelligence briefs
- Human approval queue
- Permission-aware call gating
- Permanent suppression register
- Call outcome and QA views
- 100-point conversation-quality rubric
- Agent policy and escalation boundaries
- Integration-readiness screen
- Browser-local prototype storage and JSON export

## What remains before live calls

1. Recover or export the original Retell HARPER agent and conversation-flow JSON.
2. Add encrypted deployment variables: `RETELL_API_KEY`, `RETELL_AGENT_ID`, `OPENAI_API_KEY`, `WEBHOOK_SIGNING_SECRET` and approved calendar/CRM credentials.
3. Implement authenticated server-side storage. Do not store real prospect data in browser localStorage.
4. Add signed Retell webhook ingestion and idempotency.
5. Add explicit opt-in callback flow first.
6. Obtain UK legal/compliance review for the intended outbound use case, scripts, suppression process and data retention.
7. Run simulator, adversarial and opt-out test suites before enabling any live dial action.

## Intended architecture

```text
HARPER OS dashboard
  -> authenticated API
  -> prospect + suppression database
  -> approval and policy engine
  -> Retell voice orchestrator
  -> OpenAI reasoning / summaries / evaluations
  -> calendar, CRM and email tools
  -> signed webhook outcome pipeline
  -> QA and optimisation dashboard
```

## Current status

This branch contains a working management-interface prototype, not a live autonomous caller. Unknown or unverified contacts cannot be approved, and no API secrets are committed.

## Local preview

Open `index.html` directly in a browser, or serve the directory with any static server.
