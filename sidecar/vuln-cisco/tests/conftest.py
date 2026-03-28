"""Shared pytest fixtures for the Cisco Vulnerability Scanner sidecar tests."""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Ensure the sidecar package root is importable (tests run from tests/)
SIDECAR_ROOT = Path(__file__).resolve().parent.parent
if str(SIDECAR_ROOT) not in sys.path:
    sys.path.insert(0, str(SIDECAR_ROOT))

TEST_API_KEY = "test-key-for-pytest-00000000"


@pytest.fixture(autouse=True)
def _isolated_data_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Create a temp DATA_DIR and seed it with a known API key.

    This fixture is auto-used so every test gets an isolated filesystem
    regardless of whether it explicitly requests the fixture.
    """
    data_dir = tmp_path / "data"
    results_dir = data_dir / "results"
    results_dir.mkdir(parents=True)

    # Write a known API key so auth tests are deterministic
    key_file = data_dir / "api-key.txt"
    key_file.write_text(TEST_API_KEY)

    # Point the file_store at the temp results dir
    monkeypatch.setenv("DATA_DIR", str(results_dir))

    # Patch file_store.DATA_DIR at module level so it picks up the temp path
    from storage import file_store
    monkeypatch.setattr(file_store, "DATA_DIR", results_dir)

    # Patch auth module to use our temp key file and reset the cached key
    from middleware import auth
    monkeypatch.setattr(auth, "API_KEY_PATH", key_file)
    auth.init_api_key()

    return data_dir


@pytest.fixture()
def client() -> TestClient:
    """Provide a FastAPI TestClient wired to the sidecar app."""
    from main import app

    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture()
def auth_headers() -> dict[str, str]:
    """Return Authorization headers carrying the test API key."""
    return {"Authorization": f"Bearer {TEST_API_KEY}"}
