"""
Forge Sidecar — Cisco Vulnerability Scanner Pipeline

Adapted from HomeNetwork/scanner/cve-lookup.py for use as an importable
module callable from FastAPI route handlers.

Pipeline:
  1. SNMP walk target to extract IOS version from sysDescr (pysnmp)
  2. Query Cisco PSIRT openVuln API (OAuth2 client_credentials)
  3. Optionally run Nuclei CLI for network/SSH template findings
  4. Generate JSON + HTML reports

Credentials are NEVER written to disk or included in error messages.
"""

from __future__ import annotations

import json
import logging
import os
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from pysnmp.hlapi.v3arch.asyncio import (
    CommunityData,
    ContextData,
    ObjectIdentity,
    ObjectType,
    SnmpEngine,
    UdpTransportTarget,
    get_cmd,
)

logger = logging.getLogger("forge.scanner")

# ─── SNMP OIDs ────────────────────────────────────────────────────────────

OID_SYS_DESCR = "1.3.6.1.2.1.1.1.0"
OID_SYS_NAME = "1.3.6.1.2.1.1.5.0"
OID_SYS_LOCATION = "1.3.6.1.2.1.1.6.0"
OID_SYS_UPTIME = "1.3.6.1.2.1.1.3.0"


# ─── SNMP Stage ───────────────────────────────────────────────────────────


async def _snmp_get(target: str, community: str, oid: str) -> str | None:
    """Perform a single SNMP GET and return the value as a string."""
    engine = SnmpEngine()
    error_indication, error_status, _error_index, var_binds = await get_cmd(
        engine,
        CommunityData(community),
        await UdpTransportTarget.create((target, 161), timeout=5, retries=2),
        ContextData(),
        ObjectType(ObjectIdentity(oid)),
    )
    engine.close_dispatcher()

    if error_indication:
        logger.warning("SNMP error indication for %s: %s", oid, error_indication)
        return None
    if error_status:
        logger.warning("SNMP error status for %s: %s", oid, error_status.prettyPrint())
        return None

    for _oid, val in var_binds:
        return str(val)
    return None


async def snmp_detect(target: str, community: str) -> dict[str, Any]:
    """Gather device info via SNMP.

    Returns a dict with keys: ip, sysdescr, hostname, model, image,
    location, uptime, version, platform.

    Raises RuntimeError if sysDescr cannot be retrieved.
    """
    sysdescr = await _snmp_get(target, community, OID_SYS_DESCR)
    if not sysdescr:
        raise RuntimeError(f"SNMP: Device unreachable at {target}")

    version, platform = _parse_ios_version(sysdescr)
    if not version:
        raise RuntimeError(
            f"SNMP: Could not extract IOS version from sysDescr at {target}"
        )

    info: dict[str, Any] = {"ip": target, "sysdescr": sysdescr}

    # Parse model from sysDescr (e.g. "C3560CX Software (C3560CX-UNIVERSALK9-M)")
    model_match = re.search(r"(\w+) Software \((\S+)\)", sysdescr)
    if model_match:
        info["model"] = model_match.group(1)
        info["image"] = model_match.group(2)
    else:
        info["model"] = "Unknown"

    # Fetch additional OIDs — failures are non-fatal
    hostname = await _snmp_get(target, community, OID_SYS_NAME)
    if hostname:
        info["hostname"] = hostname

    location = await _snmp_get(target, community, OID_SYS_LOCATION)
    if location:
        info["location"] = location

    uptime = await _snmp_get(target, community, OID_SYS_UPTIME)
    if uptime:
        info["uptime"] = uptime

    info["version"] = version
    info["platform"] = platform

    logger.info("Detected: Cisco %s %s at %s", platform.upper(), version, target)
    return info


def _parse_ios_version(sysdescr: str) -> tuple[str | None, str]:
    """Extract IOS version and platform from sysDescr string.

    Returns (version, platform) where platform is 'ios' or 'iosxe'.
    """
    version_match = re.search(r"Version\s+([\d.()A-Za-z]+)", sysdescr)
    version = version_match.group(1) if version_match else None
    platform = "iosxe" if "IOS XE" in sysdescr else "ios"
    return version, platform


# ─── Cisco PSIRT openVuln API Stage ───────────────────────────────────────


