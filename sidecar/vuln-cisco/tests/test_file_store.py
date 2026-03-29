"""Tests for the flat-file storage module."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from storage import file_store


# ── Fixture data ────────────────────────────────────────────────────────────

FIXTURE_JSON = {
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

FIXTURE_HTML = "<html><body>test report</body></html>"


# ── save_scan ───────────────────────────────────────────────────────────────


class TestSaveScan:
    def test_creates_directory_structure_and_files(self):
        """save_scan should create {device}/{timestamp}/ with report files."""
        scan_dir = file_store.save_scan(
            device="10.0.0.1",
            timestamp="2026-03-27T12-00-00",
            json_data=FIXTURE_JSON,
            html_content=FIXTURE_HTML,
        )

        assert scan_dir.is_dir()
        assert (scan_dir / "report.json").exists()
        assert (scan_dir / "report.html").exists()

        # Verify JSON is valid and round-trips
        stored = json.loads((scan_dir / "report.json").read_text())
        assert stored["device_info"]["hostname"] == "sw-core-01"

        # Verify HTML content
        assert (scan_dir / "report.html").read_text() == FIXTURE_HTML

    @pytest.mark.parametrize("bad_segment", ["../escape", "/etc/passwd", "C:\\Windows", ".\x00evil", "..", ""])
    def test_rejects_traversal_in_device(self, bad_segment):
        """save_scan should reject unsafe device path segments."""
        with pytest.raises(ValueError):
            file_store.save_scan(bad_segment, "2026-03-27T12-00-00", FIXTURE_JSON, FIXTURE_HTML)

    @pytest.mark.parametrize("bad_segment", ["../escape", "/etc/passwd", "C:\\Windows", ".\x00evil", "..", ""])
    def test_rejects_traversal_in_timestamp(self, bad_segment):
        """save_scan should reject unsafe timestamp path segments."""
        with pytest.raises(ValueError):
            file_store.save_scan("10.0.0.1", bad_segment, FIXTURE_JSON, FIXTURE_HTML)


# ── list_devices ────────────────────────────────────────────────────────────


class TestListDevices:
    def test_returns_correct_device_summaries(self):
        """list_devices should return a summary for each device with scans."""
        file_store.save_scan("10.0.0.1", "2026-03-27T12-00-00", FIXTURE_JSON, FIXTURE_HTML)
        file_store.save_scan("10.0.0.2", "2026-03-27T13-00-00", FIXTURE_JSON, FIXTURE_HTML)

        devices = file_store.list_devices()
        assert len(devices) == 2

        ips = {d["device"] for d in devices}
        assert "10.0.0.1" in ips
        assert "10.0.0.2" in ips

        for d in devices:
            assert d["scan_count"] == 1
            assert d["hostname"] == "sw-core-01"


# ── list_scans ──────────────────────────────────────────────────────────────


class TestListScans:
    def test_returns_scans_sorted_newest_first(self):
        """list_scans should return entries sorted by timestamp descending."""
        file_store.save_scan("10.0.0.1", "2026-03-27T10-00-00", FIXTURE_JSON, FIXTURE_HTML)
        file_store.save_scan("10.0.0.1", "2026-03-27T14-00-00", FIXTURE_JSON, FIXTURE_HTML)
        file_store.save_scan("10.0.0.1", "2026-03-27T12-00-00", FIXTURE_JSON, FIXTURE_HTML)

        scans = file_store.list_scans("10.0.0.1")
        assert len(scans) == 3
        # Newest first
        assert scans[0]["timestamp"] == "2026-03-27T14-00-00"
        assert scans[1]["timestamp"] == "2026-03-27T12-00-00"
        assert scans[2]["timestamp"] == "2026-03-27T10-00-00"

    @pytest.mark.parametrize("bad_segment", ["../escape", "/etc/passwd", "C:\\Windows", ".\x00evil", "..", ""])
    def test_rejects_unsafe_device_path(self, bad_segment):
        """Unsafe device values should behave like a missing device."""
        assert file_store.list_scans(bad_segment) == []


# ── get_scan ────────────────────────────────────────────────────────────────


class TestGetScan:
    def test_returns_json_and_html_tuple(self):
        """get_scan should return (json_data, html_content) for a saved scan."""
        file_store.save_scan("10.0.0.1", "2026-03-27T12-00-00", FIXTURE_JSON, FIXTURE_HTML)

        json_data, html_content = file_store.get_scan("10.0.0.1", "2026-03-27T12-00-00")

        assert json_data is not None
        assert html_content is not None
        assert json_data["device_info"]["hostname"] == "sw-core-01"
        assert "test report" in html_content

    def test_nonexistent_scan_returns_none_none(self):
        """get_scan for a path that does not exist should return (None, None)."""
        json_data, html_content = file_store.get_scan("10.99.99.99", "never")
        assert json_data is None
        assert html_content is None

    @pytest.mark.parametrize("bad_device,bad_ts", [
        ("../escape", "never"),
        ("/etc/passwd", "never"),
        (".\x00evil", "never"),
        ("10.0.0.1", "../escape"),
        ("10.0.0.1", "/etc/passwd"),
        ("10.0.0.1", ".\x00evil"),
    ])
    def test_rejects_traversal_in_requested_path(self, bad_device, bad_ts):
        """Unsafe device/timestamp values should not escape DATA_DIR."""
        json_data, html_content = file_store.get_scan(bad_device, bad_ts)
        assert json_data is None
        assert html_content is None


# ── delete_scan ─────────────────────────────────────────────────────────────


class TestDeleteScan:
    def test_removes_files_and_returns_true(self):
        """delete_scan should remove the scan dir and return True."""
        file_store.save_scan("10.0.0.1", "2026-03-27T12-00-00", FIXTURE_JSON, FIXTURE_HTML)

        result = file_store.delete_scan("10.0.0.1", "2026-03-27T12-00-00")
        assert result is True

        # Verify the scan is gone
        json_data, html_content = file_store.get_scan("10.0.0.1", "2026-03-27T12-00-00")
        assert json_data is None
        assert html_content is None

    def test_nonexistent_scan_returns_false(self):
        """delete_scan for a missing path should return False."""
        result = file_store.delete_scan("10.99.99.99", "never")
        assert result is False

    @pytest.mark.parametrize("bad_device,bad_ts", [
        ("../escape", "never"),
        ("/etc/passwd", "never"),
        (".\x00evil", "never"),
        ("10.0.0.1", "../escape"),
        ("10.0.0.1", "/etc/passwd"),
        ("10.0.0.1", ".\x00evil"),
    ])
    def test_rejects_traversal_in_delete_path(self, bad_device, bad_ts):
        """Unsafe device/timestamp values should not delete outside DATA_DIR."""
        assert file_store.delete_scan(bad_device, bad_ts) is False
