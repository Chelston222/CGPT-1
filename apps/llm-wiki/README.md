# LLM Wiki Memory Kernel

The LLM Wiki is the canonical durable-memory layer beneath the 222Emails / OMEGA operating system.

It is intentionally local-first and cheap-first:

- Markdown and JSON are the durable source of truth.
- SQLite FTS5 is a disposable, rebuildable retrieval index.
- Hybrid retrieval improves fuzzy/concept matching without paid embeddings.
- Raw source files are never rewritten by ingestion.
- Live operational state stays in its live system and is queried at source.
- Connector snapshots are indexed separately and always marked volatile.
- Every durable retrieval retains source provenance.
- Agent writes to canonical knowledge are proposal-first unless explicitly approved.
- MCP exposes read-only memory tools, not canonical mutation tools.

## V2 core loop

1. **Ingest durable knowledge** from approved repository sources.
2. **Import connector snapshots** only for discovery/context acceleration.
3. **Retrieve hybrid context** using lexical + overlap + fuzzy signals + canonical weighting.
4. **Govern** canonical knowledge with structural lint, staleness checks and explicit conflict detection.
5. **Serve memory to agents** through a stateless MCP-compatible HTTP interface.
6. **Verify volatile state live** before consequential action.

## Quick start

Requires Python 3.11+ and no third-party packages.

```bash
cd apps/llm-wiki
python -m src.cli init
python -m src.cli ingest --repo ../..
python -m src.cli search "222Emails positioning"
python -m src.cli context "revenue recovery offer" --limit 8
python -m src.cli connector-ingest /path/to/snapshot.json
python -m src.cli connector-search "prospect pricing reply"
python -m src.cli lint --fail-on-error
python -m src.cli stats
python -m src.cli serve-mcp --host 127.0.0.1 --port 8765
```

The generated database defaults to `.data/wiki.db` and must not be committed.

## Connector snapshot contract

Connector ingestion accepts JSON or JSONL. A record must contain:

```json
{
  "source": "gmail",
  "external_id": "message-or-thread-id",
  "title": "Human-readable title",
  "content": "Searchable snapshot content",
  "uri": "gmail://optional-source-uri",
  "observed_at": "2026-08-30T01:00:00Z",
  "expires_at": null,
  "metadata": {"thread_id": "optional"}
}
```

Connector records are never promoted into canonical durable truth merely because they were ingested. Results carry `volatile=true` and `verification_required=true`.

## MCP

`serve-mcp` exposes a loopback-only HTTP endpoint at `/mcp`, targeting the stateless MCP `2026-07-28` request/response model.

Read-only tools:

- `wiki_search`
- `wiki_context`
- `connector_search`
- `wiki_health`

The CLI refuses a non-loopback bind. Remote exposure requires a separate authenticated deployment wrapper.

## Governance

Documents can opt into high-confidence canonical contradiction detection using metadata/frontmatter:

```yaml
---
status: CURRENT CANONICAL
canonical_key: primary_market
canonical_value: UK
updated: 2026-08-30
---
```

If two active canonical sources declare different values for the same `canonical_key`, lint raises an error and agents must not guess.

## Source policy

`config/sources.json` defines repository paths that may enter the durable knowledge index. It deliberately excludes secrets, runtime state, media, build artefacts and temporary files.

The current 222Emails canonical context pointer remains authoritative for durable strategy. Where that pointer says a fact is live, the live connector or application is authoritative instead of the wiki snapshot.

## Data model

Durable index:

- `documents`
- `chunks`
- `chunks_fts`
- `links`
- `ingest_runs`

Volatile snapshot index:

- `connector_documents`
- `connector_chunks`
- `connector_chunks_fts`

## Agent contract

Agents should use this order:

1. Retrieve from the LLM Wiki for durable context.
2. Use connector memory only to accelerate discovery.
3. Query the relevant live source for volatile state.
4. Carry provenance into decisions.
5. Treat conflicting canonical claims as a blocking lint failure.
6. Propose canonical edits; do not silently mutate source truth.

See `wiki/00-System/Memory Kernel Contract.md` for the full contract.

## V2 definition of done

- [x] Repo-aware durable ingestion
- [x] Content hashing and idempotent refresh
- [x] Provenance and bounded chunks
- [x] Zero-cost hybrid retrieval
- [x] Volatile connector snapshot index
- [x] Explicit durable/live separation
- [x] Canonical conflict detection
- [x] Canonical staleness checks
- [x] Stateless MCP read interface
- [x] Loopback safety rail
- [x] Unit tests and repository CI
- [x] No paid runtime dependency

## Future optional upgrades

True embedding/vector retrieval can be layered in later when its measured retrieval lift justifies the complexity or cost. The durable format and MCP contract do not need to change.