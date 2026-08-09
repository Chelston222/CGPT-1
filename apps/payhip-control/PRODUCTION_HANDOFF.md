# 222Emails Payhip Control — Production Handoff

Status: code-complete, CI-gated, not yet production-live.

## Production resources

- GitHub repository: `Chelston222/CGPT-1`
- Integration branch: `agent/payhip-chatgpt-control`
- Draft PR: `#28` — Add Payhip ChatGPT control plane
- Netlify project: `222emails-payhip-control`
- Netlify site ID: `075441cb-4363-4102-8567-7f8026d21643`
- Netlify base directory: `apps/payhip-control`

Keep PR #28 in draft until every acceptance gate at the bottom of this document passes.

## Cutover order

Follow this order exactly. Do not expose the Payhip API key to ChatGPT and do not put secrets in GitHub source files.

### 1. Deploy the dedicated Netlify project

Connect the Netlify project `222emails-payhip-control` to `Chelston222/CGPT-1` and configure:

- Production branch: `agent/payhip-chatgpt-control` for pre-merge acceptance testing, then change to `main` after merge.
- Base directory: `apps/payhip-control`
- Publish directory: `public`
- Functions directory: `netlify/functions`

The repository already contains `netlify.toml`, so Netlify should use those settings once the correct base directory is selected.

Do not reuse the Harper OS site. Commerce credentials must remain isolated in this dedicated project.

### 2. Create and set secrets in Netlify

Create a fresh, high-entropy control token locally. Example:

```bash
openssl rand -base64 48
```

Set both variables as secret/runtime environment variables in the dedicated Netlify project:

- `PAYHIP_API_KEY` = value from Payhip **Settings > Developer**
- `CONTROL_API_TOKEN` = the newly generated control token

Optional only if an internal automation receiver is deliberately added later:

- `OPS_FORWARD_WEBHOOK_URL`
- `OPS_FORWARD_WEBHOOK_BEARER`

Never reuse a token that has appeared in chat logs or failed tool calls. Generate a fresh one for production.

### 3. Verify the deployed service before Payhip writes to it

Open:

- `/api/health`
- `/openapi.json`

Expected health result:

- HTTP 200
- `ok: true`
- `configured.payhip_api_key: true`
- `configured.control_api_token: true`
- no secret values in the response

Negative authentication test:

```bash
curl -i https://YOUR-SITE/api/payhip/summary
```

Expected: HTTP 401.

Positive authentication test:

```bash
curl -sS \
  -H "Authorization: Bearer $CONTROL_API_TOKEN" \
  "https://YOUR-SITE/api/payhip/summary?days=30"
```

Expected: HTTP 200 with a valid, possibly empty, summary.

### 4. Configure Payhip webhooks

In Payhip **Settings > Developer**, add the deployed endpoint:

`https://YOUR-SITE/api/payhip/webhook`

Enable all four supported events:

1. `paid`
2. `refunded`
3. `subscription.created`
4. `subscription.deleted`

Do not use a generic automation URL as the primary receiver. Payhip should hit this verifier first so unsigned/invalid payloads are rejected before storage or onward automation.

### 5. Configure Payhip → Klaviyo directly

Use Payhip's native Klaviyo integration for marketing-list handoff. This control service is not the marketing-consent authority.

For each product that should nurture into 222Emails services:

1. Connect Klaviyo using the required API access.
2. Map the product buyer to the intended Klaviyo list/flow.
3. Keep the appropriate UK/EU consent behaviour enabled.
4. Verify a buyer who does not consent to marketing is not silently forced into a promotional flow.
5. Keep transactional delivery separate from optional marketing nurture.

### 6. Run the real commerce acceptance test

Use a controlled product/test checkout. Prefer a deliberately free or deeply discounted private test code if appropriate rather than altering a real customer order.

For a successful purchase, verify all of the following:

1. Payhip checkout completes.
2. Customer receives the correct digital delivery.
3. Payhip sends a `paid` webhook.
4. `/api/health` gains `last_event` metadata.
5. Authenticated `/api/payhip/sales` shows the transaction.
6. General sales results do not expose buyer email.
7. Exact `/api/payhip/transactions/:id` returns the buyer detail when explicitly requested.
8. The expected Klaviyo consent/list behaviour occurs.

Replay test:

- resend/replay the same webhook if Payhip tooling permits, or submit an identical signed fixture in a controlled test environment.
- transaction state must not duplicate.

Refund test:

1. Refund the controlled test transaction through the payment-provider/Payhip-supported refund path.
2. Verify Payhip sends `refunded`.
3. Verify transaction status becomes `partially_refunded` or `refunded` as appropriate.
4. Verify the summary reflects the refund without combining currencies.

### 7. Connect the private ChatGPT GPT Action

Create or edit a **private** GPT for Payhip operations.

Import the deployed schema:

`https://YOUR-SITE/openapi.json`

Action authentication:

