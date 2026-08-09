# 222Emails Payhip Control

Private Payhip integration layer for 222Emails.

## What it does

- Receives and verifies Payhip `paid`, `refunded`, `subscription.created` and `subscription.deleted` webhooks.
- Stores normalized event history plus current transaction/subscription state in Netlify Blobs.
- Deliberately drops Payhip IP-address data.
- Exposes bearer-protected reporting endpoints suitable for a private ChatGPT custom GPT Action.
- Proxies the currently supported Payhip Public API for coupon reads and coupon creation.
- Exposes a bearer-protected MCP endpoint at `/mcp` for a future ChatGPT plan/workspace with custom MCP support.
- Can optionally forward normalized events to a separate internal automation webhook.

## Architecture

Payhip -> `/api/payhip/webhook` -> signature check -> normalize -> Netlify Blobs

Then either:

1. ChatGPT custom GPT Action -> bearer auth -> `/api/payhip/*`
2. Future MCP-capable ChatGPT workspace -> bearer auth -> `/mcp`
3. Optional internal automation -> `OPS_FORWARD_WEBHOOK_URL`

Payhip remains the source of truth for commerce. This service is an operational read/control layer, not a replacement checkout.

## Required secrets

Set these in Netlify, never in Git:

- `PAYHIP_API_KEY`: Payhip Settings > Developer.
- `CONTROL_API_TOKEN`: a long random secret used by ChatGPT Action/MCP requests.

Optional:

- `OPS_FORWARD_WEBHOOK_URL`
- `OPS_FORWARD_WEBHOOK_BEARER`

## Payhip setup

In Payhip Settings > Developer:

1. Copy the API key into Netlify as `PAYHIP_API_KEY`.
2. Add `https://YOUR-SITE.netlify.app/api/payhip/webhook` as a webhook endpoint.
3. Enable all four supported webhook events: paid, refunded, subscription.created, subscription.deleted.
4. Do a real test purchase or a controlled free/discounted checkout and confirm `/api/health` shows a `last_event`.

Payhip signs webhook payloads with a `signature` field equal to SHA-256 of the account API key. This service verifies that value in constant time before storing anything.

## ChatGPT Plus path: custom GPT Action

At the time this app was built, full custom MCP attachment is not available on ChatGPT Plus. The practical Plus path is a private custom GPT with an Action:

1. Create/edit a private GPT.
2. Add an Action and import `https://YOUR-SITE.netlify.app/openapi.json`.
3. Authentication: API key -> Bearer.
4. Secret: the exact `CONTROL_API_TOKEN` stored in Netlify.
5. Keep the GPT private while it can access customer/order data.
6. Test read calls first: summary, sales, one known transaction.
7. Test coupon creation only with a deliberately disposable coupon code.

Suggested GPT instructions:

> You are the private 222Emails Payhip operator. Use read actions to answer Payhip sales, product, customer and subscription questions. Never invent data. Do not create a coupon unless Chelston explicitly asks for the exact discount/code/scope; repeat the intended live change before calling the create action. Treat buyer emails as private and only retrieve them when needed for the user’s explicit request.

## Future MCP path

The same deployment exposes `/mcp`. It uses MCP TypeScript SDK v2 and advertises:

- `payhip_summary`
- `payhip_recent_sales`
- `payhip_get_transaction`
- `payhip_find_customer`
- `payhip_subscriptions`
- `payhip_list_coupons`
- `payhip_get_coupon`
- `payhip_create_coupon`

The endpoint is bearer protected. Before attaching it to a production workspace, confirm the target ChatGPT plan’s current MCP authentication options; if static bearer is not supported there, add OAuth in front of this endpoint rather than making it public.

## API endpoints

Public:

- `GET /api/health` (only reports whether secrets are configured, never their values)
- `GET /openapi.json`

Payhip-only signed ingress:

- `POST /api/payhip/webhook`

Bearer protected:

- `GET /api/payhip/summary?days=30`
- `GET /api/payhip/sales?days=30&limit=20&status=paid&product=quiet`
- `GET /api/payhip/transactions/:id`
- `GET /api/payhip/customer?email=...`
- `GET /api/payhip/subscriptions?email=...&status=...`
- `GET /api/payhip/coupons?limit=20&offset=0`
- `GET /api/payhip/coupons/:id`
- `POST /api/payhip/coupons`
- `POST /mcp` and other MCP transport verbs handled by the SDK endpoint

## Money handling

Payhip webhook money values are minor units (pence/cents). The API therefore returns `*_minor` fields. Summary data is separated by currency to avoid invalid cross-currency totals.

`net_after_known_fees_minor` subtracts only fees explicitly present in the Payhip webhook payload and any recorded refund. It is not represented as accounting profit.

## QA / Omega acceptance gates

Before production use:

- [ ] `npm run qa` passes.
- [ ] Netlify deploy succeeds.
- [ ] `/api/health` is 200 and reports both required secrets configured.
- [ ] Unsigned webhook request returns 401.
- [ ] Signed Payhip test purchase returns 200 and appears in summary.
- [ ] Replaying the same webhook does not duplicate transaction state.
- [ ] Refund webhook changes status correctly.
- [ ] Recent sales omit buyer email by default.
- [ ] Exact transaction/customer lookup requires bearer auth.
- [ ] Coupon list works against Payhip API.
- [ ] Test coupon creation requires the live write action and is confirmed by checking Payhip.
- [ ] GPT Action schema imports with no validation errors.
- [ ] GPT read prompts return real values only.
- [ ] No Payhip API key or control token is committed or exposed in responses/logs.

## Scale note

Netlify Blobs is appropriate for this initial store/control workload. If transaction state grows large enough that scanning state objects becomes a latency concern, migrate the current-state layer to a queryable database while retaining the same Action/MCP contracts. The append-only event store can remain the audit source.
