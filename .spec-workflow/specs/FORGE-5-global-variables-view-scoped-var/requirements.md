# Requirements Document

## References

- **Issue:** FORGE-5
- **Spec Path:** `.spec-workflow/specs/FORGE-5-global-variables-view-scoped-var/`

## Introduction

FORGE-5 introduces View-scoped Global Variables that leverage the existing DNAC-compatible variable syntax to distinguish shared values (`${variable}`) from template-local values (`$variable`). Network engineers reuse common values (enable passwords, VTP domains, SNMP communities, NTP servers) across many templates in a deployment context. Today, every template requires redundant entry of these values. Global Variables solve this: define once on the View, use everywhere via `${var}`, fill once in the Generate flow.

## Alignment with Product Vision

Directly supports three product principles:
- **Copy-Paste Optimized**: Reduces repetitive variable entry — fill shared values once instead of per-template
- **DNAC Compatible**: Uses existing `${var}` syntax — zero new syntax, leverages team's DNAC muscle memory
- **Section Independence**: Global variables cross-cut sections naturally (same enable password in Base, Auth, and TACACS sections) without redundant definition

## Requirements

### Requirement 1: Syntax-Driven Variable Scoping

**User Story:** As a network engineer, I want `$variable` to be template-local and `${variable}` to be View-global, so that I can control which values are shared vs template-specific using familiar DNAC syntax.

#### Acceptance Criteria

1. WHEN the parser encounters `$variable_name` (no braces) THEN the system SHALL classify it as a template-local variable
2. WHEN the parser encounters `${variable_name}` (with braces) THEN the system SHALL classify it as a global variable scoped to the current View
3. WHEN both `$foo` and `${foo}` appear in a template THEN `${foo}` (global) SHALL take precedence, with a warning indicator in the editor
4. WHEN the parser returns results THEN local and global variables SHALL be returned as separate collections

### Requirement 2: Global Variables Storage on View

**User Story:** As a network engineer, I want global variables stored at the View level so that all templates within a View (e.g., "Work") share the same values without per-template duplication.

#### Acceptance Criteria

1. WHEN a View is created THEN it SHALL have an empty `globalVariables` array
2. WHEN a `${var}` is first detected in any template within a View THEN the system SHALL auto-add it to the View's global variables list
3. WHEN a global variable's value is set on the View THEN that value SHALL be available to all templates in the View during config generation
4. WHEN a View is deleted THEN its global variables SHALL be cascade-deleted
5. WHEN global variables exist on a View THEN they SHALL persist across browser sessions via Zustand persist middleware

### Requirement 3: Global Variables Sidebar Tree Node

**User Story:** As a network engineer, I want to see and manage Global Variables in the sidebar tree under each View, so that I can quickly access shared values.

#### Acceptance Criteria

1. WHEN a View exists THEN a "Global Variables" node SHALL appear in the sidebar tree between the View name and the first Vendor
2. WHEN the Global Variables node is clicked THEN the main content area SHALL display the Global Variables management page
3. WHEN global variables exist THEN the tree node SHALL display a count badge
4. WHEN no global variables exist THEN the tree node SHALL still be visible (with count 0 or no badge)

### Requirement 4: Global Variables Management Page

**User Story:** As a network engineer, I want a dedicated page to manage all global variables for a View — add, edit, delete, mask sensitive values, and reorder them.

#### Acceptance Criteria

1. WHEN the Global Variables page is open THEN all global variables for the View SHALL be listed with name, value, type, and mask toggle
2. WHEN the mask toggle is enabled for a variable THEN its value SHALL display as `••••••••` and input type SHALL be `password`
3. WHEN a user adds a global variable manually THEN it SHALL be appended to the list with default type `string`
4. WHEN a user edits a global variable THEN the change SHALL persist immediately and affect all templates in the View
5. WHEN a user deletes a global variable THEN it SHALL be removed from the View (templates still containing `${var}` will show it as an unresolved global)
6. WHEN a user reorders global variables THEN the order SHALL control the display order on this page and in the Generate view

### Requirement 5: Editor Integration — Read-Only Global Display and Syntax Highlighting

**User Story:** As a network engineer editing a template, I want to see which variables are global vs local in the right sidebar and in the editor text, so that I know which values are shared at a glance.

#### Acceptance Criteria

1. WHEN the editor detects `${var}` in template text THEN the variable SHALL appear in the right sidebar with a visual indicator distinguishing it from local variables (e.g., globe icon or "Global" badge)
2. WHEN a global variable is shown in the editor sidebar THEN it SHALL be read-only (not editable inline — editing happens on the Global Variables page)
3. WHEN a new `${var}` is detected in template text THEN it SHALL be auto-added to the View's global variables list if not already present
4. WHEN a `${var}` already exists in the View's globals THEN the editor SHALL show its current value as context
5. WHEN `${var}` appears in the editor textarea THEN the syntax highlighter overlay SHALL highlight it in green (distinct from the amber/orange used for `$var` local variables)
6. WHEN a user right-clicks a `$var` (local variable) in the editor sidebar THEN a "Promote to Global" option SHALL appear that converts it to `${var}` syntax in the template text and auto-adds it to the View's global variables

