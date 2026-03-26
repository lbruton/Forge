# Tasks Document

## References

- **Issue:** FORGE-25
- **Spec Path:** `.spec-workflow/specs/FORGE-25-configurations-bundled-plugin/`
- **Requirements:** `.spec-workflow/specs/FORGE-25-configurations-bundled-plugin/requirements.md`
- **Design:** `.spec-workflow/specs/FORGE-25-configurations-bundled-plugin/design.md`

## File Touch Map

| Action | File | Scope |
|--------|------|-------|
| CREATE | `src/plugins/configurations.ts` | Configurations manifest |
| CREATE | `src/plugins/init.ts` | Bundled plugin auto-registration |
| CREATE | `src/__tests__/bundled-plugins.test.ts` | Init + store protection tests |
| MODIFY | `src/components/Sidebar.tsx` | Wrap vendor + global vars under Configurations node, depth +1 |
| MODIFY | `src/App.tsx` | Call initBundledPlugins on mount |
| MODIFY | `src/store/index.ts` | Block deletion of bundled plugins |
| MODIFY | `src/components/PluginPanel.tsx` | "Built-in" badge, hide Remove for bundled |

---

- [x] 1. Create Configurations manifest and bundled plugin init
  - File: `src/plugins/configurations.ts` (CREATE)
  - File: `src/plugins/init.ts` (CREATE)
  - Define `CONFIGURATIONS_MANIFEST` as a static `PluginManifest` with name `"forge-configurations"`, displayName `"Configurations"`, version `"1.0.0"`, icon `"file-code-2"`, type `"bundled"`, vendors `[]`, treeNodes `[{ id: 'configurations', label: 'Configurations', icon: 'file-code-2', vendorScoped: false }]`
  - Create `initBundledPlugins(getPlugin, registerPlugin)` that registers all bundled manifests if not already present. Sets health to `{ status: 'active', lastChecked: new Date().toISOString() }` for bundled plugins.
  - _Leverage: `src/types/plugin.ts` (PluginManifest type)_
  - _Requirements: 1 (manifest), 2 (auto-registration), 5 (reusable pattern)_
  - _Prompt: Implement the task for spec FORGE-25-configurations-bundled-plugin, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript Developer | Task: (1) Create `src/plugins/configurations.ts` exporting `CONFIGURATIONS_MANIFEST: PluginManifest` with the exact values from the design doc. (2) Create `src/plugins/init.ts` exporting `initBundledPlugins(getPlugin, registerPlugin)`. This function imports `CONFIGURATIONS_MANIFEST` and any future bundled manifests, iterates them, and calls `registerPlugin(manifest)` for each that `getPlugin(manifest.name)` returns undefined. For bundled plugins, the registration should set health to `{ status: 'active', lastChecked: new Date().toISOString() }` — pass this by calling registerPlugin then immediately calling a setPluginHealth callback. The function signature should be: `initBundledPlugins(getPlugin, registerPlugin, setPluginHealth)`. | Restrictions: Keep the manifest values exactly as specified. Do NOT import the store directly — accept callbacks as params for testability. | Success: `npx tsc --noEmit` passes. Both files export correctly._

- [x] 2. Wire auto-registration in App.tsx and block bundled plugin deletion in store
  - File: `src/App.tsx` (MODIFY — import and call initBundledPlugins in mount useEffect)
  - File: `src/store/index.ts` (MODIFY — block deletion of type:'bundled' plugins)
  - _Leverage: `src/App.tsx` (existing mount useEffect with health checks), `src/store/index.ts` (existing unregisterPlugin)_
  - _Requirements: 2 (auto-registration), 4 (cannot remove built-in)_
  - _Prompt: Implement the task for spec FORGE-25-configurations-bundled-plugin, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React/Zustand Developer | Task: (1) In `src/App.tsx`, import `initBundledPlugins` from `../plugins/init.ts`. In the existing mount useEffect (where health checks run), call `initBundledPlugins(getPlugin, registerPlugin, setPluginHealth)` BEFORE the health check loop. This ensures bundled plugins are registered before health checks run. (2) In `src/store/index.ts`, modify `unregisterPlugin`: at the start of the function, check if `state.plugins[pluginName]?.manifest.type === 'bundled'`. If so, return without changing state (silently block deletion). | Restrictions: initBundledPlugins must run before health checks. The deletion block must be silent (no error thrown, just no-op). | Success: `npx tsc --noEmit` passes. On app load, Configurations plugin appears in `getPlugins()`. Attempting to unregister a bundled plugin has no effect._

