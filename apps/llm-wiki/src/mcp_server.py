from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from .connectors import connector_search, connector_stats
from .hybrid import hybrid_search
from .kernel import connect, lint, stats

PROTOCOL_VERSION = "2026-07-28"
APP_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = APP_ROOT / ".data" / "wiki.db"

TOOLS = [
    {
        "name": "wiki_search",
        "description": "Search durable OMEGA/222Emails knowledge with hybrid local retrieval and provenance.",
        "inputSchema": {
            "type": "object",
            "properties": {"query": {"type": "string"}, "limit": {"type": "integer", "minimum": 1, "maximum": 25}},
            "required": ["query"],
            "additionalProperties": False,
        },
    },
    {
        "name": "wiki_context",
        "description": "Retrieve bounded durable context for an agent task. Volatile facts must still be verified live.",
        "inputSchema": {
            "type": "object",
            "properties": {"query": {"type": "string"}, "limit": {"type": "integer", "minimum": 1, "maximum": 20}},
            "required": ["query"],
            "additionalProperties": False,
        },
    },
    {
        "name": "connector_search",
        "description": "Search imported volatile connector snapshots. Results are discovery hints and require live verification before action.",
        "inputSchema": {
            "type": "object",
            "properties": {"query": {"type": "string"}, "limit": {"type": "integer", "minimum": 1, "maximum": 25}},
            "required": ["query"],
            "additionalProperties": False,
        },
    },
    {
        "name": "wiki_health",
        "description": "Return memory-kernel stats and structural lint findings.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
]


def _text(value: Any) -> list[dict[str, str]]:
    return [{"type": "text", "text": json.dumps(value, ensure_ascii=False, indent=2)}]


def call_tool(conn, name: str, args: dict[str, Any]) -> dict[str, Any]:
    if name in {"wiki_search", "wiki_context"}:
        hits = hybrid_search(conn, str(args.get("query", "")), int(args.get("limit", 8)))
        if name == "wiki_context":
            value = {
                "query": args.get("query", ""),
                "sources": hits,
                "agent_rule": "Durable memory may be used directly when canonical. Verify volatile operational facts at the live system of record before action. Never guess across conflicts.",
            }
        else:
            value = hits
        return {"content": _text(value), "structuredContent": value, "isError": False}
    if name == "connector_search":
        hits = connector_search(conn, str(args.get("query", "")), int(args.get("limit", 8)))
        value = {
            "results": hits,
            "warning": "Connector snapshots are volatile discovery context. Re-query the live source before consequential action.",
        }
        return {"content": _text(value), "structuredContent": value, "isError": False}
    if name == "wiki_health":
        value = {**stats(conn), **connector_stats(conn), "lint": lint(conn)}
        return {"content": _text(value), "structuredContent": value, "isError": False}
    return {"content": _text({"error": f"unknown tool: {name}"}), "isError": True}


def dispatch(conn, request: dict[str, Any]) -> dict[str, Any]:
    request_id = request.get("id")
    method = request.get("method")
    params = request.get("params") or {}
    if method == "server/discover":
        result = {
            "protocolVersion": PROTOCOL_VERSION,
            "serverInfo": {"name": "omega-llm-wiki", "version": "2.0.0"},
            "capabilities": {"tools": {}},
        }
    elif method == "tools/list":
        result = {"tools": TOOLS, "ttlMs": 300000, "cacheScope": "server"}
    elif method == "tools/call":
        name = str(params.get("name", ""))
        arguments = params.get("arguments") or {}
        result = call_tool(conn, name, arguments)
    else:
        return {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32601, "message": "Method not found"}}
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


class Handler(BaseHTTPRequestHandler):
    db_path = DEFAULT_DB

    def do_POST(self) -> None:
        if self.path != "/mcp":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        try:
            request = json.loads(self.rfile.read(length) or b"{}")
            conn = connect(self.db_path)
            try:
                response = dispatch(conn, request)
            finally:
                conn.close()
            payload = json.dumps(response, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("MCP-Protocol-Version", PROTOCOL_VERSION)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except (ValueError, json.JSONDecodeError) as exc:
            payload = json.dumps({"jsonrpc": "2.0", "id": None, "error": {"code": -32602, "message": str(exc)}}).encode("utf-8")
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

    def log_message(self, fmt: str, *args: object) -> None:
        return


def serve(host: str = "127.0.0.1", port: int = 8765, db_path: Path = DEFAULT_DB) -> None:
    Handler.db_path = db_path
    server = ThreadingHTTPServer((host, port), Handler)
    print(json.dumps({"server": "omega-llm-wiki", "protocol": PROTOCOL_VERSION, "url": f"http://{host}:{port}/mcp"}))
    server.serve_forever()


if __name__ == "__main__":
    serve()
