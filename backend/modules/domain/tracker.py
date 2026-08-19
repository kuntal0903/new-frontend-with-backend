"""
Domain Scan Real-Time Progress & Stage Tracker

WHY THIS FILE EXISTS:
    Tracks the exact progression of all 16 stages of a domain scan in real-time,
    providing granular stage statuses (waiting, running, completed, failed, skipped),
    live progress counters (e.g. 31/63 DNS verified), real activity logs,
    and cooperative scan cancellation support.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from common.logger import get_logger

logger = get_logger("domain", "tracker")

STAGE_DEFINITIONS = [
    {"id": "domain_validation", "number": "01", "name": "Domain Validation", "description": "Checking domain syntax and DNS delegation"},
    {"id": "dns_validation", "number": "02", "name": "DNS Validation", "description": "Checking authoritative DNS records"},
    {"id": "subdomain_discovery", "number": "03", "name": "Subdomain Discovery", "description": "Certificate Transparency / passive sources"},
    {"id": "deduplication", "number": "04", "name": "Candidate Deduplication", "description": "Removing duplicate hostnames"},
    {"id": "wildcard_detection", "number": "05", "name": "Wildcard DNS Detection", "description": "Testing random labels against DNS"},
    {"id": "dns_verification", "number": "06", "name": "DNS Verification", "description": "Verifying discovered hostnames"},
    {"id": "ip_analysis", "number": "07", "name": "IP Address Analysis", "description": "Validating discovered IP addresses"},
    {"id": "http_verification", "number": "08", "name": "HTTP / HTTPS Verification", "description": "Checking reachable web services"},
    {"id": "tls_analysis", "number": "09", "name": "TLS / Certificate Analysis", "description": "Analyzing certificates and TLS"},
    {"id": "technology_detection", "number": "10", "name": "Technology Detection", "description": "Identifying technologies from evidence"},
    {"id": "cloud_analysis", "number": "11", "name": "Cloud / CDN Analysis", "description": "Correlating infrastructure signals"},
    {"id": "port_discovery", "number": "12", "name": "Port Discovery", "description": "Checking eligible active hosts"},
    {"id": "service_identification", "number": "13", "name": "Service Identification", "description": "Verifying detected services"},
    {"id": "evidence_correlation", "number": "14", "name": "Evidence Correlation", "description": "Combining independent evidence"},
    {"id": "asset_classification", "number": "15", "name": "Asset Classification", "description": "Active / Historical / Inactive / Unknown"},
    {"id": "finalization", "number": "16", "name": "Finalizing Results", "description": "Preparing verified attack-surface data"},
]


class ScanTracker:
    """Manages real-time stage states, live activity logs, and cancellation tokens for a scan."""

    _active_trackers: Dict[str, ScanTracker] = {}

    def __init__(self, scan_id: str, target: str, profile: str = "standard"):
        self.scan_id = scan_id
        self.target = target
        self.profile = profile
        self.status = "QUEUED"  # QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED
        self.started_at = datetime.now(timezone.utc)
        self.completed_at: Optional[datetime] = None
        self.current_stage_id: str = "domain_validation"
        self.current_stage_name: str = "Domain Validation"
        self.message: str = "Scan initialized"
        self.error_message: Optional[str] = None
        self.is_cancelled: bool = False
        self.final_report: Optional[Dict[str, Any]] = None

        # Build stages array
        self.stages: Dict[str, Dict[str, Any]] = {}
        for s in STAGE_DEFINITIONS:
            self.stages[s["id"]] = {
                "id": s["id"],
                "number": s["number"],
                "name": s["name"],
                "description": s["description"],
                "status": "waiting",  # waiting, running, completed, failed, skipped, partial
                "started_at": None,
                "completed_at": None,
                "completed_count": 0,
                "total_count": 0,
                "detail": None,
                "error": None,
                "data": {},
            }

        # Live activity log (ring buffer up to 100 entries)
        self.activity_log: List[Dict[str, Any]] = []
        self._log_activity("Scan queued and registered")

    @classmethod
    def get_or_create(cls, scan_id: str, target: str, profile: str = "standard") -> ScanTracker:
        if scan_id not in cls._active_trackers:
            cls._active_trackers[scan_id] = ScanTracker(scan_id, target, profile)
        return cls._active_trackers[scan_id]

    @classmethod
    def get(cls, scan_id: str) -> Optional[ScanTracker]:
        return cls._active_trackers.get(scan_id)

    @classmethod
    def remove(cls, scan_id: str):
        if scan_id in cls._active_trackers:
            del cls._active_trackers[scan_id]

    def cancel(self):
        """Cooperative cancellation trigger."""
        self.is_cancelled = True
        self.status = "CANCELLED"
        self.message = "Scan cancelled by user"
        self.completed_at = datetime.now(timezone.utc)
        self._log_activity("Scan cancellation requested")
        if self.current_stage_id in self.stages:
            stage = self.stages[self.current_stage_id]
            if stage["status"] == "running":
                stage["status"] = "failed"
                stage["error"] = "Cancelled by user"

    def start_stage(self, stage_id: str, message: Optional[str] = None):
        """Mark stage as RUNNING."""
        if self.is_cancelled:
            return
        if stage_id in self.stages:
            stage = self.stages[stage_id]
            stage["status"] = "running"
            stage["started_at"] = datetime.now(timezone.utc).isoformat()
            self.current_stage_id = stage_id
            self.current_stage_name = stage["name"]
            self.status = "RUNNING"
            msg = message or f"Running {stage['name']}..."
            self.message = msg
            self._log_activity(msg)

    def update_progress(self, stage_id: str, completed: int, total: int, detail: Optional[str] = None):
        """Update progress counters within a stage."""
        if stage_id in self.stages:
            stage = self.stages[stage_id]
            stage["completed_count"] = completed
            stage["total_count"] = total
            if detail:
                stage["detail"] = detail
                self.message = detail
                self._log_activity(detail)

    def complete_stage(self, stage_id: str, detail: Optional[str] = None, data: Optional[Dict[str, Any]] = None):
        """Mark stage as COMPLETED."""
        if stage_id in self.stages:
            stage = self.stages[stage_id]
            stage["status"] = "completed"
            stage["completed_at"] = datetime.now(timezone.utc).isoformat()
            if detail:
                stage["detail"] = detail
            if data:
                stage["data"] = data
            self._log_activity(f"Completed {stage['name']}" + (f": {detail}" if detail else ""))

    def fail_stage(self, stage_id: str, error: str, is_fatal: bool = False):
        """Mark stage as FAILED or PARTIAL."""
        if stage_id in self.stages:
            stage = self.stages[stage_id]
            stage["status"] = "failed"
            stage["completed_at"] = datetime.now(timezone.utc).isoformat()
            stage["error"] = error
            self._log_activity(f"Stage failed [{stage['name']}]: {error}")
            if is_fatal:
                self.status = "FAILED"
                self.error_message = error
                self.completed_at = datetime.now(timezone.utc)

    def skip_stage(self, stage_id: str, reason: str):
        """Mark stage as SKIPPED."""
        if stage_id in self.stages:
            stage = self.stages[stage_id]
            stage["status"] = "skipped"
            stage["detail"] = reason
            self._log_activity(f"Skipped {stage['name']}: {reason}")

    def complete_scan(self, report: Optional[Dict[str, Any]] = None):
        """Mark full scan completed."""
        self.status = "COMPLETED"
        self.completed_at = datetime.now(timezone.utc)
        self.message = "Scan completed successfully"
        self.final_report = report
        self.complete_stage("finalization", "Attack surface data synthesized")
        self._log_activity("Domain scan finalized successfully")

    def _log_activity(self, text: str):
        now_time = datetime.now(timezone.utc).strftime("%H:%M:%S")
        self.activity_log.append({
            "time": now_time,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message": text,
        })
        if len(self.activity_log) > 100:
            self.activity_log.pop(0)

    def to_dict(self) -> Dict[str, Any]:
        """Produce the structured status payload for client polling."""
        completed_stages = sum(1 for s in self.stages.values() if s["status"] in ("completed", "skipped"))
        total_stages = len(self.stages)
        overall_percentage = int((completed_stages / total_stages) * 100)

        current_stage = self.stages.get(self.current_stage_id, {})
        if current_stage.get("status") == "running" and current_stage.get("total_count", 0) > 0:
            stage_fraction = current_stage["completed_count"] / current_stage["total_count"]
            overall_percentage = int(((completed_stages + stage_fraction) / total_stages) * 100)

        return {
            "scan_id": self.scan_id,
            "target": self.target,
            "profile": self.profile,
            "status": self.status,
            "current_stage": self.current_stage_id,
            "current_stage_name": self.current_stage_name,
            "message": self.message,
            "error_message": self.error_message,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "is_cancelled": self.is_cancelled,
            "progress": {
                "completed_stages": completed_stages,
                "total_stages": total_stages,
                "percentage": min(100, overall_percentage),
                "completed": current_stage.get("completed_count", 0),
                "total": current_stage.get("total_count", 0),
            },
            "stages": list(self.stages.values()),
            "activity_log": list(reversed(self.activity_log[-20:])),
            "has_report": self.final_report is not None,
        }
