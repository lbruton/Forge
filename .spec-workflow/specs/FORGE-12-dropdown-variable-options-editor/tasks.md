# Tasks Document

## References

- **Issue:** FORGE-12
- **Spec Path:** `.spec-workflow/specs/FORGE-12-dropdown-variable-options-editor/`

## File Touch Map

| Action | File | Scope |
|--------|------|-------|
| CREATE | `src/components/DropdownOptionsEditor.tsx` | Shared options editor component |
| MODIFY | `src/components/VariableDetectionPanel.tsx` | Integrate editor when type === 'dropdown' |
| MODIFY | `src/components/GlobalVariablesPage.tsx` | Integrate editor when type === 'dropdown' |
| TEST | `src/__tests__/dropdown-options.test.ts` | Unit tests for add/remove/duplicate/empty logic |

---

- [x] 1. Create DropdownOptionsEditor component
  - File: `src/components/DropdownOptionsEditor.tsx` (CREATE)
  - A shared, presentational component for adding/removing dropdown options
  - Props: `{ options: string[], onChange: (options: string[]) => void }`
  - UI elements:
    - Row: text input + "Add" button (enter key also triggers add)
    - List of current options, each with option text + X delete button
    - Empty state: "Add at least one option" hint (text-slate-500, text-xs)
  - Logic:
    - Add: append to array, clear input. Prevent duplicates and empty strings.
    - Remove: filter by index
  - Styling: match Forge variable edit controls (bg-forge-obsidian, border-forge-graphite, rounded-lg, text-sm)
  - Purpose: Reusable options editor for dropdown-type variables
  - _Leverage: `src/components/VariableDetectionPanel.tsx` (input styling reference), `src/components/CreateNodeModal.tsx` (input class patterns)_
  - _Requirements: REQ-1, REQ-2_
  - _Prompt: Implement the task for spec FORGE-12-dropdown-variable-options-editor, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Frontend Developer | Task: Create `src/components/DropdownOptionsEditor.tsx`. Props: `{ options: string[], onChange: (options: string[]) => void }`. Render: (1) A flex row with a text input and "Add" button. Input uses `bg-forge-obsidian border border-forge-graphite rounded-lg text-sm text-slate-200 px-3 py-1.5 flex-1`. Add button uses `bg-forge-graphite text-slate-400 hover:text-slate-200 rounded-lg px-3 py-1.5 text-sm`. (2) Below the input row, render the options list. Each option is a `flex items-center justify-between py-1 px-2 bg-forge-obsidian/50 rounded text-sm text-slate-300` row with the option text and an X icon button (`text-slate-500 hover:text-red-400`, X from lucide-react, size 14). (3) When options is empty, show "Add at least one option" in `text-slate-500 text-xs mt-1`. (4) On add: if input is non-empty and not a duplicate (case-sensitive), call `onChange([...options, value.trim()])` and clear input. Enter key in the input also triggers add. (5) On remove: call `onChange(options.filter((_, i) => i !== index))`. (6) Use local state for the input value only. The component is fully controlled via props. | Restrictions: Purely presentational — no store access. No drag-to-reorder (deferred). Import only React and lucide-react (X icon). | Success: Component renders, add/remove work, duplicates and empty strings prevented, Forge dark theme styling. TypeScript compiles (`npx tsc --noEmit`). After completing, use log-implementation to record what was done, then mark task [x] in tasks.md._
  - **Recommended Agent:** Claude

