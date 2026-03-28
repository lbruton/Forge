# Design Document

## References

- **Issue:** FORGE-22
- **Spec Path:** `.spec-workflow/specs/FORGE-22-plugin-framework/`
- **Vision:** `/Users/lbruton/Devops/Forge/Vision.md` — Plugin Framework section
- **Requirements:** `.spec-workflow/specs/FORGE-22-plugin-framework/requirements.md`

## Overview

The plugin framework turns Forge from a config template generator into a network operations workbench. It adds the infrastructure for capabilities to register, contribute sidebar tree nodes, store settings, communicate with backend sidecars, and render plugin-specific content — all while keeping the core as a static SPA.

Two plugin types: **bundled** (ship in the main app, no backend) and **sidecar** (companion Docker container with REST API). Both share the same manifest schema, settings model, and sidebar integration.

## Code Reuse Analysis

### Existing Components to Leverage

- **TreeNode** (`src/components/TreeNode.tsx`): Already accepts `ReactNode` children/icons, optional actions (onAdd, onEdit, onDelete), context menus. Plugin nodes use this directly — no changes needed.
- **Zustand store** (`src/store/index.ts`): Persist middleware with localStorage. Plugin state follows the same pattern — new slice alongside `templates`, `generatedConfigs`, etc.
- **StorageService** (`src/lib/storage-service.ts`): `forge_` prefixed localStorage wrapper. Plugin data uses the same singleton.
- **VaultEngine** (`src/lib/vault-engine.ts`): AES-256-GCM encryption for `.stvault`. Plugin configs (including API keys) flow through the existing export/import pipeline via `VaultExportData` extension.
- **Modal pattern** (`CreateNodeModal`, `VaultModal`): Established modal UX for forms and dialogs. Plugin settings panel follows this pattern.

### Integration Points

- **View data model** (`src/types/index.ts`): Extended with `plugins` field
- **Sidebar** (`src/components/Sidebar.tsx`): Plugin nodes injected after core nodes
- **App.tsx**: `renderMainContent` switch extended for plugin content views
- **VaultExportData**: Extended to include plugin metadata

## Architecture

The framework is layered into four concerns: types, service, store, and UI.

```
  UI Layer
  ┌──────────┐ ┌───────────┐ ┌────────────┐
  │ Sidebar   │ │ PluginPane│ │ PluginView │
  │ (injects  │ │ (settings │ │ (content   │
  │  nodes)   │ │  panel)   │ │  renderer) │
  └─────┬─────┘ └─────┬─────┘ └─────┬──────┘
        │              │              │
  ┌─────▼──────────────▼──────────────▼──────┐
  │  Store Layer (Zustand)                    │
  │  pluginRegistry: Record<string, Plugin>   │
  │  actions: register, unregister, update,   │
  │           healthCheck, setEnabled         │
  └─────────────────┬────────────────────────┘
                    │
  ┌─────────────────▼────────────────────────┐
  │  Service Layer                            │
  │  pluginService.ts                         │
  │  - fetchManifest(endpoint, apiKey)        │
  │  - healthCheck(endpoint, apiKey)          │
  │  - pluginFetch(endpoint, apiKey, path)    │
  └─────────────────┬────────────────────────┘
                    │
  ┌─────────────────▼────────────────────────┐
  │  Types Layer                              │
  │  plugin.ts                                │
  │  - PluginManifest                         │
  │  - PluginRegistration                     │
  │  - PluginTreeNode                         │
  │  - PluginHealthStatus                     │
  └──────────────────────────────────────────┘
                    │
                    │ HTTP (sidecar plugins only)
                    ▼
          ┌─────────────────────┐
          │  Sidecar Container  │
          │  GET /forge/manifest│
          │  GET /forge/health  │
          │  POST /scan         │
          │  GET /results/...   │
          └─────────────────────┘
```

## Components and Interfaces

### Plugin Types (`src/types/plugin.ts`)

- **Purpose:** Type definitions for the entire plugin system
- **Interfaces:** PluginManifest, PluginRegistration, PluginTreeNode, PluginHealthStatus
- **Dependencies:** None (pure types)

### Plugin Service (`src/lib/plugin-service.ts`)

