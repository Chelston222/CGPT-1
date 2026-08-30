import unittest

import app


class UpworkApplicationOSTests(unittest.TestCase):
    def setUp(self):
        self.config = app.load_json(app.CONFIG_PATH, {})

    def test_score_tiers(self):
        parts = {
            "positioning_fit": 25,
            "active_pain_urgency": 15,
            "budget_effective_rate": 15,
            "recurring_expansion": 15,
            "client_quality": 10,
            "competitive_timing": 10,
            "proof_match": 5,
            "delivery_feasibility": 5,
        }
        total, tier = app.score_job(parts, self.config)
        self.assertEqual(total, 100)
        self.assertEqual(tier, "APEX")

    def test_closed_job_blocked(self):
        job = {"source_url": "https://example.test/jobs/closed", "is_open": False}
        self.assertEqual(app.hard_gate(job, self.config, []), "JOB_CLOSED")

    def test_missing_fact_blocked(self):
        job = {
            "source_url": "https://example.test/jobs/facts",
            "is_open": True,
            "missing_required_facts": ["requested case-study metric"],
        }
        self.assertEqual(app.hard_gate(job, self.config, []), "MISSING_REQUIRED_FACT")

    def test_unsupported_proof_blocked(self):
        job = {
            "source_url": "https://example.test/jobs/proof",
            "is_open": True,
            "unsupported_proof_required": True,
        }
        self.assertEqual(app.hard_gate(job, self.config, []), "UNSUPPORTED_PROOF_REQUIRED")

    def test_duplicate_blocked(self):
        url = "https://example.test/jobs/dup"
        key = app.canonical_job_key(url)
        queue = [{"job_key": key, "state": "SUBMITTED"}]
        job = {"source_url": url, "is_open": True}
        self.assertEqual(app.hard_gate(job, self.config, queue), "DUPLICATE")

    def test_rejected_low_score(self):
        parts = {key: 0 for key in self.config["weights"]}
        total, tier = app.score_job(parts, self.config)
        self.assertEqual(total, 0)
        self.assertEqual(tier, "REJECT")


if __name__ == "__main__":
    unittest.main()
