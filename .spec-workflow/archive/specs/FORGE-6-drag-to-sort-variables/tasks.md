# Tasks Document

## References

- **Issue:** FORGE-6
- **Spec Path:** `.spec-workflow/specs/FORGE-6-drag-to-sort-variables/`

## File Touch Map

| Action | File | Scope |
|--------|------|-------|
| MODIFY | `src/components/VariableDetectionPanel.tsx` | Add drag state, handlers, GripVertical, visual feedback |
| MODIFY | `src/components/TemplateEditor.tsx` | Order-preserving merge in handleTextChange |
| MODIFY | `src/components/VariableForm.tsx` | Flat-order rendering path for custom-ordered templates |
| MODIFY | `src/types/index.ts` | Add `customVariableOrder?: boolean` to Template |
| TEST | `src/__tests__/template-parser.test.ts` | Order-preserving merge tests |
| TEST | `src/__tests__/variable-sort.test.ts` | Drag reorder + VariableForm rendering tests |

---

- [x] 1. Add `customVariableOrder` flag to Template type
  - File: `src/types/index.ts`
  - Add `customVariableOrder?: boolean` to the Template interface
  - Purpose: Distinguish user-reordered templates from detection-ordered templates
  - _Leverage: `src/types/index.ts` (existing Template interface)_
  - _Requirements: REQ-2 (Order Persistence), REQ-4 (Generate View Respects Variable Order)_
  - _Prompt: Implement the task for spec FORGE-6-drag-to-sort-variables, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript Developer | Task: Add `customVariableOrder?: boolean` to the `Template` interface in `src/types/index.ts`. This optional boolean flag indicates the user has manually reordered variables. Default is `undefined`/`false` for legacy templates. | Restrictions: Do not modify any other types. Do not change VariableDefinition — order is array-index based. | Success: Template interface has the new optional field. TypeScript compiles cleanly (`npx tsc --noEmit`). After completing, mark task [-] to in-progress in tasks.md, use log-implementation to record what was done, then mark [x]._

- [x] 2. Add drag-to-sort to VariableDetectionPanel
  - File: `src/components/VariableDetectionPanel.tsx`
  - Add `dragIndex` and `dragOverIndex` state
  - Implement `handleDragStart`, `handleDragOver`, `handleDragEnd` handlers
  - Add `draggable` attribute and drag events to each variable row
  - Add `GripVertical` icon to each row header (left of variable name)
  - Add visual feedback: opacity-50 on dragged row, amber/green border on drop target
  - On reorder: call `onChange(reorderedArray)` and notify parent to set `customVariableOrder: true`
  - Purpose: Enable drag-to-sort for variables in the right sidebar
  - _Leverage: `src/components/GlobalVariablesPage.tsx:105-128` (drag pattern), `src/components/VariableDetectionPanel.tsx` (existing component)_
  - _Requirements: REQ-1 (Drag-to-Sort Variable Rows), REQ-5 (Drag Handle Visual Design)_
  - _Prompt: Implement the task for spec FORGE-6-drag-to-sort-variables, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Frontend Developer | Task: Add drag-to-sort to VariableDetectionPanel. Copy the drag pattern from GlobalVariablesPage.tsx (lines 105-128) — use `dragIndex`/`dragOverIndex` state, `handleDragStart`/`handleDragOver`/`handleDragEnd` handlers. Add `GripVertical` icon (14px, text-slate-500) to each variable row header, left of the variable name. Add `draggable` attribute and drag event handlers to each row div. Visual feedback: opacity-50 + border-amber-500 on dragged row, border-green-500 + shadow on drop target. On successful reorder, splice the array and call `onChange(reorderedArray)`. Also accept an `onReorder` callback prop to notify the parent that custom ordering has been applied. | Restrictions: Do not change the expand/collapse behavior — drag on the grip icon, expand on clicking the row content. Do not add up/down arrow buttons (deferred). Match the exact visual style of GlobalVariablesPage drag handles. | Success: Variables can be dragged and dropped to reorder. Visual feedback matches GlobalVariablesPage. Expanding a variable to edit does not trigger drag. After completing, use log-implementation to record what was done, then mark task [x] in tasks.md._
  - **Recommended Agent:** Claude

