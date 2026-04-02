# Changelog

All notable changes to Forge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
