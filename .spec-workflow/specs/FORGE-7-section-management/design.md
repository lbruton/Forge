# Design Document

## References

- **Issue:** FORGE-7
- **Spec Path:** `.spec-workflow/specs/FORGE-7-section-management/`

## Overview

Two independent changes: (1) An "Add Section" button next to "Clean Up" in the Detected Sections header that prompts for a name and appends an empty START/END block to the template. (2) Hide XML/JSON/YAML from the Config Format dropdown in CreateNodeModal.

## Steering Document Alignment

### Technical Standards (tech.md)
- No new dependencies. Simple UI additions using existing patterns.

### Project Structure (structure.md)
- No new files. Modifications to TemplateEditor.tsx and CreateNodeModal.tsx only.

## Code Reuse Analysis

### Existing Components to Leverage
- **Clean Up button** (`TemplateEditor.tsx`): The Add Section button sits next to it, matching its style.
- **CreateNodeModal format dropdown** (`CreateNodeModal.tsx:110-113`): Just remove three `<option>` lines.

### Integration Points
- **TemplateEditor `rawText` state**: Add Section appends to rawText and triggers the existing debounced re-parse flow.
- **`setEditorDirty`**: Already wired from FORGE-10 — adding a section is an edit that sets dirty.

## Architecture

Both changes are trivial and independent — no architectural decisions needed.

### Add Section Flow
```
User clicks "Add Section" → inline input appears → user types name →
appends "\n!##### NAME - START #####\n\n!##### NAME - END #####" to rawText →
re-parse triggers → new section appears in tabs → dirty flag set
```

### Hide Formats
```
Remove <option value="xml">, <option value="json">, <option value="yaml">
from CreateNodeModal.tsx. Add // TODO comment.
```

## Components and Interfaces

### TemplateEditor (MODIFY)
- **Changes:**
  - Add state: `addSectionName: string`, `showAddSection: boolean`
  - Add "Add Section" button next to "Clean Up" in the Detected Sections header
  - When clicked: show inline input (or toggle a small form) for section name
  - On submit: append `\n\n!##### ${name} - START #####\n\n!##### ${name} - END #####` to rawText, call setEditorDirty(true), hide input, clear name
  - On cancel/escape: hide input, clear name

### CreateNodeModal (MODIFY)
- **Changes:** Remove the three `<option>` elements for xml, json, yaml. Add a TODO comment.

## Data Models

No changes.

## UI Impact Assessment

### Has UI Changes: Yes

### Visual Scope
- **Impact Level:** Minor element additions — one button + inline input in existing header
- **Components Affected:** TemplateEditor (Add Section button), CreateNodeModal (dropdown trim)
- **Prototype Required:** No — button matches existing Clean Up style, inline input is standard pattern

### Design Constraints
- **Theme Compatibility:** Dark mode only
- **Existing Patterns to Match:** Clean Up button style (text-slate-400, hover:text-slate-200, small icon)

## Open Questions

### Resolved

- [x] ~~Modal or inline input for section name?~~ — Inline input next to the button. Lighter weight, no modal overhead for a single field.

## Testing Strategy

### Manual Verification
- Click Add Section, type name, verify section appears in tabs
- Click Add Section, press Escape, verify nothing changes
- Add a section, verify dirty flag triggers unsaved changes warning
- Create a new vendor, verify only CLI format is available
