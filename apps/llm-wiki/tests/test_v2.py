from pathlib import Path
import json
import tempfile
import unittest

from src.connectors import connector_search, ingest_snapshot_file
from src.governance import governance_issues
from src.hybrid import hybrid_search
from src.kernel import connect, ingest
from src.mcp_server import dispatch


class V2Tests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "context").mkdir()
        self.db = self.root / ".data" / "wiki.db"
        self.conn = connect(self.db)
        self.config = {"include": ["context/**/*.md"], "exclude": [], "extensions": [".md"]}

    def tearDown(self):
        self.conn.close()
        self.tmp.cleanup()

    def test_hybrid_search_prefers_current_canonical(self):
        (self.root / "context" / "current.md").write_text(
            "---\nstatus: CURRENT CANONICAL\n---\n# Revenue Recovery\n\nAppointment-led revenue recovery and client return systems.",
            encoding="utf-8",
        )
        (self.root / "context" / "old.md").write_text(
            "---\nstatus: historical\n---\n# Revenue Recovery Notes\n\nAppointment-led revenue recovery notes.",
            encoding="utf-8",
        )
        ingest(self.conn, self.root, self.config)
        hits = hybrid_search(self.conn, "appointment revenue recovery", 2)
        self.assertEqual(hits[0]["path"], "context/current.md")
        self.assertIn("hybrid_score", hits[0])

    def test_connector_snapshots_are_separate_and_marked_volatile(self):
        snapshot = self.root / "gmail.json"
        snapshot.write_text(json.dumps({"records": [{
            "source": "gmail",
            "external_id": "m-1",
            "title": "Prospect reply",
            "content": "The prospect asked about pricing and next steps.",
            "uri": "gmail://m-1",
            "metadata": {"thread_id": "t-1"}
        }]}), encoding="utf-8")
        result = ingest_snapshot_file(self.conn, snapshot)
        self.assertEqual(result["records_changed"], 1)
        hits = connector_search(self.conn, "pricing", 5)
        self.assertEqual(hits[0]["source"], "gmail")
        self.assertTrue(hits[0]["volatile"])
        self.assertTrue(hits[0]["verification_required"])

    def test_governance_detects_explicit_canonical_conflict(self):
        (self.root / "context" / "a.md").write_text(
            "---\nstatus: CURRENT CANONICAL\ncanonical_key: primary_market\ncanonical_value: UK\n---\n# Market A\n",
            encoding="utf-8",
        )
        (self.root / "context" / "b.md").write_text(
            "---\nstatus: CURRENT CANONICAL\ncanonical_key: primary_market\ncanonical_value: US\n---\n# Market B\n",
            encoding="utf-8",
        )
        ingest(self.conn, self.root, self.config)
        issues = governance_issues(self.conn, stale_days=99999)
        conflicts = [i for i in issues if i["type"] == "canonical_conflict"]
        self.assertEqual(len(conflicts), 1)
        self.assertEqual(conflicts[0]["canonical_key"], "primary_market")

    def test_mcp_stateless_discovery_and_tool_call(self):
        (self.root / "context" / "positioning.md").write_text(
            "# Positioning\n\n222Emails builds client return systems.", encoding="utf-8"
        )
        ingest(self.conn, self.root, self.config)
        discovered = dispatch(self.conn, {"jsonrpc": "2.0", "id": 1, "method": "server/discover", "params": {}})
        self.assertEqual(discovered["result"]["protocolVersion"], "2026-07-28")
        called = dispatch(self.conn, {
            "jsonrpc": "2.0", "id": 2, "method": "tools/call",
            "params": {"name": "wiki_search", "arguments": {"query": "client return", "limit": 5}}
        })
        self.assertFalse(called["result"]["isError"])
        self.assertTrue(called["result"]["structuredContent"])


if __name__ == "__main__":
    unittest.main()
