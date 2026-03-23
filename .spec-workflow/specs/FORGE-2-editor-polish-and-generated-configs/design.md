# Design Document

## References

- **Issues:** FORGE-2, FORGE-3
- **Spec Path:** `.spec-workflow/specs/FORGE-2-editor-polish-and-generated-configs/`

## Overview

Enhancements to the existing V1 architecture. No new engines — extends the template parser, Zustand store, sidebar, and template editor. Adds one new data model (GeneratedConfig) and one new component (GeneratedConfigViewer). All changes are backward compatible with V1 data in localStorage.

## Steering Document Alignment

### Technical Standards (tech.md)
- Same React + Vite + Tailwind stack
- Same localStorage persistence pattern via StorageService
- Same Zustand store pattern — adding new slices and actions
- No new dependencies except potentially a lightweight drag library (or native HTML5 drag)

### Project Structure (structure.md)
- New files follow existing naming conventions (PascalCase components, kebab-case libs)
- New types added to existing `src/types/index.ts`
- Store extensions in existing `src/store/index.ts`

## Code Reuse Analysis

### Existing Components to Leverage
- **template-parser.ts**: Extend with START/END marker support and duplicate name numbering
- **store/index.ts**: Add GeneratedConfig CRUD actions, sidebar hierarchy changes
- **types/index.ts**: Add GeneratedConfig interface, extend Model with generatedConfigs
- **Sidebar.tsx**: Extend tree to show Templates/Generated sub-folders under Model
- **TemplateEditor.tsx**: Reorder panels, remove duplicate chips, add guidance
- **ConfigGenerator.tsx**: Add "Save to Generated" button
- **ConfigPreview.tsx**: Reuse for read-only generated config viewer

### Integration Points
- **StorageService**: New key pattern `forge_generated_ID` for generated configs
- **VaultExportData**: Extend to include generatedConfigs in .stvault exports
- **Sidebar tree**: Model nodes expand to show Templates + Generated sub-folders

## Architecture

No new architectural patterns. This is a feature extension using established V1 patterns.

### Parser Changes (template-parser.ts)

```
Existing flow:  text → parseSections() → TemplateSection[]
Enhanced flow:  text → parseSections() → deduplicate names → TemplateSection[]
                text → cleanUpSections() → inject START/END markers → cleaned text
```

New function `cleanUpSections(text, format)`: takes raw text, detects sections, injects START/END markers, returns cleaned text that the user can review before saving.

Duplicate naming: after section detection, scan names for duplicates, append " (2)", " (3)" etc.

### Sidebar Hierarchy Change

```
Before (V1):                    After (V1.1):
▼ Model                        ▼ Model
  📋 Variant 1                   📄 Templates
  📋 Variant 2                     📋 Variant 1
                                    📋 Variant 2
                                  📂 Generated
                                    📋 tulsapipe... — 03/23
```

Model node now has two child categories instead of directly containing variants.

### Generated Config Data Flow

```
User fills variables → ConfigGenerator → generateConfig() → preview
  → User clicks "Save to Generated"
  → Modal: name (auto-suggest from $hostname), notes
  → store.saveGeneratedConfig(data) → localStorage forge_generated_ID
  → Sidebar updates → Generated folder shows new entry
  → Click entry → GeneratedConfigViewer (read-only, syntax highlighted)
```

## Components and Interfaces

### Modified Components

#### template-parser.ts (MODIFY)
- **New function:** `cleanUpSections(text: string, format: ConfigFormat): string` — injects START/END markers
- **Modified:** `parseSections()` — support START/END markers, deduplicate names with sequence numbers
- **New regex patterns:** `/^!#{3,}\s*(.*?)\s*-\s*START\s*#{3,}/i` and `/^!#{3,}\s*(.*?)\s*-\s*END\s*#{3,}/i`

#### TemplateEditor.tsx (MODIFY)
- Remove "Detected in Template" chips section below textarea
- Reorder right sidebar: Sections above Variables
- Add "Clean Up Sections" button that calls cleanUpSections() and replaces textarea content
- Add clear guidance text block
- Variable highlighting in textarea via CSS overlay or post-processing

