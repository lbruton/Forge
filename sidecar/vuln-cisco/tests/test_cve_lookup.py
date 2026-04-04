"""Tests for cve_lookup helper functions and enriched field schemas."""

from __future__ import annotations

import json
import subprocess
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from scanner.cve_lookup import _deduplicate, _normalize_cisco_advisory, _nvd_url, _run_nuclei, run_scan


# ─── _nvd_url tests ─────────────────────────────────────────────────────


def test_nvd_url_with_cves():
    """Returns NVD link for the first CVE in the list."""
    result = _nvd_url(["CVE-2023-20198", "CVE-2023-20199"])
    assert result == "https://nvd.nist.gov/vuln/detail/CVE-2023-20198"


def test_nvd_url_empty():
    """Returns empty string for an empty CVE list."""
    assert _nvd_url([]) == ""


# ─── _run_nuclei enriched fields ────────────────────────────────────────


def _make_nuclei_jsonl(**overrides) -> str:
    """Build a single Nuclei JSONL line with sensible defaults."""
    base = {
        "template-id": "cisco-asa-xss",
        "matched-at": "https://192.168.1.1:443",
        "info": {
            "name": "Cisco ASA XSS",
            "severity": "high",
            "description": "  Cross-site scripting in Cisco ASA  ",
            "remediation": "Upgrade to fixed release",
            "impact": "Arbitrary script execution",
            "reference": [
                "https://tools.cisco.com/advisory/cisco-sa-asa-xss",
                "https://nvd.nist.gov/vuln/detail/CVE-2023-11111",
            ],
            "classification": {
                "cve-id": ["CVE-2023-11111"],
                "cwe-id": ["CWE-79"],
                "cvss-score": 7.5,
                "epss-score": 0.42,
                "epss-percentile": 0.89,
                "cpe": "cpe:2.3:o:cisco:asa:*",
            },
        },
    }
    # Allow deep overrides
    for key, val in overrides.items():
        if key == "info":
            base["info"].update(val)
        else:
            base[key] = val
    return json.dumps(base)


@patch("shutil.which", return_value="/usr/bin/nuclei")
@patch("subprocess.run")
def test_run_nuclei_enriched_fields(mock_run, mock_which):
    """Full JSONL with all info fields produces enriched output."""
    mock_run.return_value = MagicMock(
        stdout=_make_nuclei_jsonl(),
        stderr="",
        returncode=0,
    )

    findings = _run_nuclei("192.168.1.1")
    assert len(findings) == 1
    f = findings[0]

    # Existing fields
    assert f["source"] == "nuclei"
    assert f["advisory_id"] == "cisco-asa-xss"
    assert f["title"] == "Cisco ASA XSS"
    assert f["cve_ids"] == ["CVE-2023-11111"]
    assert f["severity"] == "HIGH"
    assert f["cvss_base"] == 7.5
    assert f["summary"] == "Cross-site scripting in Cisco ASA"

    # New enrichment fields
    assert f["description"] == "Cross-site scripting in Cisco ASA"
    assert f["remediation"] == "Upgrade to fixed release"
    assert f["impact"] == "Arbitrary script execution"
    assert f["references"] == [
        "https://tools.cisco.com/advisory/cisco-sa-asa-xss",
        "https://nvd.nist.gov/vuln/detail/CVE-2023-11111",
    ]
    assert f["cwe"] == ["CWE-79"]
    assert f["epss_score"] == pytest.approx(0.42)
    assert f["epss_percentile"] == pytest.approx(0.89)
    assert f["cpe"] == "cpe:2.3:o:cisco:asa:*"
    assert f["kev"] is False
    assert f["kev_date_added"] == ""
    assert f["kev_due_date"] == ""
    assert f["product_match"] == "no_data"