def _psirt_get_token(client_id: str, client_secret: str) -> str:
    """Obtain OAuth2 bearer token from Cisco identity service.

    Raises RuntimeError on auth failure — NEVER includes credentials in
    the error message.
    """
    url = "https://id.cisco.com/oauth2/default/v1/token"
    try:
        resp = requests.post(
            url,
            data={"grant_type": "client_credentials"},
            auth=(client_id, client_secret),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15,
        )
        resp.raise_for_status()
        token = resp.json().get("access_token")
        if not token:
            raise RuntimeError(
                "PSIRT API: Authentication succeeded but no access_token returned"
            )
        return token
    except requests.HTTPError:
        raise RuntimeError(
            "PSIRT API: Authentication failed — check Cisco API credentials"
        )
    except requests.RequestException as exc:
        raise RuntimeError(
            f"PSIRT API: Connection error during authentication — {exc}"
        )


def _psirt_query(
    version: str, platform: str, token: str
) -> list[dict[str, Any]]:
    """Query Cisco openVuln API for advisories affecting this IOS version.

    Uses the Software Checker endpoint first, then falls back to a
    product-level query with client-side filtering.
    """
    base_url = "https://apix.cisco.com/security/advisories/v2"
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}

    platform_name = "iosxe" if platform == "iosxe" else "ios"
    url = f"{base_url}/OSType/{platform_name}?version={requests.utils.quote(version)}"

    # Strategy 1: version-specific endpoint
    try:
        resp = requests.get(url, headers=headers, timeout=30)
        if resp.ok:
            data = resp.json()
            advisories = data if isinstance(data, list) else data.get("advisories", [])
            if advisories:
                logger.info(
                    "PSIRT (version match): %d advisories", len(advisories)
                )
                return advisories
    except requests.RequestException:
        pass  # Fall through to product query

    # Strategy 2: product query with pagination + client-side filter
    logger.info("PSIRT: version endpoint unavailable, using product query")
    product = "Cisco IOS XE" if platform == "iosxe" else "Cisco IOS"
    all_advisories: list[dict[str, Any]] = []
    page = 1

    while True:
        paged_url = (
            f"{base_url}/product?product={requests.utils.quote(product)}"
            f"&pageIndex={page}&pageSize=100"
        )
        try:
            resp = requests.get(paged_url, headers=headers, timeout=30)
            if not resp.ok:
                break
            advs = resp.json().get("advisories", [])
            if not advs:
                break
            all_advisories.extend(advs)
            if len(advs) < 100:
                break
            page += 1
            time.sleep(0.25)  # Rate limit: 5/sec
        except requests.RequestException:
            break

    logger.info("PSIRT: %d total %s advisories", len(all_advisories), product)

    # Client-side filter by base version train
    base_match = re.match(r"(\d+\.\d+)", version)
    base_ver = base_match.group(1) if base_match else ""

    filtered: list[dict[str, Any]] = []
    for adv in all_advisories:
        sir = adv.get("sir", "NA")
        if sir == "NA":
            continue
        if sir in ("Critical", "High"):
            filtered.append(adv)
        elif base_ver:
            title = adv.get("advisoryTitle", "").lower()
            summary = adv.get("summary", "").lower()
            if (
                base_ver in title
                or base_ver in summary
                or "all versions" in summary
            ):
                filtered.append(adv)

    logger.info(
        "PSIRT: %d advisories after filtering for IOS %s",
        len(filtered),
        base_ver,
    )
    return filtered


def _normalize_cisco_advisory(adv: dict[str, Any]) -> dict[str, Any]:
    """Normalize a Cisco openVuln advisory to the common finding schema."""
    cvss_raw = adv.get("cvssBaseScore", 0)
    try:
        cvss = float(cvss_raw) if cvss_raw and cvss_raw != "NA" else 0.0
    except (ValueError, TypeError):
        cvss = 0.0

    return {
        "source": "cisco_openvuln",
        "advisory_id": adv.get("advisoryId", ""),
        "title": adv.get("advisoryTitle", ""),
        "cve_ids": adv.get("cves", []),
        "severity": adv.get("sir", "").upper(),
        "cvss_base": cvss,
        "cwe": adv.get("cwe", []),
        "summary": adv.get("summary", ""),
        "first_fixed": adv.get("firstFixed", []) or [],
        "first_published": adv.get("firstPublished", ""),
        "url": adv.get("publicationUrl", ""),
        "bug_ids": adv.get("bugIDs", []),
    }


# ─── Nuclei Stage ─────────────────────────────────────────────────────────


