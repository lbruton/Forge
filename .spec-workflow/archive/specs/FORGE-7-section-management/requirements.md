# Requirements Document

## References

- **Issue:** FORGE-7
- **Spec Path:** `.spec-workflow/specs/FORGE-7-section-management/`

## Introduction

Two improvements to section management: a UI button to create new empty sections, and hiding untested output formats from the dropdown. The SPLIT marker feature originally planned for this issue has been deferred to FORGE-16 (right-click/keyboard shortcut for marker insertion).

## Alignment with Product Vision

From product.md: **"Engineer-First UX"** — creating sections should be as easy as creating variables. Hiding untested formats prevents user confusion.

## Requirements

### Requirement 1: Add Section Button

**User Story:** As a network engineer, I want to create a new empty section from the UI so that I can organize my template without manually typing section markers.

#### Acceptance Criteria

1. WHEN the user clicks an "Add Section" button in the editor THEN the system SHALL prompt for a section name (inline input or small modal)
2. WHEN the user submits a name THEN the system SHALL append `!##### NAME - START #####\n\n!##### NAME - END #####` to the end of the raw text
3. WHEN the new section is appended THEN the system SHALL re-parse sections and the new section SHALL appear in the section tabs
4. IF the user cancels the name prompt THEN no changes SHALL be made
5. IF the user enters an empty name THEN the system SHALL not add a section
6. WHEN a section is added THEN the editor dirty flag SHALL be set (FORGE-10 integration)

### Requirement 2: Hide Untested Output Formats

**User Story:** As a team lead, I want untested output formats hidden from the dropdown so that users don't accidentally select XML/JSON/YAML which may not work correctly.

#### Acceptance Criteria

1. WHEN the Config Format dropdown is rendered in CreateNodeModal THEN only "CLI" SHALL be visible as an option
2. The `ConfigFormat` type union (`'cli' | 'xml' | 'json' | 'yaml'`) SHALL remain unchanged in the type system
3. Existing data with XML/JSON/YAML formats SHALL continue to display correctly (not broken)
4. A code comment SHALL indicate that the formats are temporarily hidden pending testing

## Open Questions

### Resolved

- [x] ~~Where should the Add Section button go?~~ — Next to the "Clean Up" button in the Detected Sections header area, matching its style.
- [x] ~~Should SPLIT marker be included?~~ — Deferred to FORGE-16. Right-click/keyboard shortcut approach is more intuitive.

## Non-Functional Requirements

### Code Architecture and Modularity
- Add Section is a UI change in TemplateEditor — append text to rawText and trigger re-parse
- Format hiding is a 3-line change in CreateNodeModal
- Both are independent changes with no shared code

### Usability
- Add Section button should be visually consistent with the Clean Up button
- Name prompt should auto-focus the input
