# Requirements Document

## References

- **Issue:** FORGE-34
- **Spec Path:** `.spec-workflow/specs/FORGE-34-stvault-import-export-upgrade/`

## Introduction

The `.stvault` encrypted export/import pipeline was built when Forge's data model consisted of views, vendors, models, variants, and templates. The data model has since grown to include plugin registrations, vuln scanner devices, scan caches, and user preferences. The current `exportData()` silently drops `vulnDevices`, `vulnScanCache`, and `preferences` — meaning a user who exports, wipes their browser, and re-imports loses significant configuration data without warning.

This spec upgrades the pipeline in two phases: first ensuring data completeness (no silent drops), then improving the UX with selective export/import controls, merge-vs-replace strategy, and richer preview.

## Alignment with Product Vision

From product.md: "Safe by Default — No private data stored unencrypted outside the browser. Exports always encrypted. Public hosting is always safe." and "Team portability — .stvault encrypted exports allow team members to share template libraries."

The vault is the only mechanism for backup and portability. If it silently drops data, users lose trust in the backup mechanism and may not discover the loss until after their original data is gone. This upgrade ensures the vault faithfully represents the full application state.

## Requirements

### Requirement 1: Complete Data Export

**User Story:** As a network engineer, I want my .stvault export to include all application data (devices, scan history, preferences), so that I can restore my complete workspace from a backup.

#### Acceptance Criteria

1. WHEN the user exports a vault THEN the system SHALL include `vulnDevices` in `VaultExportData`, with SNMP community strings stripped (same pattern as plugin secret stripping).
2. WHEN the user exports a vault THEN the system SHALL include `preferences` in `VaultExportData`, excluding `expandedNodes` (which are tied to specific node IDs that may not exist on the import target).
3. WHEN the user exports a vault THEN the system SHALL include `vulnScanCache` in `VaultExportData` only when the user opts in via a checkbox (default: off, due to potential size).
4. WHEN the user exports a vault THEN the system SHALL strip all sensitive fields from vuln devices (snmpCommunity) using the same credential-stripping pattern used for plugin secrets in FORGE-64.

### Requirement 2: Complete Data Import

**User Story:** As a network engineer, I want to import a vault file and have all my vuln scanner devices, preferences, and optionally scan history restored, so that I don't lose configuration after a browser wipe.

#### Acceptance Criteria

1. WHEN a vault file containing `vulnDevices` is imported THEN the system SHALL merge vuln devices into the store (skip existing by ID, add new).
2. WHEN a vault file containing `preferences` is imported THEN the system SHALL deep-merge preferences with current state (imported values override, new fields from current state preserved).
3. WHEN a vault file containing `vulnScanCache` is imported THEN the system SHALL merge scan entries per device (additive, no dedup needed since entries are timestamped).
4. WHEN a vault file from an older version lacks the new fields (`vulnDevices`, `preferences`, `vulnScanCache`) THEN the system SHALL import gracefully with no errors (backward compatibility).
5. WHEN importing vuln devices that reference a `viewId` not present in the import target THEN the system SHALL assign them to the first available view and notify the user.

### Requirement 3: Plugin Re-Setup Notice

**User Story:** As a network engineer, I want to be clearly told after import which plugins need re-configuration, so that I know my Infisical and sidecar connections won't work until I re-enter credentials.

#### Acceptance Criteria

1. WHEN a vault file is imported that contains plugin registrations with stripped credentials THEN the system SHALL display a notice listing plugins that require re-setup.
2. WHEN a vault file is imported that contains vuln devices with stripped SNMP communities THEN the system SHALL display a notice that SNMP credentials need re-entry.

### Requirement 4: Selective Export

**User Story:** As a network engineer, I want to choose which categories of data to include in my export (views, configs, plugins, devices, scan history, preferences), so that I can create focused backups or share only templates without device data.

#### Acceptance Criteria

1. WHEN the export modal opens THEN the system SHALL display checkboxes for: Views & Templates (always on), Generated Configs, Plugin Settings, Vuln Devices, Scan History, Preferences.
2. WHEN the user unchecks a category THEN the system SHALL exclude that data from the exported vault file.
3. WHEN "Scan History" is checked THEN the system SHALL include `vulnScanCache` in the export.
4. WHEN the export preview is shown THEN the system SHALL display item counts for each checked category (e.g., "3 views, 12 templates, 5 devices, 2 plugin configs").

