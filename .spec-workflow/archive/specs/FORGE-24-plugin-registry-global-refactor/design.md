# Design Document

## References

- **Issue:** FORGE-24
- **Spec Path:** `.spec-workflow/specs/FORGE-24-plugin-registry-global-refactor/`
- **Requirements:** `.spec-workflow/specs/FORGE-24-plugin-registry-global-refactor/requirements.md`
- **Predecessor:** FORGE-22 (plugin framework, View-scoped)

## Overview

This is a surgical refactor — moving plugin registrations from `View.plugins` to a global `ForgeStore.plugins` field, updating the sidebar to render the Plugins node at the top level, and simplifying all store actions to drop the `viewId` parameter. The FORGE-22 components (PluginPanel, PluginContentView, plugin-service) remain functionally intact.

## Code Reuse Analysis

### Existing Components Preserved (no changes)
- **plugin-service.ts** — HTTP layer is storage-agnostic
- **plugin.ts types** — PluginManifest, PluginRegistration, PluginHealthStatus are correct as-is
- **TreeNode.tsx** — plugin nodes still use this component
- **PluginContentView.tsx** — only changes data source (1-2 lines)

### Components Modified
- **store/index.ts** — plugin slice refactored from View-scoped to global
- **Sidebar.tsx** — Plugins node moves from inside Views to top-level
- **App.tsx** — simplified routing (direct lookup, no View search)
- **PluginPanel.tsx** — switch from `getViewPlugins(viewId)` to `getPlugins()`
- **types/index.ts** — remove `plugins` from View, update ForgeTree or store interface

## Architecture

### Before (FORGE-22 — View-scoped)
```
ForgeStore
├── tree: ForgeTree
│   └── views: View[]
│       └── plugins: Record<string, PluginRegistration>  ← here
├── selectedPluginName
└── selectedPluginNodeId
```

### After (FORGE-24 — Global)
```
ForgeStore
├── tree: ForgeTree
│   └── views: View[]  ← no plugins field
├── plugins: Record<string, PluginRegistration>  ← moved here
├── selectedPluginName
└── selectedPluginNodeId
```

### Sidebar Tree Layout

```
Before (FORGE-22):              After (FORGE-24):
─────────────────               ─────────────────
Home Network                    Home Network
├── Global Variables            ├── Global Variables
├── Cisco/...                   ├── Cisco/...
└── Plugins          ←inside    ├── Vulnerability Scans  ← workbench
    ├── Scanner [●]             │   └── Cisco/...
    └── + Add Plugin            │
                                Plugins              ← top-level
                                ├── Scanner [●]
                                └── + Add Plugin
```

## Components and Interfaces

### Type Changes (`src/types/index.ts`)

- **Remove** `plugins?: Record<string, PluginRegistration>` from `View` interface
- No new types needed — PluginRegistration is already defined in plugin.ts

### Store Changes (`src/store/index.ts`)

**New root state field:**
```typescript
plugins: Record<string, PluginRegistration>;  // global, persisted
```

**Simplified action signatures:**
```typescript
// Before (viewId required):
registerPlugin(viewId, manifest, endpoint?, apiKey?)
unregisterPlugin(viewId, pluginName)
setPluginEnabled(viewId, pluginName, enabled)
setPluginHealth(viewId, pluginName, status)
updatePluginSettings(viewId, pluginName, settings)
getViewPlugins(viewId): PluginRegistration[]

// After (no viewId):
registerPlugin(manifest, endpoint?, apiKey?)
unregisterPlugin(pluginName)
setPluginEnabled(pluginName, enabled)
setPluginHealth(pluginName, status)
updatePluginSettings(pluginName, settings)
getPlugins(): PluginRegistration[]
getPlugin(pluginName): PluginRegistration | undefined
```

**Implementation:** Direct record mutations on `state.plugins` instead of nested View updates. Much simpler:
```typescript
registerPlugin: (manifest, endpoint?, apiKey?) => {
  set((state) => ({
    plugins: {
      ...state.plugins,
      [manifest.name]: {
        manifest, endpoint, apiKey,
        enabled: true,
        settings: {},
        health: { status: 'unknown', lastChecked: '' },
      },
    },
  }));
}
```

**Persistence:** `plugins` is a root-level field, so Zustand's persist middleware includes it automatically. The `partialize` exclusion list only needs `selectedPluginName` and `selectedPluginNodeId` (unchanged).

