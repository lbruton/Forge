# Tasks Document

## References

- **Issue:** FORGE-10
- **Spec Path:** `.spec-workflow/specs/FORGE-10-unsaved-changes-warning/`

## File Touch Map

| Action | File | Scope |
|--------|------|-------|
| MODIFY | `src/store/index.ts` | Add editorDirty, pendingSaveCallback state + actions |
| MODIFY | `src/components/TemplateEditor.tsx` | Set dirty on edits, clear on save, register save callback |
| CREATE | `src/components/UnsavedChangesModal.tsx` | Confirmation dialog component |
| MODIFY | `src/App.tsx` | Navigation guard, pending nav state, modal rendering, beforeunload |
| TEST | `src/__tests__/unsaved-changes.test.ts` | Guard logic + dirty flag tests |

---

- [x] 1. Add dirty state and save callback to Zustand store
  - File: `src/store/index.ts`
  - Add `editorDirty: boolean` (default `false`) to store state
  - Add `pendingSaveCallback: (() => void) | null` (default `null`) to store state
  - Add `setEditorDirty: (dirty: boolean) => void` action
  - Add `setPendingSaveCallback: (cb: (() => void) | null) => void` action
  - **Important:** `pendingSaveCallback` must NOT be persisted — exclude it from any persistence middleware. It's a runtime-only function reference.
  - Purpose: Provide shared dirty state accessible from both TemplateEditor and App.tsx
  - _Leverage: `src/store/index.ts` (existing store pattern)_
  - _Requirements: REQ-1 (Dirty State Detection)_
  - _Prompt: Implement the task for spec FORGE-10-unsaved-changes-warning, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript Developer | Task: Add four items to the Zustand store in `src/store/index.ts`: (1) `editorDirty: boolean` state, default `false`; (2) `pendingSaveCallback: (() => void) | null` state, default `null`; (3) `setEditorDirty(dirty: boolean)` action that sets editorDirty; (4) `setPendingSaveCallback(cb)` action that sets pendingSaveCallback. Add these to the ForgeStore interface AND the store implementation. CRITICAL: `pendingSaveCallback` is a function reference — if the store uses persist middleware, exclude `pendingSaveCallback` from serialization (it will be `null` on reload, which is correct). Also exclude `editorDirty` from persistence — it's runtime-only state. | Restrictions: Do not change any existing store state or actions. Do not add a new store — use the existing one. | Success: Store compiles (`npx tsc --noEmit`). New state and actions are accessible via `useForgeStore()`. After completing, use log-implementation to record what was done, then mark task [x] in tasks.md._