- [x] 3. Wrap vendor and Global Variables tree under Configurations node in Sidebar
  - File: `src/components/Sidebar.tsx` (MODIFY)
  - _Leverage: `src/components/Sidebar.tsx` (existing vendor rendering loop and Global Variables node)_
  - _Requirements: 3 (workbench node), 4 (disable hides content)_
  - _Prompt: Implement the task for spec FORGE-25-configurations-bundled-plugin, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Frontend Developer | Task: Refactor `src/components/Sidebar.tsx` to wrap the vendor tree and Global Variables under a "Configurations" workbench node. (1) At the top of each View's children rendering, check if the `forge-configurations` plugin is enabled: `const configurationsPlugin = getPlugin('forge-configurations'); const configurationsEnabled = configurationsPlugin?.enabled ?? false;`. (2) If enabled, wrap BOTH the Global Variables TreeNode AND the vendor `.map()` loop inside a new parent TreeNode: id=`${view.id}__configurations`, label="Configurations", icon=FileCode2, depth=1, hasChildren=true, onAdd=openCreate('vendor', view.id). (3) Move the Global Variables TreeNode inside this wrapper as its first child, at depth=2 (was depth=1). (4) Move all vendor TreeNodes inside this wrapper, shift ALL depths by +1 (vendor 1→2, model 2→3, templates folder 3→4, variants 4→5, generated folder 3→4, generated configs 4→5). (5) If configurationsEnabled is false, skip rendering both Global Variables and the vendor tree entirely. (6) Auto-expand: in the existing useEffect or view creation logic, ensure `${view.id}__configurations` is added to expandedNodes on first load so the tree is open by default. Check if `toggleExpandedNode` can be called during init, or if you need to set the initial preferences. | Restrictions: Do NOT modify TreeNode.tsx. The Configurations node MUST be the first child of the View (before other plugin workbench nodes). Global Variables MUST be the first child inside Configurations. All existing onSelect/onEdit/onDelete/onAdd callbacks must continue working — only depths change. | Success: `npx tsc --noEmit` passes. Vendor tree renders under Configurations at correct depths. Global Variables is inside Configurations. Clicking variants still opens editors. Disabling the plugin hides everything._

- [x] 4. Add "Built-in" badge and hide Remove for bundled plugins in PluginPanel
  - File: `src/components/PluginPanel.tsx` (MODIFY)
  - _Leverage: `src/components/PluginPanel.tsx` (existing plugin detail view)_
  - _Requirements: 4 (built-in badge, cannot remove)_
  - _Prompt: Implement the task for spec FORGE-25-configurations-bundled-plugin, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Frontend Developer | Task: Modify `src/components/PluginPanel.tsx`: (1) In the plugin detail view header (where plugin name and version are displayed), add a "Built-in" badge when `manifest.type === 'bundled'`. Style: `text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-forge-graphite text-slate-400`. (2) In the plugin list view, add the same badge next to bundled plugins. (3) Hide the "Remove Plugin" button when `manifest.type === 'bundled'` — bundled plugins can be disabled but not removed. (4) In the plugin list, move bundled plugins to the top of the list (before sidecar plugins). | Restrictions: Only visual changes — no store logic changes. Follow Forge branding. | Success: `npx tsc --noEmit` passes. Configurations shows "Built-in" badge. No Remove button for bundled plugins._

- [x] 5. Unit tests for bundled plugin init and deletion protection
  - File: `src/__tests__/bundled-plugins.test.ts` (CREATE)
  - _Leverage: `src/__tests__/plugin-store.test.ts` (existing Vitest patterns)_
  - _Requirements: 2 (auto-registration), 4 (cannot remove), 5 (reusable pattern)_
  - _Prompt: Implement the task for spec FORGE-25-configurations-bundled-plugin, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA Engineer | Task: Create `src/__tests__/bundled-plugins.test.ts` with Vitest. Tests: (1) `initBundledPlugins` registers Configurations when not present — mock getPlugin returning undefined, verify registerPlugin called with CONFIGURATIONS_MANIFEST. (2) `initBundledPlugins` skips when already registered — mock getPlugin returning a registration, verify registerPlugin NOT called. (3) Store blocks deletion of bundled plugins — register a bundled plugin, call unregisterPlugin, verify it still exists in getPlugins(). (4) Store allows deletion of sidecar plugins — register a sidecar plugin, call unregisterPlugin, verify it's gone. (5) Configurations manifest passes validateManifest — import CONFIGURATIONS_MANIFEST and validateManifest from plugin-service, verify no throw. | Restrictions: Use Vitest. For tests 1-2, mock the callback functions (vi.fn()). For tests 3-4, use the real store. | Success: `npx vitest run` passes all tests._
