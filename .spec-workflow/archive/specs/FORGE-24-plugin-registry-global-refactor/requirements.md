# Requirements Document

## References

- **Issue:** FORGE-24
- **Spec Path:** `.spec-workflow/specs/FORGE-24-plugin-registry-global-refactor/`
- **Predecessor:** FORGE-22 (plugin framework — View-scoped implementation)
- **Vision:** `/Users/lbruton/Devops/Forge/Vision.md` — Two-Tier Plugin Architecture, Workbench Model

## Introduction

FORGE-22 built the plugin framework with plugin registrations stored on the View object (`View.plugins`). This was architecturally incorrect — a sidecar container runs once and serves all Views. The endpoint, API key, and enable/disable state are infrastructure concerns, not per-environment concerns.

This spec refactors the plugin data model to a two-tier architecture:
- **Global plugin registry** — what's installed, how to reach it (top-level, outside Views)
- **View plugin usage** — what devices/assets you're working with at each workbench (per-View, future scope)

The refactor touches the type layer, store, sidebar, routing, export/import, and tests. The FORGE-22 components (PluginPanel, PluginContentView, plugin-service) remain largely intact — they just read from a different location in the store.

## Alignment with Product Vision

Implements the "Two-Tier Plugin Architecture" and "Workbench Model" from Vision.md:
- Global Plugins node sits at the top level of the sidebar tree, outside Views
- Plugin workbench nodes (Vulnerability Scans, Config Backups, etc.) appear inside Views only when the corresponding global plugin is enabled
- Forge is a workshop — each enabled plugin contributes a workstation to the View

## Codebase Impact Report

### Files to modify

| File | Change | Effort |
|------|--------|--------|
| `src/types/index.ts` | Remove `plugins` from View, add to ForgeTree | Small |
| `src/types/plugin.ts` | No changes needed | None |
| `src/store/index.ts` | Move 6 plugin actions from View-scoped to global, add `plugins` to root state | Medium |
| `src/components/Sidebar.tsx` | Move Plugins node from inside Views to top-level, keep workbench nodes inside Views | Medium |
| `src/App.tsx` | Simplify plugin routing (direct lookup instead of searching Views), update health check loop | Small |
| `src/components/PluginPanel.tsx` | Change from `getViewPlugins(viewId)` to global `plugins` lookup | Small |
| `src/components/PluginContentView.tsx` | Same — global lookup | Small |
| `src/__tests__/plugin-store.test.ts` | Rewrite for global model | Medium |
| `src/__tests__/plugin-service.test.ts` | No changes | None |

### Patterns to preserve

- PluginManifest, PluginRegistration, PluginHealthStatus types are correct as-is
- plugin-service.ts (HTTP layer) is unaffected — it doesn't know about storage
- PluginPanel UI and PluginContentView rendering logic stay the same — only the data source changes

## Requirements

### Requirement 1: Global Plugin Registry

**User Story:** As a network engineer, I want plugin registrations to be global (not per-View) so that I configure a sidecar connection once and it's available across all my Views.

#### Acceptance Criteria

1. WHEN a plugin is registered THEN it SHALL be stored at the ForgeTree level (not on any View)
2. WHEN multiple Views exist THEN all Views SHALL see the same set of registered plugins
3. WHEN a plugin is enabled globally THEN its contributed workbench nodes SHALL appear in every View
4. WHEN a plugin is disabled globally THEN its workbench nodes SHALL disappear from all Views
5. WHEN the `registerPlugin` action is called THEN it SHALL NOT require a `viewId` parameter
6. WHEN the `unregisterPlugin` action is called THEN it SHALL NOT require a `viewId` parameter

### Requirement 2: Top-Level Plugins Sidebar Node

**User Story:** As a network engineer, I want the Plugins management panel to be at the top level of the sidebar tree (not inside each View) so I can manage all my plugin connections from one place.

#### Acceptance Criteria

1. WHEN Forge loads THEN a "Plugins" node SHALL appear at the top level of the sidebar tree (sibling to Views, not inside them)
2. WHEN the Plugins node is expanded THEN it SHALL show all registered plugins with active/inactive status indicators
3. WHEN a plugin is selected in the global Plugins node THEN the main content area SHALL show the PluginPanel for that plugin
4. WHEN "Add Plugin" is selected THEN the PluginPanel SHALL show the registration form
5. WHEN the Plugins node exists inside any View (from FORGE-22) THEN it SHALL be removed (replaced by the global node)