- [x] 2. Wire dirty detection in TemplateEditor
  - File: `src/components/TemplateEditor.tsx`
  - Call `setEditorDirty(true)` whenever the user modifies: rawText (in handleTextChange), variables (in onChange callback), section reorder (in handleDragEnd), or any other edit action
  - Call `setEditorDirty(false)` after successful save in handleSave
  - On mount: call `setPendingSaveCallback(() => handleSave)` to register the save function
  - On unmount: call `setPendingSaveCallback(null)` and `setEditorDirty(false)` to clean up
  - Purpose: TemplateEditor becomes the source of dirty state and exposes its save function
  - _Leverage: `src/components/TemplateEditor.tsx` (existing handleSave, handleTextChange), `src/store/index.ts` (new setEditorDirty, setPendingSaveCallback)_
  - _Requirements: REQ-1 (Dirty State Detection)_
  - _Prompt: Implement the task for spec FORGE-10-unsaved-changes-warning, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Developer | Task: Modify TemplateEditor.tsx to track dirty state. (1) Import `setEditorDirty` and `setPendingSaveCallback` from the store via `useForgeStore`. (2) Call `setEditorDirty(true)` in every edit handler: `handleTextChange` (when rawText changes), the `onChange` callback passed to VariableDetectionPanel, section drag `handleDragEnd`, and any other handler that modifies editor state. (3) Call `setEditorDirty(false)` at the end of `handleSave` after the save succeeds. (4) In a `useEffect` on mount, call `setPendingSaveCallback(() => handleSave)` to register the save function in the store. Return a cleanup that calls `setPendingSaveCallback(null)` and `setEditorDirty(false)`. Make sure handleSave is stable (wrapped in useCallback with correct deps) so the registered callback stays current. | Restrictions: Do not change the save logic itself. Do not add visual indicators for dirty state (that's not in scope). The dirty flag is a simple boolean — no content comparison needed. | Success: TypeScript compiles. Editing any aspect of the template sets editorDirty to true. Saving clears it. Unmounting clears it. After completing, use log-implementation to record what was done, then mark task [x] in tasks.md._
  - **Recommended Agent:** Claude

- [x] 3. Create UnsavedChangesModal component
  - File: `src/components/UnsavedChangesModal.tsx` (CREATE)
  - A confirmation dialog with three buttons: "Save & Continue" (amber/primary), "Discard" (red/danger), "Cancel" (slate/secondary)
  - Message: "You have unsaved changes to this template. What would you like to do?"
  - Follow CreateNodeModal's overlay pattern: fixed z-50, bg-black/60, centered box, Escape to close (as Cancel), backdrop click to close (as Cancel)
  - Props: `{ open: boolean, onSave: () => void, onDiscard: () => void, onCancel: () => void }`
  - Purpose: Presentational component for the unsaved changes confirmation
  - _Leverage: `src/components/CreateNodeModal.tsx` (overlay pattern, escape handler, backdrop click)_
  - _Requirements: REQ-3 (Confirmation Dialog)_
  - _Prompt: Implement the task for spec FORGE-10-unsaved-changes-warning, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Frontend Developer | Task: Create `src/components/UnsavedChangesModal.tsx`. Props interface: `{ open: boolean, onSave: () => void, onDiscard: () => void, onCancel: () => void }`. When `open` is false, render nothing. When open: (1) Fixed overlay div with `z-50 bg-black/60 inset-0 flex items-center justify-center`. (2) Centered box with `bg-forge-obsidian border border-forge-steel rounded-xl shadow-2xl p-6 max-w-md w-full mx-4`. (3) Header: "Unsaved Changes" with X button that calls onCancel. (4) Body text: "You have unsaved changes to this template. What would you like to do?" in text-slate-400. (5) Three buttons in a flex row: "Save & Continue" (bg-amber-600 hover:bg-amber-500, calls onSave), "Discard" (bg-red-600/20 text-red-400 hover:bg-red-600/30, calls onDiscard), "Cancel" (bg-forge-graphite text-slate-400, calls onCancel). (6) Escape key handler via useEffect (calls onCancel). (7) Backdrop click handler on overlay div (calls onCancel if click target is overlay). Match the exact Forge theme colors used in CreateNodeModal. | Restrictions: Purely presentational — no business logic, no store access. Do not import or depend on anything except React and lucide-react (X icon). | Success: Component renders correctly, all three buttons fire their callbacks, Escape and backdrop click work as Cancel. TypeScript compiles. After completing, use log-implementation to record what was done, then mark task [x] in tasks.md._
  - **Recommended Agent:** Claude

- [x] 4. Add navigation guard and beforeunload to App.tsx
  - File: `src/App.tsx`
  - Add `pendingNavAction` state: `(() => void) | null`
  - Create `guardNavigation(action: () => void)` helper: checks `editorDirty` from store — if dirty AND mode is 'editor', stores action as pending and opens modal; if clean, executes immediately
  - Wrap ALL navigation triggers with `guardNavigation`:
    - `setMode('generator')` — the Generate tab click
    - `handleSelectVariant(variantId)` — sidebar variant click
    - `setSelectedGlobalVariablesViewId(viewId)` — sidebar global vars click
    - `setSelectedGeneratedConfigId(configId)` — sidebar generated config click
  - Modal handlers:
    - `handleSaveAndContinue`: call `pendingSaveCallback()` from store, then execute `pendingNavAction`, clear both
    - `handleDiscard`: call `setEditorDirty(false)`, execute `pendingNavAction`, clear it
    - `handleCancelNav`: clear `pendingNavAction` (modal closes)
  - Render `<UnsavedChangesModal open={pendingNavAction !== null} onSave={handleSaveAndContinue} onDiscard={handleDiscard} onCancel={handleCancelNav} />`
  - Add `beforeunload` event listener: when `editorDirty` is true, set `e.returnValue` to trigger browser prompt. Use a useEffect that adds/removes the listener based on `editorDirty`.
  - Purpose: Central navigation guard that intercepts all paths out of the editor
  - _Leverage: `src/App.tsx` (existing navigation handlers), `src/components/UnsavedChangesModal.tsx` (new modal), `src/store/index.ts` (editorDirty, pendingSaveCallback)_
  - _Requirements: REQ-2 (Navigation Interception), REQ-3 (Confirmation Dialog), REQ-4 (Browser Tab Close)_
  - _Prompt: Implement the task for spec FORGE-10-unsaved-changes-warning, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Developer | Task: Add the navigation guard system to App.tsx. (1) Import UnsavedChangesModal and store selectors (editorDirty, pendingSaveCallback, setEditorDirty). (2) Add state: `pendingNavAction: (() => void) | null`, default null. (3) Create `guardNavigation(action: () => void)`: reads `editorDirty` from store — if dirty AND current `mode === 'editor'`, set `pendingNavAction` to action (defers it); otherwise call action() immediately. (4) Wrap these navigation triggers with guardNavigation: the Generate tab onClick (setMode('generator')), handleSelectVariant (the function that calls setSelectedVariant), the Global Variables onClick (setSelectedGlobalVariablesViewId), and any generated config selection. (5) Modal handlers: `handleSaveAndContinue` calls `pendingSaveCallback?.()`, then `pendingNavAction?.()`, then clears both. `handleDiscard` calls `setEditorDirty(false)`, then `pendingNavAction?.()`, then clears. `handleCancelNav` clears `pendingNavAction`. (6) Render `<UnsavedChangesModal open={pendingNavAction !== null} ...handlers />` in JSX. (7) Add a useEffect for beforeunload: when `editorDirty` is true, add a beforeunload listener that sets `e.returnValue = ''`; clean up on false. | Restrictions: Do not change how navigation actually works — only intercept it. The guard should be a no-op when not in editor mode or when editor is clean. Do not change TemplateEditor or store. | Success: TypeScript compiles. Navigating away from a dirty editor shows the modal. Clean editor navigates immediately. Browser tab close triggers beforeunload when dirty. After completing, use log-implementation to record what was done, then mark task [x] in tasks.md._
  - **Recommended Agent:** Claude

- [x] 5. Unit tests for dirty flag and guard logic
  - File: `src/__tests__/unsaved-changes.test.ts` (CREATE)
  - Test dirty flag store behavior:
    - `setEditorDirty(true)` sets flag, `setEditorDirty(false)` clears it
    - Default is false
  - Test guard logic (extract guardNavigation as a testable function if possible):
    - When dirty + editor mode → action is deferred (not called)
    - When clean → action is called immediately
    - When dirty + NOT editor mode → action is called immediately
  - Purpose: Regression safety for the core guard logic
  - _Leverage: `src/__tests__/variable-sort.test.ts` (existing test patterns), `src/store/index.ts`_
  - _Requirements: REQ-1, REQ-2_
  - _Prompt: Implement the task for spec FORGE-10-unsaved-changes-warning, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA Engineer | Task: Create `src/__tests__/unsaved-changes.test.ts` with unit tests. Suite A — Store dirty flag: test that `setEditorDirty(true)` sets `editorDirty` to true, `setEditorDirty(false)` clears it, and default is false. Import the store directly and use `getState()`/`setState()`. Suite B — Guard logic: if the guardNavigation function can be extracted and exported from App.tsx, test it directly. Otherwise, test the store-level behavior: when `editorDirty` is true, a navigation action should be deferred; when false, it should execute immediately. Use vitest mock functions (`vi.fn()`) to verify whether navigation callbacks are called. Run tests with `npx vitest run src/__tests__/unsaved-changes.test.ts`. | Restrictions: Do not modify existing tests. Use Vitest. | Success: All tests pass. After completing, use log-implementation to record what was done, then mark task [x] in tasks.md._
  - **Recommended Agent:** Claude
