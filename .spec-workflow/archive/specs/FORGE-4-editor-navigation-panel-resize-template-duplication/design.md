# Design Document

## References

- **Issue:** FORGE-4
- **Spec Path:** `.spec-workflow/specs/FORGE-4-editor-navigation-panel-resize-template-duplication/`

## Overview

FORGE-4 adds editor navigation (section jump-to, section tabs, cursor indicator), fixes drag-to-sort section reordering, adds panel collapse toggles with persisted state, and enables template variant duplication. All changes are UI/component-level — no new data flows, no storage schema changes beyond an additive type field and a new preference key.

## Steering Document Alignment

### Technical Standards (tech.md)
- React + Vite + Tailwind stack — all changes use existing patterns
- No new dependencies — drag, scroll, and collapse are vanilla DOM operations
- localStorage via Zustand persist middleware for panel collapse state (existing pattern)

### Project Structure (structure.md)
- One new component: `EditorSectionTabs.tsx` (PascalCase, in `src/components/`)
- Type extension in `src/types/index.ts` (additive `startLine` field)
- Parser update in `src/lib/template-parser.ts` (populate `startLine`)
- All other changes modify existing files

## Code Reuse Analysis

### Existing Components to Leverage
- **`textareaRef` + `overlayRef`** (`TemplateEditor.tsx:39,40`): Programmatic scroll for jump-to
- **`handleTextareaScroll`** (`TemplateEditor.tsx:188-193`): Overlay sync pattern — reuse for programmatic scroll
- **`debounceRef`** (`TemplateEditor.tsx:42`): Throttle cursor-in-section detection
- **`dragIndex`/`dragOverIndex` + handlers** (`TemplateEditor.tsx:35-36,164-185`): Fully wired drag infrastructure — only missing rawText rebuild
- **`SectionTabs.tsx`**: Visual reference for tab strip styling (not reused directly — different data type)
- **`TreeNode.tsx` context menu** (lines 117-146): Extend with `onDuplicate` prop
- **`sidebarCollapsed` + `toggleSidebar()`** (`store/index.ts:419-425`): Left sidebar collapse already works
- **`saveTemplate` + `addVariant`** (`Sidebar.tsx:78-91`): Compose for duplication — no new store action
- **`structuredClone`** (`store/index.ts:230,265`): Deep clone pattern for template duplication

### Integration Points
- **Zustand store** (`src/store/index.ts`): Add `rightPanelCollapsed: boolean` to `Preferences` type + toggle action
- **`TemplateSection` type** (`src/types/index.ts`): Add `startLine?: number` field
- **`parseSections`** (`src/lib/template-parser.ts`): Populate `startLine` from divider line index

## Architecture

The design follows a layered approach: type/parser foundation first, then UI features that consume it.

