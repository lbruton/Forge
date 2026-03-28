# Tasks Document

## References

- **Issue:** FORGE-22
- **Spec Path:** `.spec-workflow/specs/FORGE-22-plugin-framework/`
- **Requirements:** `.spec-workflow/specs/FORGE-22-plugin-framework/requirements.md`
- **Design:** `.spec-workflow/specs/FORGE-22-plugin-framework/design.md`

## File Touch Map

| Action | File | Scope |
|--------|------|-------|
| CREATE | `src/types/plugin.ts` | Plugin type definitions |
| CREATE | `src/lib/plugin-service.ts` | HTTP service for sidecar communication |
| CREATE | `src/components/PluginPanel.tsx` | Plugin settings/management UI |
| CREATE | `src/components/PluginContentView.tsx` | Plugin content renderer (HTML reports) |
| CREATE | `src/__tests__/plugin-service.test.ts` | Plugin service unit tests |
| CREATE | `src/__tests__/plugin-store.test.ts` | Plugin store unit tests |
| MODIFY | `src/types/index.ts` | Extend View interface with plugins field |
| MODIFY | `src/store/index.ts` | Add plugin store slice (actions + state) |
| MODIFY | `src/components/Sidebar.tsx` | Inject plugin tree nodes + Plugins management node |
| MODIFY | `src/App.tsx` | Extend renderMainContent for plugin views |
| MODIFY | `package.json` | Add DOMPurify dependency |

---

- [x] 1. Create plugin type definitions
  - File: `src/types/plugin.ts` (CREATE)
  - File: `src/types/index.ts` (MODIFY — add `plugins` to View, re-export plugin types)
  - Define: PluginManifest, PluginTreeNode, SettingsField, PluginRegistration, PluginHealthStatus
  - Extend View interface with optional `plugins?: Record<string, PluginRegistration>`
  - _Leverage: `src/types/index.ts` (existing View interface pattern)_
  - _Requirements: 1 (manifest schema), 3 (settings storage), 4 (health monitoring)_
  - _Prompt: Implement the task for spec FORGE-22-plugin-framework, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript Developer | Task: Create `src/types/plugin.ts` with all plugin type definitions from the design document (PluginManifest, PluginTreeNode, SettingsField, PluginRegistration, PluginHealthStatus). Then modify `src/types/index.ts` to add `plugins?: Record<string, PluginRegistration>` to the View interface and re-export all plugin types. | Restrictions: Do NOT modify any existing type definitions. The `plugins` field MUST be optional for backward compatibility. Follow the existing naming and export conventions in `src/types/index.ts`. | Success: All 5 plugin interfaces defined, View interface extended, `npx tsc --noEmit` passes with zero errors._

- [x] 2. Create plugin service (HTTP layer)
  - File: `src/lib/plugin-service.ts` (CREATE)
  - Implement: `fetchManifest(endpoint, apiKey)` — GET /forge/manifest with Bearer auth, validates required fields
  - Implement: `healthCheck(endpoint, apiKey)` — GET /forge/health with 5s AbortController timeout
  - Implement: `pluginFetch(endpoint, apiKey, path, options?)` — generic authenticated fetch wrapper
  - Implement: `validateManifest(data)` — runtime validation of manifest shape
  - All fetch calls use `credentials: 'omit'`, never log API keys
  - _Leverage: Standard fetch API, AbortController for timeouts_
  - _Requirements: 1 (manifest fetch), 4 (health check), 7 (API security)_
  - _Prompt: Implement the task for spec FORGE-22-plugin-framework, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Frontend Developer specializing in API communication | Task: Create `src/lib/plugin-service.ts` with four exported functions: `fetchManifest`, `healthCheck`, `pluginFetch`, and `validateManifest`. All HTTP requests must include `Authorization: Bearer <apiKey>` header and use `credentials: 'omit'`. `healthCheck` must use AbortController with a 5-second timeout. `validateManifest` must check all required manifest fields (name, displayName, version, icon, type, vendors, treeNodes) and throw descriptive errors for missing fields. | Restrictions: Never log or include API keys in error messages. All functions must be pure (no side effects, no store access). Use try/catch with human-readable error messages, not raw fetch errors. | Success: All 4 functions exported, type-safe, `npx tsc --noEmit` passes. Errors are descriptive (e.g., "Cannot connect to http://... — check that the sidecar is running")._

