# Design Document

## References

- **Issue:** FORGE-34
- **Spec Path:** `.spec-workflow/specs/FORGE-34-stvault-import-export-upgrade/`

## Overview

Upgrade the `.stvault` import/export pipeline to cover the full persisted data model (vuln devices, scan cache, preferences) and add UX controls for selective export/import, merge-vs-replace strategy, and enhanced preview with re-setup notices.

The implementation is split into two logical phases:

- **Phase A (Data Layer):** Extend `VaultExportData`, update `exportData()` and `importData()` in the Zustand store. No UI changes.
- **Phase B (UI Layer):** Add category checkboxes, merge/replace toggle, enhanced preview, and re-setup notices to `VaultModal.tsx`.

## Steering Document Alignment

### Technical Standards (tech.md)

- Browser-only, no backend — vault files remain self-contained encrypted blobs
- Web Crypto API (AES-256-GCM + PBKDF2) — vault engine unchanged
- localStorage as primary store — all new data types already persisted by Zustand

### Project Structure (structure.md)

- Types in `src/types/index.ts` — extend `VaultExportData` interface there
- Store logic in `src/store/index.ts` — extend `exportData()` and `importData()` there
- UI in `src/components/VaultModal.tsx` — all modal changes there
- Vault engine (`src/lib/vault-engine.ts`) — no changes needed

## Code Reuse Analysis

### Existing Components to Leverage

- **`exportData()` credential stripping** (`store/index.ts:977-997`): Pattern for iterating plugin registrations, stripping sensitive fields, resetting health. Reuse for vuln device SNMP stripping.
- **`getSensitiveSettingsKeys()`** (`lib/credential-store.ts`): Identifies password-type fields from manifests. Not directly applicable to vuln devices (SNMP community is a known field), but the pattern is the same.
- **`importData()` merge logic** (`store/index.ts:870-971`): Additive merge with conflict detection. Extend with same approach for vuln devices and preferences.
- **`resetAll()` action** (`store/index.ts:845-867`): Already resets all state to defaults. Used as-is for "Replace all" import strategy.
- **VaultModal conflict UI** (`VaultModal.tsx:612-645`): Existing skip/overwrite/rename dropdown per conflict item. Reuse pattern for any new conflict types.

### Integration Points

- **Zustand persist** (`store/index.ts:1178-1213`): `partialize` already excludes runtime-only fields. New export options are runtime-only and don't need persistence.
- **`encryptVulnDeviceSecrets()` / `decryptVulnDeviceSecrets()`** (`store/index.ts:78-108`): Existing helpers for SNMP community encryption in localStorage. Export stripping uses a simpler approach (just delete the field).

## Architecture

The design adds no new files, services, or architectural patterns. It extends three existing files with minimal new surface area.

```
VaultModal.tsx                    store/index.ts                types/index.ts
┌─────────────────┐             ┌──────────────────┐          ┌─────────────────┐
│ Export Tab       │             │ exportData()     │          │ VaultExportData  │
│  + checkboxes ──────────────►│  + vulnDevices   │◄─────────│  + vulnDevices?  │
│  + scan opt-in  │             │  + preferences   │          │  + vulnScanCache?│
│                  │             │  + scanCache?    │          │  + preferences?  │
│ Import Tab       │             │                  │          │  + exportOptions?│
│  + merge/replace │             │ importData()     │          └─────────────────┘
│  + cat. checkboxes────────►  │  + vulnDevices   │
│  + re-setup notice│            │  + preferences   │
│  + enhanced preview│           │  + scanCache     │
└─────────────────┘             │  + resetAll path │
                                └──────────────────┘
```

### Modular Design Principles

- **Single File Responsibility**: Type changes in types, logic changes in store, UI changes in VaultModal. No cross-cutting concerns.
- **Component Isolation**: Export options state is local to VaultModal (not persisted). No new components needed — checkboxes and toggle are inline in the existing modal.
- **Backward Compatibility**: All new `VaultExportData` fields are optional (`?`). No version gate, no migration needed.

## Components and Interfaces

### Extended VaultExportData Interface

- **Purpose:** Define the full shape of data in a `.stvault` file
- **Location:** `src/types/index.ts:162-172`
- **Changes:** Add optional fields for the three missing data types plus export metadata

