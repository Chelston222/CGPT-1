import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import app, status, upwork_api

class UpworkOSTest(unittest.TestCase):
    def setUp(self):
        self.config=app.load_json(app.CONFIG_PATH,{})
        self.job={"source_url":"https://www.upwork.com/jobs/~test_123-XYZ","external_id":"test123","title":"Klaviyo lifecycle automation","description":"Improve retention and win-back flows","requirements":"","is_open":True,"missing_required_facts":[],"unsupported_proof_required":False}
        self.parts={"positioning_fit":25,"active_pain_urgency":15,"budget_effective_rate":12,"recurring_expansion":12,"client_quality":8,"competitive_timing":8,"proof_match":4,"delivery_feasibility":5}
    def test_score_is_apex(self):
        score,tier=app.score_job(self.parts,self.config); self.assertEqual((score,tier),(89,"APEX"))
    def test_canonical_url_identity(self):
        a=app.canonical_job_key("https://www.upwork.com/jobs/~ABC_123-XYZ?source=rss","different-id")
        b=app.canonical_job_key("https://www.upwork.com/jobs/~ABC_123-XYZ/",None)
        c=app.canonical_job_key("https://www.upwork.com/jobs/~ABC_124-XYZ/",None)
        self.assertEqual(a,b); self.assertNotEqual(a,c)
    def test_closed_job_blocked(self): self.assertEqual(app.hard_gate(dict(self.job,is_open=False),self.config,[]),"JOB_CLOSED")
    def test_duplicate_blocked(self):
        key=app.canonical_job_key(self.job["source_url"]); self.assertEqual(app.hard_gate(self.job,self.config,[{"job_key":key,"state":"SUBMITTED"}]),"DUPLICATE")
    def test_terminal_history_still_blocks_reapply(self):
        key=app.canonical_job_key(self.job["source_url"])
        for s in ("WON","LOST","SUPPRESSED","REJECTED"):
            with self.subTest(state=s): self.assertEqual(app.hard_gate(self.job,self.config,[{"job_key":key,"state":s}]),"DUPLICATE")
    def test_missing_fact_stops_submission(self): self.assertEqual(app.prepare_record(dict(self.job,missing_required_facts=["metric"]),self.parts,proposal="draft")["state"],"NEEDS_HUMAN_FACT")
    def test_unsupported_proof_rejected(self): self.assertEqual(app.prepare_record(dict(self.job,unsupported_proof_required=True),self.parts,proposal="draft")["hard_gate_reason"],"UNSUPPORTED_PROOF_REQUIRED")
    def test_good_proposal_ready_to_submit(self):
        with patch.object(app,"load_json") as load:
            load.side_effect=[self.config,[]]; r=app.prepare_record(self.job,self.parts,proposal="Evidence-grounded proposal")
        self.assertEqual(r["state"],"READY_TO_SUBMIT")
    def test_api_fails_closed(self):
        with patch.dict("os.environ",{},clear=True):
            with self.assertRaisesRegex(RuntimeError,"disabled"): upwork_api.submit_proposal({"state":"READY_TO_SUBMIT"})
    def test_state_machine_rejects_illegal_transition(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/"queue.json"; p.write_text(json.dumps([{"job_key":"x","state":"READY_TO_SUBMIT"}]))
            with patch.object(status,"QUEUE_PATH",p):
                with self.assertRaises(ValueError): status.transition("x","WON")
    def test_suppression_can_stop_ready_job(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/"queue.json"; p.write_text(json.dumps([{"job_key":"x","state":"READY_TO_SUBMIT"}]))
            with patch.object(status,"QUEUE_PATH",p): r=status.transition("x","SUPPRESSED",suppression_reason="manual stop")
        self.assertEqual(r["state"],"SUPPRESSED")
    def test_metrics(self):
        rows=[{"job_key":"a","state":"WON","submitted_at":"x","connects_spent":10,"revenue_won":1000},{"job_key":"b","state":"LOST","submitted_at":"x","connects_spent":10,"revenue_won":0}]
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/"queue.json"; p.write_text(json.dumps(rows))
            with patch.object(status,"QUEUE_PATH",p): m=status.metrics()
        self.assertEqual((m["submitted"],m["wins"],m["revenue_per_connect"]),(2,1,50))

if __name__=="__main__": unittest.main()
