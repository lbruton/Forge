"""GET /forge/health — authenticated health check."""

from __future__ import annotations

import shutil
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from middleware.auth import verify_api_key
from models.schemas import HealthResponse

router = APIRouter()


@router.get("/forge/health", response_model=HealthResponse)
async def get_health(_key: str = Depends(verify_api_key)) -> HealthResponse:
    nuclei_available = shutil.which("nuclei") is not None
    status = "active" if nuclei_available else "degraded"

    return HealthResponse(
        status=status,
        lastChecked=datetime.now(timezone.utc).isoformat(),
        nucleiAvailable=nuclei_available,
        scansRunning=0,
    )
