"""Flat-file storage for scan results on the Docker volume.

Directory layout::

    /data/results/
    └── {device_ip}/
        └── {timestamp}/
            ├── report.json
            └── report.html
"""

from __future__ import annotations

import json
import logging
import os
import shutil
from pathlib import Path

logger = logging.getLogger("forge.storage")

DATA_DIR = Path(os.environ.get("DATA_DIR", "/data/results"))


def _results_dir() -> Path:
    """Return the results root, creating it if necessary."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return DATA_DIR


def _is_safe_segment(segment: str) -> bool:
    """Return True when a path segment is safe to join under DATA_DIR."""
    return bool(segment) and segment not in {".", ".."} and "/" not in segment and "\\" not in segment and "\x00" not in segment


def _resolve_results_path(*segments: str) -> Path | None:
    """Resolve a child path under DATA_DIR, rejecting traversal attempts."""
    if not segments or any(not _is_safe_segment(segment) for segment in segments):
        logger.warning("Rejected unsafe results path segments: %s", segments)
        return None

    root = _results_dir().resolve()
    candidate = root.joinpath(*segments).resolve(strict=False)

    try:
        candidate.relative_to(root)
    except ValueError:
        logger.warning("Rejected results path outside data dir: %s", candidate)
        return None

    return candidate


def device_exists(device: str) -> bool:
    """Return True if a safe device results directory exists."""
    device_dir = _resolve_results_path(device)
    return bool(device_dir and device_dir.is_dir())


# ── Device listing ───────────────────────────────────────────────────────


def list_devices() -> list[dict]:
    """Scan the results directory for device folders.

    For each device, find the latest scan and read its report.json to
    build a DeviceSummary dict.
    """
    root = _results_dir()
    devices: list[dict] = []

    for device_dir in sorted(root.iterdir()):
        if not device_dir.is_dir():
            continue

        scans = _scan_dirs_sorted(device_dir)
        scan_count = len(scans)
        if scan_count == 0:
            continue

        latest = scans[0]  # newest first
        report = _read_report_json(latest)

        summary: dict = {
            "device": device_dir.name,
            "hostname": None,
            "last_scan": latest.name,
            "severity": None,
            "scan_count": scan_count,
        }

        if report:
            device_info = report.get("device_info", {})
            summary["hostname"] = device_info.get("hostname")
            summary["severity"] = report.get("severity_summary")

        devices.append(summary)

    return devices


# ── Scan listing ─────────────────────────────────────────────────────────


def list_scans(device: str) -> list[dict]:
    """List all scans for a device, newest first.

    Returns a list of ScanEntry-shaped dicts.  Returns an empty list if
    the device directory does not exist.
    """
    device_dir = _resolve_results_path(device)
    if device_dir is None or not device_dir.is_dir():
        return []

    entries: list[dict] = []
    for scan_dir in _scan_dirs_sorted(device_dir):
        report = _read_report_json(scan_dir)
        entry: dict = {
            "timestamp": scan_dir.name,
            "status": "complete",
            "severity": {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0},
            "device_info": None,
            "total_findings": 0,
        }
        if report:
            entry["severity"] = report.get(
                "severity_summary",
                {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0},
            )
            entry["device_info"] = report.get("device_info")
            entry["total_findings"] = report.get("findings_count", 0)
        entries.append(entry)

    return entries


# ── Single scan ──────────────────────────────────────────────────────────


def get_scan(device: str, timestamp: str) -> tuple[dict | None, str | None]:
    """Return (json_data, html_content) for a specific scan.

    Returns (None, None) if the scan directory or files don't exist.
    """
    scan_dir = _resolve_results_path(device, timestamp)
    if scan_dir is None or not scan_dir.is_dir():
        return None, None

    json_path = scan_dir / "report.json"
    html_path = scan_dir / "report.html"

    json_data = None
    html_content = None

    if json_path.exists():
        try:
            json_data = json.loads(json_path.read_text())
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("Failed to read %s: %s", json_path, exc)

    if html_path.exists():
        try:
            html_content = html_path.read_text()
        except OSError as exc:
            logger.warning("Failed to read %s: %s", html_path, exc)

    return json_data, html_content


# ── Save scan ────────────────────────────────────────────────────────────


def save_scan(
    device: str, timestamp: str, json_data: dict, html_content: str
) -> Path:
    """Persist scan results to disk.

    Creates ``{DATA_DIR}/{device}/{timestamp}/`` and writes report.json
    and report.html.  Returns the scan directory path.
    """
    scan_dir = _resolve_results_path(device, timestamp)
    if scan_dir is None:
        raise ValueError("Invalid device or timestamp for scan storage")
    scan_dir.mkdir(parents=True, exist_ok=True)

    json_path = scan_dir / "report.json"
    html_path = scan_dir / "report.html"

    json_path.write_text(json.dumps(json_data, indent=2))
    html_path.write_text(html_content)

    logger.info("Saved scan results to %s", scan_dir)
    return scan_dir


# ── Delete scan ──────────────────────────────────────────────────────────


def delete_scan(device: str, timestamp: str) -> bool:
    """Remove a scan directory.  Returns True if deleted, False if not found."""
    scan_dir = _resolve_results_path(device, timestamp)
    if scan_dir is None or not scan_dir.is_dir():
        return False

    shutil.rmtree(scan_dir)
    logger.info("Deleted scan %s/%s", device, timestamp)

    # Clean up empty device directory
    device_dir = _resolve_results_path(device)
    if device_dir and device_dir.is_dir() and not any(device_dir.iterdir()):
        device_dir.rmdir()
        logger.info("Removed empty device directory %s", device)

    return True


# ── Helpers ──────────────────────────────────────────────────────────────


def _scan_dirs_sorted(device_dir: Path) -> list[Path]:
    """Return scan subdirectories sorted by name descending (newest first)."""
    return sorted(
        (d for d in device_dir.iterdir() if d.is_dir()),
        key=lambda d: d.name,
        reverse=True,
    )


def _read_report_json(scan_dir: Path) -> dict | None:
    """Read and parse report.json from a scan directory."""
    json_path = scan_dir / "report.json"
    if not json_path.exists():
        return None
    try:
        return json.loads(json_path.read_text())
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("Failed to read %s: %s", json_path, exc)
        return None