- [x] 2. Integrate options editor in VariableDetectionPanel
  - File: `src/components/VariableDetectionPanel.tsx` (MODIFY)
  - When an expanded variable has `type === 'dropdown'`, render `<DropdownOptionsEditor>` below the type selector
  - Props: `options={variables[index].options}` and `onChange={(newOptions) => updateVariable(index, { options: newOptions })}`
  - Purpose: Local template variables can now have dropdown options defined
  - _Leverage: `src/components/VariableDetectionPanel.tsx` (existing expanded variable form), `src/components/DropdownOptionsEditor.tsx` (new component)_
  - _Requirements: REQ-1_
  - _Prompt: Implement the task for spec FORGE-12-dropdown-variable-options-editor, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Developer | Task: Modify `src/components/VariableDetectionPanel.tsx` to integrate the DropdownOptionsEditor. (1) Import DropdownOptionsEditor from `./DropdownOptionsEditor.tsx`. (2) In the expanded variable edit form, AFTER the type selector `<select>`, add a conditional: `{variables[index].type === 'dropdown' && <DropdownOptionsEditor options={variables[index].options} onChange={(newOptions) => updateVariable(index, { options: newOptions })} />}`. (3) Add a small top margin (mt-2) wrapper div around the DropdownOptionsEditor for spacing. | Restrictions: Do not change any other part of the component. Do not modify the type selector itself. The options editor only appears when type is 'dropdown'. | Success: Setting a variable to 'dropdown' type shows the options editor. Adding/removing options calls updateVariable correctly. TypeScript compiles. After completing, use log-implementation to record what was done, then mark task [x] in tasks.md._
  - **Recommended Agent:** Claude

- [x] 3. Integrate options editor in GlobalVariablesPage
  - File: `src/components/GlobalVariablesPage.tsx` (MODIFY)
  - When editing a global variable with `type === 'dropdown'`, render `<DropdownOptionsEditor>` below the type selector
  - Props: `options={editValues.options}` and `onChange={(newOptions) => setEditValues({ ...editValues, options: newOptions })}`
  - Purpose: Global variables can now have dropdown options defined
  - _Leverage: `src/components/GlobalVariablesPage.tsx` (existing variable edit form), `src/components/DropdownOptionsEditor.tsx` (new component)_
  - _Requirements: REQ-2_
  - _Prompt: Implement the task for spec FORGE-12-dropdown-variable-options-editor, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Developer | Task: Modify `src/components/GlobalVariablesPage.tsx` to integrate the DropdownOptionsEditor. (1) Import DropdownOptionsEditor from `./DropdownOptionsEditor.tsx`. (2) Find the variable edit form where the type selector is rendered. AFTER the type selector, add: `{editValues.type === 'dropdown' && <DropdownOptionsEditor options={editValues.options} onChange={(newOptions) => setEditValues({ ...editValues, options: newOptions })} />}`. (3) Wrap in a mt-2 div for spacing. (4) Make sure `editValues` includes `options` when initializing the edit state — check that the edit state initialization copies `options` from the existing variable. | Restrictions: Do not change any other part of the component. Only add the conditional render after the type selector. | Success: Setting a global variable to 'dropdown' type shows the options editor. Options are saved when the variable is saved. TypeScript compiles. After completing, use log-implementation to record what was done, then mark task [x] in tasks.md._
  - **Recommended Agent:** Claude

- [x] 4. Unit tests for DropdownOptionsEditor logic
  - File: `src/__tests__/dropdown-options.test.ts` (CREATE)
  - Test add: new option appends to array, onChange called with updated array
  - Test remove: option removed at correct index, onChange called
  - Test duplicate prevention: adding existing option does not call onChange
  - Test empty string prevention: adding empty/whitespace does not call onChange
  - Test multiple adds: sequential adds build the array correctly
  - Purpose: Regression safety for the options editor logic
  - _Leverage: `src/__tests__/variable-sort.test.ts` (existing test patterns)_
  - _Requirements: REQ-1, REQ-2_
  - _Prompt: Implement the task for spec FORGE-12-dropdown-variable-options-editor, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA Engineer | Task: Create `src/__tests__/dropdown-options.test.ts`. Since DropdownOptionsEditor is a React component with local state, test the logic by simulating the add/remove behavior. Option A (preferred): Extract the add/remove logic into testable helper functions and test those. Option B: Use a simple test that verifies the component's behavioral contract — create mock onChange, simulate the add logic (non-empty, non-duplicate → append), and simulate remove logic (filter by index). Tests to write: (1) adding a new option calls onChange with appended array, (2) adding a duplicate does NOT call onChange, (3) adding empty string does NOT call onChange, (4) removing an option calls onChange with filtered array, (5) removing preserves order of remaining options. Run with `npx vitest run src/__tests__/dropdown-options.test.ts`. | Restrictions: Do not modify existing tests. Use Vitest. | Success: All tests pass. Full suite still passes (`npx vitest run`). After completing, use log-implementation to record what was done, then mark task [x] in tasks.md._
  - **Recommended Agent:** Claude