@patch("shutil.which", return_value="/usr/bin/nuclei")
@patch("subprocess.run")
def test_run_nuclei_sparse_template(mock_run, mock_which):
    """Minimal JSONL (no classification, no description) defaults gracefully."""
    sparse = json.dumps({
        "template-id": "generic-detect",
        "matched-at": "https://10.0.0.1",
        "info": {
            "severity": "medium",
        },
    })
    mock_run.return_value = MagicMock(stdout=sparse, stderr="", returncode=0)

    findings = _run_nuclei("10.0.0.1")
    assert len(findings) == 1
    f = findings[0]

    assert f["advisory_id"] == "generic-detect"
    assert f["description"] == ""
    assert f["remediation"] == ""
    assert f["impact"] == ""
    assert f["references"] == []
    assert f["cwe"] == []
    assert f["epss_score"] == 0.0
    assert f["epss_percentile"] == 0.0
    assert f["cpe"] == ""
    assert f["kev"] is False
    assert f["kev_date_added"] == ""
    assert f["kev_due_date"] == ""
    assert f["product_match"] == "no_data"
    assert f["url"] == ""


@patch("shutil.which", return_value="/usr/bin/nuclei")
@patch("subprocess.run")
def test_run_nuclei_url_uses_reference(mock_run, mock_which):
    """URL should use the first reference, not matched-at."""
    mock_run.return_value = MagicMock(
        stdout=_make_nuclei_jsonl(),
        stderr="",
        returncode=0,
    )

    findings = _run_nuclei("192.168.1.1")
    f = findings[0]
    # Should use reference[0], not matched-at
    assert f["url"] == "https://tools.cisco.com/advisory/cisco-sa-asa-xss"
    assert f["url"] != "https://192.168.1.1:443"


@patch("shutil.which", return_value="/usr/bin/nuclei")
@patch("subprocess.run")
def test_run_nuclei_url_falls_back_to_nvd(mock_run, mock_which):
    """When no references exist but CVE ID is present, fall back to NVD URL."""
    line = json.dumps({
        "template-id": "cve-detect",
        "matched-at": "https://10.0.0.1",
        "info": {
            "severity": "high",
            "classification": {
                "cve-id": ["CVE-2024-99999"],
            },
        },
    })
    mock_run.return_value = MagicMock(stdout=line, stderr="", returncode=0)

    findings = _run_nuclei("10.0.0.1")
    f = findings[0]
    assert f["url"] == "https://nvd.nist.gov/vuln/detail/CVE-2024-99999"


# ─── _normalize_cisco_advisory enriched fields ──────────────────────────


def test_normalize_cisco_advisory_enriched_fields():
    """Normalized Cisco advisory includes all enrichment default fields."""
    adv = {
        "advisoryId": "cisco-sa-test-001",
        "advisoryTitle": "Test Advisory",
        "cves": ["CVE-2023-00001"],
        "sir": "High",
        "cvssBaseScore": "8.6",
        "cwe": ["CWE-20"],
        "summary": "A test advisory summary.",
        "firstFixed": ["17.3.5"],
        "firstPublished": "2023-01-15",
        "publicationUrl": "https://tools.cisco.com/advisory/cisco-sa-test-001",
        "bugIDs": ["CSCab12345"],
    }

    result = _normalize_cisco_advisory(adv)

    # Existing fields unchanged
    assert result["source"] == "cisco_openvuln"
    assert result["advisory_id"] == "cisco-sa-test-001"
    assert result["title"] == "Test Advisory"
    assert result["cve_ids"] == ["CVE-2023-00001"]
    assert result["severity"] == "HIGH"
    assert result["cvss_base"] == 8.6
    assert result["summary"] == "A test advisory summary."
    assert result["url"] == "https://tools.cisco.com/advisory/cisco-sa-test-001"

    # New enrichment fields
    assert result["description"] == "A test advisory summary."
    assert result["remediation"] == ""
    assert result["impact"] == ""
    assert result["references"] == ["https://tools.cisco.com/advisory/cisco-sa-test-001"]
    assert result["epss_score"] == 0.0
    assert result["epss_percentile"] == 0.0
    assert result["cpe"] == ""
    assert result["kev"] is False
    assert result["kev_date_added"] == ""
    assert result["kev_due_date"] == ""
    assert result["product_match"] == "no_data"


# ─── run_scan integration test ────────────────────────────────────────


