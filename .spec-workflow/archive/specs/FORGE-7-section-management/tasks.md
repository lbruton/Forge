# Tasks Document

## References

- **Issue:** FORGE-7
- **Spec Path:** `.spec-workflow/specs/FORGE-7-section-management/`

## File Touch Map

| Action | File | Scope |
|--------|------|-------|
| MODIFY | `src/components/TemplateEditor.tsx` | Add Section button + inline input + append logic |
| MODIFY | `src/components/CreateNodeModal.tsx` | Remove XML/JSON/YAML options from dropdown |

---

- [x] 1. Add Section button in TemplateEditor
  - File: `src/components/TemplateEditor.tsx`
  - Add an "Add Section" button next to the "Clean Up" button in the Detected Sections header
  - When clicked, show an inline text input for the section name
  - On submit (Enter or click confirm): append `\n\n!##### NAME - START #####\n\n!##### NAME - END #####` to rawText, call setEditorDirty(true), hide input, clear name state
  - On cancel (Escape or click away): hide input, clear name
  - Prevent empty names
  - Purpose: Allow users to create sections from the UI without typing markers manually
  - _Leverage: `src/components/TemplateEditor.tsx` (existing Clean Up button area, setEditorDirty)_
  - _Requirements: REQ-1_
  - _Prompt: Implement the task for spec FORGE-7-section-management, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Frontend Developer | Task: Add an "Add Section" button to TemplateEditor.tsx next to the existing "Clean Up" button in the Detected Sections header area. (1) Read the full TemplateEditor.tsx to find where the "Clean Up" button and "DETECTED SECTIONS" header are rendered. (2) Add state: `showAddSection: boolean` (default false), `addSectionName: string` (default ''). (3) Add a button with a Plus icon (from lucide-react, already imported) next to "Clean Up", styled similarly: `text-slate-400 hover:text-forge-amber text-xs`. Label or tooltip: "Add Section". (4) When clicked, toggle `showAddSection` to true and show an inline input below or next to the button. Input should auto-focus. (5) On Enter or a small confirm button: if name is non-empty, append `\n\n!##### ${addSectionName.trim()} - START #####\n\n!##### ${addSectionName.trim()} - END #####` to the current rawText via setRawText. Call setEditorDirty(true). Hide input, clear name. (6) On Escape: hide input, clear name. (7) The rawText change will trigger the existing debounced re-parse which will pick up the new section. | Restrictions: Do not modify the parser. Do not modify the Clean Up logic. Keep the button visually consistent with the existing Clean Up button. Do not add a modal — use inline input. | Success: Clicking Add Section, typing a name, pressing Enter creates a new section visible in the tabs. Escape cancels. Empty name is rejected. Dirty flag is set. TypeScript compiles (`npx tsc --noEmit`). Build passes (`npm run build`). Do NOT commit._
  - **Recommended Agent:** Claude

- [x] 2. Hide untested output formats in CreateNodeModal
  - File: `src/components/CreateNodeModal.tsx`
  - Remove the three `<option>` elements for xml, json, yaml from the Config Format dropdown
  - Add a TODO comment: `// TODO: re-enable xml, json, yaml when formats are tested`
  - Keep the `ConfigFormat` type union unchanged in types/index.ts
  - Purpose: Prevent users from selecting untested formats
  - _Leverage: `src/components/CreateNodeModal.tsx` (lines 110-113)_
  - _Requirements: REQ-2_
  - _Prompt: Implement the task for spec FORGE-7-section-management, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Developer | Task: Modify `src/components/CreateNodeModal.tsx`. Find the Config Format `<select>` dropdown (around lines 110-113). Remove the three `<option>` elements for "xml", "json", and "yaml", leaving only `<option value="cli">CLI</option>`. Add a comment above the remaining option: `{/* TODO: re-enable xml, json, yaml when formats are tested */}`. Do NOT modify `src/types/index.ts` — the ConfigFormat type union must stay unchanged. | Restrictions: Only change the dropdown options. Do not remove the select element itself. Do not change the ConfigFormat type. | Success: CreateNodeModal only shows "CLI" in the format dropdown. TypeScript compiles. Build passes (`npm run build`). Do NOT commit._
  - **Recommended Agent:** Claude
