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
| Version Lock | `devops/version.lock` |

## Technical Baseline

**Stack**: React 19 + Vite + TypeScript + Zustand + Tailwind CSS v4
**Architecture**: Static web app, browser storage, no backend required
**Hosting**: Homelab (Portainer) initially, publicly hostable

## Commands

```bash
npm run dev       # Vite dev server
npm run build     # tsc -b && vite build
npm run test      # vitest run (11 test suites)
npm run lint      # eslint
```

**Type-check gotcha:** `npx tsc --noEmit` silently passes because root
`tsconfig.json` has `"files": []`. Always use:

```bash
npx tsc --noEmit -p tsconfig.app.json
```

The `dompurify` type error is pre-existing — ignore it.

## Versioning

Forge uses a simplified version lock workflow (no `dev` branch, no GitHub Releases yet).

**Version files** (bumped by `/release patch`):
1. `package.json` — Vite reads this at build time → `__APP_VERSION__` in header
2. `devops/version.lock` — claim system for concurrent agent coordination
3. `CHANGELOG.md` — new version heading + entries

**Workflow:** Each PR with runtime code changes gets a patch bump before merge.
Exception: `chore:` PRs from `/gsd` sessions roll into the next release.

**Display:** Version shows in the app header via `v{__APP_VERSION__}`.

## Architecture

```
src/
├── App.tsx                    # Root — routing, plugin init, layout
├── store/index.ts             # Zustand store — all app state + actions
├── types/                     # index.ts (core), plugin.ts, secrets-provider.ts
├── lib/
│   ├── template-parser.ts     # Section parsing, cleanup, rebuild (highest complexity)
│   ├── substitution-engine.ts # Variable substitution for config generation
│   ├── vault-engine.ts        # .stvault encrypt/decrypt (AES-GCM)
│   ├── storage-service.ts     # localStorage wrapper with prefix isolation
│   ├── plugin-service.ts      # Plugin lifecycle management
│   ├── syntax-highlighter.ts  # Config syntax coloring
│   └── validators.ts          # Shared validators (IPv4, secretKeyToVarName)
├── components/                # 21 React components (see sidebar, editor, modals)
├── plugins/
│   ├── init.ts                # Plugin bootstrap
│   ├── configurations.ts      # Bundled plugin — config template management
│   └── infisical/             # Bundled plugin — secrets integration
│       ├── manifest.ts        # Plugin manifest + settings schema
│       ├── provider.ts        # SecretsProvider implementation
│       ├── api.ts             # InfisicalClient (HTTP + token lifecycle)
│       ├── SecretsBrowser.tsx  # Secrets browsing UI
│       └── SetupWizard.tsx    # Connection setup wizard
└── __tests__/                 # 11 Vitest test suites
```

## Plugin System

Forge uses a two-tier plugin model:

- **Bundled plugins** (Configurations, Infisical) — shipped with the app, enable/disable only
- **Sidecar plugins** — external Docker containers (planned, see FORGE-23)

Plugins register via manifests in `src/plugins/`. The registry is **global** (not per-View).
Views store usage data (devices, results), not plugin instances.

### SecretsProvider Interface

Plugins can implement `SecretsProvider` (defined in `types/secrets-provider.ts`) to integrate
with external secrets managers. Methods: `listProjects`, `listSecrets`, `getSecret`, `setSecret?`.

Sync convention: variables synced to Infisical get a `FORGE_` prefix on the secret key
(e.g., `hostname` → `FORGE_HOSTNAME`). Import strips the prefix back via `secretKeyToVarName()`.

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
