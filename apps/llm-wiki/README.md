# LLM Wiki Memory Kernel

The LLM Wiki is the canonical durable-memory layer beneath the 222Emails / OMEGA operating system.

It is intentionally local-first and cheap-first:

- Markdown and JSON are the durable source of truth.
- SQLite FTS5 is a disposable, rebuildable retrieval index.
- Raw source files are never rewritten by ingestion.
- Live operational state stays in its live system and is queried at source.
- Every indexed chunk retains provenance back to the source path and content hash.
- Agent writes to canonical knowledge are proposal-first unless explicitly approved.

## Core loop

1. **Ingest**: discover approved source files, hash them, extract metadata and index chunks.
2. **Query**: retrieve the smallest high-signal context with source provenance.
3. **Lint**: surface stale, duplicated, orphaned or structurally unsafe knowledge.
4. **Act**: downstream agents consume retrieved context but keep their existing business review gates.

This follows the useful part of the LLM-wiki / second-brain pattern without making the model brute-force the full repository on each request.

## Quick start

Requires Python 3.11+ and no third-party packages.

```bash
cd apps/llm-wiki
python -m src.cli init
python -m src.cli ingest --repo ../..
python -m src.cli search "222Emails positioning"
python -m src.cli context "revenue recovery offer" --limit 8
python -m src.cli lint
python -m src.cli stats
```

The generated database defaults to `.data/wiki.db` and must not be committed.

## Source policy

`config/sources.json` defines repository paths that may enter the durable knowledge index. It deliberately excludes secrets, runtime state, media, build artefacts and temporary files.

The current 222Emails canonical context pointer remains authoritative for durable strategy. Where that pointer says a fact is live, the live connector or application is authoritative instead of the wiki snapshot.

## Data model

The index stores:

- `documents`: source identity, type, timestamps, hash, canonical status and metadata.
- `chunks`: bounded retrieval units with headings and line ranges.
- `chunks_fts`: FTS5 index for local lexical retrieval.
- `links`: explicit wiki-style relationships between documents.
- `ingest_runs`: audit record of index refreshes.

## Agent contract

Agents should use this order:

1. Retrieve from the LLM Wiki for durable context.
2. Query the relevant live source for volatile state.
3. Cite or carry provenance into decisions.
4. Treat conflicting canonical claims as a lint failure, not permission to guess.
5. Propose canonical edits; do not silently mutate source truth.

See `wiki/00-System/Memory Kernel Contract.md` for the full contract.

## Definition of done for v1

- [x] Repo-aware source discovery
- [x] Content hashing and idempotent ingestion
- [x] Markdown/JSON/text chunking
- [x] SQLite FTS5 retrieval
- [x] Provenance and line ranges
- [x] Wiki-link extraction
- [x] Structural linting
- [x] Agent-friendly JSON context output
- [x] Zero paid runtime dependency
- [x] CI smoke tests

## Next layer

The kernel is model-agnostic. Semantic embeddings, MCP/HTTP adapters and scheduled connector ingestion can be added behind the same contracts without changing the durable knowledge format.