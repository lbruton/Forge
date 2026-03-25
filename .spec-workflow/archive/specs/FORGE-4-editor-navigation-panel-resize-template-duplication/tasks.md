# Tasks Document

## References

- **Issue:** FORGE-4
- **Spec Path:** `.spec-workflow/specs/FORGE-4-editor-navigation-panel-resize-template-duplication/`

## File Touch Map

| Action | File | Scope |
|--------|------|-------|
| MODIFY | `src/types/index.ts` | Add `startLine` to `TemplateSection`, `rightPanelCollapsed` to `Preferences` |
| MODIFY | `src/lib/template-parser.ts` | Populate `startLine` in `parseSections`, add `rebuildRawText` export |
| MODIFY | `src/store/index.ts` | Add `rightPanelCollapsed` default, `toggleRightPanel` action |
| CREATE | `src/components/EditorSectionTabs.tsx` | New section tab strip component |
| MODIFY | `src/components/TemplateEditor.tsx` | Jump-to, cursor detection, section tabs integration, right panel collapse, drag-sort rawText rebuild |
| MODIFY | `src/components/Sidebar.tsx` | Collapse chevron button, duplicate variant handler |
| MODIFY | `src/components/TreeNode.tsx` | `onDuplicate` prop, "Duplicate" context menu item |
| MODIFY | `src/App.tsx` | Left sidebar collapse chevron positioning |
| MODIFY | `src/__tests__/template-parser.test.ts` | Tests for `startLine` population and `rebuildRawText` |

---

- [x] 1. Add `startLine` to `TemplateSection` type and populate in parser
  - Files: `src/types/index.ts`, `src/lib/template-parser.ts`, `src/__tests__/template-parser.test.ts`
  - Add `startLine?: number` to `TemplateSection` interface
  - In `parseSections`, set `startLine` to the line index of each section's START divider in the raw text
  - Add unit tests verifying `startLine` is correctly populated for multi-section templates
  - Purpose: Foundation for reliable jump-to and cursor detection — eliminates fragile `findIndex` lookups
  - _Leverage: `src/lib/template-parser.ts` (existing `parseSections` function and divider detection logic), `src/__tests__/template-parser.test.ts` (existing test patterns)_
  - _Requirements: 1, 2, 3_
  - _Prompt: Implement the task for spec FORGE-4-editor-navigation-panel-resize-template-duplication, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript Developer | Task: Add `startLine?: number` to the `TemplateSection` interface in `src/types/index.ts`. Then modify `parseSections` in `src/lib/template-parser.ts` to populate `startLine` with the 0-based line index of each section's START divider marker in the raw text. Add unit tests in `src/__tests__/template-parser.test.ts` covering: single section, multiple sections, sections with content between dividers. | Restrictions: Do not change any existing parser behavior or break existing tests. The field is optional for backward compatibility. Do not modify any component files. | Success: `parseSections` returns sections with correct `startLine` values. All existing tests still pass. New tests verify `startLine` for 1-section and multi-section templates._
  - **Recommended Agent:** Claude
  - After implementation: mark task [-] → run log-implementation → mark [x]

- [x] 2. Add `rebuildRawText` function to template-parser
  - Files: `src/lib/template-parser.ts`, `src/__tests__/template-parser.test.ts`
  - Create and export `rebuildRawText(sections: TemplateSection[], rawText: string): string` that reconstructs raw text with sections in the given order
  - Uses section `startLine` and divider patterns to extract each section's text block, then concatenates in new order
  - Add unit tests: reorder 2 sections, verify output has correct order; verify line count matches original
  - Purpose: Fixes latent bug where drag-reorder updates `sections[]` but not `rawText`
  - _Leverage: `src/lib/template-parser.ts` (existing divider pattern knowledge, `parseSections`), `src/types/index.ts` (`TemplateSection` with `startLine`)_
  - _Requirements: 4_
  - _Prompt: Implement the task for spec FORGE-4-editor-navigation-panel-resize-template-duplication, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript Developer | Task: Create and export a `rebuildRawText(sections: TemplateSection[], rawText: string): string` function in `src/lib/template-parser.ts`. This function takes sections in a desired order and the current rawText, extracts each section's text block (from its START divider through its END divider or next section), and concatenates them in the new order. Any text before the first section and after the last section should be preserved in place. Add unit tests in `src/__tests__/template-parser.test.ts`: reorder 2 sections and verify correct output, verify line count matches, verify text outside sections is preserved. | Restrictions: Do not modify `parseSections` or any existing exports. Do not touch component files. Handle edge case where sections have no END divider (section runs to next START or EOF). | Success: `rebuildRawText` correctly reorders section blocks in raw text. All existing tests pass. New tests cover reorder and edge cases._
  - **Recommended Agent:** Claude
  - After implementation: mark task [-] → run log-implementation → mark [x]

