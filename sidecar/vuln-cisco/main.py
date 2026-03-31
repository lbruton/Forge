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

# LAN-only sidecar behind firewall — CORS * is intentional (nosemgrep: cors-wildcard)
app.add_middleware(  # nosec B104
    CORSMiddleware,
    allow_origins=["*"],  # noqa: S104
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
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
