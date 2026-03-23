# CLAUDE.md

This file provides core guidance to Claude Code when working with code in this repository.

> See `~/.claude/CLAUDE.md` for global workflow rules (push safety, version checkout gate, PR lifecycle, MCP tools, code search tiers, plugins).

## Project Overview

**Forge** is a network configuration template generator for teams replacing Cisco DNAC CLI template workflows. It provides device model management, sectioned template editing with DNAC-compatible `$variable` / `${variable}` syntax, multi-format output (Cisco CLI, XML, JSON, YAML), and encrypted `.stvault` export/import for safe public hosting.

**Tagline**: "One tool to configure them all."

## At a Glance

| Field | Value |
|-------|-------|
| Repo | [lbruton/Forge](https://github.com/lbruton/Forge) |
| Branches | `main` (default) |
| Path | `/Volumes/DATA/GitHub/Forge/` |
| Issue Prefix | `FORGE` |
| DocVault | `Projects/Forge/` |

## Technical Baseline

**Stack**: TBD (tech stack decisions pending — see steering docs)
**Architecture**: Static web app, browser storage, no backend required
**Hosting**: Homelab (Portainer) initially, publicly hostable

## Branding

All visual design decisions are documented in `/Users/lbruton/Devops/Forge/BRANDING.md`. Key points:
- Dark mode only (slate backgrounds, amber accent)
- Inter for UI text, JetBrains Mono for config/code content
- Lucide icons
- Config output styled as terminal (darker bg, monospace, line numbers)

## Core Concepts

- **Model**: A device type (e.g., IE3300, C9200L, ASA) with associated config templates
- **Template Section**: A named config block (Base, Auth, VLAN, Interface, TACACS/ISE, ACL)
- **Variable**: A `$name` or `${name}` placeholder in template text, auto-detected from source config
- **stvault**: Encrypted export format for sharing/backing up device models and templates

## Variable Pattern

Uses DNAC-compatible syntax so team muscle memory transfers:
- `$variable` — simple variable
- `${variable}` — braced variable (for embedding in strings)
