"""Pydantic models for the Cisco Vulnerability Scanner sidecar."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, field_validator


# -- Manifest ------------------------------------------------------------------


class TreeNode(BaseModel):
    id: str
    label: str
    icon: str
    vendorScoped: bool


class ManifestResponse(BaseModel):
    name: str
    displayName: str
    version: str
    icon: str
    type: str
    vendors: list[str]
    treeNodes: list[TreeNode]


# -- Health --------------------------------------------------------------------


class HealthResponse(BaseModel):
    status: Literal["active", "degraded"]
    lastChecked: str
    nucleiAvailable: bool
    scansRunning: int


# -- Scan Request / Status -----------------------------------------------------


class ScanRequest(BaseModel):
    target: str
    hostname: str | None = None
    snmp_community: str
    cisco_client_id: str
    cisco_client_secret: str
    skip_nuclei: bool = False

    @field_validator("cisco_client_id", "cisco_client_secret")
    @classmethod
    def credentials_not_blank(cls, v: str, info) -> str:  # noqa: N805
        if not v or not v.strip():
            raise ValueError(
                f"{info.field_name} must not be empty — "
                "Cisco PSIRT API credentials are required"
            )
        return v


class ScanStatus(BaseModel):
    scan_id: str
    status: Literal["queued", "running", "complete", "failed"]
    progress: str | None = None
    started_at: str | None = None
    completed_at: str | None = None
    error: str | None = None
    device: str
    result_path: str | None = None


# -- Severity / Scan Entry / Device Summary ------------------------------------


class SeveritySummary(BaseModel):
    critical: int
    high: int
    medium: int
    low: int
    info: int


class ScanEntry(BaseModel):
    timestamp: str
    status: str
    severity: SeveritySummary
    device_info: dict | None = None
    total_findings: int


class DeviceSummary(BaseModel):
    device: str
    hostname: str | None = None
    last_scan: str | None = None
    severity: SeveritySummary | None = None
    scan_count: int
