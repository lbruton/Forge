# Requirements Document

## References

- **Issue:** FORGE-4
- **Spec Path:** `.spec-workflow/specs/FORGE-4-editor-navigation-panel-resize-template-duplication/`

## Introduction

FORGE-4 addresses UX friction discovered during V1 testing: large config templates are hard to navigate, side panels consume fixed screen space, drag-to-sort sections is visually present but non-functional, and there's no way to duplicate a template variant without recreating it from scratch. These improvements make Forge viable for real-world template libraries with 6+ sections and hundreds of lines of config.

## Alignment with Product Vision

Forge's product principles prioritize **Engineer-First UX** and **Section Independence**. FORGE-4 directly serves both: section jump-to and cursor indicators help engineers work within individual sections of large configs, panel collapse reclaims screen real estate for the config text itself, and template duplication supports the common workflow of creating site-specific variants from a base template.

## Requirements

### Requirement 1: Section Jump-To Navigation

**User Story:** As a network engineer, I want to click a section name in the editor sidebar and have the textarea scroll to that section, so that I can quickly navigate large configs without manual scrolling.

#### Acceptance Criteria

1. WHEN a user clicks a section name in the detected sections panel THEN the editor textarea SHALL scroll to the START marker of that section
2. WHEN the textarea scrolls programmatically THEN the variable highlight overlay SHALL scroll in sync
3. IF the section is already visible in the viewport THEN the system SHALL still align the section's START marker to the top of the textarea

### Requirement 2: Editor Section Tabs

**User Story:** As a network engineer, I want section tabs above the editor textarea so I can jump between sections with a single click, consistent with the tab pattern already used in the Generate view.

#### Acceptance Criteria

1. WHEN the editor has detected sections THEN section tabs SHALL appear above the textarea
2. WHEN a user clicks a section tab THEN the textarea SHALL scroll to that section (same behavior as Requirement 1)
3. WHEN the active section changes (via cursor movement or tab click) THEN the corresponding tab SHALL be visually highlighted
4. IF the template has no detected sections THEN the tab strip SHALL be hidden

### Requirement 3: Active Section Indicator

**User Story:** As a network engineer, I want to see which section my cursor is currently in, so that I have spatial awareness when editing large configs.

#### Acceptance Criteria

1. WHEN the cursor moves within the editor textarea THEN the system SHALL determine which section contains the cursor position
2. WHEN the active section changes THEN the corresponding section in the sidebar panel SHALL be visually highlighted
3. WHEN the active section changes THEN the corresponding editor section tab SHALL be visually highlighted
4. IF the cursor is outside any section (e.g., before the first START marker) THEN no section SHALL be highlighted

### Requirement 4: Drag-to-Sort Sections

**User Story:** As a network engineer, I want to drag sections in the sidebar to reorder them, so that I can arrange config sections in the order my deployment workflow requires.

#### Acceptance Criteria

1. WHEN a user drags a section via its grip handle THEN the section list SHALL reorder visually during the drag
2. WHEN a drag-and-drop completes THEN the template's raw text SHALL be rebuilt to reflect the new section order
3. WHEN the raw text is rebuilt after reorder THEN the textarea cursor position SHALL be preserved (no cursor jump)
4. WHEN the raw text is rebuilt after reorder THEN the variable highlight overlay SHALL update to match

### Requirement 5: Panel Collapse Toggle

**User Story:** As a network engineer, I want to collapse side panels to maximize the editor textarea width, especially when working on a smaller screen or when I don't need the variable/section panels.

#### Acceptance Criteria

1. WHEN a user clicks the collapse chevron on the left sidebar THEN the sidebar SHALL collapse to a hidden state on desktop (matching existing mobile behavior)
2. WHEN a user clicks the collapse chevron on the right editor panel (variables + sections) THEN the panel SHALL collapse
3. WHEN a collapsed panel's expand button is clicked THEN the panel SHALL restore to its previous width
4. WHEN panel collapse state changes THEN the editor textarea SHALL expand to fill the freed space

### Requirement 6: Template Variant Duplication

**User Story:** As a network engineer, I want to duplicate an existing template variant so I can create site-specific configurations from a base template without re-entering sections and variables from scratch.

#### Acceptance Criteria

1. WHEN a user right-clicks (or clicks the dots menu on) a template variant in the sidebar THEN a "Duplicate" option SHALL appear in the context menu
2. WHEN "Duplicate" is selected THEN a new variant SHALL be created with the name "{original} (copy)" under the same model
3. WHEN a variant is duplicated THEN the new variant SHALL have a new unique ID but contain a full copy of all sections, variables, and raw source text
4. WHEN a variant is duplicated THEN the duplicated variant SHALL appear in the sidebar tree immediately

## Open Questions

> **GATE:** All blocking questions must be resolved before this document can be approved.

### Blocking (must resolve before approval)

None — all items are well-defined from the issue and codebase analysis.

### Non-blocking (can defer to Design)

None remaining.

### Resolved

- [x] ~~Should drag-to-resize panel width be included, or is collapse sufficient for V1?~~ — Collapse only for V1; drag-to-resize deferred to a future issue
- [x] ~~Should panel collapse persist across sessions?~~ — Yes, persist in Zustand preferences for better UX
- [x] ~~Should section jump-to use line-based calculation or character offset?~~ — Line-based using `startLine` added to `TemplateSection` type (codebase impact analysis confirmed `lineStart` calc already exists but isn't persisted on the type)
- [x] ~~Should template duplication require a new store action?~~ — No, existing `saveTemplate` + `addVariant` compose correctly (codebase impact analysis confirmed)

## Non-Functional Requirements

### Code Architecture and Modularity
- **Single Responsibility**: New `EditorSectionTabs` component rather than overloading existing `SectionTabs` (which serves the Generate view with different data types)
- **Type Safety**: Add `startLine?: number` to `TemplateSection` interface rather than computing line positions ad-hoc in multiple locations
- **Existing Patterns**: Leverage existing `textareaRef`/`overlayRef` sync, `debounceRef` throttling, `TreeNode` context menu, and `sidebarCollapsed` preference patterns

### Performance
- Cursor-in-section detection SHALL be debounced (not on every keystroke) to avoid re-render churn
- Section jump-to scroll SHALL be near-instant (< 16ms — single DOM property set)
- Raw text rebuild after drag-reorder SHALL preserve textarea cursor position

### Security
- No new security surface — all changes are UI-only with no external data flow

### Reliability
- Drag-to-sort MUST rebuild raw text atomically — the template's rawSource and section order SHALL always be in sync (fixing the existing latent bug where they diverge)

### Usability
- All new interactions follow existing Forge UI patterns (same icon library, same color tokens, same panel styling)
- Collapse/expand transitions should be immediate (no animation overhead for an engineer-focused tool)