@pytest.mark.asyncio
@patch("scanner.cve_lookup.load_kev_catalog")
@patch("scanner.cve_lookup._run_nuclei")
@patch("scanner.cve_lookup._psirt_query")
@patch("scanner.cve_lookup._psirt_get_token")
@patch("scanner.cve_lookup.snmp_detect", new_callable=AsyncMock)
async def test_run_scan_pipeline_enrichment(
    mock_snmp,
    mock_token,
    mock_psirt,
    mock_nuclei,
    mock_kev,
):
    """Full pipeline: product filtering, nuclei enrichment, KEV cross-ref."""
    # ── SNMP returns a 3560CX device ──
    mock_snmp.return_value = {
        "ip": "10.0.0.1",
        "sysdescr": "Cisco IOS Software",
        "hostname": "sw-lab-01",
        "model": "WS-C3560CX-12PD-S",
        "image": "C3560CX-UNIVERSALK9-M",
        "version": "15.2(7)E2",
        "platform": "ios",
    }

    mock_token.return_value = "fake-token"

    # ── PSIRT returns 2 advisories: one matches 3560-CX, one does not ──
    mock_psirt.return_value = [
        {
            "advisoryId": "cisco-sa-match-001",
            "advisoryTitle": "Matching Advisory",
            "cves": ["CVE-2023-11111"],
            "sir": "High",
            "cvssBaseScore": "8.6",
            "cwe": ["CWE-20"],
            "summary": "Affects 3560-CX switches.",
            "firstFixed": ["15.2(7)E3"],
            "firstPublished": "2023-06-01",
            "publicationUrl": "https://tools.cisco.com/advisory/cisco-sa-match-001",
            "bugIDs": ["CSCab12345"],
            "productNames": ["Cisco Catalyst 3560-CX Series Switches"],
        },
        {
            "advisoryId": "cisco-sa-nomatch-002",
            "advisoryTitle": "Non-Matching Advisory",
            "cves": ["CVE-2023-22222"],
            "sir": "Critical",
            "cvssBaseScore": "9.8",
            "cwe": ["CWE-78"],
            "summary": "Affects ISR routers only.",
            "firstFixed": ["17.3.5"],
            "firstPublished": "2023-07-01",
            "publicationUrl": "https://tools.cisco.com/advisory/cisco-sa-nomatch-002",
            "bugIDs": ["CSCcd67890"],
            "productNames": ["Cisco ISR 4331 Series Routers"],
        },
    ]

    # ── Nuclei returns one finding with CVE-2023-33333 ──
    nuclei_line = json.dumps({
        "template-id": "cisco-3560-xss",
        "matched-at": "https://10.0.0.1:443",
        "info": {
            "name": "Cisco 3560 XSS",
            "severity": "high",
            "description": "XSS in web UI",
            "remediation": "Upgrade firmware",
            "impact": "Script injection",
            "reference": ["https://example.com/advisory"],
            "classification": {
                "cve-id": ["CVE-2023-33333"],
                "cwe-id": ["CWE-79"],
                "cvss-score": 7.5,
                "epss-score": 0.35,
                "epss-percentile": 0.80,
                "cpe": "cpe:2.3:o:cisco:ios:*",
            },
        },
    })
    mock_nuclei.return_value = [
        {
            "source": "nuclei",
            "advisory_id": "cisco-3560-xss",
            "title": "Cisco 3560 XSS",
            "cve_ids": ["CVE-2023-33333"],
            "severity": "HIGH",
            "cvss_base": 7.5,
            "cwe": ["CWE-79"],
            "summary": "XSS in web UI",
            "first_fixed": [],
            "first_published": "",
            "url": "https://example.com/advisory",
            "bug_ids": [],
            "description": "XSS in web UI",
            "remediation": "Upgrade firmware",
            "impact": "Script injection",
            "references": ["https://example.com/advisory"],
            "epss_score": 0.35,
            "epss_percentile": 0.80,
            "cpe": "cpe:2.3:o:cisco:ios:*",
            "kev": False,
            "kev_date_added": "",
            "kev_due_date": "",
            "product_match": "no_data",
        }
    ]

    # ── KEV catalog has CVE-2023-33333 (the Nuclei finding) ──
    mock_kev.return_value = {
        "CVE-2023-33333": {
            "date_added": "2023-08-01",
            "due_date": "2023-08-22",
            "vendor_project": "Cisco",
            "product": "IOS",
            "vulnerability_name": "Cisco IOS XSS",
            "known_ransomware_use": False,
        },
    }

    result = await run_scan(
        target="10.0.0.1",
        snmp_community="public",
        cisco_client_id="fake-id",
        cisco_client_secret="fake-secret",
        skip_nuclei=False,
    )

    findings = result["findings"]

    # The non-matching advisory (ISR) should have been filtered out
    advisory_ids = [f["advisory_id"] for f in findings]
    assert "cisco-sa-match-001" in advisory_ids
    assert "cisco-sa-nomatch-002" not in advisory_ids

    # Matching PSIRT finding has product_match = "verified"
    psirt_finding = next(f for f in findings if f["advisory_id"] == "cisco-sa-match-001")
    assert psirt_finding["product_match"] == "verified"

    # Nuclei finding has enriched fields
    nuclei_finding = next(f for f in findings if f["advisory_id"] == "cisco-3560-xss")
    assert nuclei_finding["description"] == "XSS in web UI"
    assert nuclei_finding["remediation"] == "Upgrade firmware"
    assert nuclei_finding["references"] == ["https://example.com/advisory"]
    assert nuclei_finding["epss_score"] == pytest.approx(0.35)

    # Nuclei finding matched KEV
    assert nuclei_finding["kev"] is True
    assert nuclei_finding["kev_date_added"] == "2023-08-01"
    assert nuclei_finding["kev_due_date"] == "2023-08-22"

    # PSIRT finding did NOT match KEV (CVE-2023-11111 not in catalog)
    assert psirt_finding["kev"] is False

    # Notes should NOT contain KEV unavailable message (catalog was present)
    assert not any("KEV" in n for n in result["notes"])