- **Purpose:** All HTTP communication with sidecar plugins. Isolated fetch logic with timeout, error handling, and auth headers.
- **Interfaces:**
  - `fetchManifest(endpoint: string, apiKey: string): Promise<PluginManifest>` — fetches and validates manifest
  - `healthCheck(endpoint: string, apiKey: string): Promise<PluginHealthStatus>` — pings `/forge/health` with 5s timeout
  - `pluginFetch(endpoint: string, apiKey: string, path: string, options?: RequestInit): Promise<Response>` — authenticated fetch wrapper for any plugin API call
- **Dependencies:** None (pure HTTP service)
- **Reuses:** Standard `fetch` API with `AbortController` for timeouts

### Plugin Store Slice (`src/store/index.ts` extension)

- **Purpose:** Plugin state management — registration, health status, enabled state
- **Interfaces:**
  - `pluginRegistry: Record<string, PluginRegistration>` — all registered plugins keyed by manifest `name`
  - `registerPlugin(viewId: string, manifest: PluginManifest, endpoint?: string, apiKey?: string): void`
  - `unregisterPlugin(viewId: string, pluginName: string): void`
  - `setPluginEnabled(viewId: string, pluginName: string, enabled: boolean): void`
  - `setPluginHealth(pluginName: string, status: PluginHealthStatus): void`
  - `getViewPlugins(viewId: string): PluginRegistration[]`
- **Dependencies:** PluginManifest, PluginRegistration types
- **Reuses:** Existing Zustand persist middleware, same localStorage pattern

### Plugin Panel Component (`src/components/PluginPanel.tsx`)

- **Purpose:** Main content area when a plugin is selected in the Plugins node. Shows settings, status, and actions.
- **Interfaces:** `PluginPanelProps { viewId: string; pluginName: string }`
- **Dependencies:** Store (plugin actions), PluginService (health check, manifest refresh)
- **Reuses:** Form input patterns from GlobalVariablesPage, card/panel styling from existing components

### Plugin Content Renderer (`src/components/PluginContentView.tsx`)

- **Purpose:** Renders plugin-contributed content when a plugin tree node is selected. For v1, renders HTML content (scan reports) in a sandboxed container using DOMPurify for XSS prevention.
- **Interfaces:** `PluginContentViewProps { pluginName: string; nodeId: string; viewId: string }`
- **Dependencies:** Store (plugin data), PluginService (fetch content from sidecar), DOMPurify (HTML sanitization)
- **Reuses:** ConfigPreview styling (terminal-like dark background, monospace text)

### Sidebar Plugin Injection (`src/components/Sidebar.tsx` modification)

- **Purpose:** Inject plugin-contributed tree nodes into the sidebar after core nodes
- **Change:** After the vendor tree nodes and before the Plugins management node, iterate over active plugins and render their `treeNodes` using existing `TreeNode` component
- **Reuses:** TreeNode component (no changes to TreeNode itself)

## Data Models

### PluginManifest

```typescript
interface PluginManifest {
  name: string;           // unique identifier, e.g., "forge-vuln-cisco"
  displayName: string;    // human-readable, e.g., "Cisco PSIRT/Nuclei Scan"
  version: string;        // semver, e.g., "1.0.0"
  icon: string;           // Lucide icon name, e.g., "shield-alert"
  type: 'bundled' | 'sidecar';
  vendors: string[];      // vendor types supported, e.g., ["cisco"]
  treeNodes: PluginTreeNode[];
  settingsSchema?: Record<string, SettingsField>;  // dynamic settings form
}
```

### PluginTreeNode

```typescript
interface PluginTreeNode {
  id: string;             // unique node ID, e.g., "vulnerabilities"
  label: string;          // display name, e.g., "Vulnerabilities"
  icon: string;           // Lucide icon name
  vendorScoped: boolean;  // if true, appears under matching vendors only
}
```

### SettingsField

```typescript
interface SettingsField {
  type: 'string' | 'password' | 'number' | 'boolean' | 'select';
  label: string;
  description?: string;
  required?: boolean;
  default?: string | number | boolean;
  options?: { label: string; value: string }[];  // for 'select' type
}
```

### PluginRegistration (stored per-View)

```typescript
interface PluginRegistration {
  manifest: PluginManifest;
  endpoint?: string;      // sidecar only — URL of the sidecar API
  apiKey?: string;        // sidecar only — Bearer token
  enabled: boolean;
  settings: Record<string, string | number | boolean>;  // user-entered plugin settings
  health: PluginHealthStatus;
}
```

