# Design Document

## References

- **Issue:** FORGE-25
- **Spec Path:** `.spec-workflow/specs/FORGE-25-configurations-bundled-plugin/`
- **Requirements:** `.spec-workflow/specs/FORGE-25-configurations-bundled-plugin/requirements.md`

## Overview

Wrap the existing vendor/model/template tree as the first bundled plugin. This is a sidebar restructure with auto-registration logic — no new features, no data model changes. The existing config template code stays exactly where it is.

## Code Reuse Analysis

### Existing Components Preserved (no changes)
- **TemplateEditor, ConfigGenerator, VariableForm, ConfigPreview** — all unchanged
- **plugin-service.ts** — `validateManifest()` used to verify the bundled manifest
- **TreeNode.tsx** — unchanged, used for the new Configurations wrapper node
- **PluginPanel.tsx** — already handles bundled plugins (no endpoint/API key, enable/disable toggle)

### Components Modified
- **Sidebar.tsx** — wrap vendor tree under Configurations node, depth shift +1
- **App.tsx** — add `initBundledPlugins()` call on mount
- **store/index.ts** — minor: prevent deletion of built-in plugins

### Components Created
- **src/plugins/configurations.ts** — manifest definition
- **src/plugins/init.ts** — `initBundledPlugins()` function

## Architecture

```
App.tsx useEffect (mount)
    │
    ├── initBundledPlugins()          ← NEW: registers bundled manifests
    │   └── registerPlugin(manifest)  ← existing store action
    │
    └── health checks (existing)      ← skips bundled plugins (always active)

Sidebar.tsx
    View
    ├── Configurations (depth=1)      ← NEW: wrapper TreeNode
    │   ├── Global Variables (depth=2) ← moved inside (scoped to config templates)
    │   ├── Vendor (depth=2)          ← was depth=1
    │   │   └── Model (depth=3)       ← was depth=2
    │   │       ├── Templates (depth=4)
    │   │       └── Generated (depth=4)
    │   └── Vendor (depth=2)
    ├── [other plugin workbenches]    ← future plugins at depth=1
    └── (Plugins at top-level)
```

**Note:** Global Variables moves inside Configurations because it's scoped to the config template workflow (`${var}` substitution). It's not a cross-plugin global — other plugins (vulnerability scanner, backups) will have their own settings stored in their plugin config. If a future need arises for truly global cross-plugin variables, that would be a separate top-level node.

## Components and Interfaces

### Configurations Manifest (`src/plugins/configurations.ts`)

- **Purpose:** Static manifest for the Configurations bundled plugin
- **Exports:** `CONFIGURATIONS_MANIFEST: PluginManifest`
- **Dependencies:** PluginManifest type

```typescript
export const CONFIGURATIONS_MANIFEST: PluginManifest = {
  name: 'forge-configurations',
  displayName: 'Configurations',
  version: '1.0.0',
  icon: 'file-code-2',
  type: 'bundled',
  vendors: [],
  treeNodes: [{
    id: 'configurations',
    label: 'Configurations',
    icon: 'file-code-2',
    vendorScoped: false,
  }],
};
```

### Bundled Plugin Init (`src/plugins/init.ts`)

- **Purpose:** Auto-register all bundled plugins on app mount
- **Exports:** `initBundledPlugins(getPlugin, registerPlugin)`
- **Dependencies:** Store actions (passed as params, not imported — keeps it testable)

```typescript
export function initBundledPlugins(
  getPlugin: (name: string) => PluginRegistration | undefined,
  registerPlugin: (manifest: PluginManifest) => void,
) {
  const bundled = [CONFIGURATIONS_MANIFEST];
  for (const manifest of bundled) {
    if (!getPlugin(manifest.name)) {
      registerPlugin(manifest);
    }
  }
}
```

### Sidebar Changes (`src/components/Sidebar.tsx`)

**The vendor `.map()` loop wraps under a new TreeNode:**

