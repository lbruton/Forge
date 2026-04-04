"""Forge sidecar — Cisco Vulnerability Scanner (PSIRT + Nuclei)."""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from middleware.auth import init_api_key
from routes.manifest import router as manifest_router
from routes.results import router as results_router
from routes.scan import router as scan_router
from routes.health import router as health_router  # after scan (imports get_active_scan_count)

app = FastAPI(
    title="Forge Vuln Scanner — Cisco",
    version="1.0.0",
)

# CORS: allow the Forge frontend origin (NPM proxy URL).
# Set FORGE_CORS_ORIGIN to the frontend URL, e.g. "https://forge.example.com".
# Falls back to localhost dev origins when unset.
_cors_origin = os.environ.get("FORGE_CORS_ORIGIN", "")
_allowed_origins = (
    [_cors_origin] if _cors_origin
    else ["http://localhost:5173", "http://localhost:4173", "http://127.0.0.1:5173"]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(manifest_router)
app.include_router(health_router)
app.include_router(scan_router)
app.include_router(results_router)


@app.on_event("startup")
async def startup() -> None:
    init_api_key()


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("FORGE_VULN_PORT", "8400"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)  # nosec B104 — Docker container, bind-all is required
