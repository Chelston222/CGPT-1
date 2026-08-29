from pathlib import Path
import tempfile
import unittest

from src.kernel import connect, ingest, lint, search, stats


class KernelTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "context").mkdir()
        (self.root / "wiki").mkdir()
        self.db = self.root / ".data" / "wiki.db"
        self.conn = connect(self.db)
        self.config = {
            "include": ["context/**/*.md", "wiki/**/*.md"],
            "exclude": ["**/.env*"],
            "extensions": [".md"]
        }

    def tearDown(self):
        self.conn.close()
        self.tmp.cleanup()

    def test_ingest_is_idempotent_and_search_keeps_provenance(self):
        source = self.root / "context" / "positioning.md"
        source.write_text(
            "# Positioning\n\n222Emails is a Revenue Recovery Systems company for appointment-led SMEs.\n",
            encoding="utf-8",
        )
        first = ingest(self.conn, self.root, self.config)
        second = ingest(self.conn, self.root, self.config)
        self.assertEqual(first["files_changed"], 1)
        self.assertEqual(second["files_changed"], 0)
        hits = search(self.conn, "Revenue Recovery", 5)
        self.assertTrue(hits)
        self.assertEqual(hits[0]["path"], "context/positioning.md")
        self.assertGreaterEqual(hits[0]["start_line"], 1)
        self.assertGreaterEqual(hits[0]["end_line"], hits[0]["start_line"])

    def test_removed_source_is_removed_from_index(self):
        source = self.root / "context" / "temporary.md"
        source.write_text("# Temporary\n\nOld knowledge.", encoding="utf-8")
        ingest(self.conn, self.root, self.config)
        source.unlink()
        result = ingest(self.conn, self.root, self.config)
        self.assertEqual(result["files_removed"], 1)
        self.assertEqual(stats(self.conn)["documents"], 0)

    def test_wikilink_lint_flags_unresolved_target(self):
        source = self.root / "wiki" / "source.md"
        source.write_text("# Source\n\nSee [[Missing Page]].", encoding="utf-8")
        ingest(self.conn, self.root, self.config)
        issues = lint(self.conn)
        unresolved = [i for i in issues if i["type"] == "unresolved_wikilink"]
        self.assertEqual(len(unresolved), 1)
        self.assertEqual(unresolved[0]["target"], "Missing Page")


if __name__ == "__main__":
    unittest.main()
