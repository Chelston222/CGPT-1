# OMEGA Memory Netlify Bridge

Production-shaped HTTPS bridge for the OMEGA LLM Wiki.

## Security

The service fails closed unless `OMEGA_MCP_TOKEN` exists in the Netlify production runtime.

- `OMEGA_MCP_TOKEN` protects `/mcp`
- `OMEGA_IMPORT_TOKEN` should protect `/admin/memory/import` when available
- if the platform cannot provision the dedicated import secret, the import endpoint securely falls back to `OMEGA_MCP_TOKEN` rather than opening access

The MCP surface is read-only. The import surface is separate and write-only. Do not commit either secret.

`/mcp` accepts the MCP token as `Authorization: Bearer <token>` or as `?key=<token>` for private ChatGPT app setups that preserve the configured MCP URL exactly.

## Storage

Memory is stored in Netlify Blobs under store `omega-memory`, key `memory/index.json`, using strong consistency.

Each record has this shape:

```json
{
  "id": "stable-id",
  "title": "Human title",
  "text": "Searchable memory content",
  "source_class": "durable",
  "canonical_status": "CURRENT CANONICAL",
  "updated_at": "2026-08-30T00:00:00Z",
  "volatile": false,
  "metadata": {}
}
```

Historical chat records must use `source_class: historical_evidence` and `canonical_status: noncanonical`.

## Import

POST JSON to `/admin/memory/import` with the import bearer token. If `OMEGA_IMPORT_TOKEN` is unavailable, use the MCP token fallback.

```json
{
  "mode": "merge",
  "records": []
}
```

`replace` is supported for a deliberate full rebuild. `merge` is the safer default.

## MCP

The `/mcp` function targets MCP `2026-07-28` and implements:

- `server/discover`
- `tools/list`
- `tools/call`
- `search`
- `fetch`
- `health`

Durable canonical results are weighted above historical conversation evidence. Historical evidence is explicitly marked as requiring verification before it can override current truth.

## Local validation

```bash
npm install
npm run check
npm test
```

For Netlify-native local testing use `netlify dev` from this directory.

## Deployment target

Netlify project: `omega-memory`

The site must remain unseeded and fail-closed until production authentication is configured. After deployment and seeding, verify `health`, `search`, and `fetch` through the exact HTTPS MCP URL before attaching it as a private ChatGPT app.
