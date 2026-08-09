export default async (request) => {
  const origin = new URL(request.url).origin;
  const spec = {
    openapi: '3.1.0',
    info: {
      title: '222Emails Payhip Control API',
      version: '1.0.0',
      description: 'Private control plane for Payhip sales, customers, subscriptions and supported coupon actions.',
    },
    servers: [{ url: origin }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
      schemas: {
        CouponCreate: {
          type: 'object',
          required: ['code', 'coupon_type'],
          properties: {
            code: { type: 'string', minLength: 2, maxLength: 64 },
            coupon_type: { type: 'string', enum: ['single', 'multi', 'collection'] },
            percent_off: { type: 'number', exclusiveMinimum: 0, maximum: 100 },
            amount_off: { type: 'integer', minimum: 1, description: 'Discount in minor currency units, e.g. 500 = £5.' },
            product_key: { type: 'string' },
            collection_id: { type: 'string' },
            usage_limit: { type: 'integer', minimum: 1 },
            notes: { type: 'string', maxLength: 500 },
          },
          oneOf: [{ required: ['percent_off'] }, { required: ['amount_off'] }],
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/api/payhip/summary': { get: { operationId: 'getPayhipSummary', summary: 'Summarise Payhip sales', parameters: [{ name: 'days', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 3650, default: 30 } }], responses: { 200: { description: 'Sales summary' } } } },
      '/api/payhip/sales': { get: { operationId: 'getPayhipSales', summary: 'List recent Payhip sales', parameters: [
        { name: 'days', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 3650, default: 30 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['paid', 'partially_refunded', 'refunded'] } },
        { name: 'product', in: 'query', schema: { type: 'string' } },
      ], responses: { 200: { description: 'Recent sales without buyer emails' } } } },
      '/api/payhip/transactions/{id}': { get: { operationId: 'getPayhipTransaction', summary: 'Get one Payhip transaction, including buyer email', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Transaction' }, 404: { description: 'Not found' } } } },
      '/api/payhip/customer': { get: { operationId: 'findPayhipCustomer', summary: 'Find Payhip purchase and subscription history for an exact buyer email', parameters: [{ name: 'email', in: 'query', required: true, schema: { type: 'string', format: 'email' } }], responses: { 200: { description: 'Customer history' } } } },
      '/api/payhip/subscriptions': { get: { operationId: 'getPayhipSubscriptions', summary: 'List Payhip subscription state captured from webhooks', parameters: [
        { name: 'email', in: 'query', schema: { type: 'string', format: 'email' } },
        { name: 'status', in: 'query', schema: { type: 'string' } },
      ], responses: { 200: { description: 'Subscriptions' } } } },
      '/api/payhip/coupons': {
        get: { operationId: 'listPayhipCoupons', summary: 'List Payhip coupons using the official Payhip API', parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
        ], responses: { 200: { description: 'Coupons' } } },
        post: { operationId: 'createPayhipCoupon', summary: 'Create a Payhip coupon', description: 'This changes the live Payhip account and should only run after explicit user confirmation.', 'x-openai-isConsequential': true, requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CouponCreate' } } } }, responses: { 201: { description: 'Coupon created' } } },
      },
      '/api/payhip/coupons/{id}': { get: { operationId: 'getPayhipCoupon', summary: 'Get one Payhip coupon by ID', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Coupon' } } } },
    },
  };
  return Response.json(spec, { headers: { 'cache-control': 'public, max-age=300' } });
};

export const config = { path: '/openapi.json' };