- [x] 3. Add plugin state to Zustand store
  - File: `src/store/index.ts` (MODIFY)
  - Add to ForgeStore interface: `registerPlugin`, `unregisterPlugin`, `setPluginEnabled`, `setPluginHealth`, `getViewPlugins`, `selectedPluginName`, `setSelectedPluginName`, `selectedPluginNodeId`, `setSelectedPluginNodeId`
  - Plugin registrations stored on the View object (View.plugins map)
  - Selection state for which plugin/node is active in the main content area
  - Persisted via existing Zustand persist middleware (plugins are part of the View, so they auto-persist)
  - _Leverage: `src/store/index.ts` (existing store patterns — addView, addVendor, etc.)_
  - _Requirements: 2 (registration flow), 3 (settings storage), 4 (health monitoring)_
  - _Prompt: Implement the task for spec FORGE-22-plugin-framework, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React/Zustand Developer | Task: Extend the Zustand store in `src/store/index.ts` with plugin state management. Add interface members: `selectedPluginName: string | null`, `selectedPluginNodeId: string | null`, `setSelectedPluginName(name)`, `setSelectedPluginNodeId(nodeId)`, `registerPlugin(viewId, manifest, endpoint?, apiKey?)`, `unregisterPlugin(viewId, pluginName)`, `setPluginEnabled(viewId, pluginName, enabled)`, `setPluginHealth(viewId, pluginName, status)`, `getViewPlugins(viewId)`. Plugin registrations are stored on `View.plugins` (the map we added in Task 1). Selection state (`selectedPluginName`, `selectedPluginNodeId`) should be excluded from persistence via the `partialize` middleware. | Restrictions: Do NOT restructure existing store code. Follow the exact same patterns used by `addVendor`, `addModel`, etc. for mutations. Plugin registration must create default health status `{ status: 'unknown', lastChecked: '' }`. | Success: All actions work correctly, `npx tsc --noEmit` passes, `selectedPluginName`/`selectedPluginNodeId` are excluded from persistence._

- [x] 4. Create Plugin Panel component (settings + management)
  - File: `src/components/PluginPanel.tsx` (CREATE)
  - Two modes: "Add Plugin" form (endpoint + API key inputs) and "Plugin Detail" view (settings, status, actions)
  - For sidecar plugins: show endpoint, masked API key with reveal toggle, health status indicator (green/red dot), Refresh Health button, Remove button
  - For bundled plugins: show enabled/disabled toggle, no endpoint/API key fields
  - Dynamic settings form: render form fields from `manifest.settingsSchema` (string, password, number, boolean, select types)
  - Status indicator: green dot = active, red dot = inactive with error message
  - _Leverage: `src/components/GlobalVariablesPage.tsx` (form input patterns, masked value toggle), `src/components/VariableInput.tsx` (input styling)_
  - _Requirements: 2 (registration flow), 3 (settings storage), 4 (health monitoring), 6 (plugins panel), 7 (API security — masked keys)_
  - _Prompt: Implement the task for spec FORGE-22-plugin-framework, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Frontend Developer | Task: Create `src/components/PluginPanel.tsx`. This component has two views: (1) "Add Plugin" — form with endpoint URL and API key inputs, a "Connect" button that calls `fetchManifest` from plugin-service, and on success calls `registerPlugin` from the store. (2) "Plugin Detail" — shows plugin name/version, health status (green/red dot), connection settings (endpoint + masked API key with eye toggle for sidecar plugins, or enable/disable toggle for bundled plugins), dynamic settings form rendered from `manifest.settingsSchema`, and Remove/Refresh actions. Use the same input styling as GlobalVariablesPage (bg-forge-obsidian, border-forge-steel, etc.). Status dot: 8px circle, green-500 for active, red-500 for inactive. | Restrictions: Follow Forge branding (dark mode, amber accent, Inter font). Do NOT create modals — this renders in the main content area. API keys must be masked by default. All fetch errors must show human-readable messages. | Success: Both views render correctly, "Connect" fetches manifest and registers plugin, health status shows correctly, dynamic settings form renders from schema, `npx tsc --noEmit` passes._