### PluginHealthStatus

```typescript
interface PluginHealthStatus {
  status: 'active' | 'inactive' | 'unknown';
  lastChecked: string;    // ISO timestamp
  error?: string;         // human-readable error if inactive
}
```

### View Extension

```typescript
// Existing View interface extended:
interface View {
  id: string;
  name: string;
  vendors: Vendor[];
  globalVariables?: VariableDefinition[];
  plugins?: Record<string, PluginRegistration>;  // NEW — keyed by manifest name
  createdAt: string;
  updatedAt: string;
}
```

### VaultExportData Extension

No separate `pluginMetadata` field needed — plugins are part of the View object, so they export/import with the tree automatically.

## UI Impact Assessment

### Has UI Changes: Yes

### Visual Scope
- **Impact Level:** New panel (Plugin Panel), minor element additions (sidebar plugin nodes, status indicators)
- **Components Affected:** Sidebar.tsx (inject plugin nodes + Plugins management node), App.tsx (renderMainContent switch), new PluginPanel.tsx, new PluginContentView.tsx
- **Prototype Required:** No — the Plugin Panel follows existing patterns (GlobalVariablesPage form layout, card styling). Plugin tree nodes use existing TreeNode component. No new visual hierarchy or uncertain layout.

### Design Constraints
- **Theme Compatibility:** Dark mode only (Forge branding)
- **Existing Patterns to Match:** GlobalVariablesPage (form layout, input styling), Sidebar tree nodes (TreeNode component), status indicators (green/red dots similar to masked variable indicators)
- **Responsive Behavior:** Plugin panel fills the main content area. Sidebar nodes follow existing responsive pattern (sidebar collapses on mobile).

## Open Questions

### Resolved

- [x] ~~Plugin panel placement in sidebar~~ — "Plugins" node appears at the bottom of the View's children, after all vendor nodes and Global Variables. It's always visible but not intrusive.
- [x] ~~Health check interval~~ — On app load + manual refresh only for v1. Periodic polling adds complexity without clear value for a homelab context where sidecars are always-on or always-off.
- [x] ~~Content rendering approach~~ — v1 uses DOMPurify-sanitized HTML renderer for scan reports. Future: dynamic React component loading for richer plugin UIs.
- [x] ~~Where does plugin data live in VaultExportData?~~ — It doesn't need a separate field. Plugins are part of the View object, so they export/import with the tree automatically.

## Error Handling

### Error Scenarios

1. **Sidecar unreachable on registration**
   - **Handling:** Catch fetch error, display human-readable message ("Cannot connect to {endpoint} — check that the sidecar is running")
   - **User Impact:** Plugin saved as inactive with error message visible in Plugins panel

2. **API key rejected (401/403)**
   - **Handling:** Mark plugin inactive, display "Authentication failed — check your API key"
   - **User Impact:** Plugin appears in Plugins panel as inactive, user can edit the key

3. **Manifest validation failure**
   - **Handling:** Reject registration, display which fields are missing/invalid
   - **User Impact:** Form shows inline error, plugin is not added

4. **Health check timeout (5s)**
   - **Handling:** AbortController cancels the request, plugin marked inactive
   - **User Impact:** Plugin shows "Connection timed out" in status

5. **Plugin content fetch failure**
   - **Handling:** PluginContentView shows an error state ("Unable to load data from {pluginName}")
   - **User Impact:** Content area shows error, sidebar node remains visible

6. **Corrupted plugin data in localStorage**
   - **Handling:** Catch JSON parse errors, treat as empty plugins map, log warning to console
   - **User Impact:** Plugins appear unregistered, user re-adds them

## Testing Strategy

### Unit Tests (Vitest)
- **Plugin service**: Mock fetch to test manifest validation, health check timeout, auth header injection
- **Plugin store**: Test register/unregister/enable/disable/health state transitions
- **Manifest validation**: Test required fields, optional fields, type discrimination (bundled vs sidecar)

### Manual Verification
- Register a mock sidecar (simple Express/FastAPI server returning a manifest and health endpoint)
- Verify sidebar updates dynamically
- Verify .stvault export/import preserves plugin configs
- Verify graceful degradation when sidecar is stopped
