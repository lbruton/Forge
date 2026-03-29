"""GET/DELETE /results — browse and manage stored scan results."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse

from middleware.auth import verify_api_key
from storage import file_store

router = APIRouter()


@router.get("/results")
async def list_devices(
    _key: str = Depends(verify_api_key),
) -> list[dict]:
    """Return a summary for every device that has at least one scan."""
    return file_store.list_devices()


@router.get("/results/{device}")
async def list_scans(
    device: str,
    _key: str = Depends(verify_api_key),
) -> list[dict]:
    """Return all scan entries for a device, newest first."""
    scans = file_store.list_scans(device)
    if not scans:
        # Distinguish "no scans" from "device never scanned"
        if not file_store.device_exists(device):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device '{device}' not found",
            )
    return scans


@router.get("/results/{device}/{timestamp}")
async def get_scan(
    device: str,
    timestamp: str,
    request: Request,
    _key: str = Depends(verify_api_key),
):
    """Return scan results as JSON or HTML depending on Accept header."""
    json_data, html_content = file_store.get_scan(device, timestamp)

    if json_data is None and html_content is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scan '{device}/{timestamp}' not found",
        )

    # If the client prefers HTML, return the rendered report
    accept = request.headers.get("accept", "")
    if "text/html" in accept and html_content is not None:
        return HTMLResponse(content=html_content)

    # Default: return JSON
    if json_data is not None:
        return json_data

    # Fallback: we have HTML but no JSON (shouldn't normally happen)
    return HTMLResponse(content=html_content)


@router.delete(
    "/results/{device}/{timestamp}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_scan(
    device: str,
    timestamp: str,
    _key: str = Depends(verify_api_key),
) -> None:
    """Delete a specific scan's results."""
    deleted = file_store.delete_scan(device, timestamp)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scan '{device}/{timestamp}' not found",
        )
