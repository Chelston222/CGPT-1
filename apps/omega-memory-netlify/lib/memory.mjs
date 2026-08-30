export function tokenize(text) {
  return String(text || '').toLowerCase().match(/[\p{L}\p{N}£$%._-]+/gu) || [];
}

export function scoreRecord(query, record) {
  const q = new Set(tokenize(query));
  if (!q.size) return 0;
  const title = String(record.title || '');
  const text = String(record.text || '');
  const hay = new Set(tokenize(`${title} ${text}`));
  let overlap = 0;
  for (const token of q) if (hay.has(token)) overlap += 1;
  const exact = `${title} ${text}`.toLowerCase().includes(String(query).toLowerCase()) ? 1 : 0;
  const canonical = String(record.canonical_status || '').toLowerCase().includes('canonical') ? 0.25 : 0;
  const historicalPenalty = record.source_class === 'historical_evidence' ? -0.08 : 0;
  return overlap / q.size + exact * 0.35 + canonical + historicalPenalty;
}

export function searchIndex(index, query, limit = 8) {
  const records = Array.isArray(index?.records) ? index.records : [];
  return records
    .map((record) => ({...record, score: scoreRecord(query, record)}))
    .filter((record) => record.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(Number(limit) || 8, 25)));
}

export function mergeRecords(existing, incoming) {
  const map = new Map();
  for (const record of Array.isArray(existing) ? existing : []) map.set(String(record.id), record);
  for (const record of Array.isArray(incoming) ? incoming : []) {
    if (!record?.id || !record?.text) continue;
    map.set(String(record.id), record);
  }
  return [...map.values()];
}

export function authorised(req, token) {
  if (!token) return false;
  const auth = req.headers.get('authorization') || '';
  if (auth === `Bearer ${token}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get('key') === token;
}