def _run_nuclei(target: str) -> list[dict[str, Any]]:
    """Run Nuclei CLI against the target and parse JSONL output.

    Returns a list of normalized findings.  If Nuclei is not installed or
    times out, returns an empty list with a logged warning.
    """
    import shutil

    if not shutil.which("nuclei"):
        logger.warning("Nuclei binary not found — skipping Nuclei scan")
        return []

    cmd = [
        "nuclei",
        "-target", target,
        "-t", "ssh/",
        "-t", "network/",
        "-jsonl",
        "-silent",
        "-timeout", "120",
        "-no-color",
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute hard limit
        )
    except FileNotFoundError:
        logger.warning("Nuclei binary not found — skipping Nuclei scan")
        return []
    except subprocess.TimeoutExpired:
        logger.warning("Nuclei timed out after 300s — skipping")
        return []

    findings: list[dict[str, Any]] = []
    for line in result.stdout.strip().splitlines():
        if not line:
            continue
        try:
            n = json.loads(line)
            info = n.get("info", {})
            sev = info.get("severity", "info").upper()
            if sev == "INFO":
                sev = "LOW"

            classification = info.get("classification", {}) or {}
            cve_ids = classification.get("cve-id", []) or []
            if isinstance(cve_ids, str):
                cve_ids = [cve_ids] if cve_ids else []

            cvss_raw = classification.get("cvss-score", 0)
            try:
                cvss = float(cvss_raw) if cvss_raw else 0.0
            except (ValueError, TypeError):
                cvss = 0.0

            findings.append({
                "source": "nuclei",
                "advisory_id": n.get("template-id", ""),
                "title": info.get("name", ""),
                "cve_ids": cve_ids,
                "severity": sev,
                "cvss_base": cvss,
                "cwe": [],
                "summary": info.get("description", "").strip(),
                "first_fixed": [],
                "first_published": "",
                "url": n.get("matched-at", ""),
                "bug_ids": [],
            })
        except (json.JSONDecodeError, KeyError):
            continue

    logger.info("Nuclei: %d findings", len(findings))
    return findings


# ─── Deduplication ────────────────────────────────────────────────────────


