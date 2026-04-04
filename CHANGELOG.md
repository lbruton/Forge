# Changelog

All notable changes to Forge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.2] - 2026-04-04

### Added

- PSIRT product filtering: advisories filtered by device model family to eliminate false positives (FORGE-67)
- Nuclei metadata enrichment: full info block extraction (description, remediation, references, EPSS, CWE, CPE) (FORGE-67)
- CISA KEV integration: disk-cached catalog with 24h TTL, cross-references findings by CVE ID (FORGE-67)
- Finding Detail Modal: two-column view with severity, CVSS, KEV status, references, and remediation (FORGE-67)
- KEV badge on scan report findings that appear in CISA Known Exploited Vulnerabilities catalog (FORGE-67)
- Clickable scan report rows to open finding details (FORGE-67)

### Fixed

- Advisory links now point to Cisco/NVD advisory pages instead of the scanned device IP (FORGE-67)
- "No fix available" styling for platforms with no reachable fix version (FORGE-67)
- Catalyst subfamily matching: C9200L and C9200CX now differentiated correctly (FORGE-67)
- Deduplication now merges Nuclei enrichment into PSIRT records when CVEs overlap (FORGE-67)

## [0.2.1] - 2026-04-03

### Added

- Config Secrets Linter: detection engine with 34 regex rules across 9 Cisco config categories (FORGE-78)
- Severity classification: critical (cleartext/Type 0), high (Type 7 reversible), low (Type 5/8/9 hashed)
- Non-intrusive warning banner above the template editor with collapsible finding list
- Click-to-navigate: click a finding to scroll the editor to the flagged line
- Automatic scan on text change (debounced) and format switch; CLI-only (skips JSON/XML/YAML)
- Variable exclusion: `$var` and `${var}` in value positions are not flagged
- 90 unit + integration tests covering all detection categories, realistic configs, and performance

## [0.2.0] - 2026-04-02

### Added

- Complete vault export: vulnDevices, preferences, and opt-in scan cache now included in .stvault files (FORGE-34)
- Selective export: category checkboxes to include/exclude data types with item counts (FORGE-34)
- Selective import: category checkboxes for each data type present in vault file (FORGE-34)
- Merge/replace import strategy: "Replace all" option with confirmation gate (FORGE-34)
- Enhanced import preview: full data category counts, plugin re-setup notices, SNMP re-entry notices (FORGE-34)
- SNMP community stripping on export (consistent with plugin credential stripping from FORGE-64)
- 5 new vault roundtrip tests covering backward compat, credential stripping, orphaned viewId handling

### Fixed

- User-resizable sidebar with drag handle (180-400px range, persisted) (FORGE-37, PR #30)

## [0.1.0] - 2026-03-28

Baseline release. Forge graduated from a simple config builder into a full
plugin-powered network configuration platform.

### Core

- Sectioned template editor with DNAC-compatible `$variable` / `${variable}` syntax
- Multi-format config generation (Cisco CLI, XML, JSON, YAML)
- Hierarchical device model management (View > Vendor > Model > Variant)
- Global variables with per-View scope and auto-sync from templates
- Variable drag-to-sort with order controlling Generate view output
- Dropdown variable options editor for constrained selections
- Unsaved changes warning when navigating away from editor
- Section drag-to-sort with raw text rebuild
- Editor section tabs with jump-to and cursor-in-section detection
- Collapsible sidebar and right panel with persisted preferences
- Encrypted `.stvault` export/import (AES-GCM) for safe sharing
- Config output styled as terminal with syntax highlighting and line numbers
- Dark mode UI with slate/amber design language (Inter + JetBrains Mono)

### Plugin System

- Three-tier plugin architecture: bundled, integration, and sidecar
- Global plugin registry with enable/disable, health checks, and settings schema
- `pluginFetch()` abstraction for all sidecar HTTP calls
- `SecretsProvider` interface for runtime credential resolution

### Plugins

- **Configurations** (bundled) — config template management organized under each View
- **Infisical Secrets** (integration) — browse, import, and sync secrets from
  self-hosted Infisical; setup wizard with Machine Identity auth; `FORGE_` prefix
  convention for variable round-trip
- **Cisco Vulnerability Scanner** (sidecar) — PSIRT advisory lookup + Nuclei
  scanning via Docker container; device management with SNMP credentials from
  Infisical; scan progress stepper; React-rendered responsive reports; scan
  history in sidebar tree

### Sidebar

- Menu-first tree navigation with right-click context menus on all actionable nodes
- Alphabetical sorting of tree nodes
- Plugin tree nodes auto-populated from manifests
- Generated config history nested under each model

### Security

- Infisical-managed secrets resolved at runtime, never stored in localStorage
  (sidecar API keys still persist in browser storage — tracked in FORGE-64)
- DOMPurify sanitization for all sidecar HTML
- Sidecar API key managed via file store, never exposed in responses
- SECURITY.md with vulnerability reporting policy

### Infrastructure

- Docker Compose for Portainer GitOps deployment
- Static web app with browser storage — no server required (sidecar plugins
  are optional Docker containers on the LAN)
