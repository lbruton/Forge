"""CISA Known Exploited Vulnerabilities (KEV) catalog integration.

Provides disk-cached KEV catalog with 24h TTL for cross-referencing
scan findings against actively exploited vulnerabilities.
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

logger = logging.getLogger("kev_lookup")

KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
CACHE_TTL = timedelta(hours=24)


def load_kev_catalog(cache_dir: str = "/data") -> dict[str, dict]:
    """Load the CISA KEV catalog, using a disk cache with 24h TTL.

    Returns a dict keyed by CVE ID with vulnerability metadata.
    Never raises an exception.
    """
    cache_path = Path(cache_dir) / "kev_cache.json"
    meta_path = Path(cache_dir) / "kev_cache_meta.json"

    # Try to read existing cache
    cached_data = None
    cache_is_fresh = False

    try:
        if cache_path.exists() and meta_path.exists():
            meta = json.loads(meta_path.read_text())
            fetched_at = datetime.fromisoformat(meta["fetched_at"])
            if datetime.now(timezone.utc) - fetched_at < CACHE_TTL:
                cache_is_fresh = True
            cached_data = json.loads(cache_path.read_text())
    except (json.JSONDecodeError, KeyError, ValueError):
        logger.warning("Corrupt KEV cache detected, will delete and re-fetch")
        _delete_cache(cache_path, meta_path)
        cached_data = None

    if cache_is_fresh and cached_data is not None:
        logger.info("Using fresh KEV cache")
        return cached_data

    # Cache is stale or missing — attempt fresh fetch
    try:
        resp = requests.get(KEV_URL, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        catalog = _parse_kev_response(data)
        _write_cache(cache_path, meta_path, catalog)
        logger.info("Fetched fresh KEV catalog (%d entries)", len(catalog))
        return catalog
    except requests.RequestException as exc:
        logger.warning("KEV fetch failed: %s", exc)
        if cached_data is not None:
            logger.warning("Returning stale KEV cache as fallback")
            return cached_data
        logger.warning("No KEV cache available, returning empty catalog")
        return {}
    except (json.JSONDecodeError, KeyError, ValueError) as exc:
        logger.warning("KEV response parse error: %s", exc)
        if cached_data is not None:
            return cached_data
        return {}


def enrich_findings_with_kev(findings: list[dict], kev_catalog: dict[str, dict]) -> None:
    """Mutate findings in-place, adding KEV metadata where CVEs match.

    For each finding, checks if any CVE ID in finding["cve_ids"] exists
    in the kev_catalog. If so, sets kev=True and populates date fields.
    """
    for finding in findings:
        cve_ids = finding.get("cve_ids", [])
        if not cve_ids:
            continue
        for cve_id in cve_ids:
            entry = kev_catalog.get(cve_id)
            if entry:
                finding["kev"] = True
                finding["kev_date_added"] = entry["date_added"]
                finding["kev_due_date"] = entry["due_date"]
                break


def _parse_kev_response(data: dict) -> dict[str, dict]:
    """Parse raw KEV API response into a lookup dict keyed by CVE ID."""
    catalog = {}
    for vuln in data["vulnerabilities"]:
        catalog[vuln["cveID"]] = {
            "date_added": vuln["dateAdded"],
            "due_date": vuln["dueDate"],
            "vendor_project": vuln["vendorProject"],
            "product": vuln["product"],
            "vulnerability_name": vuln["vulnerabilityName"],
            "known_ransomware_use": vuln["knownRansomwareCampaignUse"] == "Known",
        }
    return catalog


def _write_cache(cache_path: Path, meta_path: Path, catalog: dict) -> None:
    """Write catalog and metadata to disk cache."""
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(catalog))
    meta_path.write_text(
        json.dumps({"fetched_at": datetime.now(timezone.utc).isoformat()})
    )


def _delete_cache(cache_path: Path, meta_path: Path) -> None:
    """Remove cache files if they exist."""
    for p in (cache_path, meta_path):
        try:
            p.unlink(missing_ok=True)
        except OSError:
            pass