- type: API key
- auth type: Bearer
- secret: the exact fresh `CONTROL_API_TOKEN` stored in Netlify

Recommended GPT instructions:

> You are the private 222Emails Payhip operator. Use read actions to answer Payhip sales, product, customer and subscription questions. Never invent data. General sales queries should not reveal buyer emails. Retrieve buyer-identifying detail only when Chelston explicitly asks for a specific customer or transaction. Do not create a coupon unless Chelston explicitly requests the exact code, discount and scope. State the intended live change immediately before calling the coupon-creation action.

Read-only acceptance prompts:

- `How many Payhip transactions have we had in the last 30 days?`
- `What are our top Payhip products in the last 30 days?`
- `Show me the latest five Payhip sales.`
- `Find transaction <known test transaction id>.`
- `What Payhip coupons currently exist?`

All answers must match source data. No fabricated sales, products, customers or revenue.

### 8. Test the one enabled live mutation

Coupon creation is the only general-account live mutation deliberately exposed in v1.

Use a disposable test code such as a clearly labelled internal QA coupon. Explicitly specify:

- code
- percentage or fixed discount
- scope: single product, multi product or collection
- product key / collection ID when required
- usage limit if desired

Verify the coupon exists in Payhip after ChatGPT performs the action. Remove/disable it manually in Payhip after the test if it should not remain live.

Do not claim product creation/editing, order refund actions or broad customer CRUD from ChatGPT. Payhip's current public API does not provide those general account operations.

### 9. MCP future cutover

The same deployed service exposes `/mcp` and the tool set is already implemented. Keep it unused until the target ChatGPT plan/workspace supports the required custom MCP connection and authentication method.

Before attaching MCP in production:

1. Re-check current OpenAI MCP authentication requirements.
2. If static bearer is not accepted, add OAuth in front of `/mcp` rather than making it unauthenticated.
3. Repeat the same read-first and mutation-last acceptance suite.

No backend rewrite should be needed unless the platform contract changes.

### 10. Merge and switch production branch

Only after all gates pass:

1. Mark PR #28 ready for review.
2. Re-run/confirm GitHub CI is green on the final head SHA.
3. Merge PR #28 to `main`.
4. Change the dedicated Netlify project's production branch to `main` if it was temporarily deploying the integration branch.
5. Deploy `main`.
6. Re-run `/api/health`, one authenticated read and one Payhip webhook smoke test.

## Rollback

If any production gate fails:

1. Disable/remove the Payhip webhook endpoint so no new events enter the bridge.
2. Remove/rotate the GPT Action `CONTROL_API_TOKEN` in both Netlify and the GPT configuration.
3. Disable the GPT Action or keep the GPT private and unused.
4. Roll Netlify back to the last known-good deploy or stop publishing the project.
5. Leave Payhip checkout itself running. This integration is intentionally not in the payment path, so a bridge failure must not stop customers buying or receiving their Payhip products.
6. Keep PR #28 unmerged until the fault is fixed and the regression suite passes again.

## Production acceptance gates

### Code and CI

- [x] Syntax checks pass.
- [x] Core regression suite passes locally.
- [x] Clean GitHub dependency install passes.
- [x] MCP/control/webhook runtime import smoke test passes in GitHub Actions.
- [x] No real credentials are committed.
- [x] Generic sales results redact buyer email.
- [x] Full and partial refund logic covered.
- [x] Subscription create/cancel logic covered.
- [x] Unknown webhook event rejection covered.
- [x] OpenAPI Action schema contract covered.

### Hosting and secrets

- [x] Dedicated Netlify project created.
- [ ] Repository deployed to dedicated Netlify project.
- [ ] Fresh `CONTROL_API_TOKEN` added as a Netlify secret.
- [ ] `PAYHIP_API_KEY` added as a Netlify secret.
- [ ] `/api/health` reports both configured.
- [ ] unauthenticated control request returns 401.
- [ ] authenticated summary request returns 200.

### Payhip and marketing

- [ ] all four Payhip webhook events configured.
- [ ] signed real `paid` event accepted.
- [ ] replay does not duplicate state.
- [ ] controlled refund correctly updates state.
- [ ] Payhip → Klaviyo direct integration configured.
- [ ] marketing-consent behaviour verified.

### ChatGPT

- [ ] private GPT Action imports `/openapi.json` without errors.
- [ ] bearer auth succeeds.
- [ ] summary/recent-sales/product questions match Payhip-derived data.
- [ ] exact customer/transaction lookup works only when requested.
- [ ] disposable test coupon can be created and verified in Payhip.
- [ ] no unsupported product/customer/refund write capability is claimed.

### Final

- [ ] PR #28 marked ready only after the live gates above pass.
- [ ] PR #28 merged.
- [ ] Netlify production source switched to `main`.
- [ ] post-merge smoke test passes.

Until every unchecked production gate passes, status remains **built and validated, not production-live**.