def test_deduplicate_merges_nuclei_enrichment():
    """When PSIRT and Nuclei share a CVE, dedup keeps PSIRT but merges Nuclei enrichment."""
    psirt_finding = {
        "source": "cisco_openvuln",
        "advisory_id": "cisco-sa-test",
        "cve_ids": ["CVE-2023-99999"],
        "severity": "HIGH",
        "cvss_base": 8.1,
        "title": "Test Advisory",
        "summary": "PSIRT summary only",
        "first_fixed": ["15.2(8)E"],
        "description": "",
        "remediation": "",
        "impact": "",
        "references": ["https://sec.cloudapps.cisco.com/advisory/cisco-sa-test"],
        "epss_score": 0.0,
        "epss_percentile": 0.0,
        "cpe": "",
        "cwe": [],
        "first_published": "",
        "url": "",
        "bug_ids": [],
        "kev": False,
        "kev_date_added": "",
        "kev_due_date": "",
        "product_match": "verified",
    }
    nuclei_finding = {
        "source": "nuclei",
        "advisory_id": "CVE-2023-99999",
        "cve_ids": ["CVE-2023-99999"],
        "severity": "HIGH",
        "cvss_base": 8.1,
        "title": "CVE-2023-99999",
        "summary": "Nuclei detailed description",
        "first_fixed": [],
        "description": "A detailed vulnerability description from Nuclei",
        "remediation": "Upgrade firmware to latest version",
        "impact": "Remote code execution",
        "references": [
            "https://nvd.nist.gov/vuln/detail/CVE-2023-99999",
            "https://example.com/advisory",
        ],
        "epss_score": 0.75,
        "epss_percentile": 0.95,
        "cpe": "cpe:2.3:o:cisco:ios:15.2:*",
        "cwe": ["CWE-787"],
        "first_published": "",
        "url": "https://nvd.nist.gov/vuln/detail/CVE-2023-99999",
        "bug_ids": [],
        "kev": False,
        "kev_date_added": "",
        "kev_due_date": "",
        "product_match": "no_data",
    }
    # PSIRT comes first (appended before Nuclei in run_scan)
    result = _deduplicate([psirt_finding, nuclei_finding])
    assert len(result) == 1
    merged = result[0]
    # Kept PSIRT source and fix version
    assert merged["source"] == "cisco_openvuln"
    assert merged["first_fixed"] == ["15.2(8)E"]
    # Merged Nuclei enrichment into PSIRT record
    assert merged["description"] == "A detailed vulnerability description from Nuclei"
    assert merged["remediation"] == "Upgrade firmware to latest version"
    assert merged["impact"] == "Remote code execution"
    assert merged["epss_score"] == 0.75
    assert merged["epss_percentile"] == 0.95
    assert merged["cpe"] == "cpe:2.3:o:cisco:ios:15.2:*"
