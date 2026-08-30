import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import app
import status
import upwork_api


class UpworkOSTest(unittest.TestCase):
    def setUp(self):
        self.config = app.load_json(app.CONFIG_PATH, {})
        self.job = {
            "source_url": "https://www.upwork.com/jobs/~test123",
            "external_id": "test123",
            "title": "Klaviyo lifecycle automation",
            "description": "Improve retention and win-back flows",
            "requirements": "",
            "is_open": True,
            "missing_required_facts": [],
            "unsupported_proof_required": False,
        }
        self.parts = {
            "positioning_fit": 25,
            "active_pain_urgency": 15,
            "budget_effective_rate": 12,
            "recurring_expansion": 12,
            "client_quality": 8,
            "competitive_timing": 8,
            "proof_match": 4,
            "delivery_feasibility": 5,
        }

    def test_score_is_apex(self):
        score, tier = app.score_job(self.parts, self.config)
        self.assertEqual(score, 89)
        self.assertEqual(tier, "APEX")

    def test_closed_job_blocked(self):
        job = dict(self.job, is_open=False)
        self.assertEqual(app.hard_gate(job, self.config, []), "JOB_CLOSED")

    def test_duplicate_blocked(self):
        key = app.canonical_job_key(self.job["source_url"], self.job["external_id"])
        q = [{"job_key": key, "state": "SUBMITTED"}]
        self.assertEqual(app.hard_gate(self.job, self.config, q), "DUPLICATE")

    def test_missing_fact_stops_submission(self):
        job = dict(self.job, missing_required_facts=["requested case-study metric"])
        r = app.prepare_record(job, self.parts, proposal="draft")
        self.assertEqual(r["state"], "NEEDS_HUMAN_FACT")

    def test_unsupported_proof_rejected(self):
        job = dict(self.job, unsupported_proof_required=True)
        r = app.prepare_record(job, self.parts, proposal="draft")
        self.assertEqual(r["state"], "REJECTED")
        self.assertEqual(r["hard_gate_reason"], "UNSUPPORTED_PROOF_REQUIRED")

    def test_good_proposal_ready_to_submit(self):
        with patch.object(app, "load_json") as load:
            load.side_effect = [self.config, []]
            r = app.prepare_record(self.job, self.parts, proposal="Evidence-grounded proposal")
        self.assertEqual(r["state"], "READY_TO_SUBMIT")

    def test_api_fails_closed(self):
        with patch.dict("os.environ", {}, clear=True):
            self.assertFalse(upwork_api.api_enabled())
            with self.assertRaisesRegex(RuntimeError, "disabled"):
                upwork_api.submit_proposal({"state": "READY_TO_SUBMIT"})

    def test_state_machine_rejects_illegal_transition(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "queue.json"
            p.write_text(json.dumps([{"job_key":"x","state":"READY_TO_SUBMIT"}]))
            with patch.object(status, "QUEUE_PATH", p):
                with self.assertRaises(ValueError):
                    status.transition("x", "WON")

    def test_suppression_can_stop_ready_job(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "queue.json"
            p.write_text(json.dumps([{"job_key":"x","state":"READY_TO_SUBMIT"}]))
            with patch.object(status, "QUEUE_PATH", p):
                row = status.transition("x", "SUPPRESSED", suppression_reason="manual stop")
        self.assertEqual(row["state"], "SUPPRESSED")

    def test_metrics(self):
        rows = [
            {"job_key":"a","state":"WON","submitted_at":"x","connects_spent":10,"revenue_won":1000},
            {"job_key":"b","state":"LOST","submitted_at":"x","connects_spent":10,"revenue_won":0},
        ]
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "queue.json"
            p.write_text(json.dumps(rows))
            with patch.object(status, "QUEUE_PATH", p):
                m = status.metrics()
        self.assertEqual(m["submitted"], 2)
        self.assertEqual(m["wins"], 1)
        self.assertEqual(m["revenue_per_connect"], 50)


if __name__ == "__main__":
    unittest.main()
