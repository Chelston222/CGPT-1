from __future__ import annotations

import argparse
import json
from pathlib import Path

from .connectors import connector_search, connector_stats, ingest_snapshot_file
from .governance import governance_issues
from .hybrid import hybrid_search
from .kernel import connect, ingest, lint, load_source_config, stats

APP_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = APP_ROOT / ".data" / "wiki.db"
DEFAULT_CONFIG = APP_ROOT / "config" / "sources.json"


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="222Emails / OMEGA LLM Wiki memory kernel")
    p.add_argument("--db", type=Path, default=DEFAULT_DB)
    p.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    sub = p.add_subparsers(dest="command", required=True)

    sub.add_parser("init")

    ing = sub.add_parser("ingest")
    ing.add_argument("--repo", type=Path, default=APP_ROOT.parents[1])

    sea = sub.add_parser("search")
    sea.add_argument("query")
    sea.add_argument("--limit", type=int, default=10)

    ctx = sub.add_parser("context")
    ctx.add_argument("query")
    ctx.add_argument("--limit", type=int, default=8)

    con = sub.add_parser("connector-ingest")
    con.add_argument("snapshot", type=Path)

    csea = sub.add_parser("connector-search")
    csea.add_argument("query")
    csea.add_argument("--limit", type=int, default=10)

    lin = sub.add_parser("lint")
    lin.add_argument("--fail-on-error", action="store_true")
    lin.add_argument("--stale-days", type=int, default=180)

    sub.add_parser("stats")

    srv = sub.add_parser("serve-mcp")
    srv.add_argument("--host", default="127.0.0.1")
    srv.add_argument("--port", type=int, default=8765)
    return p


def print_json(value: object) -> None:
    print(json.dumps(value, indent=2, ensure_ascii=False))


def main() -> int:
    args = parser().parse_args()
    if args.command == "serve-mcp":
        if args.host not in {"127.0.0.1", "localhost", "::1"}:
            raise SystemExit("Refusing non-loopback MCP bind without an authenticated deployment wrapper.")
        from .mcp_server import serve
        serve(args.host, args.port, args.db)
        return 0

    conn = connect(args.db)
    try:
        if args.command == "init":
            print_json({"ok": True, "db": str(args.db)})
            return 0
        if args.command == "ingest":
            config = load_source_config(args.config)
            result = ingest(conn, args.repo.resolve(), config)
            print_json({"ok": True, **result})
            return 0
        if args.command == "search":
            print_json(hybrid_search(conn, args.query, args.limit))
            return 0
        if args.command == "context":
            hits = hybrid_search(conn, args.query, args.limit)
            payload = {
                "query": args.query,
                "retrieved": len(hits),
                "sources": [
                    {
                        "path": h["path"],
                        "title": h["title"],
                        "heading": h["heading"],
                        "lines": [h["start_line"], h["end_line"]],
                        "canonical_status": h["canonical_status"],
                        "hybrid_score": h["hybrid_score"],
                        "content": h["content"],
                    }
                    for h in hits
                ],
                "agent_rule": "Use durable wiki context first; verify volatile state at its live source; preserve provenance; do not guess across conflicts.",
            }
            print_json(payload)
            return 0
        if args.command == "connector-ingest":
            result = ingest_snapshot_file(conn, args.snapshot)
            print_json({"ok": True, **result})
            return 0
        if args.command == "connector-search":
            print_json(connector_search(conn, args.query, args.limit))
            return 0
        if args.command == "lint":
            issues = lint(conn) + governance_issues(conn, args.stale_days)
            print_json({"issues": issues, "count": len(issues)})
            if args.fail_on_error and any(i["severity"] == "error" for i in issues):
                return 2
            return 0
        if args.command == "stats":
            print_json({**stats(conn), **connector_stats(conn), "governance_issues": len(governance_issues(conn))})
            return 0
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