```typescript
export interface VaultExportData {
  exportedAt: string;
  views?: View[];
  vendors?: Vendor[];
  models?: Model[];
  variants?: Variant[];
  templates: Record<string, Template>;
  variableValues: Record<string, VariableValues>;
  generatedConfigs?: Record<string, GeneratedConfig>;
  plugins?: Record<string, PluginRegistration>;
  // NEW — Phase A
  vulnDevices?: VulnDevice[]; // SNMP communities stripped
  vulnScanCache?: Record<string, ScanEntry[]>; // opt-in, can be large
  preferences?: Partial<Preferences>; // excludes expandedNodes
  exportOptions?: ExportOptions; // metadata: what was included
}

export interface ExportOptions {
  includeGeneratedConfigs: boolean;
  includePlugins: boolean;
  includeVulnDevices: boolean;
  includeVulnScanCache: boolean;
  includePreferences: boolean;
}
```

### Updated exportData()

- **Purpose:** Serialize full app state with credential stripping and selective inclusion
- **Location:** `src/store/index.ts:974-1007`
- **Changes:** Accept `ExportOptions` parameter, add vuln device stripping, preferences filtering, conditional scan cache

```typescript
exportData: (options?: ExportOptions) => {
  const state = get();
  const opts = options ?? defaultExportOptions;

  // Existing: sanitize plugins (strip apiKey, password settings, reset health)
  const sanitizedPlugins = /* existing logic */;

  // NEW: sanitize vuln devices (strip snmpCommunity)
  const sanitizedDevices = state.vulnDevices.map(d => {
    const { snmpCommunity: _, ...rest } = d;
    return rest;
  });

  // NEW: filter preferences (exclude expandedNodes)
  const { expandedNodes: _, ...exportablePrefs } = state.preferences;

  return {
    exportedAt: now(),
    views: state.tree.views,
    templates: state.templates,
    variableValues: state.variableValues,
    ...(opts.includeGeneratedConfigs && { generatedConfigs: state.generatedConfigs }),
    ...(opts.includePlugins && { plugins: sanitizedPlugins }),
    ...(opts.includeVulnDevices && { vulnDevices: sanitizedDevices }),
    ...(opts.includeVulnScanCache && { vulnScanCache: state.vulnScanCache }),
    ...(opts.includePreferences && { preferences: exportablePrefs }),
    exportOptions: opts,
  };
}
```

### Updated importData()

- **Purpose:** Merge or replace all data types from a vault file
- **Location:** `src/store/index.ts:870-971`
- **Changes:** Handle new fields, add replace-all path, orphan viewId handling

Key additions inside the existing `set()` callback:

1. **Vuln devices merge:** Iterate `data.vulnDevices`, skip if device ID already exists, add new ones. If a device's `viewId` doesn't match any imported or existing view, reassign to the first available view.
2. **Preferences merge:** Deep-merge `data.preferences` with current preferences (imported values win, current defaults fill gaps).
3. **Scan cache merge:** For each `deviceId` in `data.vulnScanCache`, concatenate entries with existing cache (additive, no dedup).

The "Replace all" path is handled in VaultModal before calling `importData()`:

```typescript
if (importStrategy === 'replace') {
  resetAll();
}
importData(filteredData);
```

### Updated VaultModal UI

- **Purpose:** Add export/import controls and enhanced preview
- **Location:** `src/components/VaultModal.tsx`
- **Reuses:** Existing checkbox pattern from scope selector, existing conflict resolution UI

#### Export Tab Changes

- Add category checkboxes below the scope selector:
  - "Views & Templates" — always included, no checkbox (core data)
  - "Generated Configs" — default: on
  - "Plugin Settings" — default: on, note: "Credentials will be stripped"
  - "Vulnerability Devices" — default: on, note: "SNMP communities will be stripped"
  - "Scan History" — default: off, note: "May increase file size significantly"
  - "Preferences" — default: on
- Pass selected options to `exportData(options)`.
- Show item counts below checkboxes as a compact summary line.

#### Import Tab Changes

- After decrypt, before conflict view, add:
  - **Strategy toggle:** "Merge with existing" (default) / "Replace all (erase first)"
  - **Category checkboxes:** One per data type present in the vault file, all checked by default. Unchecked categories are filtered out before `importData()`.
  - **Enhanced preview:** Show all category counts (not just views/vendors/models/variants).
  - **Re-setup notices:** Amber warning boxes:
    - If plugins present: "X plugin(s) included. Credentials were stripped — you'll need to re-configure [list plugin names] after import."
    - If vuln devices present: "X device(s) included. SNMP communities were stripped — you'll need to re-enter them after import."
