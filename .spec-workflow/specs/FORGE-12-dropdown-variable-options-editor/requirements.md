# Requirements Document

## References

* **Issue:** FORGE-12
* **Spec Path:** `.spec-workflow/specs/FORGE-12-dropdown-variable-options-editor/`

## Introduction

The variable system supports a `dropdown` type with an `options: string[]` array, and the Generate view correctly renders a `<select>` for dropdown-type variables. However, there is no UI to populate the options array — the dropdown type is unusable. This spec adds an options editor that appears when a variable's type is set to 'dropdown', in both the VariableDetectionPanel (local variables) and GlobalVariablesPage (global variables).

## Alignment with Product Vision

From product.md: **"Engineer-First UX"** and **"DNAC Compatible"**. DNAC templates support dropdown/enumerated variables for things like port modes, VLAN types, and protocol options. Forge needs this parity so teams can migrate their existing dropdown-style variables.

## Requirements

### Requirement 1: Options Editor in VariableDetectionPanel

**User Story:** As a network engineer editing a template, I want to define dropdown options for a variable so that the Generate view presents a selection list instead of a free-text input.

#### Acceptance Criteria

1. WHEN a variable's type is set to 'dropdown' in the VariableDetectionPanel THEN the system SHALL display an options editor below the type selector
2. WHEN the user types an option value and clicks "Add" (or presses Enter) THEN the system SHALL append the option to the variable's options array
3. WHEN the user clicks the delete button on an option THEN the system SHALL remove that option from the array
4. WHEN the options list is empty THEN the system SHALL show a hint: "Add at least one option"
5. WHEN the variable type is changed away from 'dropdown' THEN the system SHALL hide the options editor but preserve the options data

### Requirement 2: Options Editor in GlobalVariablesPage

**User Story:** As a network engineer managing global variables, I want to define dropdown options for a global variable so that all templates sharing it present consistent choices.

#### Acceptance Criteria

1. WHEN a global variable's type is set to 'dropdown' in the GlobalVariablesPage THEN the system SHALL display an options editor below the type selector
2. The options editor SHALL have identical functionality to the VariableDetectionPanel editor (add, remove, empty state hint)
3. WHEN the global variable is saved THEN the system SHALL persist the options array

### Requirement 3: Generate View Renders Populated Options

**User Story:** As a network engineer generating a config, I want to select from defined dropdown options so that I use consistent, validated values.

#### Acceptance Criteria

1. WHEN a dropdown-type variable has options defined THEN the Generate view SHALL render a `<select>` with those options (this already works — verify it still works after changes)
2. WHEN a dropdown-type variable has no options defined THEN the Generate view SHALL render the `<select>` with only "Select..." and no other choices
3. IF a previously selected option value is removed from the options list THEN the Generate view SHALL reset the selection to empty

### Requirement 4: Options Persistence

**User Story:** As a network engineer, I want dropdown options to persist through save, reload, and .stvault export/import.

#### Acceptance Criteria

1. WHEN a template with dropdown variables is saved THEN the system SHALL persist the options array
2. WHEN a saved template is reopened THEN the system SHALL display the saved options in the editor
3. WHEN a template is exported via .stvault THEN the system SHALL include dropdown options
4. WHEN a .stvault file is imported THEN the system SHALL restore dropdown options

## Open Questions

> **GATE:** All blocking questions must be resolved before this document can be approved.

### Blocking (must resolve before approval)

* [x] ~~Should the options editor be a shared component or inline in each location?~~ — Shared component. Both VariableDetectionPanel and GlobalVariablesPage need identical functionality. Extract a reusable `DropdownOptionsEditor` component.

### Non-blocking (can defer to Design)

* [ ] Should we add drag-to-reorder for dropdown options? — Could reuse the existing drag pattern, but may be overkill for V1. Defer.
  &#x9;A.  we can defer, as long as the user can add them and edit them they can manage the order manually in the v1
* [ ] Should there be a max number of options? — No hard limit for now.
  A. I think only if there is a technical reason such as it will break the UI or the backend, but realistically most users are not going to manually add 9999 options so no hard limit for V1 is fine.&#x20;

### Resolved

* [x] ~~Does the options array already persist through save/reload?~~ — Yes, the store and .stvault serialization already handle it. The gap is purely UI.
* [x] ~~Does the Generate view already render dropdowns?~~ — Yes, `VariableInput.tsx:55-66` renders a `<select>` for dropdown type. Just needs options populated.

## Non-Functional Requirements

### Code Architecture and Modularity

* **Shared component**: Extract a `DropdownOptionsEditor` component used by both VariableDetectionPanel and GlobalVariablesPage
* **Single Responsibility**: The options editor handles only add/remove of string options — no variable metadata editing
* **No store changes needed**: Options are already part of VariableDefinition and persisted via existing save flows

### Usability

* Options editor must be visually consistent with surrounding variable edit controls (same input styling, same spacing)
* "Add" action should work via both button click and Enter key press
* Empty state should clearly communicate that options are required for the dropdown to be useful