### Sidebar Changes (`src/components/Sidebar.tsx`)

1. **Remove** the per-View "Plugins" TreeNode and its children
2. **Add** a top-level "Plugins" TreeNode AFTER the Views loop (at depth 0, sibling to Views)
3. **Keep** workbench nodes inside Views — iterate `getPlugins()`, for enabled plugins render their `treeNodes` inside each View (same as FORGE-22 but reading from global state)
4. Plugin node `onSelect` no longer needs viewId

### App.tsx Changes

1. **Simplify routing:** Replace `tree.views.find(v => v.plugins?.[selectedPluginName])` with direct `getPlugin(selectedPluginName)`. No more View search.
2. **Health check loop:** Replace `view.plugins` iteration with `Object.values(plugins)` at the store root level
3. **PluginPanel routing:** Pass `pluginName` only (no viewId needed for global registry)
4. **PluginContentView routing:** Still needs a viewId for content context — use the currently active View from sidebar selection state

### PluginPanel Changes

- Replace `getViewPlugins(viewId)` with `getPlugins()` / `getPlugin(pluginName)`
- Remove viewId from `registerPlugin` calls
- Remove viewId prop requirement (or keep for "which View context" if needed later)

### PluginContentView Changes

- Replace `getViewPlugins(viewId).find(...)` with `getPlugin(pluginName)`
- Keep viewId prop for content context (which View's devices to show)

### Export/Import Changes

**Export:** `exportData` already exports the full store. With `plugins` at root level, it's automatically included.

**Import migration:** In `importData`, check for old format:
```typescript
// Migrate View-scoped plugins to global
for (const view of importedData.views ?? []) {
  if (view.plugins) {
    for (const [name, reg] of Object.entries(view.plugins)) {
      if (!state.plugins[name]) {
        state.plugins[name] = reg;
      }
    }
    delete view.plugins;  // clean up old format
  }
}
```

## Data Models

No new types. Only structural changes:

```typescript
// View (modified — remove plugins)
interface View {
  id: string;
  name: string;
  vendors: Vendor[];
  globalVariables?: VariableDefinition[];
  // plugins removed — now on ForgeStore root
  createdAt: string;
  updatedAt: string;
}

// ForgeStore (modified — add plugins at root)
interface ForgeStore {
  tree: ForgeTree;
  templates: Record<string, Template>;
  variableValues: Record<string, VariableValues>;
  generatedConfigs: Record<string, GeneratedConfig>;
  plugins: Record<string, PluginRegistration>;  // NEW — global
  preferences: Preferences;
  selectedPluginName: string | null;
  selectedPluginNodeId: string | null;
  // ... actions
}
```

## UI Impact Assessment

### Has UI Changes: Yes

### Visual Scope
- **Impact Level:** Minor element relocation (Plugins node moves from inside Views to top-level)
- **Components Affected:** Sidebar.tsx (node relocation), PluginPanel.tsx (data source change)
- **Prototype Required:** No — this is a tree node relocation, not a new visual design. Same TreeNode component, same icons, same styling, different position in the tree.

### Design Constraints
- **Existing Patterns to Match:** Views are at depth 0, Plugins will also be at depth 0
- **Visual distinction:** Plugins node should use a different icon or subtle visual cue to distinguish it from Views (it's infrastructure, not a workspace). Use `Settings` or `Puzzle` icon.

## Open Questions

### Resolved

- [x] ~~Should `plugins` live on ForgeTree or ForgeStore root?~~ — ForgeStore root. ForgeTree is the user's content hierarchy (Views, Vendors, Models). Plugins are infrastructure state. Keeping them separate avoids muddying the content model.
- [x] ~~VaultExportData changes needed?~~ — The `exportData` function in the store needs to include the `plugins` field explicitly. `importData` needs migration logic for old View-scoped format.

## Error Handling

No new error scenarios. Existing plugin error handling (connection failures, auth errors, manifest validation) is unaffected by the data location change.

## Testing Strategy

### Unit Tests (Vitest)
- Rewrite `plugin-store.test.ts` for global model (no viewId in actions)
- Test migration path: create store with View-scoped plugins, import, verify they appear in global registry
- Existing `plugin-service.test.ts` unchanged (service is storage-agnostic)

### Manual Verification
- Verify Plugins node appears at top level (not inside Views)
- Verify plugin workbench nodes still appear inside Views
- Verify .stvault round-trip preserves plugins
- Verify importing an old-format .stvault migrates plugins correctly
