# Tasks Document

## References

- **Issue:** FORGE-14
- **Spec Path:** `.spec-workflow/specs/FORGE-14-cleanup-deletes-content-outside-markers/`

## File Touch Map

| Action | File | Scope |
|--------|------|-------|
| MODIFY | `src/lib/template-parser.ts` | Replace section-building loop in parseSections with gap-filling cursor algorithm |
| TEST | `src/__tests__/template-parser.test.ts` | Add tests for orphan text preservation |

---

- [x] 1. Implement gap-filling cursor algorithm in parseSections
  - File: `src/lib/template-parser.ts`
  - Replace the section-building loop (lines 275-316) with a gap-filling cursor algorithm that creates "Generic Config" sections for any content not covered by dividers
  - **Algorithm:**
    1. Initialize `cursor = 0`
    2. For each divider in sorted order:
       a. If `cursor < divider.lineIndex`: collect lines[cursor..divider.lineIndex), trim leading/trailing blank lines. If any non-whitespace content remains, create a "Generic Config" section for it.
       b. Build the section from the divider (existing logic — START/END or legacy)
       c. Advance cursor: for START/END → `cursor = endLineIndex + 1`; for legacy → `cursor = next divider's lineIndex` or `lines.length`
    3. After all dividers: if `cursor < lines.length`, collect remaining lines. If any non-whitespace content, create a "Generic Config" postamble section.
    4. Run `deduplicateNames` on all sections (including the new gap sections) to handle "Generic Config", "Generic Config (2)", etc.
  - **Remove:** the preamble-prepend code (current lines 312-316) — replaced by step 2a above
  - Purpose: Ensure every line in the document belongs to exactly one section
  - _Leverage: `src/lib/template-parser.ts` (existing parseSections, deduplicateNames)_
  - _Requirements: REQ-1, REQ-2, REQ-3, REQ-4_
  - _Prompt: Implement the task for spec FORGE-14-cleanup-deletes-content-outside-markers, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Parser Developer | Task: Modify the `parseSections` function in `src/lib/template-parser.ts`. Replace the section-building loop (after dividers are sorted, starting around the "Build sections from dividers" comment) with a gap-filling cursor algorithm. (1) Read the FULL current implementation first — understand the divider detection (lines 158-258), deduplicateNames, and the current section builder (lines 275-316). (2) Replace the section builder with a cursor-based approach: start cursor at line 0, for each sorted divider check if there's a gap before it (cursor < divider.lineIndex), create a "Generic Config" section for the gap content (skip if only whitespace), build the divider's section using existing logic (START/END or legacy), advance cursor past the section. After all dividers, check for postamble (cursor < lines.length). (3) Remove the preamble-prepend code (lines 312-316) — it's replaced by gap detection. (4) Call deduplicateNames on ALL dividers (including injected gap dividers) so "Generic Config" gets proper dedup. (5) Gap sections should have dividerPattern set to empty string '' and no endDividerPattern. Their order should be based on document position. CRITICAL: The existing section-building for both START/END pairs (with endLineIndex) and legacy dividers (without endLineIndex) must continue to work identically. Only ADD gap handling — do not break existing section detection. | Restrictions: Do not modify divider detection logic (lines 158-258). Do not modify cleanUpSections. Do not change the TemplateSection interface. Existing tests MUST still pass. | Success: All existing tests pass. A template with bare text + one START/END block produces 3 sections (preamble Generic Config, the named section, postamble Generic Config). No content is lost. Run `npx vitest run src/__tests__/template-parser.test.ts` and `npx tsc --noEmit`. Do NOT commit._
  - **Recommended Agent:** Claude

- [x] 2. Add unit tests for orphan text preservation
  - File: `src/__tests__/template-parser.test.ts` (MODIFY — add new test suite)
  - Add a new `describe('parseSections — orphan text preservation')` suite with:
    - Test: bare text + one START/END block in middle → 3 sections (preamble, named, postamble)
    - Test: START/END block at start + bare postamble → 2 sections (named, postamble)
    - Test: bare preamble + START/END block at end → 2 sections (preamble, named)
    - Test: two START/END blocks with gap content → 3 sections (named1, gap, named2)
    - Test: whitespace-only gap → no extra section created
    - Test: existing fully-covered template → identical output (backward compat)
  - Add a `describe('cleanUpSections — no data loss')` suite:
    - Test: bare text + one START/END → cleanUpSections output contains ALL original non-divider lines
    - Test: verify line count: output sections' content lines ≥ input non-divider lines
  - Purpose: Regression safety for the data loss fix
  - _Leverage: `src/__tests__/template-parser.test.ts` (existing test patterns, seedConfig)_
  - _Requirements: REQ-1, REQ-2, REQ-3, REQ-4_
  - _Prompt: Implement the task for spec FORGE-14-cleanup-deletes-content-outside-markers, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA Engineer | Task: Add tests to `src/__tests__/template-parser.test.ts` for orphan text preservation. Add two new describe blocks. (A) `describe('parseSections — orphan text preservation')`: Test that bare text before a START/END block becomes a "Generic Config" section. Test that bare text after the last END marker becomes a section. Test that content between two START/END blocks becomes a section. Test that whitespace-only gaps don't create sections. Test that a fully-covered template (all content inside sections) produces identical output to before. (B) `describe('cleanUpSections — no data loss')`: Test that running cleanUpSections on a template with bare text + one START/END block preserves ALL original content lines. Verify by checking that every non-divider, non-whitespace line from the input appears somewhere in the output. Run with `npx vitest run src/__tests__/template-parser.test.ts`. | Restrictions: Do not modify existing tests. Append new describe blocks at the end. Use Vitest. | Success: All tests pass including new ones. Full suite passes (`npx vitest run`). Do NOT commit._
  - **Recommended Agent:** Claude