def _deduplicate(findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Deduplicate findings by CVE ID, preferring Cisco source."""
    seen: set[tuple[str, ...]] = set()
    deduped: list[dict[str, Any]] = []

    for f in findings:
        key = tuple(f["cve_ids"]) if f["cve_ids"] else (f["advisory_id"],)
        if not any(key):
            # No identifying key — keep as-is
            deduped.append(f)
            continue
        if key not in seen:
            seen.add(key)
            deduped.append(f)
        else:
            # Merge: prefer Cisco source for first_fixed data
            existing = next(
                (d for d in deduped if tuple(d["cve_ids"]) == tuple(f["cve_ids"])),
                None,
            )
            if (
                existing
                and f["source"] == "cisco_openvuln"
                and not existing.get("first_fixed")
            ):
                existing["first_fixed"] = f["first_fixed"]
                existing["advisory_id"] = f["advisory_id"]

    return deduped


# ─── Severity Summary ────────────────────────────────────────────────────


def _severity_summary(findings: list[dict[str, Any]]) -> dict[str, int]:
    """Count findings by severity level."""
    summary = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for f in findings:
        sev = f["severity"].upper()
        if sev == "CRITICAL":
            summary["critical"] += 1
        elif sev == "HIGH":
            summary["high"] += 1
        elif sev == "MEDIUM":
            summary["medium"] += 1
        elif sev in ("LOW", "INFO"):
            summary["low"] += 1
        else:
            summary["info"] += 1
    return summary


# ─── Report Generation ───────────────────────────────────────────────────


def _generate_report_json(
    device_info: dict[str, Any],
    severity_summary: dict[str, int],
    findings: list[dict[str, Any]],
    notes: list[str] | None = None,
) -> dict[str, Any]:
    """Build the structured JSON report dict (also the return value)."""
    return {
        "scan_date": datetime.now(timezone.utc).isoformat(),
        "scanner": "Forge Vuln Scanner — Cisco v1.0",
        "device_info": device_info,
        "severity_summary": severity_summary,
        "findings_count": len(findings),
        "findings": findings,
        "notes": notes or [],
    }


def _generate_report_html(
    device_info: dict[str, Any],
    severity_summary: dict[str, int],
    findings: list[dict[str, Any]],
    notes: list[str] | None = None,
) -> str:
    """Generate a dark-themed HTML vulnerability report.

    Visual style matches the HomeNetwork prototype: slate backgrounds,
    colored severity badges, CVE table, device info card.
    """
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    crit = severity_summary.get("critical", 0)
    high = severity_summary.get("high", 0)
    med = severity_summary.get("medium", 0)
    low = severity_summary.get("low", 0) + severity_summary.get("info", 0)
    total = len(findings)

    device_name = device_info.get("hostname", "Unknown Device")
    device_ip = device_info.get("ip", "N/A")
    device_version = device_info.get("version", "N/A")
    device_platform = device_info.get("platform", "N/A")
    device_model = device_info.get("model", "N/A")

    sev_colors = {
        "CRITICAL": "#dc2626",
        "HIGH": "#ea580c",
        "MEDIUM": "#ca8a04",
        "LOW": "#2563eb",
        "INFO": "#6b7280",
        "UNKNOWN": "#6b7280",
    }

    # Build finding rows
    rows_html = ""
    for f in sorted(findings, key=lambda x: x["cvss_base"], reverse=True):
        sev = f["severity"]
        color = sev_colors.get(sev, "#6b7280")
        cve_links = ", ".join(
            f'<a href="https://nvd.nist.gov/vuln/detail/{c}" target="_blank">{c}</a>'
            for c in f["cve_ids"]
        ) or "N/A"
        advisory = f.get("advisory_id", "")
        advisory_link = (
            f'<a href="{f["url"]}" target="_blank">{advisory}</a>'
            if advisory and f.get("url")
            else advisory or "—"
        )
        fix = ", ".join(f["first_fixed"]) if f.get("first_fixed") else "—"
        bugs = ", ".join(f["bug_ids"]) if f.get("bug_ids") else "—"

        source_badges = {
            "cisco_openvuln": '<span class="badge badge-cisco">Cisco</span>',
            "nvd": '<span class="badge badge-nvd">NVD</span>',
            "nuclei": '<span class="badge badge-nuclei">Nuclei</span>',
        }
        source_badge = source_badges.get(
            f["source"],
            f'<span class="badge badge-nvd">{f["source"]}</span>',
        )

        title_text = f["title"][:120] if f.get("title") else "—"

        rows_html += f"""
        <tr>
          <td><span class="severity" style="background:{color}">{sev}</span></td>
          <td class="cvss">{f['cvss_base']:.1f}</td>
          <td class="cve">{cve_links}</td>
          <td>{advisory_link}</td>
          <td class="title">{title_text}</td>
          <td>{fix}</td>
          <td>{bugs}</td>
          <td>{source_badge}</td>
        </tr>"""

    # Notes section
    notes_html = ""
    if notes:
        notes_items = "".join(f"<li>{n}</li>" for n in notes)
        notes_html = f"""
  <div class="notes">
    <h3>Notes</h3>
    <ul>{notes_items}</ul>
  </div>"""

    # Severity bar segments — use "empty" class for zero-count segments
    seg_crit = f'{crit} Critical' if crit else ''
    seg_high = f'{high} High' if high else ''
    seg_med = f'{med} Medium' if med else ''
    seg_low = f'{low} Low' if low else ''

    seg_crit_class = '' if crit else ' empty'
    seg_high_class = '' if high else ' empty'
    seg_med_class = '' if med else ' empty'
    seg_low_class = '' if low else ' empty'

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Vulnerability Report — {device_name}</title>
</head>
<body>
<style>
  :root {{
    --bg: #0f172a; --surface: #1e293b; --surface2: #334155;
    --text: #e2e8f0; --text-muted: #94a3b8; --border: #475569;
    --critical: #dc2626; --high: #ea580c; --medium: #ca8a04;
    --low: #2563eb; --info: #6b7280;
    --accent: #38bdf8;
  }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    background: var(--bg); color: var(--text);
    line-height: 1.5; padding: 2rem;
  }}
  .container {{ max-width: 1400px; margin: 0 auto; }}

  .header {{
    display: flex; justify-content: space-between; align-items: flex-start;
    padding-bottom: 1.5rem; border-bottom: 1px solid var(--border);
    margin-bottom: 2rem;
  }}
  .header h1 {{ font-size: 1.5rem; color: var(--accent); font-weight: 600; }}
  .header .subtitle {{ color: var(--text-muted); font-size: 0.85rem; margin-top: 0.25rem; }}
  .header .meta {{ text-align: right; color: var(--text-muted); font-size: 0.8rem; }}

  .device-card {{
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem;
    display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }}
  .device-card .label {{ font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }}
  .device-card .value {{ font-size: 0.95rem; color: var(--text); margin-top: 0.15rem; }}

  .severity-bar {{
    display: flex; gap: 0; margin-bottom: 2rem; border-radius: 8px; overflow: hidden;
    height: 48px; background: var(--surface);
  }}
  .severity-bar .seg {{
    display: flex; align-items: center; justify-content: center;
    font-size: 0.8rem; font-weight: 600; color: white;
    min-width: 80px; padding: 0 0.75rem; transition: flex 0.3s;
    white-space: nowrap;
  }}
  .severity-bar .seg.empty {{ min-width: 0; padding: 0; }}

  .stats {{
    display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap;
  }}
  .stat {{
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 8px; padding: 1rem 1.5rem; text-align: center; flex: 1; min-width: 120px;
  }}
  .stat .number {{ font-size: 2rem; font-weight: 700; }}
  .stat .label {{ font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em; }}
  .stat.critical .number {{ color: var(--critical); }}
  .stat.high .number {{ color: var(--high); }}
  .stat.medium .number {{ color: var(--medium); }}
  .stat.low .number {{ color: var(--low); }}
  .stat.total .number {{ color: var(--accent); }}

  .table-wrap {{
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 8px; overflow: hidden;
  }}
  table {{ width: 100%; border-collapse: collapse; font-size: 0.82rem; }}
  thead {{ background: var(--surface2); }}
  th {{
    padding: 0.75rem 1rem; text-align: left; font-weight: 600;
    font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--text-muted); border-bottom: 1px solid var(--border);
    position: sticky; top: 0; background: var(--surface2);
  }}
  td {{ padding: 0.6rem 1rem; border-bottom: 1px solid var(--border); vertical-align: top; }}
  tr:hover {{ background: rgba(56, 189, 248, 0.05); }}
  tr:last-child td {{ border-bottom: none; }}

  .severity {{
    display: inline-block; padding: 0.15rem 0.5rem; border-radius: 4px;
    font-size: 0.7rem; font-weight: 700; color: white; letter-spacing: 0.03em;
  }}
  .cvss {{ font-weight: 700; font-size: 0.9rem; }}
  .cve a {{ color: var(--accent); text-decoration: none; }}
  .cve a:hover {{ text-decoration: underline; }}
  td a {{ color: var(--accent); text-decoration: none; }}
  td a:hover {{ text-decoration: underline; }}
  .title {{ max-width: 350px; }}

  .badge {{
    display: inline-block; padding: 0.1rem 0.4rem; border-radius: 3px;
    font-size: 0.65rem; font-weight: 600; text-transform: uppercase;
  }}
  .badge-cisco {{ background: #065f46; color: #6ee7b7; }}
  .badge-nvd {{ background: #1e3a5f; color: #93c5fd; }}
  .badge-nuclei {{ background: #581c87; color: #d8b4fe; }}

  .notes {{
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1.5rem;
  }}
  .notes h3 {{ font-size: 0.85rem; color: var(--accent); margin-bottom: 0.5rem; }}
  .notes ul {{ list-style: disc; padding-left: 1.25rem; }}
  .notes li {{ font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem; }}

  .footer {{
    margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border);
    color: var(--text-muted); font-size: 0.75rem; text-align: center;
  }}

  @media print {{
    body {{ background: white; color: black; padding: 1rem; }}
    .severity-bar .seg {{ color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
    .severity {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
    .stat .number {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
    tr:hover {{ background: none; }}
  }}
</style>
<div class="container">

  <div class="header">
    <div>
      <h1>Vulnerability Scan Report</h1>
      <div class="subtitle">Forge Cisco Vulnerability Scanner</div>
    </div>
    <div class="meta">
      <div>Generated: {now}</div>
      <div>Scanner: Forge Vuln Scanner v1.0</div>
    </div>
  </div>

  <div class="device-card">
    <div class="field"><div class="label">Hostname</div><div class="value">{device_name}</div></div>
    <div class="field"><div class="label">IP Address</div><div class="value">{device_ip}</div></div>
    <div class="field"><div class="label">Platform</div><div class="value">{device_platform}</div></div>
    <div class="field"><div class="label">Software Version</div><div class="value">{device_version}</div></div>
    <div class="field"><div class="label">Model</div><div class="value">{device_model}</div></div>
  </div>

  <div class="stats">
    <div class="stat total"><div class="number">{total}</div><div class="label">Total</div></div>
    <div class="stat critical"><div class="number">{crit}</div><div class="label">Critical</div></div>
    <div class="stat high"><div class="number">{high}</div><div class="label">High</div></div>
    <div class="stat medium"><div class="number">{med}</div><div class="label">Medium</div></div>
    <div class="stat low"><div class="number">{low}</div><div class="label">Low</div></div>
  </div>

  <div class="severity-bar">
    <div class="seg{seg_crit_class}" style="flex:{crit}; background:var(--critical)">{seg_crit}</div>
    <div class="seg{seg_high_class}" style="flex:{high}; background:var(--high)">{seg_high}</div>
    <div class="seg{seg_med_class}" style="flex:{med}; background:var(--medium)">{seg_med}</div>
    <div class="seg{seg_low_class}" style="flex:{low}; background:var(--low)">{seg_low}</div>
  </div>

  {notes_html}

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Severity</th>
          <th>CVSS</th>
          <th>CVE</th>
          <th>Advisory</th>
          <th>Description</th>
          <th>Fix Version</th>
          <th>Bug IDs</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody>
        {rows_html if rows_html else '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem">No vulnerabilities found.</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="footer">
    Sources: Cisco PSIRT openVuln API &middot; Nuclei Network Scanner<br>
    Forge Vuln Scanner &mdash; SNMP &rarr; Version Detection &rarr; CVE Lookup &rarr; Report
  </div>

</div>
</body>
</html>"""

    return html


# ─── Main Entry Point ────────────────────────────────────────────────────


async def run_scan(
    target: str,
    snmp_community: str,
    cisco_client_id: str,
    cisco_client_secret: str,
    skip_nuclei: bool = False,
    output_dir: str | None = None,
) -> dict[str, Any]:
    """Execute the full vulnerability scan pipeline.

    Parameters
    ----------
    target : str
        IP address or hostname of the Cisco device.
    snmp_community : str
        SNMP v2c community string.
    cisco_client_id : str
        Cisco PSIRT openVuln API client ID.
    cisco_client_secret : str
        Cisco PSIRT openVuln API client secret.
    skip_nuclei : bool
        If True, skip the Nuclei network scan stage.
    output_dir : str | None
        Directory to write report.json and report.html.  If None, no
        files are written.

    Returns
    -------
    dict
        {device_info, severity_summary, findings, report_html, notes}

    Raises
    ------
    RuntimeError
        On SNMP failure or PSIRT auth failure, with a descriptive message
        that never includes credentials.
    """
    notes: list[str] = []

    # ── Stage 1: SNMP Detection ──
    logger.info("Stage 1: SNMP detection on %s", target)
    device_info = await snmp_detect(target, snmp_community)
    version = device_info["version"]
    platform = device_info["platform"]

    # ── Stage 2: Cisco PSIRT API ──
    logger.info("Stage 2: Cisco PSIRT API query for %s %s", platform, version)
    token = _psirt_get_token(cisco_client_id, cisco_client_secret)
    advisories = _psirt_query(version, platform, token)
    findings = [_normalize_cisco_advisory(adv) for adv in advisories]
    logger.info("PSIRT stage: %d findings", len(findings))

    # ── Stage 3: Nuclei (optional) ──
    if skip_nuclei:
        notes.append("Nuclei scan was skipped by request.")
        logger.info("Stage 3: Nuclei skipped by request")
    else:
        logger.info("Stage 3: Nuclei scan on %s", target)
        try:
            nuclei_findings = _run_nuclei(target)
            findings.extend(nuclei_findings)
            if not nuclei_findings:
                notes.append(
                    "Nuclei scan completed but returned no findings."
                )
        except Exception as exc:
            logger.warning("Nuclei stage failed: %s", exc)
            notes.append(
                f"Nuclei scan failed ({exc}) — results are PSIRT-only."
            )

    # ── Deduplicate & summarize ──
    findings = _deduplicate(findings)
    findings.sort(key=lambda f: f["cvss_base"], reverse=True)
    severity = _severity_summary(findings)

    # ── Stage 4: Report Generation ──
    report_html = _generate_report_html(device_info, severity, findings, notes)
    report_json = _generate_report_json(device_info, severity, findings, notes)

    if output_dir:
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)

        json_path = out / "report.json"
        html_path = out / "report.html"

        json_path.write_text(json.dumps(report_json, indent=2))
        html_path.write_text(report_html)

        logger.info("Reports written to %s", out)

    return {
        "device_info": device_info,
        "severity_summary": severity,
        "findings": findings,
        "report_html": report_html,
        "notes": notes,
    }
