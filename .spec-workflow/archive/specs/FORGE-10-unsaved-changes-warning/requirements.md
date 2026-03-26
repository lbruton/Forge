# Requirements Document

## References

- **Issue:** FORGE-10
- **Spec Path:** `.spec-workflow/specs/FORGE-10-unsaved-changes-warning/`

## Introduction

Prevent silent data loss when users navigate away from the template editor with unsaved changes. When the user has modified template text, variables, or section order and attempts to switch views (Generate, another template, Global Variables), a confirmation dialog intercepts the navigation and offers to save, discard, or cancel.

## Alignment with Product Vision

From product.md: **"Engineer-First UX"** — network engineers paste complex configs and invest significant effort editing templates. Silently losing that work is the opposite of engineer-friendly. This is a P1 data loss prevention feature requested directly by the team.

## Requirements

### Requirement 1: Dirty State Detection

**User Story:** As a network engineer, I want the editor to track whether I have unsaved changes so that the system can warn me before I lose work.

#### Acceptance Criteria

1. WHEN the user modifies template text (rawText differs from saved rawSource) THEN the system SHALL mark the editor as dirty
2. WHEN the user modifies variables (reorder, edit, add, delete) THEN the system SHALL mark the editor as dirty
3. WHEN the user clicks "Save Template" and the save succeeds THEN the system SHALL clear the dirty flag
4. WHEN the editor loads a template THEN the system SHALL initialize with a clean (not dirty) state
5. IF no changes have been made since last save THEN the system SHALL NOT mark the editor as dirty

### Requirement 2: Navigation Interception

**User Story:** As a network engineer, I want to be warned before navigating away from unsaved edits so that I don't accidentally lose my work.

#### Acceptance Criteria

1. WHEN the user attempts to navigate away with unsaved changes THEN the system SHALL display a confirmation dialog
2. WHEN the user has no unsaved changes THEN the system SHALL navigate immediately without a dialog
3. The following navigation actions SHALL be intercepted:
   - Clicking a different template variant in the sidebar
   - Clicking "Global Variables" in the sidebar
   - Switching from Editor to Generate mode via the header tabs
   - Clicking a generated config in the sidebar

### Requirement 3: Confirmation Dialog

**User Story:** As a network engineer, I want clear options to save, discard, or cancel when I have unsaved changes so that I am in control of my work.

#### Acceptance Criteria

1. WHEN the dialog appears THEN the system SHALL display three options: "Save & Continue", "Discard", and "Cancel"
2. WHEN the user clicks "Save & Continue" THEN the system SHALL save the template and then proceed with the navigation
3. WHEN the user clicks "Discard" THEN the system SHALL discard unsaved changes and proceed with the navigation
4. WHEN the user clicks "Cancel" THEN the system SHALL close the dialog and return the user to the editor with changes intact
5. WHEN the user clicks the backdrop or presses Escape THEN the system SHALL treat it as "Cancel"
6. The dialog SHALL follow the existing modal pattern (overlay, centered box, forge theme styling)

### Requirement 4: Browser Tab Close Protection

**User Story:** As a network engineer, I want to be warned if I try to close the browser tab with unsaved changes.

#### Acceptance Criteria

1. WHEN the user attempts to close or refresh the browser tab with unsaved changes THEN the system SHALL show the browser's native beforeunload confirmation
2. WHEN the editor has no unsaved changes THEN the system SHALL NOT trigger beforeunload

## Open Questions

> **GATE:** All blocking questions must be resolved before this document can be approved.

### Blocking (must resolve before approval)

- [x] ~~Where should dirty state live — TemplateEditor local state or Zustand store?~~ — Zustand store, because the interception points (setSelectedVariant, setMode) are in the store or App.tsx and need access to the dirty flag.
- [x] ~~Should "Save & Continue" trigger the save from App.tsx or from TemplateEditor?~~ — App.tsx needs a way to trigger save. Expose a save callback via a ref or store method.

### Resolved

- [x] ~~Should we intercept browser back button?~~ — No, the app is a single-page tool without browser history navigation. `beforeunload` covers tab close/refresh.

## Non-Functional Requirements

### Code Architecture and Modularity
- **Reuse existing modal pattern**: UnsavedChangesModal must follow CreateNodeModal's overlay/escape/backdrop pattern
- **Minimal store additions**: Add dirty flag and pending navigation state to existing store, not a separate store
- **Single interception point**: Navigation guard logic should be centralized, not scattered across every click handler

### Performance
- Dirty detection must be instant — no deep comparison on every keystroke. A simple flag set on any edit is sufficient.

### Usability
- Dialog must be clearly worded — "Save & Continue" not "OK", "Discard" not "No"
- Dialog must not block non-editor views (only intercepts when navigating AWAY from editor with unsaved changes)