```
┌─────────────────────────────────────────────────┐
│  Layer 1: Type + Parser Foundation              │
│  TemplateSection.startLine + parseSections fix   │
│  rawText rebuild helper                          │
├─────────────────────────────────────────────────┤
│  Layer 2: Editor Navigation                      │
│  Jump-to scroll, cursor detection, section tabs  │
├─────────────────────────────────────────────────┤
│  Layer 3: Panel Management                       │
│  Collapse toggles (left + right), persisted      │
├─────────────────────────────────────────────────┤
│  Layer 4: Sidebar Operations                     │
│  Variant duplication via context menu             │
└─────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Type Extension: `TemplateSection.startLine`
- **Purpose:** Reliable line number for section START marker — eliminates fragile `findIndex` lookups
- **Interface:** `startLine?: number` on `TemplateSection` (optional for backward compat)
- **Dependencies:** `parseSections` in `template-parser.ts` must populate it
- **Reuses:** Existing divider detection logic in parser

### 2. `rebuildRawText(sections: TemplateSection[], rawText: string): string`
- **Purpose:** Reconstruct rawText from reordered sections after drag-sort
- **Location:** `src/lib/template-parser.ts` (new export)
- **Interface:** Takes current sections array (in new order) and original rawText, returns rewritten text with sections in the new order
- **Dependencies:** Section `startLine` and divider patterns
- **Reuses:** Existing `dividerPattern`/`endDividerPattern` on sections

### 3. `EditorSectionTabs` Component
- **Purpose:** Tab strip above editor textarea for section navigation
- **Location:** `src/components/EditorSectionTabs.tsx`
- **Props:**
  ```ts
  interface EditorSectionTabsProps {
    sections: TemplateSection[];
    activeSectionName: string | null;
    onJumpTo: (section: TemplateSection) => void;
  }
  ```
- **Dependencies:** `TemplateSection` type
- **Reuses:** Visual styling from `SectionTabs.tsx` (colors, tab shape, active state)

### 4. Cursor-in-Section Detection (in `TemplateEditor`)
- **Purpose:** Track which section the cursor is in, update `activeSectionName` state
- **Interface:** `activeSectionName: string | null` local state, updated on `onSelect`/`onMouseUp`/`onKeyUp` (debounced)
- **Dependencies:** `TemplateSection.startLine`, textarea `selectionStart`
- **Reuses:** `debounceRef` pattern from `handleTextChange`

### 5. Section Jump-To (in `TemplateEditor`)
- **Purpose:** Scroll textarea + overlay to a section's START marker
- **Interface:** `handleJumpToSection(section: TemplateSection): void`
- **Dependencies:** `textareaRef`, `overlayRef`, section `startLine`
- **Reuses:** Existing ref pattern; `leading-[1.65rem]` line height for scroll math

### 6. Panel Collapse — Right Panel
- **Purpose:** Collapse the right editor panel (variables + sections) with a chevron toggle
- **Location:** `TemplateEditor.tsx` (button) + `store/index.ts` (persisted state)
- **Interface:** `rightPanelCollapsed: boolean` in Preferences, `toggleRightPanel()` action
- **Dependencies:** Zustand persist middleware (already configured)
- **Reuses:** `sidebarCollapsed`/`toggleSidebar` pattern exactly

### 7. Panel Collapse — Left Sidebar Desktop Chevron
- **Purpose:** Add a visible collapse button on the sidebar for desktop (mobile hamburger already exists)
- **Location:** `App.tsx` or `Sidebar.tsx` — positioned chevron button on sidebar edge
- **Interface:** Calls existing `toggleSidebar()` action
- **Dependencies:** Existing `sidebarCollapsed` preference
- **Reuses:** Entire existing collapse infrastructure — just adding a button

### 8. Variant Duplication
- **Purpose:** Clone a template variant with all its data under a new ID
- **Location:** `TreeNode.tsx` (new prop + menu item), `Sidebar.tsx` (handler wiring)
- **Interface:**
  - `TreeNode`: new `onDuplicate?: () => void` prop → "Duplicate" button in context menu
  - `Sidebar`: `handleDuplicateVariant(viewId, vendorId, modelId, variantId)` handler
- **Dependencies:** `getTemplate()`, `saveTemplate()`, `addVariant()` from store
- **Reuses:** Existing context menu pattern, `crypto.randomUUID()`, `structuredClone`

## Data Models

### TemplateSection (modified)
```ts
export interface TemplateSection {
  // ... existing fields unchanged ...
  startLine?: number;  // NEW: line index of START marker in rawText
}
```

### Preferences (modified)
```ts
export interface Preferences {
  // ... existing fields unchanged ...
  rightPanelCollapsed: boolean;  // NEW: default false
}
```

No new models. No storage schema migration needed — Zustand persist handles new preference fields via defaults.

## UI Impact Assessment

### Has UI Changes: Yes

### Visual Scope
- **Impact Level:** Minor element additions to existing components
- **Components Affected:** `TemplateEditor.tsx` (section tabs, jump-to, cursor indicator, right panel collapse), `App.tsx`/`Sidebar.tsx` (left sidebar collapse chevron), `TreeNode.tsx` (duplicate menu item)
- **Prototype Required:** No — all additions follow established visual patterns (tabs match `SectionTabs`, collapse chevrons match Lucide icon patterns, context menu item matches existing Edit/Delete items). No new layout paradigms or uncertain visual hierarchy.

### Design Constraints
- **Theme Compatibility:** Dark mode only (Forge is dark-mode-only per branding)
- **Existing Patterns to Match:** `SectionTabs` for tab styling, `TreeNode` context menu for duplication item, sidebar toggle for collapse behavior
- **Responsive Behavior:** Collapse chevrons hidden on mobile (hamburger menu exists); section tabs wrap same as existing `SectionTabs`

## Open Questions

### Blocking (must resolve before approval)

None.

### Resolved

- [x] ~~Drag-to-resize included?~~ — No, collapse only for V1 (per requirements feedback)
- [x] ~~Right panel collapse persisted?~~ — Yes, via Zustand preferences (per requirements feedback)
- [x] ~~New component vs reuse SectionTabs?~~ — New `EditorSectionTabs` component; different data type (`TemplateSection[]` vs `GeneratedSection[]`), no copy/download actions needed
- [x] ~~Where does rebuildRawText live?~~ — In `template-parser.ts` alongside `parseSections` (same module boundary)

## Error Handling

### Error Scenarios
1. **Jump-to with no `startLine`**
   - **Handling:** If `section.startLine` is undefined, fall back to `findIndex` on rawText (existing behavior)
   - **User Impact:** Slightly less accurate scroll position — no visible error

2. **Drag-reorder produces malformed rawText**
   - **Handling:** `rebuildRawText` validates output has same line count; if mismatch, revert to original rawText and log warning to console
   - **User Impact:** Drag appears to "snap back" — no data loss

3. **Duplicate variant when localStorage is near capacity**
   - **Handling:** Existing `saveTemplate` already catches quota errors — same error path applies
   - **User Impact:** Existing error toast/handling

## Testing Strategy

### Manual Verification
- Jump-to: Click each section in sidebar and tab strip, verify textarea scrolls to correct position
- Cursor indicator: Click within different sections, verify correct section highlights in sidebar and tabs
- Drag-to-sort: Reorder sections, verify rawText updates, save and reload to confirm persistence
- Panel collapse: Toggle left and right panels, verify textarea expands, reload to confirm persistence
- Variant duplication: Right-click variant → Duplicate, verify new variant appears with "(copy)" suffix and independent content
