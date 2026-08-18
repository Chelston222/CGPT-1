const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const metaConfig = () => ({
  token: required('WHATSAPP_ACCESS_TOKEN'),
  phoneNumberId: required('WHATSAPP_PHONE_NUMBER_ID'),
  graphVersion: required('WHATSAPP_GRAPH_VERSION'),
  verifyToken: required('WHATSAPP_VERIFY_TOKEN')
});

export async function metaRequest(path, { method = 'GET', body, headers = {} } = {}) {
  const { token, graphVersion } = metaConfig();
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Meta API request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export function normalizePhone(value = '') {
  return String(value).replace(/[^0-9]/g, '');
}

export const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  body: JSON.stringify(body)
});
