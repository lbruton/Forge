# Requirements Document

## References

- **Issues:** FORGE-2, FORGE-3
- **Spec Path:** `.spec-workflow/specs/FORGE-2-editor-polish-and-generated-configs/`

## Introduction

Combined spec covering two areas: (1) template editor polish and section format improvements from V1 testing feedback, and (2) generated config history for audit trail. Both build on the existing V1 architecture with no breaking changes.

## Alignment with Product Vision

- **Engineer-first UX** — editor improvements reduce friction for the paste-and-go workflow
- **Copy-paste optimized** — generated config history lets engineers save and recall previous outputs
- **Safe by default** — generated configs included in encrypted .stvault exports

## Requirements

### REQ-1: Section START/END Markers

**User Story:** As a network engineer, I want explicit section boundary markers so that section start and end points are unambiguous.

#### Acceptance Criteria

1. WHEN the parser encounters `!##### SECTION TITLE - START #####` THEN it SHALL begin a new section named "SECTION TITLE"
2. WHEN the parser encounters `!##### SECTION TITLE - END #####` THEN it SHALL close the current section
3. WHEN the parser encounters legacy DNAC dividers (without START/END) THEN it SHALL still detect them (backward compatible)
4. WHEN the template editor has a "Clean Up Sections" button clicked THEN the system SHALL auto-inject START markers before each detected boundary and END markers before the next section start
5. WHEN a section has no END marker THEN the system SHALL treat it as ending at the next START marker or end of file (no error, just a warning)

### REQ-2: Duplicate Section Name Handling

**User Story:** As a network engineer, I want duplicate section names to be disambiguated with sequence numbers so that I can distinguish between them without losing paste order.

#### Acceptance Criteria

1. WHEN the parser detects two sections with the same name THEN the first SHALL keep its original name and subsequent duplicates SHALL be appended with " (2)", " (3)", etc.
2. WHEN sections are deduplicated THEN their original order SHALL be preserved
3. WHEN a user renames a section in the editor THEN the sequence numbers SHALL be recalculated

### REQ-3: Template Editor UI Polish

**User Story:** As a network engineer, I want the template editor to be clean and informative so that I can easily understand and manage my template structure.

#### Acceptance Criteria

1. WHEN the template editor is displayed THEN the "Detected Sections" panel SHALL appear ABOVE the "Detected Variables" panel in the right sidebar
2. WHEN variables are shown in the right sidebar THEN the duplicate "Detected in Template" chips below the textarea SHALL be removed
3. WHEN a section is displayed in the sections panel THEN it SHALL have a drag grip handle for reordering
4. WHEN a user drags a section to a new position THEN the section order SHALL update and persist to the template
5. WHEN the editor is displayed THEN clear guidance text SHALL explain the section format, variable syntax, and supported divider patterns
6. WHEN the template editor textarea displays config text THEN variables (matching $varname pattern) SHALL be visually highlighted (amber/bold) in the textarea or an overlay

### REQ-4: Sidebar Polish

**User Story:** As a user, I want the "+ Add View" button to always be visible at the bottom of the sidebar.

#### Acceptance Criteria

1. WHEN the sidebar is displayed THEN the "+ Add View" button SHALL be anchored to the bottom (sticky position)
2. WHEN the sidebar tree is longer than the viewport THEN the tree SHALL scroll independently while the button stays fixed at the bottom

### REQ-5: PWA Support

**User Story:** As a user, I want to install Forge as a browser app with a proper icon.

#### Acceptance Criteria

1. WHEN the app is loaded in a browser THEN the tab SHALL show the Forge anvil favicon
2. WHEN the app has a web manifest THEN Chrome/Edge SHALL offer "Install as App"
3. WHEN installed as a PWA THEN the app icon SHALL be the Forge anvil icon

### REQ-6: Generated Config History (FORGE-3)

**User Story:** As a network engineer, I want to save generated configs with a name and notes so that I have an audit trail of what was deployed to each device.

#### Acceptance Criteria

1. WHEN the user clicks "Save to Generated" in the config generator THEN a modal SHALL prompt for a name (auto-suggested from $hostname if available) and optional notes
2. WHEN the user saves a generated config THEN it SHALL be stored with: name, full config text, variable values used, source variant ID, timestamp, and notes
3. WHEN the sidebar displays a Model THEN it SHALL show two sub-folders: "Templates" (variants) and "Generated" (saved outputs)
4. WHEN the user clicks a generated config in the sidebar THEN a read-only view SHALL display the config with syntax highlighting, metadata (date, source template, variable values), and copy/download buttons
5. WHEN the user right-clicks a generated config THEN they SHALL be able to delete it
6. WHEN a .stvault is exported THEN generated configs SHALL be included in the archive
7. WHEN a .stvault is imported THEN generated configs SHALL be restored alongside templates
8. WHEN the user manually edits the generated output before saving THEN the edited version SHALL be what gets stored (not just the auto-generated text)

## Open Questions

### Blocking (must resolve before approval)

None — all decisions made during V1 testing and chat.

### Resolved

- [x] ~~Section format~~ — `!##### SECTION - START/END #####` (confirmed in chat)
- [x] ~~Duplicate naming~~ — sequence numbers preserving order (confirmed in chat)
- [x] ~~Generated folder name~~ — "Generated" (confirmed in chat)
- [x] ~~Variable highlighting in editor~~ — amber/bold via overlay or summary (confirmed in chat)

## Non-Functional Requirements

### Performance
- Section drag-reorder SHALL update instantly (no perceptible delay)
- Generated config save SHALL complete in under 100ms

### Reliability
- All changes backward compatible with V1 templates in localStorage
- Generated configs SHALL survive page reload (localStorage persistence)