The key insight: the Configurations workbench node is NOT rendered by the generic plugin treeNode loop. It's a special case because its children are the vendor tree (which is core data, not plugin-provided content). The generic plugin treeNodes render empty workbench nodes that plugins fill via their own content views. Configurations has its children built into the sidebar already.

**Approach:** Check if the `forge-configurations` plugin is enabled. If yes, wrap the vendor loop in a Configurations TreeNode. If not (disabled), skip the vendor loop entirely.

```tsx
{/* Configurations workbench — wraps vendor tree + global variables when plugin is enabled */}
{configurationsEnabled && (
  <TreeNode
    id={`${view.id}__configurations`}
    label="Configurations"
    icon={<FileCode2 size={14} />}
    depth={1}
    hasChildren={true}
    onAdd={() => openCreate('vendor', view.id)}
  >
    {/* Global Variables — scoped to config template workflow */}
    <TreeNode
      id={view.id + '__globals'}
      label={`Global Variables${...}`}
      icon={<Globe size={14} />}
      depth={2}  // was 1
      hasChildren={false}
      onSelect={() => { /* existing global vars selection */ }}
    />

    {/* Vendors */}
    {view.vendors.map((vendor) => (
      <TreeNode
        // ... existing vendor rendering, depth=2 instead of 1
      >
        {/* ... existing model/template/generated tree, all depths +1 */}
      </TreeNode>
    ))}
  </TreeNode>
)}
```

**Auto-expand:** When a View is created or on first load, add `${view.id}__configurations` to the expanded nodes list so the vendor tree is visible without an extra click.

### Store Changes (`src/store/index.ts`)

**Minor:** In `unregisterPlugin`, check if the plugin manifest has `type: 'bundled'`. If so, block the deletion (return without changing state). This prevents built-in plugins from being removed.

### PluginPanel Badge (`src/components/PluginPanel.tsx`)

**Minor:** When rendering a plugin with `manifest.type === 'bundled'`, show a "Built-in" badge next to the name. Hide the "Remove" button for bundled plugins.

## Data Models

No data model changes. PluginManifest and PluginRegistration are used as-is.

## UI Impact Assessment

### Has UI Changes: Yes

### Visual Scope
- **Impact Level:** Minor element additions (one new TreeNode wrapper, depth shifts, "Built-in" badge)
- **Components Affected:** Sidebar.tsx (Configurations wrapper node), PluginPanel.tsx (Built-in badge, hide Remove for bundled)
- **Prototype Required:** No — adding a TreeNode wrapper is a well-understood pattern. The "Built-in" badge is a small text tag.

### Design Constraints
- **Existing Patterns to Match:** TreeNode at depth 1 (same as Global Variables, plugin workbench nodes)
- **Responsive Behavior:** Unchanged — TreeNode handles all depths

## Open Questions

### Resolved

- [x] ~~Should Configurations be rendered by the generic plugin treeNode loop?~~ — No. Configurations is special because its children are the vendor tree (core sidebar data). Generic plugin treeNodes render empty workbenches that plugins fill via content views. Configurations wraps existing JSX.
- [x] ~~What happens to the existing vendor `onAdd` when wrapped?~~ — The Configurations node inherits the "Add Vendor" action via its own `onAdd` prop.

## Error Handling

No new error scenarios. Bundled plugin registration is synchronous and cannot fail (it's a static manifest with no network calls).

## Testing Strategy

### Unit Tests (Vitest)
- `initBundledPlugins`: test that it registers when not present, skips when already registered
- Store: test that `unregisterPlugin` blocks deletion of bundled plugins

### Manual Verification
- Verify "Configurations" node appears inside each View
- Verify vendor tree renders correctly at new depths
- Verify clicking variants still opens TemplateEditor/ConfigGenerator
- Verify disabling Configurations hides the vendor tree
- Verify "Built-in" badge in Plugins panel
- Verify built-in plugins cannot be removed