### Requirement 6: Generate View — Global Variables Display

**User Story:** As a network engineer generating a config, I want to see global variable values in the Generate view without inline editing, so that I fill shared values in one place (the Global Variables page) not per-template.

#### Acceptance Criteria

1. WHEN the Generate view renders variable inputs THEN global variables SHALL appear in a separate section (info card or grouped area), visually distinct from template-local inputs
2. WHEN global variables are displayed in the Generate view THEN they SHALL show their current values but NOT be editable inline
3. WHEN the global variables section is shown THEN it SHALL include a button/link to open the Global Variables management page
4. WHEN a global variable has no value set THEN it SHALL be highlighted as "unfilled" in the Generate view with a prompt to set it on the Global Variables page

### Requirement 7: Config Generation — Global Variable Resolution

**User Story:** As a network engineer, I want `${var}` references in my templates to resolve to the global variable values during config generation, so that the output contains the actual shared values.

#### Acceptance Criteria

1. WHEN config is generated THEN `${variable_name}` patterns SHALL resolve to the corresponding global variable value from the View
2. WHEN config is generated THEN `$variable_name` patterns SHALL resolve to the template-local variable value (current behavior)
3. IF a `${var}` has no value set on the View THEN the system SHALL leave the `${var}` reference unsubstituted in the output (same as current behavior for unfilled local vars)
4. WHEN a generated config is saved to history THEN the global variable values used SHALL be captured in a separate `globalVariableValues` field on the `GeneratedConfig` snapshot (point-in-time record — if the global admin password later changes, the history still shows what was used at generation time)

### Requirement 8: Export/Import — Global Variables in .stvault

**User Story:** As a network engineer, I want global variables included in .stvault exports so that when I share my template library, the shared values transfer with it.

#### Acceptance Criteria

1. WHEN a .stvault file is exported THEN all global variables for each View SHALL be included automatically (they ride on the View object)
2. WHEN a .stvault file is imported into a fresh instance THEN global variables SHALL be restored on each View
3. WHEN a .stvault file is imported and the View already exists THEN global variables SHALL be merged by name (imported values update existing, new names are added, existing names not in import are preserved)

## Open Questions

> **GATE:** All blocking questions must be resolved before this document can be approved.

### Blocking (must resolve before approval)

None — the architecture is well-understood from the codebase impact analysis and the issue discussion.

### Non-blocking (can defer to Design)

None remaining.

### Resolved

- [x] ~~Syntax highlighter colors for global vs local?~~ — Yes. Green highlight for `${global}` variables, current amber/orange for `$local` variables. (User confirmed)
- [x] ~~"Promote to global" action?~~ — Yes, include it. Right-click `$var` → convert to `${var}` and auto-add to View globals. (User confirmed — good UX shortcut)
- [x] ~~How should GeneratedConfig snapshot capture globals?~~ — Separate `globalVariableValues: Record<string, string>` field on `GeneratedConfig`. Captures a point-in-time snapshot of global values used at generation time, so if the global admin password later changes, the history still shows what was used. (User confirmed — prevents data gap in generation history)
- [x] ~~Scope of "global" — View level or app-wide?~~ — View level. "Work" has different globals than "HomeLab". (User confirmed)
- [x] ~~Need encrypted storage for globals?~~ — No. Generated configs contain plaintext anyway. Optional mask toggle is cosmetic only. (Pivoted from original FORGE-5 secrets concept)
- [x] ~~New syntax needed?~~ — No. Existing `${var}` syntax becomes the global trigger. (User proposed, leverages DNAC compatibility)
- [x] ~~Parser already handles both forms?~~ — Yes. `parseVariables` regex has dual capture groups: `match[1]` for braced, `match[2]` for bare. Just need to surface the distinction. (Codebase impact analysis confirmed)

## Non-Functional Requirements

### Code Architecture and Modularity
- **Parser returns discriminated result**: `parseVariables` returns `{ local: VariableDefinition[], global: string[] }` — clean separation at the source
- **Store actions follow existing patterns**: Global variable CRUD mirrors existing template/variable store patterns
- **New component reuses VariableDetectionPanel patterns**: Accordion expand/collapse, add/edit/delete flow
- **No new external dependencies**: All UI built with existing React + Zustand + Lucide + Tailwind stack

### Performance
- Global variable auto-detection SHALL be debounced (same 300ms as existing `parseVariables` in `handleTextChange`)
- Global variable resolution in the substitution engine SHALL add negligible overhead (single `Record<string, string>` lookup per `${var}`)

### Security
- Mask toggle is cosmetic only — hides value in UI with `type="password"` input
- No encryption of global variable values beyond existing .stvault export encryption
- No new external data flows — all localStorage-based

### Reliability
- Import merge for global variables SHALL be additive — never delete existing globals not present in the import
- Parser discrimination SHALL be backward-compatible — existing templates with `${var}` will start being treated as global, but since no globals exist yet, they'll be auto-created with empty values (no data loss)

### Usability
- Global variables management page follows existing VariableDetectionPanel visual patterns
- Sidebar tree node uses existing TreeNode component at depth 1 — consistent with vendor/model/variant tree structure
- Generate view info card uses existing Forge dark theme styling
