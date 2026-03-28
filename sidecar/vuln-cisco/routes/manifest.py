"""GET /forge/manifest — public (no auth required)."""

from __future__ import annotations

from fastapi import APIRouter

from models.schemas import ManifestResponse

router = APIRouter()


@router.get("/forge/manifest", response_model=ManifestResponse)
async def get_manifest() -> ManifestResponse:
    return ManifestResponse(
        name="forge-vuln-cisco",
        displayName="Cisco Vulnerability Scanner",
        version="1.0.0",
        icon="shield-alert",
        type="sidecar",
        vendors=["cisco"],
        treeNodes=[
            {
                "id": "vulnerabilities",
                "label": "Vulnerabilities",
                "icon": "shield-alert",
                "vendorScoped": False,
            }
        ],
    )
