# Changelog

All notable changes to Forge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

- Credentials never stored in localStorage — only Infisical key references
- DOMPurify sanitization for all sidecar HTML
- Sidecar API key managed via file store, never exposed in responses
- SECURITY.md with vulnerability reporting policy

### Infrastructure

- Docker Compose for Portainer GitOps deployment
- Static web app — no backend, browser storage only
