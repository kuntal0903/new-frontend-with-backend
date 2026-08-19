"""
Domain Controller — Thin Delegation Layer

WHY THIS FILE EXISTS:
    Maps incoming validated requests to service calls and translates
    service results / exceptions into API-friendly responses.
    Contains zero business logic.

WHAT IT ACCEPTS:
    Validated Pydantic request objects and a database session.

WHAT IT RETURNS:
    APIResponse or raises HTTP-friendly exceptions.
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from common.exceptions import ResourceNotFoundException, ValidationException
from common.response import error_response, success_response
from modules.domain.service import DomainService


class DomainController:
    """Thin controller — all work delegated to DomainService."""

    def __init__(self):
        self.service = DomainService()

    async def initiate_scan(
        self, domain: str, db: AsyncSession
    ) -> Dict[str, Any]:
        """Validate target early, spawn background task for full 16-stage scan, and return 202 with scan_id immediately."""
        from modules.domain.validator import DomainValidator
        from modules.domain.tracker import ScanTracker
        from common.utils import generate_asset_id

        val_result = await DomainValidator().validate(domain)
        if not val_result.is_eligible_for_scan():
            return {
                "success": False,
                "data": {
                    "scan_id": None,
                    "target_domain": domain,
                    "status": "failed",
                    "validation": val_result.to_dict(),
                    "error_message": val_result.reason,
                    "total_assets_found": 0,
                    "assets": {},
                },
                "message": val_result.reason,
                "scan_id": None,
                "execution_time": 0.0,
            }

        scan_id = generate_asset_id()
        tracker = ScanTracker.get_or_create(scan_id, val_result.domain)

        # Immediately persist initial scan record to DB so polling finds it even across serverless cold starts
        from modules.domain.repository import DomainRepository
        repo = DomainRepository(db)
        await repo.create_scan(
            scan_id=scan_id,
            target_domain=val_result.domain,
            scan_config={"profile": "standard"}
        )
        await repo.commit()

        # Launch background scan worker
        async def _background_worker():
            from common.database import AsyncSessionLocal
            async with AsyncSessionLocal() as session:
                try:
                    await self.service.run_scan(val_result.domain, session, scan_id=scan_id)
                except Exception as exc:
                    pass

        asyncio.create_task(_background_worker())

        return {
            "success": True,
            "scan_id": scan_id,
            "status": "QUEUED",
            "message": f"Scan initiated for {val_result.domain}",
            "data": tracker.to_dict(),
        }

    async def get_scan_status(
        self, scan_id: str, db: AsyncSession
    ) -> Dict[str, Any]:
        """Retrieve the current status and stage progress of a scan."""
        result = await self.service.get_scan_status(scan_id, db)
        if result is None:
            raise ResourceNotFoundException(f"Scan '{scan_id}' not found")
        return success_response(data=result).model_dump()

    async def get_scan_assets(
        self,
        scan_id: str,
        db: AsyncSession,
        asset_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Retrieve discovered assets for a scan."""
        scan = await self.service.get_scan_status(scan_id, db)
        if scan is None:
            raise ResourceNotFoundException(f"Scan '{scan_id}' not found")

        assets = await self.service.get_scan_assets(
            scan_id, db, asset_type=asset_type
        )
        return success_response(
            data={"scan_id": scan_id, "assets": assets, "total": len(assets)},
        ).model_dump()

    async def get_scan_report(
        self, scan_id: str, db: AsyncSession
    ) -> Dict[str, Any]:
        """Retrieve full scan report with grouped assets, summary, and telemetry."""
        report = await self.service.get_scan_report(scan_id, db)
        if report is None:
            raise ResourceNotFoundException(f"Scan '{scan_id}' not found")
        return success_response(data=report).model_dump()

    async def cancel_scan(
        self, scan_id: str
    ) -> Dict[str, Any]:
        """Cancel an ongoing scan."""
        from modules.domain.tracker import ScanTracker
        tracker = ScanTracker.get(scan_id)
        if tracker:
            tracker.cancel()
            return success_response(message="Scan cancellation requested", data=tracker.to_dict()).model_dump()
        return error_response(message=f"Active scan '{scan_id}' not found").model_dump()
