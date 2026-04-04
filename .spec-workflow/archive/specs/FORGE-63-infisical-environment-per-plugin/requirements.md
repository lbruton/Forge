# Requirements Document

## References

- **Issue:** FORGE-63
- **Spec Path:** `.spec-workflow/specs/FORGE-63-infisical-environment-per-plugin/`

## Introduction

The Infisical secrets integration currently hardcodes a single global `defaultEnvironment` for all credential resolution. When secrets are organized into per-purpose Infisical environments (e.g., "Vulnerabilities" for PSIRT/SNMP credentials, "Production" for config secrets), plugins silently resolve from the wrong environment, producing empty credentials and failed scans. This feature enables each plugin to specify which Infisical environment its secrets resolve from, while preserving backward compatibility with the existing global default.

## Alignment with Product Vision

Forge's plugin system is designed for modular, independent functionality — each plugin manages its own configuration and credentials. Hardcoding a shared environment breaks this isolation. This feature restores the plugin-scoped credential model and directly supports the "Safe by Default" principle: secrets should resolve from the correct, explicitly-configured environment rather than silently falling back to a potentially wrong one.

## Requirements

### Requirement 1: Per-Plugin Infisical Environment Setting

**User Story:** As a network engineer using multiple Forge plugins, I want each plugin to pull secrets from its own Infisical environment, so that I can organize credentials by function (e.g., vuln scanning vs configuration secrets) without one overriding the other.

#### Acceptance Criteria

1. WHEN a plugin's `settingsSchema` includes an `infisicalEnvironment` field THEN the system SHALL use that value for all `getSecret()` and `setSecret()` calls originating from that plugin.
2. IF a plugin's `infisicalEnvironment` setting is empty or unset THEN the system SHALL fall back to the Infisical plugin's `defaultEnvironment` setting.
3. IF both the plugin's `infisicalEnvironment` and Infisical's `defaultEnvironment` are empty THEN the system SHALL fall back to `'dev'` as the final default.
4. WHEN the vuln-cisco plugin is registered THEN its settings form SHALL display an "Infisical Environment" text input field.

### Requirement 2: Centralized Environment Resolution

**User Story:** As a developer maintaining Forge, I want a single helper function that resolves the correct Infisical environment for any plugin, so that the resolution chain (plugin setting → global default → `'dev'`) is consistent and not duplicated across 6+ call sites.

#### Acceptance Criteria

1. WHEN any component needs to resolve the Infisical environment for a plugin THEN it SHALL call the shared helper function rather than inline the resolution logic.
2. WHEN the helper is called with a plugin name THEN it SHALL check that plugin's `infisicalEnvironment` setting first, then the Infisical plugin's `defaultEnvironment`, then `'dev'`.
3. WHEN the resolution chain is changed in the future THEN only the helper function SHALL need updating (single point of change).

### Requirement 3: Backward Compatibility

**User Story:** As an existing Forge user who hasn't configured per-plugin environments, I want everything to keep working exactly as it does today, so that this upgrade doesn't break my workflow.

#### Acceptance Criteria

1. WHEN no plugin has an `infisicalEnvironment` setting configured THEN all credential resolution SHALL behave identically to the current implementation (uses Infisical `defaultEnvironment` or `'dev'`).
2. WHEN the vuln-cisco plugin is upgraded THEN existing `PluginRegistration` data in localStorage SHALL remain valid — no migration required.
3. WHEN GlobalVariablesPage resolves secrets for variable sync THEN it SHALL continue using the Infisical plugin's `defaultEnvironment` (global variables are app-scoped, not plugin-scoped).

## Open Questions

> **GATE:** All blocking questions must be resolved before this document can be approved.

### Blocking (must resolve before approval)

_None — all blocking questions resolved during discovery._

### Non-blocking (can defer to Design)

- [ ] Should the helper function live in `src/lib/` (shared utility) or `src/plugins/infisical/` (provider-adjacent)? — Placement decision for design phase.

### Resolved

- [x] ~~Should GlobalVariablesPage use per-plugin env?~~ — No. Global variables are app-scoped. The `syncToSecrets` metadata already captures environment per-reference at link time. No change needed.
- [x] ~~Should the env be stored per-plugin setting or per-secret-reference?~~ — Per-plugin setting. Per-reference is more granular but adds unnecessary complexity for the current use case. The existing `syncToSecrets.environment` already handles per-reference for global variables.
- [x] ~~Does the vuln-cisco plugin need a settingsSchema?~~ — Yes. Currently has none (comment: "PSIRT credentials managed via Infisical"). Adding `infisicalEnvironment` to the schema will auto-render a settings field in PluginPanel via the existing `SettingsForm` component.

## Non-Functional Requirements

### Code Architecture and Modularity

- **Single Responsibility**: The environment resolution helper has one job — resolve the Infisical environment for a given plugin context.
- **DRY**: All 6 existing call sites that inline the resolution pattern must be refactored to use the helper. Zero duplicated resolution logic after implementation.
- **Backward Compatible**: No data migration, no breaking changes to existing `PluginRegistration` or `SecretsProvider` interfaces.

### Performance

- No performance impact — the helper reads in-memory Zustand state, no async calls.

### Security

- No credentials stored in plugin settings — `infisicalEnvironment` is an environment slug (e.g., `"vulnerabilities"`), not a secret.
- The security model (Infisical-first, no localStorage credentials) is unchanged.

### Reliability

- Fallback chain (`plugin → global → 'dev'`) ensures credential resolution never fails due to missing configuration — it always has a default.

### Usability

- The `infisicalEnvironment` field auto-renders in the plugin settings form via the existing `SettingsForm` component. No new UI components needed.
- Clear label and optional description guide the user on what to enter.
