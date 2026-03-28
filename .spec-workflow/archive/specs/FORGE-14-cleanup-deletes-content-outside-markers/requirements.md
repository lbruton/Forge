# Requirements Document

## References

- **Issue:** FORGE-14
- **Spec Path:** `.spec-workflow/specs/FORGE-14-cleanup-deletes-content-outside-markers/`

## Introduction

Critical data loss bug: when a template has a mix of bare text and START/END section markers, pressing "Clean Up" silently deletes all content outside the markers. The root cause is in `parseSections` — it only creates sections from detected dividers and drops orphan text (content before the first divider, between non-adjacent dividers, and after the last END marker). `cleanUpSections` then only outputs what `parseSections` returns, losing the orphaned content.

## Alignment with Product Vision

From product.md: **"Safe by Default"** — the app should never silently destroy user data. This is the highest priority fix category.

## Requirements

### Requirement 1: Preserve Content Before First Divider

**User Story:** As a network engineer, I want content before my first section marker to be preserved as its own section so that Clean Up doesn't delete my preamble config.

#### Acceptance Criteria

1. WHEN a template has content before the first START/END or legacy divider THEN `parseSections` SHALL create a separate section for that content named "Generic Config"
2. WHEN Clean Up runs on such a template THEN the preamble content SHALL appear in a "Generic Config" section with proper START/END markers
3. IF the preamble is only whitespace/empty lines THEN no extra section SHALL be created

### Requirement 2: Preserve Content After Last END Marker

**User Story:** As a network engineer, I want content after my last END marker to be preserved so that trailing config lines aren't silently deleted.

#### Acceptance Criteria

1. WHEN a template has content after the last END marker THEN `parseSections` SHALL create a separate section for that content named "Generic Config (2)" (or next available deduplicated name)
2. WHEN Clean Up runs THEN the postamble content SHALL appear in its own section with START/END markers
3. IF the postamble is only whitespace/empty lines THEN no extra section SHALL be created

### Requirement 3: Preserve Content Between Non-Adjacent Dividers

**User Story:** As a network engineer, I want content between two separate START/END blocks to be preserved so that gap content isn't lost.

#### Acceptance Criteria

1. WHEN there are two START/END blocks with content between them (not covered by either block) THEN `parseSections` SHALL create a section for the gap content
2. The gap section SHALL be named "Generic Config" (deduplicated if needed)
3. The gap section SHALL appear in document order between the two explicit sections

### Requirement 4: No Silent Data Loss

**User Story:** As a network engineer, I want assurance that Clean Up never removes content from my template.

#### Acceptance Criteria

1. WHEN Clean Up runs THEN every non-empty line from the original template SHALL appear in exactly one output section
2. The only lines that may be removed are: legacy divider lines being replaced by START/END markers, and leading/trailing blank lines within sections
3. No config content (commands, variables, comments) SHALL be silently deleted

## Open Questions

### Resolved

- [x] ~~Should the fix be in parseSections, cleanUpSections, or both?~~ — `parseSections`. It's the source of truth. If it returns all content as sections, `cleanUpSections` will output everything correctly.
- [x] ~~What should orphan sections be named?~~ — "Generic Config", deduplicated with existing names per the existing `deduplicateNames` function.
- [x] ~~Should the existing preamble-prepend behavior (line 312-316) change?~~ — Yes, replace it. Instead of prepending to the first section, create a separate "Generic Config" section. This is cleaner and matches the user's mental model.

## Non-Functional Requirements

### Code Architecture and Modularity
- Fix should be entirely within `parseSections` in `src/lib/template-parser.ts`
- `cleanUpSections` should not need changes — it correctly outputs whatever `parseSections` returns
- Existing tests must continue to pass — this is additive behavior

### Reliability
- Zero tolerance for data loss — every non-whitespace line in input must appear in output
- Test coverage must include: bare text + one START/END, multiple START/END with gaps, preamble only, postamble only, mixed legacy + START/END dividers
