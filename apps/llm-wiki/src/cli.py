from __future__ import annotations

import argparse
import json
from pathlib import Path

from .kernel import connect, ingest, lint, load_source_config, search, stats

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

    lin = sub.add_parser("lint")
    lin.add_argument("--fail-on-error", action="store_true")

    sub.add_parser("stats")
    return p


def print_json(value: object) -> None:
    print(json.dumps(value, indent=2, ensure_ascii=False))


def main() -> int:
    args = parser().parse_args()
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
            print_json(search(conn, args.query, args.limit))
            return 0
        if args.command == "context":
            hits = search(conn, args.query, args.limit)
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
                        "content": h["content"],
                    }
                    for h in hits
                ],
                "agent_rule": "Use durable wiki context first; verify volatile state at its live source; do not guess across conflicts.",
            }
            print_json(payload)
            return 0
        if args.command == "lint":
            issues = lint(conn)
            print_json({"issues": issues, "count": len(issues)})
            if args.fail_on_error and any(i["severity"] == "error" for i in issues):
                return 2
            return 0
        if args.command == "stats":
            print_json(stats(conn))
            return 0
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