- [x] 3. Add right panel collapse to store and types
  - Files: `src/types/index.ts`, `src/store/index.ts`
  - Add `rightPanelCollapsed: boolean` (default `false`) to `Preferences` interface
  - Add `toggleRightPanel()` action to store (mirrors existing `toggleSidebar` pattern)
  - Update `defaultPreferences` with the new field
  - Purpose: Persisted panel collapse state via Zustand persist middleware
  - _Leverage: `src/store/index.ts` (existing `toggleSidebar` action at line 419-425, `defaultPreferences`, persist middleware), `src/types/index.ts` (`Preferences` interface)_
  - _Requirements: 5_
  - _Prompt: Implement the task for spec FORGE-4-editor-navigation-panel-resize-template-duplication, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript Developer | Task: Add `rightPanelCollapsed: boolean` to the `Preferences` interface in `src/types/index.ts` with default `false`. In `src/store/index.ts`, add it to `defaultPreferences` and create a `toggleRightPanel()` action that mirrors the existing `toggleSidebar()` pattern (toggle the boolean and persist via existing middleware). | Restrictions: Do not modify any existing preference fields or actions. Do not touch component files. Follow the exact pattern of `toggleSidebar`. | Success: `rightPanelCollapsed` exists in preferences with default `false`. `toggleRightPanel()` toggles it. Zustand persist handles storage automatically._
  - **Recommended Agent:** Claude
  - After implementation: mark task [-] → run log-implementation → mark [x]

- [x] 4. Wire drag-to-sort rawText rebuild in TemplateEditor
  - Files: `src/components/TemplateEditor.tsx`
  - In `handleDragEnd`, after reordering `sections` state, call `rebuildRawText` to update `rawText`
  - Preserve cursor position across the rawText rebuild (save `selectionStart`/`selectionEnd`, restore after state update)
  - Sync overlay scroll position after rebuild
  - Purpose: Fixes latent bug — drag reorder now updates both sections array and raw text atomically
  - _Leverage: `src/components/TemplateEditor.tsx` (existing `handleDragEnd` at lines 176-181, `textareaRef`, `overlayRef`), `src/lib/template-parser.ts` (`rebuildRawText` from Task 2)_
  - _Requirements: 4_
  - _Prompt: Implement the task for spec FORGE-4-editor-navigation-panel-resize-template-duplication, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Developer | Task: In `TemplateEditor.tsx`, modify `handleDragEnd` to call `rebuildRawText(reorderedSections, rawText)` after reordering sections. Update `rawText` state with the result. Before the state update, save `textarea.selectionStart`/`selectionEnd`; after, restore them via a `useEffect` or `requestAnimationFrame`. Also sync `overlayRef.scrollTop` to `textareaRef.scrollTop` after the rebuild. Import `rebuildRawText` from `../lib/template-parser`. | Restrictions: Do not change any other TemplateEditor functionality. Do not modify the drag start/over handlers. Cursor must not jump after reorder. | Success: Dragging sections reorders both the sidebar list AND the textarea content. Cursor stays in place. Overlay stays in sync._
  - **Recommended Agent:** Claude
  - After implementation: mark task [-] → run log-implementation → mark [x]