- [x] 5. Inject plugin nodes into Sidebar
  - File: `src/components/Sidebar.tsx` (MODIFY)
  - After vendor tree nodes (inside each View): iterate over `getViewPlugins(view.id)`, for each active+enabled plugin render its `treeNodes` using TreeNode component
  - For `vendorScoped: true` nodes: render under matching vendor nodes only
  - For `vendorScoped: false` nodes: render at View level (depth 1)
  - Add a "Plugins" management node at the bottom of each View's children (always visible)
  - Plugins node expands to show each registered plugin with active/inactive indicator in label
  - Plugin node click sets `selectedPluginName` in store
  - Plugin tree node click sets `selectedPluginNodeId` in store
  - Import Lucide icons dynamically by name for plugin icons
  - _Leverage: `src/components/Sidebar.tsx` (existing tree rendering pattern), `src/components/TreeNode.tsx` (no changes)_
  - _Requirements: 5 (dynamic sidebar), 6 (plugins panel)_
  - _Prompt: Implement the task for spec FORGE-22-plugin-framework, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Frontend Developer | Task: Modify `src/components/Sidebar.tsx` to inject plugin tree nodes. Inside each View's children (after the vendor map loop, before the closing TreeNode tag): (1) For each active plugin from `getViewPlugins(view.id)`, render its `treeNodes` — if `vendorScoped: false`, render at depth 1; if `vendorScoped: true`, render inside matching vendor nodes at depth 2. (2) Add a "Plugins" TreeNode at depth 1 (always visible, icon: Puzzle from lucide-react). When expanded, show each registered plugin as a child node with `[● active]` or `[○ inactive]` in the label. Clicking a plugin node calls `setSelectedPluginName`. Clicking a plugin tree node calls `setSelectedPluginNodeId`. For plugin icons, create a helper that maps Lucide icon name strings to React components (e.g., "shield-alert" → ShieldAlert). Support a handful of common icons (Shield, ShieldAlert, Database, Server, Network, HardDrive, Puzzle) with a fallback to Puzzle for unknown names. | Restrictions: Do NOT modify TreeNode.tsx. Do NOT hardcode plugin-specific knowledge — all rendering is driven by the manifest. Keep the Plugins node as the last child of the View. | Success: Active plugin treeNodes appear in sidebar, Plugins management node is visible, clicking sets selection state, icons render correctly, `npx tsc --noEmit` passes._

- [x] 6. Extend App.tsx for plugin content routing
  - File: `src/App.tsx` (MODIFY)
  - Extend `renderMainContent` switch: if `selectedPluginName` is set and `selectedPluginNodeId` is null, render `<PluginPanel>`. If both are set, render `<PluginContentView>`.
  - Add `useEffect` on app mount: for each View, iterate plugins and call `healthCheck` (via plugin-service) for each sidecar plugin, update store health status. Use `Promise.allSettled` for parallel checks.
  - Wire up `handleSelectPluginNode` in sidebar callbacks to clear other selections (variant, globalVariables, generatedConfig) when a plugin is selected
  - _Leverage: `src/App.tsx` (existing renderMainContent pattern, guardNavigation pattern)_
  - _Requirements: 2 (registration flow — plugin panel routing), 4 (health check on load), 5 (content rendering)_
  - _Prompt: Implement the task for spec FORGE-22-plugin-framework, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Application Developer | Task: Modify `src/App.tsx`: (1) Import PluginPanel and PluginContentView. (2) In `renderMainContent`, add checks BEFORE the existing conditions: if `selectedPluginName && !selectedPluginNodeId` → return `<PluginPanel viewId={currentViewId} pluginName={selectedPluginName} />`; if `selectedPluginName && selectedPluginNodeId` → return `<PluginContentView pluginName={selectedPluginName} nodeId={selectedPluginNodeId} viewId={currentViewId} />`. (3) Add a `useEffect` that runs on mount: for each View in `tree.views`, for each sidecar plugin in `view.plugins`, call `healthCheck(plugin.endpoint, plugin.apiKey)` and update health via `setPluginHealth`. Use `Promise.allSettled` so one failing plugin doesn't block others. (4) When a plugin is selected in the sidebar, clear `selectedVariantId`, `selectedGlobalVariablesViewId`, and `selectedGeneratedConfigId`. | Restrictions: Plugin content routing must come BEFORE existing content checks in renderMainContent. Health checks must not block app rendering (fire and forget with state updates). Do NOT add periodic health polling — on mount only. | Success: Plugin panel renders when plugin selected, content view renders when plugin node selected, health checks fire on mount, selections are mutually exclusive, `npx tsc --noEmit` passes._