- "Replace all" confirmation: When selected, show a red-bordered warning with confirm button before proceeding.

## Data Models

### ExportOptions (new)

```typescript
interface ExportOptions {
  includeGeneratedConfigs: boolean; // default: true
  includePlugins: boolean; // default: true
  includeVulnDevices: boolean; // default: true
  includeVulnScanCache: boolean; // default: false (large)
  includePreferences: boolean; // default: true
}
```

### VaultExportData (extended)

```
Existing fields (unchanged):
  exportedAt: string
  views?: View[]
  vendors?, models?, variants?: (scoped export)
  templates: Record<string, Template>
  variableValues: Record<string, VariableValues>
  generatedConfigs?: Record<string, GeneratedConfig>
  plugins?: Record<string, PluginRegistration>

New fields (all optional for backward compat):
  vulnDevices?: VulnDevice[]              // snmpCommunity stripped
  vulnScanCache?: Record<string, ScanEntry[]>
  preferences?: Partial<Preferences>      // expandedNodes excluded
  exportOptions?: ExportOptions           // metadata
```

## UI Impact Assessment

### Has UI Changes: Yes

### Visual Scope

- **Impact Level:** Minor element additions to existing modal
- **Components Affected:** `VaultModal.tsx` — export tab (add checkboxes + counts), import tab (add strategy toggle + checkboxes + enhanced preview + re-setup notices)
- **Prototype Required:** No — all additions are standard form controls (checkboxes, radio toggle, info boxes) with clear analogues in the existing VaultModal and throughout the Forge UI. No new layout patterns or visual hierarchy concerns.

### Design Constraints

- **Theme Compatibility:** Dark mode only (Forge is dark-mode-only per BRANDING.md)
- **Existing Patterns to Match:** VaultModal scope selector (radio buttons), conflict resolution cards (bg-forge-obsidian rounded boxes), existing amber warning style
- **Responsive Behavior:** Modal is already max-w-[500px] centered — checkbox additions fit within existing layout. No responsive changes needed.

## Open Questions

### Blocking (must resolve before approval)

None.

### Resolved

- [x] ~~Should exportData accept options or should filtering happen in VaultModal?~~ — Options passed to exportData so the store can skip serialization of large data (scan cache). VaultModal builds the options from checkbox state.
- [x] ~~Should "Replace all" call resetAll() inside importData() or outside?~~ — Outside, in VaultModal. Keeps importData() as a pure merge function. VaultModal calls resetAll() then importData() sequentially.
- [x] ~~How to handle orphaned viewIds on vuln device import?~~ — Reassign to the first available view. Log a notice in the re-setup warnings.

## Error Handling

### Error Scenarios

1. **Import vault from older version (missing new fields)**
   - **Handling:** All new fields are optional. `importData()` checks for existence before processing. No errors thrown.
   - **User Impact:** Import succeeds normally. Categories not present in the vault file show "Not included" in preview.

2. **"Replace all" with empty vault file**
   - **Handling:** `resetAll()` clears everything, then `importData()` with empty/minimal data recreates a near-empty state.
   - **User Impact:** User sees confirmation warning before proceeding. After import, they have only what was in the vault file.

3. **Vuln device with orphaned viewId**
   - **Handling:** Device reassigned to first available view. If no views exist (shouldn't happen — import always has views), device is still imported but won't appear in any view until a view is created.
   - **User Impact:** Re-setup notice mentions "X device(s) were reassigned to [view name] because their original view was not found."

4. **Scan cache exceeds localStorage budget**
   - **Handling:** Zustand persist will fail silently if localStorage is full. This is a pre-existing constraint, not introduced by this spec.
   - **User Impact:** Same as current behavior — the app may fail to persist. The export checkbox default (scan cache off) mitigates this for most users.

## Testing Strategy

### Unit Tests (Vitest)

- **vault-engine.test.ts:** Roundtrip test — export with all new fields, re-import on clean state, verify data integrity (minus stripped fields).
- **store export/import tests:** Test exportData with various ExportOptions combinations. Test importData with new fields, backward compat (missing fields), merge behavior, orphaned viewId handling.

### Manual Verification

- Export → wipe localStorage → import → verify vuln devices, preferences, and (opt-in) scan cache restored.
- Export from current version → import into older version → confirm no crash (forward compat).
- Test "Replace all" flow end-to-end.
- Verify re-setup notices display correctly for plugins and SNMP.