- [x] 5. Implement section jump-to and cursor-in-section detection
  - Files: `src/components/TemplateEditor.tsx`
  - Add `activeSectionName: string | null` local state
  - Add `handleJumpToSection(section)`: compute scroll position from `section.startLine * lineHeightPx`, set `textareaRef.scrollTop` and `overlayRef.scrollTop`
  - Wire click handlers on section panel items to call `handleJumpToSection`
  - Add debounced cursor detection on `onMouseUp`/`onKeyUp`: convert `selectionStart` to line number, find containing section, update `activeSectionName`
  - Apply active highlight class to the matching section panel item
  - Purpose: Core editor navigation — click-to-scroll and cursor awareness
  - _Leverage: `src/components/TemplateEditor.tsx` (existing `textareaRef` line 39, `overlayRef` line 40, `debounceRef` line 42, section panel rendering lines 317-351, `leading-[1.65rem]` line height), `src/types/index.ts` (`TemplateSection.startLine` from Task 1)_
  - _Requirements: 1, 3_
  - _Prompt: Implement the task for spec FORGE-4-editor-navigation-panel-resize-template-duplication, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Developer | Task: In `TemplateEditor.tsx`: (1) Add `activeSectionName: string | null` state. (2) Create `handleJumpToSection(section: TemplateSection)` that computes `scrollTop = section.startLine * lineHeightPx` (get lineHeightPx from the textarea's computed style or use 1.65rem converted to px) and sets both `textareaRef.current.scrollTop` and `overlayRef.current.scrollTop`. (3) Make each section item in the sections panel clickable — add `onClick={() => handleJumpToSection(section)}` and `cursor-pointer` class. (4) Add debounced cursor detection: on `onMouseUp` and `onKeyUp` of the textarea, convert `selectionStart` to a line number, compare against sections' `startLine` ranges to find the containing section, update `activeSectionName`. Use the existing `debounceRef` pattern with ~150ms delay. (5) Apply a visual highlight (e.g., `border-amber-500 bg-amber-500/10`) to the section panel item whose name matches `activeSectionName`. | Restrictions: Do not change section panel layout structure. Do not add new dependencies. Debounce cursor detection to avoid re-render churn. If `startLine` is undefined, fall back to `findIndex` on rawText. | Success: Clicking a section in the sidebar scrolls the textarea to it. Moving the cursor highlights the current section in the sidebar. Both textarea and overlay stay in sync._
  - **Recommended Agent:** Claude
  - After implementation: mark task [-] → run log-implementation → mark [x]

- [x] 6. Create `EditorSectionTabs` component and integrate into TemplateEditor
  - Files: `src/components/EditorSectionTabs.tsx` (CREATE), `src/components/TemplateEditor.tsx`
  - Create `EditorSectionTabs` with props: `sections: TemplateSection[]`, `activeSectionName: string | null`, `onJumpTo: (section) => void`
  - Style tabs to match existing `SectionTabs` visual pattern (same colors, active state, wrap behavior)
  - Insert tab strip in `TemplateEditor` between the header row and the textarea container
  - Hide tab strip when no sections are detected
  - Purpose: Quick section navigation via tabs, consistent with Generate view tab pattern
  - _Leverage: `src/components/SectionTabs.tsx` (visual styling reference — colors, active state classes, wrap), `src/components/TemplateEditor.tsx` (layout insertion point around line 264-291, `activeSectionName` and `handleJumpToSection` from Task 5)_
  - _Requirements: 2, 3_
  - _Prompt: Implement the task for spec FORGE-4-editor-navigation-panel-resize-template-duplication, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Developer | Task: (1) Create `src/components/EditorSectionTabs.tsx` — a functional component accepting `sections: TemplateSection[]`, `activeSectionName: string | null`, `onJumpTo: (section: TemplateSection) => void`. Render a horizontal tab strip where each tab shows the section name. The active tab (matching `activeSectionName`) gets a highlighted style (amber border/bg). Tabs wrap on overflow (same as existing `SectionTabs` flex-wrap pattern). If `sections` is empty, render nothing (return null). (2) In `TemplateEditor.tsx`, import and render `EditorSectionTabs` between the "Paste Config Template" header area and the textarea `div.flex-1.relative`. Pass `sections`, `activeSectionName`, and `handleJumpToSection` as props. | Restrictions: Do NOT modify the existing `SectionTabs.tsx` component. Match its visual style but keep the components independent. Do not add new dependencies. | Success: Section tabs appear above the editor textarea. Clicking a tab scrolls to that section. The active section tab highlights as the cursor moves. Tabs are hidden when there are no sections._
  - **Recommended Agent:** Claude
  - After implementation: mark task [-] → run log-implementation → mark [x]

- [x] 7. Add panel collapse toggles (left sidebar + right panel)
  - Files: `src/components/TemplateEditor.tsx`, `src/components/Sidebar.tsx` or `src/App.tsx`
  - Right panel: Add a `ChevronRight`/`ChevronLeft` toggle button on the right panel in `TemplateEditor`. When `rightPanelCollapsed` is true, hide the `w-80` panel and let the textarea expand to full width.
  - Left sidebar: Add a `ChevronLeft`/`ChevronRight` toggle button visible on desktop (positioned on the sidebar's right edge or in the sidebar header). Calls existing `toggleSidebar()`.
  - Both chevrons use Lucide icons consistent with existing icon usage
  - Purpose: Reclaim screen space for the editor textarea on demand
  - _Leverage: `src/store/index.ts` (`toggleRightPanel` from Task 3, existing `toggleSidebar`), `src/components/TemplateEditor.tsx` (right panel at line 294, `w-80 min-w-[320px]`), `src/App.tsx` (sidebar container lines 244-253, existing `sidebarCollapsed` usage), Lucide `ChevronLeft`/`ChevronRight` icons_
  - _Requirements: 5_
  - _Prompt: Implement the task for spec FORGE-4-editor-navigation-panel-resize-template-duplication, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Developer | Task: (1) In `TemplateEditor.tsx`, read `rightPanelCollapsed` from the Zustand store. Add a small button with `ChevronRight` (when expanded) or `ChevronLeft` (when collapsed) icon at the left edge of the right panel (or where the panel was). When collapsed, hide the `w-80` panel div entirely and let the editor area take full width. (2) In `App.tsx` or `Sidebar.tsx`, add a desktop-visible collapse chevron button for the left sidebar. Position it on the sidebar's right edge. It calls the existing `toggleSidebar()` action. Hide this button on mobile (the hamburger menu already handles mobile). Use Lucide `ChevronLeft`/`ChevronRight` icons matching the existing icon style (same size, same stroke). | Restrictions: Do not change the mobile hamburger behavior. Do not add animation/transitions (instant toggle per requirements). The left sidebar collapse must use the EXISTING `toggleSidebar` action — do not create a new one. | Success: Both panels have visible collapse/expand chevrons on desktop. Clicking them toggles panel visibility. The textarea expands to fill freed space. State persists across page reloads._
  - **Recommended Agent:** Claude
  - After implementation: mark task [-] → run log-implementation → mark [x]

- [x] 8. Add template variant duplication to sidebar context menu
  - Files: `src/components/TreeNode.tsx`, `src/components/Sidebar.tsx`
  - Add `onDuplicate?: () => void` prop to `TreeNode`
  - Add "Duplicate" button to `TreeNode` context menu (between Edit and Delete, same styling)
  - In `Sidebar.tsx`, wire `onDuplicate` on variant-level `TreeNode`s: clone source template with `structuredClone` + new `crypto.randomUUID()` ID, call `saveTemplate`, then `addVariant` with name `"{original} (copy)"`
  - Purpose: Enable creating site-specific variants from a base template without re-entering content
  - _Leverage: `src/components/TreeNode.tsx` (context menu pattern lines 117-146, `onEdit`/`onDelete` props), `src/components/Sidebar.tsx` (variant rendering lines 209-222, `saveTemplate`/`addVariant` composition pattern lines 78-91), `src/store/index.ts` (`getTemplate`, `saveTemplate`, `addVariant`)_
  - _Requirements: 6_
  - _Prompt: Implement the task for spec FORGE-4-editor-navigation-panel-resize-template-duplication, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Developer | Task: (1) In `TreeNode.tsx`, add an `onDuplicate?: () => void` prop. In the context menu (the floating div with Edit/Delete buttons), add a "Duplicate" button between Edit and Delete. It should call `onDuplicate()` and close the menu. Use the same button styling as Edit and Delete. Add a Lucide `Copy` icon matching the existing icon pattern. Only show the Duplicate button when `onDuplicate` is provided. (2) In `Sidebar.tsx`, on variant-level `TreeNode` components, wire `onDuplicate`: read the source template via `getTemplate(variant.templateId)`, deep clone it with `structuredClone`, assign a new `crypto.randomUUID()` as ID, set `createdAt`/`updatedAt` to now, call `saveTemplate` with the clone, then call `addVariant` with the parent path (viewId, vendorId, modelId) and name `"{variant.name} (copy)"` pointing to the new template ID. | Restrictions: Do not modify the existing Edit or Delete functionality. Do not create a new store action — compose existing `saveTemplate` + `addVariant`. The `onDuplicate` prop must be optional so existing `TreeNode` usage is unaffected. | Success: Right-clicking a variant shows Edit, Duplicate, Delete. Clicking Duplicate creates a new variant with "(copy)" suffix containing an independent copy of all template data. The new variant appears immediately in the sidebar tree._
  - **Recommended Agent:** Claude
  - After implementation: mark task [-] → run log-implementation → mark [x]
