"""Tests for all API route endpoints."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from tests.conftest import TEST_API_KEY


# ── Fixture data ────────────────────────────────────────────────────────────

FIXTURE_REPORT = {
    "scan_date": "2026-03-27T12:00:00+00:00",
    "scanner": "Forge Vuln Scanner - Cisco v1.0",
    "device_info": {
        "ip": "10.0.0.1",
        "hostname": "sw-core-01",
        "model": "C9200L",
        "version": "17.9.4a",
        "platform": "iosxe",
    },
    "severity_summary": {
        "critical": 1,
        "high": 2,
        "medium": 0,
        "low": 0,
        "info": 0,
    },
    "findings_count": 3,
    "findings": [],
    "notes": [],
}


def _save_fixture_scan(tmp_path_like: Path) -> None:
    """Write a fixture scan into the results directory at DATA_DIR."""
    from storage import file_store

    file_store.save_scan(
        device="10.0.0.1",
        timestamp="2026-03-27T12-00-00",
        json_data=FIXTURE_REPORT,
        html_content="<html><body>report</body></html>",
    )


# ── Manifest ────────────────────────────────────────────────────────────────


class TestManifest:
    def test_manifest_returns_valid_json(self, client):
        resp = client.get("/forge/manifest")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "forge-vuln-cisco"
        assert data["type"] == "sidecar"
        assert "cisco" in data["vendors"]
        assert len(data["treeNodes"]) >= 1
        assert data["treeNodes"][0]["id"] == "vulnerabilities"


# ── Health ──────────────────────────────────────────────────────────────────


class TestHealth:
    def test_health_returns_status_and_nuclei(self, client, auth_headers):
        resp = client.get("/forge/health", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        assert "nucleiAvailable" in data
        assert data["status"] in ("active", "degraded")


# ── Scan ────────────────────────────────────────────────────────────────────


class TestScan:
    @patch("routes.scan.run_scan", new_callable=AsyncMock)
    def test_post_scan_returns_202_with_scan_id(
        self, mock_run_scan, client, auth_headers
    ):
        """POST /scan with a valid body should return 202 and a scanId."""
        mock_run_scan.return_value = {
            "device_info": FIXTURE_REPORT["device_info"],
            "severity_summary": FIXTURE_REPORT["severity_summary"],
            "findings": [],
            "report_html": "<html></html>",
            "notes": [],
        }

        resp = client.post(
            "/scan",
            json={
                "target": "10.99.99.99",
                "snmp_community": "public",
                "cisco_client_id": "fake-id",
                "cisco_client_secret": "fake-secret",
                "skip_nuclei": True,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 202
        data = resp.json()
        assert "scanId" in data

    @patch("routes.scan.run_scan", new_callable=AsyncMock)
    def test_post_scan_duplicate_target_returns_409(
        self, mock_run_scan, client, auth_headers
    ):
        """Submitting a scan for an already-active target should return 409."""
        # Seed the _active_targets dict with a fake in-progress scan
        from routes import scan as scan_module

        scan_module._active_targets["10.88.88.88"] = "fake-scan-id"

        try:
            resp = client.post(
                "/scan",
                json={
                    "target": "10.88.88.88",
                    "snmp_community": "public",
                    "cisco_client_id": "fake-id",
                    "cisco_client_secret": "fake-secret",
                },
                headers=auth_headers,
            )
            assert resp.status_code == 409
            assert "already in progress" in resp.json()["detail"].lower()
        finally:
            scan_module._active_targets.pop("10.88.88.88", None)

    @patch("routes.scan.run_scan", new_callable=AsyncMock)
    def test_get_scan_status_returns_status(
        self, mock_run_scan, client, auth_headers
    ):
        """GET /scan/{id}/status should return the scan entry."""
        mock_run_scan.return_value = {
            "device_info": FIXTURE_REPORT["device_info"],
            "severity_summary": FIXTURE_REPORT["severity_summary"],
            "findings": [],
            "report_html": "<html></html>",
            "notes": [],
        }

        # Start a scan first to get a scanId
        post_resp = client.post(
            "/scan",
            json={
                "target": "10.77.77.77",
                "snmp_community": "public",
                "cisco_client_id": "fake-id",
                "cisco_client_secret": "fake-secret",
                "skip_nuclei": True,
            },
            headers=auth_headers,
        )
        scan_id = post_resp.json()["scanId"]

        resp = client.get(f"/scan/{scan_id}/status", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["scan_id"] == scan_id
        assert data["device"] == "10.77.77.77"

        # Clean up
        from routes import scan as scan_module
        scan_module._active_targets.pop("10.77.77.77", None)

    def test_get_scan_status_nonexistent_returns_404(
        self, client, auth_headers
    ):
        """GET /scan/{id}/status for an unknown ID should return 404."""
        resp = client.get(
            "/scan/nonexistent-id/status", headers=auth_headers
        )
        assert resp.status_code == 404


# ── Results ─────────────────────────────────────────────────────────────────


class TestResults:
    def test_results_empty_returns_empty_list(self, client, auth_headers):
        """GET /results with no scans should return an empty list."""
        resp = client.get("/results", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_results_returns_devices_after_save(
        self, client, auth_headers, _isolated_data_dir
    ):
        """After saving a fixture scan, GET /results should list the device."""
        _save_fixture_scan(_isolated_data_dir)

        resp = client.get("/results", headers=auth_headers)
        assert resp.status_code == 200
        devices = resp.json()
        assert len(devices) >= 1
        assert devices[0]["device"] == "10.0.0.1"
        assert devices[0]["scan_count"] == 1

    def test_get_results_device_timestamp_returns_json(
        self, client, auth_headers, _isolated_data_dir
    ):
        """GET /results/{device}/{timestamp} defaults to JSON response."""
        _save_fixture_scan(_isolated_data_dir)

        resp = client.get(
            "/results/10.0.0.1/2026-03-27T12-00-00",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["device_info"]["hostname"] == "sw-core-01"

    def test_delete_results_returns_204(
        self, client, auth_headers, _isolated_data_dir
    ):
        """DELETE /results/{device}/{timestamp} should return 204."""
        _save_fixture_scan(_isolated_data_dir)

        resp = client.delete(
            "/results/10.0.0.1/2026-03-27T12-00-00",
            headers=auth_headers,
        )
        assert resp.status_code == 204

    def test_delete_nonexistent_results_returns_404(
        self, client, auth_headers
    ):
        """DELETE for a scan that does not exist should return 404."""
        resp = client.delete(
            "/results/nonexistent/123",
            headers=auth_headers,
        )
        assert resp.status_code == 404
