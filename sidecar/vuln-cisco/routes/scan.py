"""POST /scan and GET /scan/{scan_id}/status — scan lifecycle endpoints."""

from __future__ import annotations

import asyncio
import logging
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from middleware.auth import verify_api_key
from models.schemas import ScanRequest, ScanStatus
from scanner.cve_lookup import run_scan
from storage import file_store

logger = logging.getLogger("forge.routes.scan")

router = APIRouter()

# Module-level dict tracking active/completed scans.
# Key: scan_id (str), Value: mutable status dict.
_scans: dict[str, dict[str, Any]] = {}

# Track active target IPs to prevent duplicate concurrent scans.
# Key: target IP (str), Value: scan_id (str).
_active_targets: dict[str, str] = {}


def _run_scan_in_thread(scan_id: str, req: ScanRequest) -> None:
    """Execute the scan pipeline in a background thread.

    Uses ``asyncio.run()`` because the scanner's ``run_scan`` is async
    (SNMP uses asyncio) but we're called from a sync thread context.
    """
    entry = _scans[scan_id]
    target = req.target

    try:
        entry["progress"] = "SNMP detection"
        logger.info("[%s] Starting scan for %s", scan_id, target)

        def _update_progress(stage: str) -> None:
            entry["progress"] = stage

        # Run the async pipeline in a fresh event loop
        result = asyncio.run(
            run_scan(
                target=target,
                snmp_community=req.snmp_community,
                cisco_client_id=req.cisco_client_id,
                cisco_client_secret=req.cisco_client_secret,
                skip_nuclei=req.skip_nuclei,
                on_progress=_update_progress,
            )
        )

        entry["progress"] = "Saving results"

        # Build the report JSON for storage
        from scanner.cve_lookup import _generate_report_json

        report_json = _generate_report_json(
            device_info=result["device_info"],
            severity_summary=result["severity_summary"],
            findings=result["findings"],
            notes=result.get("notes"),
        )

        # Use the scan start timestamp as the directory name
        timestamp = entry["started_at"].replace(":", "-")
        scan_dir = file_store.save_scan(
            device=target,
            timestamp=timestamp,
            json_data=report_json,
            html_content=result["report_html"],
        )

        entry["status"] = "complete"
        entry["progress"] = "complete"
        entry["completed_at"] = datetime.now(timezone.utc).isoformat()
        entry["result_path"] = f"{target}/{timestamp}"
        logger.info("[%s] Scan complete — saved to %s", scan_id, scan_dir)

    except Exception as exc:
        entry["status"] = "failed"
        entry["progress"] = "failed"
        entry["completed_at"] = datetime.now(timezone.utc).isoformat()
        entry["error"] = str(exc)
        logger.error("[%s] Scan failed: %s", scan_id, exc)

    finally:
        # Release the target lock
        _active_targets.pop(target, None)


@router.post(
    "/scan",
    response_model=dict,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_scan(
    req: ScanRequest,
    _key: str = Depends(verify_api_key),
) -> dict:
    """Launch a vulnerability scan in the background.

    Returns 202 with ``{"scanId": "<uuid>"}`` on success, or 409 if a
    scan is already running for the same target IP.
    """
    # Check for duplicate in-flight scan
    if req.target in _active_targets:
        existing_id = _active_targets[req.target]
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "detail": "Scan already in progress",
                "scanId": existing_id,
            },
        )

    scan_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    _scans[scan_id] = {
        "scan_id": scan_id,
        "status": "running",
        "progress": "queued",
        "started_at": now,
        "completed_at": None,
        "error": None,
        "device": req.target,
        "result_path": None,
    }
    _active_targets[req.target] = scan_id

    thread = threading.Thread(
        target=_run_scan_in_thread,
        args=(scan_id, req),
        name=f"scan-{scan_id[:8]}",
        daemon=True,
    )
    thread.start()

    return {"scanId": scan_id}


@router.get("/scan/{scan_id}/status", response_model=ScanStatus)
async def get_scan_status(
    scan_id: str,
    _key: str = Depends(verify_api_key),
) -> ScanStatus:
    """Return the current status of a scan by ID."""
    entry = _scans.get(scan_id)
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )

    return ScanStatus(
        scan_id=entry["scan_id"],
        status=entry["status"],
        progress=entry.get("progress"),
        started_at=entry.get("started_at"),
        completed_at=entry.get("completed_at"),
        error=entry.get("error"),
        device=entry["device"],
        result_path=entry.get("result_path"),
    )


def get_active_scan_count() -> int:
    """Return the number of currently running scans (used by health check)."""
    return len(_active_targets)
