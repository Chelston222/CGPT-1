#!/usr/bin/env python3
"""222Emails Phase 1 outbound pipeline.

This script is deliberately dependency-free so it can run locally or in a free
GitHub Actions workflow. It cleans and deduplicates leads, applies a conservative
ICP/compliance score, generates human-review-only Gmail draft copy, and writes an
audit trail plus a daily summary.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REQUIRED_LEAD_FIELDS = [
    "business_name",
    "contact_name",
    "website",
    "city",
    "sector",
    "company_type",
    "email",
    "source",
    "status",
    "notes",
    "last_checked_at",
]

OUTPUT_FIELDS = [
    "lead_id",
    *REQUIRED_LEAD_FIELDS,
    "score",
    "compliance_status",
    "decision",
    "decision_reason",
    "campaign_name",
    "draft_subject",
]


@dataclass
class PipelineResult:
    checked: int = 0
    valid: int = 0
    duplicates: int = 0
    blocked: int = 0
    queued: int = 0
    drafts: int = 0
    errors: list[str] = field(default_factory=list)


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def normalise(value: Any) -> str:
    return str(value or "").strip()


def normalise_key(value: Any) -> str:
    return normalise(value).lower()


def load_settings(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def read_leads(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        missing = [field for field in REQUIRED_LEAD_FIELDS if field not in (reader.fieldnames or [])]
        if missing:
            raise ValueError(f"Lead CSV is missing required fields: {', '.join(missing)}")
        return [{field: normalise(row.get(field)) for field in REQUIRED_LEAD_FIELDS} for row in reader]


def lead_id_for(lead: dict[str, str]) -> str:
    source = "|".join([normalise_key(lead.get("email")), normalise_key(lead.get("website"))])
    return hashlib.sha256(source.encode("utf-8")).hexdigest()[:12]


def validate_lead(lead: dict[str, str]) -> list[str]:
    errors = []
    for field in ["business_name", "website", "city", "sector", "company_type", "email", "source", "status"]:
        if not normalise(lead.get(field)):
            errors.append(f"missing_{field}")
    if "@" not in normalise(lead.get("email")):
        errors.append("invalid_email")
    if normalise(lead.get("website")) and not normalise(lead.get("website")).startswith(("http://", "https://")):
        errors.append("invalid_website")
    return errors


def classify_compliance(lead: dict[str, str], settings: dict[str, Any]) -> tuple[str, str]:
    status = normalise_key(lead.get("status"))
    blocked_statuses = set(settings["compliance"].get("blocked_statuses", []))
    if status in blocked_statuses:
        return "blocked", f"status_is_{status}"

    company_type = normalise_key(lead.get("company_type"))
    allowed_types = set(settings["compliance"].get("allowed_company_types", []))
    if company_type not in allowed_types:
        return "needs_review", "company_type_not_clearly_corporate_b2b"

    return "allowed", "corporate_b2b_category_clear"


def score_lead(lead: dict[str, str], settings: dict[str, Any]) -> tuple[int, list[str]]:
    scoring = settings.get("scoring", {})
    score = 0
    reasons: list[str] = []

    if normalise(lead.get("city")):
        score += int(scoring.get("city_bonus", 0))
        reasons.append("city_present")

    if normalise_key(lead.get("sector")) in set(scoring.get("preferred_sectors", [])):
        score += int(scoring.get("sector_bonus", 0))
        reasons.append("preferred_sector")

    if normalise_key(lead.get("company_type")) in set(scoring.get("preferred_company_types", [])):
        score += int(scoring.get("company_type_bonus", 0))
        reasons.append("preferred_company_type")

    if normalise(lead.get("website")):
        score += int(scoring.get("website_bonus", 0))
        reasons.append("website_present")

    if normalise(lead.get("notes")):
        score += int(scoring.get("notes_bonus", 0))
        reasons.append("operator_notes_present")

    return score, reasons


def draft_for(lead: dict[str, str], settings: dict[str, Any]) -> tuple[str, str]:
    operator = settings["operator"]
    opt_out = settings["compliance"]["required_opt_out_text"]
    business_name = lead["business_name"]
    first_name = lead["contact_name"] or "there"
    sector = lead["sector"]
    city = lead["city"]
    note = lead["notes"] or "your booking flow"

    subject = f"Quick idea for {business_name}'s quieter weeks"
    body = (
        f"Hi {first_name},\n\n"
        f"I noticed {business_name} while looking at {sector} businesses in {city}. "
        f"The note I made was: {note}.\n\n"
        f"222Emails helps local service businesses fill quiet weeks and bring past clients back "
        f"with a simple repeat-booking email system installed once and reviewed before anything goes out.\n\n"
        f"If useful, I can send a short fit check showing where the biggest booking leakage might be.\n\n"
        f"Best,\n{operator['sender_name']}\n{operator['business_name']}\n{operator['website']}\n\n"
        f"{opt_out}"
    )
    return subject, body


def write_csv(path: Path, rows: list[dict[str, Any]], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def append_jsonl(path: Path, records: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, sort_keys=True) + "\n")


def write_jsonl(path: Path, records: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, sort_keys=True) + "\n")


def write_summary(path: Path, result: PipelineResult, settings: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    auto_send = settings["pipeline"].get("auto_send_enabled", False)
    lines = [
        "# 222Emails Daily Outbound Summary",
        "",
        f"Generated at: {utc_now()}",
        "",
        "## Counts",
        f"- Leads checked: {result.checked}",
        f"- Valid leads: {result.valid}",
        f"- Duplicates skipped: {result.duplicates}",
        f"- Blocked or held: {result.blocked}",
        f"- Review queue rows: {result.queued}",
        f"- Drafts generated: {result.drafts}",
        "",
        "## Safety posture",
        f"- Auto-send enabled: {str(auto_send).lower()}",
        "- Human review required before sending: true",
        "- Gmail draft creation is represented as export files only until credentials are configured.",
    ]
    if result.errors:
        lines.extend(["", "## Errors", *[f"- {error}" for error in result.errors]])
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_pipeline(settings_path: Path, leads_path: Path, output_dir: Path, logs_dir: Path, reports_dir: Path) -> PipelineResult:
    settings = load_settings(settings_path)
    if settings["pipeline"].get("auto_send_enabled"):
        raise ValueError("auto_send_enabled must remain false for Phase 1")

    leads = read_leads(leads_path)
    result = PipelineResult(checked=len(leads))
    seen_keys: set[str] = set()
    queue_rows: list[dict[str, Any]] = []
    draft_rows: list[dict[str, Any]] = []
    audit_rows: list[dict[str, Any]] = []
    max_drafts = int(settings["pipeline"].get("max_daily_drafts", 25))
    minimum_score = int(settings["pipeline"].get("minimum_score_for_draft", 60))

    for lead in leads:
        lead_id = lead_id_for(lead)
        errors = validate_lead(lead)
        audit_base = {
            "timestamp": utc_now(),
            "system_step": "lead_pipeline",
            "input_ref": lead_id,
        }

        dedupe_key = normalise_key(lead.get("email")) or normalise_key(lead.get("website"))
        if dedupe_key in seen_keys:
            result.duplicates += 1
            audit_rows.append({**audit_base, "action_taken": "skip_duplicate", "result": "blocked", "error_if_any": "duplicate_contact"})
            continue
        seen_keys.add(dedupe_key)

        if errors:
            result.errors.append(f"{lead_id}: {', '.join(errors)}")
            result.blocked += 1
            audit_rows.append({**audit_base, "action_taken": "validate", "result": "blocked", "error_if_any": ",".join(errors)})
            continue

        result.valid += 1
        compliance_status, compliance_reason = classify_compliance(lead, settings)
        score, score_reasons = score_lead(lead, settings)
        decision = "hold"
        decision_reason = compliance_reason
        subject = ""
        body = ""

        if compliance_status == "allowed" and score >= minimum_score and len(draft_rows) < max_drafts:
            decision = "draft_for_review"
            decision_reason = ";".join(score_reasons)
            subject, body = draft_for(lead, settings)
            draft_rows.append({
                "lead_id": lead_id,
                "campaign_name": "phase1_fit_check",
                "draft_subject": subject,
                "draft_body": body,
                "created_at": utc_now(),
                "reviewed_by": "",
                "sent_at": "",
                "outcome": "pending_review",
            })
            result.drafts += 1
        else:
            result.blocked += 1
            if compliance_status != "allowed":
                decision_reason = compliance_reason
            elif score < minimum_score:
                decision_reason = f"score_below_threshold_{score}_lt_{minimum_score}"
            else:
                decision_reason = "max_daily_drafts_reached"

        queue_rows.append({
            **lead,
            "lead_id": lead_id,
            "score": score,
            "compliance_status": compliance_status,
            "decision": decision,
            "decision_reason": decision_reason,
            "campaign_name": "phase1_fit_check" if decision == "draft_for_review" else "",
            "draft_subject": subject,
        })
        audit_rows.append({**audit_base, "action_taken": decision, "result": compliance_status, "error_if_any": "" if decision == "draft_for_review" else decision_reason})

    result.queued = len(queue_rows)
    write_csv(output_dir / "review_queue.csv", queue_rows, OUTPUT_FIELDS)
    write_jsonl(output_dir / "drafts.jsonl", draft_rows)
    append_jsonl(logs_dir / "audit.jsonl", audit_rows)
    write_summary(reports_dir / "daily_summary.md", result, settings)
    return result


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the 222Emails Phase 1 outbound pipeline.")
    parser.add_argument("--settings", type=Path, default=Path("config/settings.example.json"))
    parser.add_argument("--leads", type=Path, default=Path("data/leads.sample.csv"))
    parser.add_argument("--output-dir", type=Path, default=Path("output"))
    parser.add_argument("--logs-dir", type=Path, default=Path("logs"))
    parser.add_argument("--reports-dir", type=Path, default=Path("reports"))
    return parser


def main() -> int:
    args = build_parser().parse_args()
    result = run_pipeline(args.settings, args.leads, args.output_dir, args.logs_dir, args.reports_dir)
    print(
        f"checked={result.checked} valid={result.valid} duplicates={result.duplicates} "
        f"blocked={result.blocked} drafts={result.drafts}"
    )
    return 0 if not result.errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
