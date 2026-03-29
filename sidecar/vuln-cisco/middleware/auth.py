"""Bearer token authentication for the Forge sidecar."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

API_KEY_PATH = Path("/data/api-key.txt")

_api_key: str | None = None
_bearer_scheme = HTTPBearer(auto_error=False)


def init_api_key() -> str:
    """Load or generate the API key on startup.

    - If ``/data/api-key.txt`` exists, read the key from it.
    - Otherwise generate a UUID4 key and persist it to ``/data/api-key.txt``.
    """
    global _api_key  # noqa: PLW0603

    if API_KEY_PATH.exists():
        _api_key = API_KEY_PATH.read_text().strip()
        print(f"[auth] Loaded existing API key from {API_KEY_PATH}")
    else:
        _api_key = str(uuid.uuid4())
        API_KEY_PATH.parent.mkdir(parents=True, exist_ok=True)
        API_KEY_PATH.write_text(_api_key)
        print(f"[auth] Generated new API key and stored it at {API_KEY_PATH}")

    return _api_key


async def verify_api_key(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> str:
    """FastAPI dependency that validates the Bearer token."""
    if credentials is None or credentials.credentials != _api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )
    return credentials.credentials