- [x] 7. Create Plugin Content View component
  - File: `src/components/PluginContentView.tsx` (CREATE)
  - File: `package.json` (MODIFY — add `dompurify` + `@types/dompurify`)
  - For v1: fetches HTML content from the sidecar via `pluginFetch` and renders it sanitized with DOMPurify
  - Shows loading spinner while fetching, error state on failure
  - Styled with terminal-like dark background (matching ConfigPreview)
  - Header shows plugin name + node label
  - _Leverage: `src/components/ConfigPreview.tsx` (terminal styling), DOMPurify for HTML sanitization_
  - _Requirements: 5 (dynamic sidebar — content rendering)_
  - _Prompt: Implement the task for spec FORGE-22-plugin-framework, first run spec-workflow-guide to get the workflow guide then implement the task: Role: React Frontend Developer | Task: (1) Add `dompurify` and `@types/dompurify` to package.json dependencies. (2) Create `src/components/PluginContentView.tsx` — props: `{ pluginName, nodeId, viewId }`. On mount, fetch content from the sidecar using `pluginFetch(endpoint, apiKey, '/content/' + nodeId)`. Sanitize HTML response with DOMPurify before rendering. Three states: loading (spinner centered on dark bg), error (message + retry button), loaded (sanitized HTML in a scrollable container). Style the container like ConfigPreview: `bg-forge-terminal`, dark background, `font-mono text-sm`. Add a header bar showing the plugin display name and node label. | Restrictions: ALL HTML from sidecars MUST be sanitized with DOMPurify before rendering — no exceptions. Use `DOMPurify.sanitize(html, { ADD_TAGS: ['style'], ADD_ATTR: ['class'] })` to allow basic styling from reports. Show "Unable to load data from {pluginName}" on fetch failure, not raw errors. | Success: Component renders sanitized HTML, loading/error states work, styled consistently with Forge branding, no XSS vectors, `npx tsc --noEmit` passes, `npm run build` succeeds._

- [x] 8. Unit tests for plugin service and store
  - File: `src/__tests__/plugin-service.test.ts` (CREATE)
  - File: `src/__tests__/plugin-store.test.ts` (CREATE)
  - Plugin service tests: mock fetch to test manifest validation (valid, missing fields, network error), health check (success, timeout, auth failure), pluginFetch (auth header injection)
  - Plugin store tests: register/unregister, enable/disable, health status updates, getViewPlugins filtering
  - _Leverage: `src/__tests__/substitution-engine.test.ts` (existing Vitest patterns)_
  - _Requirements: 1 (manifest validation), 2 (registration), 3 (settings), 4 (health)_
  - _Prompt: Implement the task for spec FORGE-22-plugin-framework, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA Engineer | Task: Create two test files. (1) `src/__tests__/plugin-service.test.ts`: Mock global `fetch` to test `fetchManifest` (valid manifest, missing required fields, network error, 401 response), `healthCheck` (success, timeout after 5s, auth failure), `validateManifest` (all required fields, missing name, missing type, invalid type value), `pluginFetch` (verifies Authorization header, credentials omit). (2) `src/__tests__/plugin-store.test.ts`: Test `registerPlugin` (adds to View.plugins map), `unregisterPlugin` (removes from map), `setPluginEnabled` (toggles enabled flag), `setPluginHealth` (updates health status), `getViewPlugins` (returns only plugins for the specified viewId, filters by enabled state). | Restrictions: Use Vitest (import from 'vitest'). Mock fetch globally, do NOT make real HTTP requests. Follow existing test patterns from `src/__tests__/substitution-engine.test.ts`. | Success: All tests pass with `npx vitest run`, coverage of happy path + error cases for both service and store._