### Requirement 5: Selective Import with Merge/Replace

**User Story:** As a network engineer, I want to choose whether to merge imported data with my existing data or replace everything, and select which categories to import, so that I have full control over what changes.

#### Acceptance Criteria

1. WHEN a vault file is decrypted THEN the system SHALL display an import strategy toggle: "Merge with existing" (default) or "Replace all" (clean slate).
2. WHEN "Replace all" is selected THEN the system SHALL show a confirmation warning: "This will erase all existing data before importing."
3. WHEN "Replace all" is confirmed THEN the system SHALL call `resetAll()` before `importData()`.
4. WHEN the import preview is shown THEN the system SHALL display checkboxes for each data category present in the vault file, all checked by default.
5. WHEN the user unchecks a category THEN the system SHALL exclude that data from the import.
6. WHEN conflicts are detected in merge mode THEN the existing conflict resolution UI (skip/overwrite/rename per item) SHALL continue to function.

### Requirement 6: Enhanced Import Preview

**User Story:** As a network engineer, I want to see a detailed preview of what's in the vault file before I import, so that I know exactly what will change.

#### Acceptance Criteria

1. WHEN a vault file is decrypted THEN the system SHALL display counts for all data categories: views, vendors, models, variants, templates, generated configs, plugin configs, vuln devices, scan entries, preferences present/absent.
2. WHEN plugin configs are present THEN the system SHALL show which plugins are included and note any that will need re-setup.
3. WHEN vuln devices are present THEN the system SHALL show the device count and note that SNMP communities will need re-entry.

## Open Questions

> **GATE:** All blocking questions must be resolved before this document can be approved.

### Blocking (must resolve before approval)

None — all blocking questions were resolved during discovery.

### Non-blocking (can defer to Design)

- [ ] Should we show a "last exported" timestamp in the UI so users know when their backup is stale?
- [ ] Should the vault envelope version be bumped to 2? Current recommendation: no, since new fields are optional and backward-compatible.

### Resolved

- [x] ~~Should SNMP communities be included in exports?~~ — No, strip them like plugin secrets. Users re-enter after import. (Discovery brief, consistent with FORGE-64 pattern.)
- [x] ~~Should scan cache be included by default?~~ — No, opt-in via checkbox (default off). Scan caches can be large. Same decision as WhoseOnFirst excluding notification_log from vault exports.
- [x] ~~Should expandedNodes be included in preferences export?~~ — No, they're tied to specific node IDs that may not exist on the import target. Export panel states and sidebar width only.
- [x] ~~Envelope version bump?~~ — Not needed. New fields are optional. Old versions ignore unknown fields gracefully.

## Non-Functional Requirements

### Code Architecture and Modularity

- **Single Responsibility**: Export logic stays in `store/index.ts:exportData()`, import logic in `importData()`. VaultModal handles only UI concerns.
- **Modular Design**: Credential-stripping helpers are already reusable (`getSensitiveSettingsKeys`). New vuln device stripping follows the same pattern.
- **Interface Extension**: `VaultExportData` type extended with optional fields — no breaking changes to existing consumers.

### Performance

- Export/import with scan cache enabled must complete in under 3 seconds for libraries up to 5MB (the existing localStorage budget).
- Scan cache serialization should not block the UI thread — the existing async encrypt/decrypt pipeline handles this.

### Security

- SNMP community strings MUST be stripped from exported vuln devices (same as plugin secret stripping in FORGE-64).
- No raw credentials in vault files — consistent with the existing security model.
- "Replace all" import MUST require explicit user confirmation before calling `resetAll()`.

### Reliability

- Backward compatibility: vault files exported before this upgrade MUST import without errors. Missing fields default gracefully.
- Forward compatibility: vault files exported after this upgrade MUST import into older Forge versions without crashes (unknown fields are ignored by `JSON.parse`).
- Roundtrip integrity: export → import on a clean browser MUST reproduce all non-sensitive data exactly.

### Usability

- Export checkboxes should have sensible defaults (all config data on, scan history off).
- Import preview must be scannable at a glance — category counts, not raw data dumps.
- Plugin re-setup notices must be prominent (amber warning style), not buried in fine print.
