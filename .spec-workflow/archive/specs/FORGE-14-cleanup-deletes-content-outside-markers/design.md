# Design Document

## References

- **Issue:** FORGE-14
- **Spec Path:** `.spec-workflow/specs/FORGE-14-cleanup-deletes-content-outside-markers/`

## Overview

Fix `parseSections` to capture ALL content in the template as sections, including orphan text that falls outside any detected divider boundaries. Replace the current preamble-prepend behavior with explicit "Generic Config" section creation for any gaps. This is a single-function fix in `template-parser.ts`.

## Steering Document Alignment

### Technical Standards (tech.md)
- No new dependencies. Pure parser logic change.
- Backward compatible — existing templates with proper sections are unaffected.

### Project Structure (structure.md)
- Single file modified: `src/lib/template-parser.ts`
- Tests added to existing test file: `src/__tests__/template-parser.test.ts`

## Code Reuse Analysis

### Existing Components to Leverage
- **`deduplicateNames`** (`src/lib/template-parser.ts`): Already handles name collisions. "Generic Config", "Generic Config (2)", etc. will work automatically.
- **Section construction pattern**: The existing section-building loop (lines 277-309) shows the exact structure for creating new sections.

### Integration Points
- **`cleanUpSections`**: No changes needed. It iterates `parseSections` output and wraps each in START/END markers. If `parseSections` returns complete coverage, `cleanUpSections` preserves everything.
- **`rebuildRawText`**: No changes needed. It uses section ranges from the raw text.

## Architecture

The fix modifies the section-building logic at the end of `parseSections` (after dividers are detected and sorted). Instead of the current approach (build sections from dividers only, prepend preamble to first section), the new approach walks the entire document line by line and fills gaps.

### Algorithm: Gap-Filling Section Builder

```
Given: sorted dividers[] with lineIndex, endLineIndex, spanLines
Given: lines[] (all lines in the document)

cursor = 0  (tracks how far through the document we've processed)

For each divider d in order:
  1. If cursor < d.lineIndex:
     → GAP: lines[cursor..d.lineIndex) are orphan text
     → Create a "Generic Config" section from those lines
     → (skip if all lines are whitespace)

  2. Build the section from divider d (existing logic)
     → For START/END: content is lines between START and END markers
     → For legacy: content is lines from divider to next divider

  3. Advance cursor past this section:
     → For START/END: cursor = endLineIndex + 1
     → For legacy: cursor = next divider's lineIndex (or end of file)

After all dividers:
  If cursor < lines.length:
    → POSTAMBLE: lines[cursor..end) are orphan text
    → Create a "Generic Config" section (skip if all whitespace)
```

This guarantees every line in the document belongs to exactly one section.

## Components and Interfaces

### parseSections (MODIFY — single function)
- **Current behavior**: Creates sections only from detected dividers. Preamble (content before first divider) is prepended to the first section's template. Postamble (content after last END marker) is dropped.
- **New behavior**: Walks the document with a cursor. Creates "Generic Config" sections for any gaps between dividers. Removes the preamble-prepend hack (lines 312-316).
- **Dependencies**: `deduplicateNames` (existing, handles name collisions)

## Data Models

No changes. Same `TemplateSection` interface.

## UI Impact Assessment

### Has UI Changes: No

## Open Questions

### Resolved

- [x] ~~Should gap sections have a specific name?~~ — "Generic Config", deduplicated automatically.
- [x] ~~Should empty/whitespace-only gaps create sections?~~ — No. Only gaps with at least one non-whitespace line become sections. This prevents spurious empty sections from blank lines between dividers.
- [x] ~~Does this affect the single-section fallback?~~ — No. The no-dividers case (lines 260-268) still returns a single "Full Config" section wrapping everything. The gap-filling only activates when dividers are found.

## Error Handling

### Error Scenarios
1. **All content is between dividers (no gaps)**
   - **Handling:** Cursor advances past each section, no gap sections created. Identical to current behavior.
   - **User Impact:** None — backward compatible.

2. **Template has only whitespace between dividers**
   - **Handling:** Gap detection skips whitespace-only gaps.
   - **User Impact:** No spurious "Generic Config" sections for blank line padding.

## Testing Strategy

### Unit Tests (added to existing template-parser.test.ts)
- Test: bare text + one START/END block → preamble + postamble become "Generic Config" sections
- Test: two START/END blocks with content gap → gap becomes a section
- Test: START/END block at very start of template → no preamble section, postamble captured
- Test: START/END block at very end of template → preamble captured, no postamble section
- Test: mixed legacy dividers + START/END → all content preserved
- Test: existing templates with full coverage → identical output (backward compat)
- Test: whitespace-only gaps → no spurious sections