### Requirement 3: View Workbench Nodes

**User Story:** As a network engineer, I want plugin-contributed feature nodes (Vulnerability Scans, Config Backups, etc.) to appear inside my Views so that I work with devices and results in the context of each environment.

#### Acceptance Criteria

1. WHEN a plugin is enabled globally THEN its contributed `treeNodes` SHALL appear inside each View at depth 1
2. WHEN a plugin has `vendorScoped: true` tree nodes THEN they SHALL appear only under matching vendors within the View
3. WHEN a plugin's tree node is selected inside a View THEN the main content area SHALL render the plugin's content view
4. IF no plugins are enabled THEN no workbench nodes SHALL appear in any View (only Global Variables and Configurations)

### Requirement 4: Store Action Refactor

**User Story:** As a developer, I want plugin store actions to operate on global state so that the API is simpler and doesn't require passing viewId for plugin management.

#### Acceptance Criteria

1. WHEN `registerPlugin` is called THEN it SHALL accept `(manifest, endpoint?, apiKey?)` — no viewId
2. WHEN `unregisterPlugin` is called THEN it SHALL accept `(pluginName)` — no viewId
3. WHEN `setPluginEnabled` is called THEN it SHALL accept `(pluginName, enabled)` — no viewId
4. WHEN `setPluginHealth` is called THEN it SHALL accept `(pluginName, status)` — no viewId
5. WHEN `updatePluginSettings` is called THEN it SHALL accept `(pluginName, settings)` — no viewId
6. WHEN `getPlugins()` is called THEN it SHALL return all globally registered plugins (replaces `getViewPlugins`)

### Requirement 5: Export/Import Compatibility

**User Story:** As a network engineer, I want my plugin configurations to be preserved in vault exports and imports, even with the new global model.

#### Acceptance Criteria

1. WHEN a `.stvault` export is created THEN global plugin registrations SHALL be included
2. WHEN a `.stvault` file is imported THEN global plugin registrations SHALL be restored
3. WHEN importing a `.stvault` from the old format (plugins on View) THEN plugin registrations SHALL be migrated to the global registry (backward compatibility)
4. WHEN importing a `.stvault` that has plugins both on Views (old) and globally (new) THEN the global registry SHALL take precedence

### Requirement 6: Configurations Grouping Node (Deferred — Not in This Spec)

**Note:** The Vision.md tree shows a "Configurations" grouping node that wraps the existing vendor/model/template tree. This adds a click depth to the most common workflow and is deferred to a future issue. The existing flat vendor nodes remain unchanged in this spec.

## Open Questions

### Resolved

- [x] ~~Should plugins be removed from the View type entirely?~~ — Yes. `View.plugins` is removed. Views will store plugin *usage data* (devices, results) in a future spec (FORGE-23 and beyond), but that's a different field (`View.pluginData`) not the registration.
- [x] ~~Should the Plugins node be above or below Views in the sidebar?~~ — Below Views. Views are the primary workspace; Plugins is infrastructure management. Pattern: workspace first, settings second.
- [x] ~~Should old View.plugins data be migrated on import?~~ — Yes, for backward compatibility with any .stvault files created during the FORGE-22 window.
- [x] ~~Should the "Configurations" grouping node be added now?~~ — No. Deferred. Adds click depth to the most common workflow without clear value until we have 3+ workbench types active.

## Non-Functional Requirements

### Code Architecture and Modularity
- Plugin types in `src/types/plugin.ts` SHALL NOT change (they're already correct)
- Store refactor SHALL follow existing Zustand mutation patterns (spread operators, immutable updates)
- Sidebar refactor SHALL NOT modify TreeNode.tsx

### Performance
- No new performance concerns — this is a data location change, not a new feature

### Security
- API keys continue to be masked in UI and excluded from error messages (no change)

### Reliability
- Backward-compatible import from old format MUST NOT lose plugin data
- If `View.plugins` exists in imported data, migration to global MUST be automatic

### Usability
- Global Plugins node reduces confusion — "where do I configure my plugins?" has one answer, not one-per-View
- Plugin management is now 1 click away from the top level, not buried inside a View
