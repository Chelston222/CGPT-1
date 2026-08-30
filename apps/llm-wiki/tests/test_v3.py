import json
import tempfile
import unittest
from pathlib import Path

from src.chat_memory import candidate_stats, chat_search, ingest_events, ingest_export, ingest_migration_csv, list_candidates
from src.kernel import connect, index_file
from src.mcp_server import call_tool, dispatch


class ChatMemoryV3Tests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.db = self.root / "wiki.db"
        self.conn = connect(self.db)

    def tearDown(self):
        self.conn.close()
        self.tmp.cleanup()

    def _export(self, path: Path):
        payload = [{"id":"conv-1","title":"222Emails positioning","create_time":1,"update_time":4,"current_node":"n4","mapping":{
            "n1":{"id":"n1","parent":None,"message":None},
            "n2":{"id":"n2","parent":"n1","message":{"id":"m1","author":{"role":"user"},"create_time":2,"content":{"parts":["From now on, never describe 222Emails as generic email marketing."]}}},
            "n3":{"id":"n3","parent":"n2","message":{"id":"m2","author":{"role":"assistant"},"create_time":3,"content":{"parts":["Understood."]}}},
            "n4":{"id":"n4","parent":"n3","message":{"id":"m3","author":{"role":"user"},"create_time":4,"content":{"parts":["We will go with Client Return Systems for appointment-led SMEs."]}}},
            "branch":{"id":"branch","parent":"n2","message":{"id":"ignored","author":{"role":"user"},"create_time":3.5,"content":{"parts":["Ignore this abandoned branch."]}}}
        }}]
        path.write_text(json.dumps(payload), encoding="utf-8")

    def test_backfill_active_branch_dedupe_and_candidates(self):
        export = self.root / "conversations.json"
        self._export(export)
        first = ingest_export(self.conn, export)
        second = ingest_export(self.conn, export)
        self.assertEqual(first["conversations_seen"], 1)
        self.assertEqual(first["messages_seen"], 3)
        self.assertEqual(second["messages_changed"], 0)
        stats = candidate_stats(self.conn)
        self.assertEqual(stats["chat_messages"], 3)
        self.assertGreaterEqual(stats["memory_candidates_review"], 2)
        candidates = list_candidates(self.conn)
        self.assertTrue(all(c["status"] == "review" for c in candidates))
        self.assertFalse(any("abandoned branch" in c["statement"] for c in candidates))

    def test_reviewed_migration_csv_becomes_evidence_not_canonical(self):
        csv_path = self.root / "migration.csv"
        csv_path.write_text(
            "index,chat_id,canonical_title,summary,decisions,open_loops,next_action,current_state,superseded_by,classification_confidence\n"
            "1,abc,OMEGA Memory,Recovered summary,Use structured truth,Import remaining chats,Run backfill,CURRENT,,0.95\n",
            encoding="utf-8",
        )
        result = ingest_migration_csv(self.conn, csv_path)
        self.assertEqual(result["conversations_seen"], 1)
        self.assertGreaterEqual(result["candidates_added"], 3)
        hits = chat_search(self.conn, "structured truth", 5)
        self.assertEqual(hits[0]["conversation_id"], "migration:abc")
        self.assertTrue(all(c["status"] == "review" for c in list_candidates(self.conn)))

    def test_incremental_ingest_is_idempotent(self):
        events = self.root / "events.jsonl"
        row = {"conversation_id":"live-1","message_id":"live-m1","role":"user","text":"I prefer concise UK English forever.","created_at":10}
        events.write_text(json.dumps(row) + "\n", encoding="utf-8")
        first = ingest_events(self.conn, events)
        second = ingest_events(self.conn, events)
        self.assertEqual(first["messages_changed"], 1)
        self.assertEqual(second["messages_changed"], 0)
        self.assertEqual(chat_search(self.conn, "concise English", 5)[0]["message_id"], "live-m1")

    def test_standard_search_fetch_prefers_durable_and_marks_history_noncanonical(self):
        repo = self.root / "repo"
        repo.mkdir()
        durable = repo / "context.md"
        durable.write_text("---\nstatus: CURRENT CANONICAL\n---\n# Positioning\nClient Return Systems for appointment-led SMEs.\n", encoding="utf-8")
        index_file(self.conn, repo, durable)
        events = self.root / "events.jsonl"
        events.write_text(json.dumps({"conversation_id":"c","message_id":"h1","role":"user","text":"Client Return Systems was discussed in this chat."}) + "\n", encoding="utf-8")
        ingest_events(self.conn, events)
        result = call_tool(self.conn, "search", {"query":"Client Return Systems","limit":5,"include_history":True})
        results = result["structuredContent"]["results"]
        self.assertEqual(results[0]["source_class"], "durable")
        chat_result = next(r for r in results if r["source_class"] == "historical_evidence")
        fetched = call_tool(self.conn, "fetch", {"id":chat_result["id"]})["structuredContent"]
        self.assertEqual(fetched["canonical_status"], "noncanonical")
        self.assertTrue(fetched["verification_required"])

    def test_mcp_initialize_and_tool_annotations(self):
        response = dispatch(self.conn, {"jsonrpc":"2.0","id":1,"method":"initialize","params":{}})
        self.assertEqual(response["result"]["serverInfo"]["version"], "3.0.0")
        tools = dispatch(self.conn, {"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}})["result"]["tools"]
        names = {t["name"] for t in tools}
        self.assertIn("search", names)
        self.assertIn("fetch", names)
        self.assertTrue(all(t["annotations"]["readOnlyHint"] for t in tools))


if __name__ == "__main__":
    unittest.main()
