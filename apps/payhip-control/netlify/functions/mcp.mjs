import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { isControlAuthorised, unauthorizedResponse } from './_shared/auth.mjs';
import { listTransactions, listSubscriptions, getTransaction, findCustomer } from './_shared/store.mjs';
import { sanitizeTransaction, summarizeTransactions } from './_shared/core.mjs';
import { listCoupons, getCoupon, createCoupon } from './_shared/payhip-api.mjs';

function textResult(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value };
}

function buildServer() {
  const server = new McpServer(
    { name: '222emails-payhip-control', version: '1.0.0' },
    { instructions: 'Use read tools freely for Payhip reporting. Creating a coupon changes the live Payhip account; only call it after the user clearly asks to create that exact coupon.' },
  );

  server.registerTool('payhip_summary', {
    title: 'Payhip sales summary',
    description: 'Use this when the user asks how Payhip sales are performing over a period.',
    inputSchema: z.object({ days: z.number().int().min(1).max(3650).default(30) }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ days }) => textResult(summarizeTransactions(await listTransactions(), { days })));

  server.registerTool('payhip_recent_sales', {
    title: 'Recent Payhip sales',
    description: 'Use this when the user asks for recent Payhip transactions or product sales. Buyer emails are excluded from this list.',
    inputSchema: z.object({ days: z.number().int().min(1).max(3650).default(30), limit: z.number().int().min(1).max(100).default(20), product: z.string().optional() }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ days, limit, product }) => {
    const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
    let rows = (await listTransactions()).filter((t) => (t.created_at ?? t.updated_at ?? 0) >= cutoff);
    if (product) {
      const needle = product.toLowerCase();
      rows = rows.filter((t) => (t.items || []).some((i) => `${i.product_name || ''} ${i.product_key || ''}`.toLowerCase().includes(needle)));
    }
    rows.sort((a, b) => (b.created_at ?? b.updated_at ?? 0) - (a.created_at ?? a.updated_at ?? 0));
    return textResult({ sales: rows.slice(0, limit).map((t) => sanitizeTransaction(t)) });
  });

  server.registerTool('payhip_get_transaction', {
    title: 'Get Payhip transaction',
    description: 'Use this when an exact Payhip transaction ID needs to be inspected. This can return the buyer email.',
    inputSchema: z.object({ transaction_id: z.string().min(1) }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ transaction_id }) => textResult((await getTransaction(transaction_id)) || { error: 'not_found' }));

  server.registerTool('payhip_find_customer', {
    title: 'Find Payhip customer',
    description: 'Use this only when the user gives an exact buyer email and asks for that customer purchase or subscription history.',
    inputSchema: z.object({ email: z.string().email() }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ email }) => textResult(await findCustomer(email)));

  server.registerTool('payhip_subscriptions', {
    title: 'Payhip subscriptions',
    description: 'Use this when the user asks for subscription status captured from Payhip webhooks.',
    inputSchema: z.object({ email: z.string().email().optional(), status: z.string().optional() }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ email, status }) => {
    let rows = await listSubscriptions();
    if (email) rows = rows.filter((s) => s.email === email.toLowerCase());
    if (status) rows = rows.filter((s) => s.status === status);
    return textResult({ subscriptions: rows.slice(0, 100) });
  });

  server.registerTool('payhip_list_coupons', {
    title: 'List Payhip coupons',
    description: 'Use this when the user asks what coupons exist in Payhip.',
    inputSchema: z.object({ limit: z.number().int().min(1).max(100).default(20), offset: z.number().int().min(0).default(0) }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  }, async ({ limit, offset }) => textResult(await listCoupons({ limit, offset })));

  server.registerTool('payhip_get_coupon', {
    title: 'Get Payhip coupon',
    description: 'Use this when an exact Payhip coupon ID needs to be inspected.',
    inputSchema: z.object({ coupon_id: z.union([z.string().min(1), z.number().int().positive()]) }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  }, async ({ coupon_id }) => textResult(await getCoupon(String(coupon_id))));

  server.registerTool('payhip_create_coupon', {
    title: 'Create Payhip coupon',
    description: 'Use this only after the user explicitly asks to create a specific coupon. It writes to the live Payhip account.',
    inputSchema: z.object({
      code: z.string().regex(/^[A-Za-z0-9_-]{2,64}$/),
      coupon_type: z.enum(['single', 'multi', 'collection']),
      percent_off: z.number().positive().max(100).optional(),
      amount_off: z.number().int().positive().optional(),
      product_key: z.string().optional(),
      collection_id: z.string().optional(),
      usage_limit: z.number().int().positive().optional(),
      notes: z.string().max(500).optional(),
    }).refine((v) => Number(v.percent_off !== undefined) + Number(v.amount_off !== undefined) === 1, { message: 'Provide exactly one of percent_off or amount_off' }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (input) => textResult(await createCoupon(input)));

  return server;
}

const handler = createMcpHandler(buildServer);

export default async (request) => {
  if (!isControlAuthorised(request)) return unauthorizedResponse();
  return handler.fetch(request);
};

export const config = { path: '/mcp' };
