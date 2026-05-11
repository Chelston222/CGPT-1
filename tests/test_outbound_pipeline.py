import csv
import json
import tempfile
import unittest
from pathlib import Path

from scripts.outbound_pipeline import run_pipeline


ROOT = Path(__file__).resolve().parents[1]


class OutboundPipelineTests(unittest.TestCase):
    def test_sample_pipeline_generates_review_only_drafts_and_holds_uncertain_leads(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            result = run_pipeline(
                ROOT / "config/settings.example.json",
                ROOT / "data/leads.sample.csv",
                base / "output",
                base / "logs",
                base / "reports",
            )

            self.assertEqual(result.checked, 4)
            self.assertEqual(result.drafts, 2)
            self.assertEqual(result.blocked, 2)

            with (base / "output/review_queue.csv").open(encoding="utf-8") as handle:
                queue_rows = list(csv.DictReader(handle))
            self.assertEqual(len(queue_rows), 4)
            self.assertIn("draft_for_review", {row["decision"] for row in queue_rows})
            self.assertIn("needs_review", {row["compliance_status"] for row in queue_rows})
            self.assertIn("blocked", {row["compliance_status"] for row in queue_rows})

            drafts = [json.loads(line) for line in (base / "output/drafts.jsonl").read_text(encoding="utf-8").splitlines()]
            self.assertEqual(len(drafts), 2)
            self.assertTrue(all(draft["outcome"] == "pending_review" for draft in drafts))
            self.assertTrue(all("Reply 'no thanks'" in draft["draft_body"] for draft in drafts))

            summary = (base / "reports/daily_summary.md").read_text(encoding="utf-8")
            self.assertIn("Auto-send enabled: false", summary)
            self.assertIn("Human review required before sending: true", summary)

    def test_auto_send_enabled_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            settings = json.loads((ROOT / "config/settings.example.json").read_text(encoding="utf-8"))
            settings["pipeline"]["auto_send_enabled"] = True
            settings_path = base / "settings.json"
            settings_path.write_text(json.dumps(settings), encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "auto_send_enabled must remain false"):
                run_pipeline(
                    settings_path,
                    ROOT / "data/leads.sample.csv",
                    base / "output",
                    base / "logs",
                    base / "reports",
                )


if __name__ == "__main__":
    unittest.main()
