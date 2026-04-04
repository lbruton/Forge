"""Tests for CISA KEV catalog lookup and enrichment."""

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
import requests as requests_lib

from scanner.kev_lookup import enrich_findings_with_kev, load_kev_catalog

SAMPLE_KEV_RESPONSE = {
    "title": "CISA KEV",
    "catalogVersion": "2026.04.04",
    "count": 2,
    "vulnerabilities": [
        {
            "cveID": "CVE-2024-1234",
            "dateAdded": "2024-03-15",
            "dueDate": "2024-04-05",
            "vendorProject": "Cisco",
            "product": "IOS",
            "vulnerabilityName": "Cisco IOS Buffer Overflow",
            "knownRansomwareCampaignUse": "Known",
        },
        {
            "cveID": "CVE-2024-5678",
            "dateAdded": "2024-06-01",
            "dueDate": "2024-06-22",
            "vendorProject": "Apache",
            "product": "HTTP Server",
            "vulnerabilityName": "Apache RCE",
            "knownRansomwareCampaignUse": "Unknown",
        },
    ],
}

EXPECTED_CATALOG = {
    "CVE-2024-1234": {
        "date_added": "2024-03-15",
        "due_date": "2024-04-05",
        "vendor_project": "Cisco",
        "product": "IOS",
        "vulnerability_name": "Cisco IOS Buffer Overflow",
        "known_ransomware_use": True,
    },
    "CVE-2024-5678": {
        "date_added": "2024-06-01",
        "due_date": "2024-06-22",
        "vendor_project": "Apache",
        "product": "HTTP Server",
        "vulnerability_name": "Apache RCE",
        "known_ransomware_use": False,
    },
}


def _write_cache(tmp_path, catalog=None, hours_ago=1):
    """Helper to write cache files with a given age."""
    if catalog is None:
        catalog = EXPECTED_CATALOG
    cache_path = tmp_path / "kev_cache.json"
    meta_path = tmp_path / "kev_cache_meta.json"
    fetched_at = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
    cache_path.write_text(json.dumps(catalog))
    meta_path.write_text(json.dumps({"fetched_at": fetched_at.isoformat()}))


@patch("scanner.kev_lookup.requests.get")
def test_load_kev_catalog_fresh_fetch(mock_get, tmp_path):
    """Fresh fetch when no cache exists — returns parsed catalog, writes cache."""
    mock_resp = MagicMock()
    mock_resp.json.return_value = SAMPLE_KEV_RESPONSE
    mock_resp.raise_for_status = MagicMock()
    mock_get.return_value = mock_resp

    result = load_kev_catalog(cache_dir=str(tmp_path))

    assert result == EXPECTED_CATALOG
    assert (tmp_path / "kev_cache.json").exists()
    assert (tmp_path / "kev_cache_meta.json").exists()
    mock_get.assert_called_once()


@patch("scanner.kev_lookup.requests.get")
def test_load_kev_catalog_uses_cache(mock_get, tmp_path):
    """Fresh cache (< 24h) is used without making a network request."""
    _write_cache(tmp_path, hours_ago=1)

    result = load_kev_catalog(cache_dir=str(tmp_path))

    assert result == EXPECTED_CATALOG
    mock_get.assert_not_called()


@patch("scanner.kev_lookup.requests.get")
def test_load_kev_catalog_stale_cache_refetches(mock_get, tmp_path):
    """Stale cache (> 24h) triggers a fresh fetch."""
    _write_cache(tmp_path, hours_ago=25)

    mock_resp = MagicMock()
    mock_resp.json.return_value = SAMPLE_KEV_RESPONSE
    mock_resp.raise_for_status = MagicMock()
    mock_get.return_value = mock_resp

    result = load_kev_catalog(cache_dir=str(tmp_path))

    assert result == EXPECTED_CATALOG
    mock_get.assert_called_once()


@patch("scanner.kev_lookup.requests.get")
def test_load_kev_catalog_fetch_failure_stale_fallback(mock_get, tmp_path):
    """Fetch failure with stale cache returns stale data."""
    _write_cache(tmp_path, hours_ago=25)

    mock_get.side_effect = requests_lib.ConnectionError("network down")

    result = load_kev_catalog(cache_dir=str(tmp_path))

    assert result == EXPECTED_CATALOG


@patch("scanner.kev_lookup.requests.get")
def test_load_kev_catalog_fetch_failure_no_cache(mock_get, tmp_path):
    """Fetch failure with no cache returns empty dict."""
    mock_get.side_effect = requests_lib.ConnectionError("network down")

    result = load_kev_catalog(cache_dir=str(tmp_path))

    assert result == {}


@patch("scanner.kev_lookup.requests.get")
def test_load_kev_catalog_corrupt_cache(mock_get, tmp_path):
    """Corrupt cache is deleted, fresh fetch succeeds."""
    (tmp_path / "kev_cache.json").write_text("{invalid json!!")
    (tmp_path / "kev_cache_meta.json").write_text('{"fetched_at": "2026-01-01T00:00:00+00:00"}')

    mock_resp = MagicMock()
    mock_resp.json.return_value = SAMPLE_KEV_RESPONSE
    mock_resp.raise_for_status = MagicMock()
    mock_get.return_value = mock_resp

    result = load_kev_catalog(cache_dir=str(tmp_path))

    assert result == EXPECTED_CATALOG
    mock_get.assert_called_once()


def test_enrich_findings_with_kev_match():
    """Finding with a matching CVE gets kev=True and date fields."""
    findings = [
        {"cve_ids": ["CVE-2024-1234"], "kev": False, "kev_date_added": "", "kev_due_date": ""}
    ]
    enrich_findings_with_kev(findings, EXPECTED_CATALOG)

    assert findings[0]["kev"] is True
    assert findings[0]["kev_date_added"] == "2024-03-15"
    assert findings[0]["kev_due_date"] == "2024-04-05"


def test_enrich_findings_with_kev_no_match():
    """Finding with non-matching CVE stays kev=False."""
    findings = [
        {"cve_ids": ["CVE-9999-0001"], "kev": False, "kev_date_added": "", "kev_due_date": ""}
    ]
    enrich_findings_with_kev(findings, EXPECTED_CATALOG)

    assert findings[0]["kev"] is False
    assert findings[0]["kev_date_added"] == ""
    assert findings[0]["kev_due_date"] == ""


def test_enrich_findings_with_kev_no_cves():
    """Finding with empty cve_ids stays kev=False."""
    findings = [
        {"cve_ids": [], "kev": False, "kev_date_added": "", "kev_due_date": ""}
    ]
    enrich_findings_with_kev(findings, EXPECTED_CATALOG)

    assert findings[0]["kev"] is False


def test_enrich_findings_with_kev_multiple_cves():
    """Finding with multiple CVEs — second one matches."""
    findings = [
        {"cve_ids": ["CVE-9999-0001", "CVE-2024-5678"], "kev": False, "kev_date_added": "", "kev_due_date": ""}
    ]
    enrich_findings_with_kev(findings, EXPECTED_CATALOG)

    assert findings[0]["kev"] is True
    assert findings[0]["kev_date_added"] == "2024-06-01"
    assert findings[0]["kev_due_date"] == "2024-06-22"
