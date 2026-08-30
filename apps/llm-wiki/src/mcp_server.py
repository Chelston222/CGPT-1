from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from .chat_memory import candidate_stats, chat_search, ensure_chat_schema
from .connectors import connector_search, connector_stats
from .governance import governance_issues
from .hybrid import hybrid_search
from .kernel import connect, lint, stats

PROTOCOL_VERSION = "2026-07-28"
APP_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = APP_ROOT / ".data" / "wiki.db"

SEARCH_SCHEMA = {
    "type": "object",
    "properties": {
        "query": {"type": "string", "minLength": 1},
        "limit": {"type": "integer", "minimum": 1, "maximum": 25},
        "include_history": {"type": "boolean"},
    },
    "required": ["query"],
    "additionalProperties": False,
}

TOOLS = [
    {
        "name": "search",
        "description": "Use this when ChatGPT needs to search OMEGA durable knowledge and, when useful, historical conversation evidence. Durable canonical sources rank ahead of chat history.",
        "inputSchema": SEARCH_SCHEMA,
        "annotations": {"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False, "idempotentHint": True},
    },
    {
        "name": "fetch",
        "description": "Use this when ChatGPT needs the full bounded source behind an exact result id returned by search.",
        "inputSchema": {
            "type": "object",
            "properties": {"id": {"type": "string", "minLength": 1}},
            "required": ["id"],
            "additionalProperties": False,
        },
        "annotations": {"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False, "idempotentHint": True},
    },
    {
        "name": "wiki_search",
        "description": "Search durable OMEGA/222Emails knowledge with hybrid local retrieval and provenance.",
        "inputSchema": {
            "type": "object",
            "properties": {"query": {"type": "string"}, "limit": {"type": "integer", "minimum": 1, "maximum": 25}},
            "required": ["query"],
            "additionalProperties": False,
        },
        "annotations": {"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False, "idempotentHint": True},
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
        "annotations": {"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False, "idempotentHint": True},
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
        "annotations": {"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False, "idempotentHint": True},
    },
    {
        "name": "wiki_health",
        "description": "Return memory-kernel, chat-memory and connector stats plus governance findings.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
        "annotations": {"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False, "idempotentHint": True},
    },
]


def _text(value: Any) -> list[dict[str, str]]:
    return [{"type": "text", "text": json.dumps(value, ensure_ascii=False, indent=2)}]


def _search_results(conn, query: str, limit: int, include_history: bool) -> dict[str, Any]:
    durable_limit = limit if not include_history else max(1, (limit * 2 + 2) // 3)
    history_limit = max(0, limit - durable_limit)
    durable = hybrid_search(conn, query, durable_limit)
    results: list[dict[str, Any]] = []
    for hit in durable:
        rid = f"wiki|{hit['path']}|{hit['start_line']}|{hit['end_line']}"
        results.append({
            "id": rid,
            "title": hit.get("title") or hit["path"],
            "text": hit.get("content", "")[:1200],
            "url": f"omega://wiki/{hit['path']}",
            "source_class": "durable",
            "canonical_status": hit.get("canonical_status", "indexed"),
            "score": hit.get("hybrid_score"),
        })
    if include_history and history_limit:
        for hit in chat_search(conn, query, history_limit):
            rid = f"chat|{hit['message_id']}"
            results.append({
                "id": rid,
                "title": hit.get("title") or "Chat history",
                "text": hit.get("text", "")[:1200],
                "url": f"omega://chat/{hit['conversation_id']}#{hit['message_id']}",
                "source_class": "historical_evidence",
                "canonical_status": "noncanonical",
                "role": hit.get("role"),
            })
    return {
        "results": results[:limit],
        "rules": [
            "Prefer durable current-canonical results over historical chat evidence.",
            "Chat history is evidence and provenance, not canonical truth by itself.",
            "Verify volatile operational facts at the live source before consequential action.",
        ],
    }


def _fetch_result(conn, result_id: str) -> dict[str, Any]:
    if result_id.startswith("chat|"):
        ensure_chat_schema(conn)
        message_id = result_id.split("|", 1)[1]
        row = conn.execute(
            "SELECT m.id,m.conversation_id,m.role,m.created_at,m.text,c.title FROM chat_messages m JOIN chat_conversations c ON c.id=m.conversation_id WHERE m.id=?",
            (message_id,),
        ).fetchone()
        if not row:
            raise KeyError("chat result not found")
        value = dict(row)
        value.update({"id": result_id, "source_class": "historical_evidence", "canonical_status": "noncanonical", "verification_required": True})
        return value
    if result_id.startswith("wiki|"):
        parts = result_id.rsplit("|", 2)
        if len(parts) != 3:
            raise KeyError("invalid wiki result id")
        path = parts[0][5:]
        start_line, end_line = int(parts[1]), int(parts[2])
        row = conn.execute(
            """
            SELECT d.path,d.title,d.canonical_status,d.content_hash,c.heading,c.start_line,c.end_line,c.content
            FROM chunks c JOIN documents d ON d.id=c.document_id
            WHERE d.path=? AND c.start_line=? AND c.end_line=? LIMIT 1
            """,
            (path, start_line, end_line),
        ).fetchone()
        if not row:
            raise KeyError("wiki result not found")
        value = dict(row)
        value.update({"id": result_id, "source_class": "durable", "verification_required": False})
        return value
    raise KeyError("unknown result id")


def call_tool(conn, name: str, args: dict[str, Any]) -> dict[str, Any]:
    if name == "search":
        value = _search_results(conn, str(args.get("query", "")), int(args.get("limit", 10)), bool(args.get("include_history", True)))
        return {"content": _text(value), "structuredContent": value, "isError": False}
    if name == "fetch":
        try:
            value = _fetch_result(conn, str(args.get("id", "")))
            return {"content": _text(value), "structuredContent": value, "isError": False}
        except (KeyError, ValueError) as exc:
            return {"content": _text({"error": str(exc)}), "isError": True}
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
        value = {**stats(conn), **connector_stats(conn), **candidate_stats(conn), "lint": lint(conn), "governance": governance_issues(conn)}
        return {"content": _text(value), "structuredContent": value, "isError": False}
    return {"content": _text({"error": f"unknown tool: {name}"}), "isError": True}


def dispatch(conn, request: dict[str, Any]) -> dict[str, Any] | None:
    request_id = request.get("id")
    method = request.get("method")
    params = request.get("params") or {}
    if method in {"server/discover", "initialize"}:
        result = {
            "protocolVersion": PROTOCOL_VERSION,
            "serverInfo": {"name": "omega-llm-wiki", "version": "3.0.0"},
            "capabilities": {"tools": {}},
        }
    elif method == "notifications/initialized":
        return None
    elif method == "ping":
        result = {}
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

    def do_GET(self) -> None:
        if self.path not in {"/", "/health"}:
            self.send_error(404)
            return
        payload = json.dumps({"ok": True, "server": "omega-llm-wiki", "version": "3.0.0"}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

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
            if response is None:
                self.send_response(202)
                self.end_headers()
                return
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
    print(json.dumps({"server": "omega-llm-wiki", "version": "3.0.0", "protocol": PROTOCOL_VERSION, "url": f"http://{host}:{port}/mcp"}))
    server.serve_forever()


if __name__ == "__main__":
    serve()