#### Sidebar.tsx (MODIFY)
- Model nodes show Templates/Generated sub-folders
- Generated folder lists saved configs with name + date
- Sticky "+ Add View" button at bottom
- Click generated config → set mode to "viewer"

#### ConfigGenerator.tsx (MODIFY)
- Add "Save to Generated" button (amber, with Save icon)
- Save modal with name field (auto-suggest from $hostname variable value) and notes field

#### store/index.ts (MODIFY)
- Add generatedConfigs slice
- Actions: saveGeneratedConfig, deleteGeneratedConfig, getGeneratedConfigs(modelId)
- Extend exportData/importData to include generated configs

#### types/index.ts (MODIFY)
- Add GeneratedConfig interface
- Extend VaultExportData with generatedConfigs field

### New Components

#### GeneratedConfigViewer.tsx (CREATE)
- **Purpose:** Read-only view of a saved generated config
- **Interfaces:** Receives generatedConfigId, renders config with syntax highlighting
- **Shows:** Config name, date, source template variant, variable values used, notes
- **Actions:** Copy, Download, Delete
- **Reuses:** ConfigPreview component for the syntax-highlighted output, CopyButton/DownloadButton

#### SaveGeneratedModal.tsx (CREATE)
- **Purpose:** Modal for saving a generated config
- **Fields:** Name (text, auto-suggested), Notes (textarea, optional)
- **Actions:** Save, Cancel
- **Styling:** Same as CreateNodeModal (Charcoal bg, Steel border, amber CTA)

## Data Models

### GeneratedConfig (new — localStorage: forge_generated_ID)

```typescript
interface GeneratedConfig {
  id: string;
  name: string;                    // e.g., "tulsapipeconswan01"
  modelId: string;                 // parent model
  sourceVariantId: string;         // which variant was used
  sourceTemplateId: string;        // template snapshot reference
  variableValues: Record of string to string;  // exact values used
  fullConfig: string;              // final substituted output (may include manual edits)
  sections: GeneratedSection[];    // per-section output
  notes: string;                   // optional user notes
  createdAt: string;               // ISO timestamp
}
```

### VaultExportData (extend)

Add field: `generatedConfigs: Record of string to GeneratedConfig`

## UI Impact Assessment

### Has UI Changes: Yes

### Visual Scope
- **Impact Level:** Minor element additions and layout changes to existing components
- **Components Affected:** TemplateEditor (panel reorder), Sidebar (hierarchy change, sticky button), ConfigGenerator (new button), plus 2 new components
- **Prototype Required:** No — changes follow existing visual patterns, no new layout paradigm

### Design Constraints
- **Theme Compatibility:** Dark mode only (unchanged)
- **Existing Patterns to Match:** V1 components — same card styles, modal patterns, button styles
- **Responsive Behavior:** Generated folder in sidebar follows existing tree behavior

## Open Questions

### Blocking
None.

### Resolved
- [x] ~~Drag library~~ — Use native HTML5 drag-and-drop for section reordering (no new dependency)
- [x] ~~Variable highlighting approach~~ — CSS class injection on variable patterns in a display overlay synced with textarea scroll

## Error Handling

1. **Mismatched START/END** — Warning toast, not blocking. Section still usable.
2. **Generated config save with empty name** — Require name field, disable Save until non-empty.
3. **localStorage quota on generated configs** — Same StorageService.isNearQuota() warning as V1.

## Testing Strategy

### Unit Tests (Vitest)
- Template parser: START/END marker detection, duplicate name numbering, cleanUpSections output, backward compatibility with V1 dividers
- Store: GeneratedConfig CRUD, export/import with generated configs

### Manual Verification
- Paste DNAC template → Clean Up → verify START/END injected correctly
- Save generated config → verify in sidebar → click to view → verify content
- Export .stvault with generated configs → import into fresh browser → verify restored
