"""Compatibility read-only verifier for the current 222Emails flagship candidate.

`verify_apex_v2_flow.py` is the canonical detailed live-account verifier. This
wrapper keeps older workflow references safe while enforcing the current
candidate ID and delegating to the canonical verifier.
"""
import os
import runpy

requested = os.environ.get("TTE_FLAGSHIP_FLOW_ID", "VbBAhU")
if requested != "VbBAhU":
    raise SystemExit(
        f"Verification blocked for non-canonical candidate {requested}. "
        "Current candidate is VbBAhU."
    )
os.environ["TTE_APEX_V2_FLOW_ID"] = requested
runpy.run_path(os.path.join(os.path.dirname(__file__), "verify_apex_v2_flow.py"), run_name="__main__")