- [x] 3. Order-preserving merge in TemplateEditor
  - File: `src/components/TemplateEditor.tsx`
  - Modify the variable merge logic in `handleTextChange` (or wherever `parseVariables` results are merged with existing variables)
  - New merge behavior: (1) Keep existing variables in their current array order, preserving metadata. (2) Append any newly detected variables at the end. (3) Remove variables no longer present in parsed output.
  - When drag reorder occurs (via `onReorder` callback from VariableDetectionPanel), set `customVariableOrder: true` on the template
  - Purpose: Preserve user-defined variable order when template text is re-parsed
  - _Leverage: `src/components/TemplateEditor.tsx` (existing merge logic), `src/lib/template-parser.ts:parseVariables`_
  - _Requirements: REQ-3 (Order Preserved During Re-parse), REQ-2 (Order Persistence)_
  - _Prompt: Implement the task for spec FORGE-6-drag-to-sort-variables, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Developer | Task: Modify the variable merge logic in TemplateEditor.tsx. Currently, after `parseVariables()` runs, the variable array is rebuilt in parse (text-occurrence) order. Change this to an order-preserving merge: (1) Start with the existing `variables` array. (2) For each existing variable, if it still appears in the parsed output, keep it at its current position and merge any metadata updates. (3) For any newly detected variable (in parsed output but not in existing array), append it at the end. (4) Remove any variable that no longer appears in the parsed output. Also: accept an `onReorder` callback from VariableDetectionPanel. When a drag reorder happens, set `customVariableOrder: true` on the template before saving. | Restrictions: Do not change `parseVariables()` itself. Do not change how `saveTemplate()` works. The merge must handle the case where `customVariableOrder` is false/undefined (legacy behavior — still preserve existing order, just don't set the flag). | Success: Editing template text preserves variable order. New variables appear at end. Removed variables disappear without disrupting order. `customVariableOrder` flag is set on first drag reorder. After completing, use log-implementation to record what was done, then mark task [x] in tasks.md._
  - **Recommended Agent:** Claude

- [x] 4. Flat-order rendering in VariableForm
  - File: `src/components/VariableForm.tsx`
  - Add a check at the top of the component: if `template.customVariableOrder === true`, render variables in flat array order (skip `groupVariablesBySection`)
  - If `customVariableOrder` is false/undefined, fall back to existing section-grouped rendering
  - Purpose: Generate view respects user-defined variable order
  - _Leverage: `src/components/VariableForm.tsx` (existing `groupVariablesBySection` function)_
  - _Requirements: REQ-4 (Generate View Respects Variable Order)_
  - _Prompt: Implement the task for spec FORGE-6-drag-to-sort-variables, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Developer | Task: Modify VariableForm.tsx to support flat-order rendering. Add a check: if the template has `customVariableOrder === true`, bypass `groupVariablesBySection()` and render variables in their array order as a single flat list. If `customVariableOrder` is false or undefined (legacy templates), keep the existing section-grouped rendering behavior unchanged. The flat list should use the same VariableInput components — just without section group headers. | Restrictions: Do not remove `groupVariablesBySection()` — it's still needed for legacy templates. Do not change the visual style of individual variable inputs. | Success: Templates with `customVariableOrder: true` show variables in flat array order in Generate view. Legacy templates still show section-grouped order. After completing, use log-implementation to record what was done, then mark task [x] in tasks.md._
  - **Recommended Agent:** Claude

- [x] 5. Unit tests for order-preserving merge and VariableForm rendering
  - Files: `src/__tests__/variable-sort.test.ts` (CREATE)
  - Test cases for order-preserving merge:
    - Existing variables retain position after re-parse
    - New variable appended at end
    - Removed variable disappears without disrupting order
    - Merge with no prior custom order still works
  - Test cases for VariableForm:
    - `customVariableOrder: true` renders flat array order
    - `customVariableOrder: false/undefined` renders section-grouped order
  - Purpose: Regression safety for the two main logic changes
  - _Leverage: `src/__tests__/template-parser.test.ts` (existing test patterns), `src/lib/template-parser.ts:parseVariables`_
  - _Requirements: REQ-3, REQ-4_
  - _Prompt: Implement the task for spec FORGE-6-drag-to-sort-variables, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA Engineer | Task: Create `src/__tests__/variable-sort.test.ts` with unit tests covering: (A) Order-preserving merge — test that existing variables keep position after parseVariables re-runs, new variables append at end, removed variables disappear without disrupting order, and the merge works with no prior custom order. Extract the merge logic into a testable function if needed. (B) VariableForm rendering logic — test that `customVariableOrder: true` produces flat order, and `false/undefined` produces section-grouped order. Use the same test patterns as `template-parser.test.ts`. Run tests with `npx vitest run src/__tests__/variable-sort.test.ts`. | Restrictions: Do not modify existing tests in `template-parser.test.ts`. Use Vitest (the project's test runner). | Success: All tests pass. Covers merge edge cases and both VariableForm rendering paths. After completing, use log-implementation to record what was done, then mark task [x] in tasks.md._
  - **Recommended Agent:** Claude
