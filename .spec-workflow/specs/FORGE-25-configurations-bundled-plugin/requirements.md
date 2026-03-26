# Requirements Document

## References

- **Issue:** FORGE-25
- **Spec Path:** `.spec-workflow/specs/FORGE-25-configurations-bundled-plugin/`
- **Vision:** `/Users/lbruton/Devops/Forge/Vision.md` — Workbench Model
- **Predecessor:** FORGE-22 (plugin framework), FORGE-24 (global plugin registry)

## Introduction

Forge's config template workflow (vendors, models, templates, generated configs) is currently rendered directly in the sidebar as top-level children of each View. With the plugin framework in place, this should be wrapped as the first **bundled plugin** — a plugin that ships in the main app, is enabled by default, and uses the same manifest/registration/workbench pattern as all other plugins.

This establishes the "everything is a plugin" architecture where Forge core is the shell and each capability is a workstation in the workshop.

### What changes
- Vendor/model/template tree moves under a "Configurations" workbench node in each View
- A static manifest is auto-registered in the global plugin registry on first app load
- The plugin appears in the global Plugins panel tagged as "Built-in"

### What stays the same
- All existing components (TemplateEditor, ConfigGenerator, VariableForm, etc.)
- Data model (vendors, models, variants, templates)
- Storage, .stvault export/import
- All existing functionality — this is a tree restructure, not a feature change

## Alignment with Product Vision

Implements the "Workbench Model" from Vision.md:
- Each top-level node inside a View is a workstation (tool in the forge)
- Configurations is the first workstation, bundled by default
- The pattern established here is reused by Runbooks, Network Maps, and all future bundled plugins

## Requirements

### Requirement 1: Configurations Plugin Manifest

**User Story:** As a developer building future plugins, I want the Configurations capability defined as a standard plugin manifest so that the pattern is established and documented.

#### Acceptance Criteria

1. WHEN Forge is built THEN a `src/plugins/configurations.ts` module SHALL export a `PluginManifest` object with: name `"forge-configurations"`, displayName `"Configurations"`, version `"1.0.0"`, icon `"file-code-2"`, type `"bundled"`, vendors `[]` (not vendor-scoped — it wraps ALL vendors), treeNodes with one entry: `{ id: 'configurations', label: 'Configurations', icon: 'file-code-2', vendorScoped: false }`
2. WHEN the manifest is loaded THEN it SHALL pass `validateManifest()` from plugin-service.ts

### Requirement 2: Auto-Registration on App Init

**User Story:** As a user, I want the Configurations plugin to appear automatically without any setup so that the config template workflow works out of the box.

#### Acceptance Criteria

1. WHEN Forge loads for the first time THEN the Configurations plugin SHALL be registered in the global plugin registry automatically
2. WHEN the Configurations plugin is already registered THEN app init SHALL NOT create a duplicate registration
3. WHEN the Configurations plugin is registered THEN its health status SHALL be `{ status: 'active', lastChecked: <now> }` (bundled plugins are always active)
4. WHEN the Configurations plugin is registered THEN it SHALL be enabled by default

### Requirement 3: Configurations Workbench Node in Sidebar

**User Story:** As a network engineer, I want the vendor/model/template tree to appear under a "Configurations" heading so that I can distinguish it from other workbenches (vulnerability scans, backups, etc.) as they're added.

#### Acceptance Criteria

1. WHEN Forge loads with the Configurations plugin enabled THEN a "Configurations" TreeNode SHALL appear inside each View at depth 1
2. WHEN the Configurations node is expanded THEN Global Variables AND all vendor/model/template/generated nodes SHALL render as its children (depths shifted by +1)
3. WHEN the Configurations plugin is disabled THEN Global Variables SHALL also be hidden (it is scoped to the config template workflow, not a cross-plugin global)
3. WHEN a new View is created THEN the Configurations node SHALL appear automatically (since the plugin is globally enabled)
4. WHEN the user clicks a variant inside Configurations THEN the existing TemplateEditor/ConfigGenerator SHALL render in the main content area (no behavior change)
5. WHEN the Configurations node is collapsed THEN the vendor tree SHALL be hidden (standard TreeNode collapse behavior)
6. WHEN a View has the Configurations node THEN it SHALL be expanded by default on first load (to avoid forcing an extra click on the most common workflow)

### Requirement 4: Built-in Plugin in Global Plugins Panel

**User Story:** As a user, I want to see the Configurations plugin in my Plugins panel so that I understand it's part of the plugin system and can control it if needed.

#### Acceptance Criteria

1. WHEN the user opens the Plugins panel THEN Configurations SHALL appear with a "Built-in" badge/tag
2. WHEN the user views Configurations plugin details THEN it SHALL show: name, version, "Built-in" type, enabled/disabled toggle — no endpoint or API key fields
3. WHEN the user disables the Configurations plugin THEN the Configurations workbench node and all vendor/model/template content SHALL disappear from all Views
4. WHEN the user re-enables the Configurations plugin THEN the workbench and all content SHALL reappear
5. WHEN the user attempts to remove (delete) the Configurations plugin THEN the action SHALL be blocked — built-in plugins cannot be removed, only disabled

### Requirement 5: Bundled Plugin Pattern for Future Reuse

**User Story:** As a developer, I want a clean pattern for adding future bundled plugins (Runbooks, Network Maps) so that each follows the same registration and rendering flow.

#### Acceptance Criteria

1. WHEN a new bundled plugin manifest is added to `src/plugins/` THEN it SHALL be auto-registered on app init following the same pattern as Configurations
2. WHEN a bundled plugin declares `treeNodes` THEN they SHALL appear in Views using the same rendering logic as Configurations
3. WHEN a bundled plugin is registered THEN it SHALL appear in the Plugins panel with the "Built-in" badge

## Open Questions

### Resolved

- [x] ~~Should the Configurations node be expanded by default?~~ — Yes. It's the most common workflow. Forcing an extra click to see templates would frustrate users. Auto-expand on first view creation.
- [x] ~~Should we add an "Add Vendor" action on the Configurations node?~~ — Yes, same as the current "Add" on each View (which adds a vendor). The Configurations node inherits the View's `onAdd` for vendors.
- [x] ~~What icon for Configurations?~~ — `FileCode2` from Lucide (same as the current Templates folder icon). Consistent with the config-template identity.

## Non-Functional Requirements

### Code Architecture and Modularity
- Bundled plugin manifests SHALL live in `src/plugins/` — one file per plugin or a single `bundled-manifests.ts` exporting all
- The auto-registration logic SHALL be a single `initBundledPlugins()` function called from App.tsx useEffect
- Sidebar.tsx vendor rendering code stays in place — it just gets wrapped in an additional TreeNode parent

### Performance
- No performance concerns — adding one TreeNode wrapper has negligible impact
- Auto-registration runs once on mount, checks `getPlugin()` to skip if already registered

### Usability
- The extra click depth (View > Configurations > Vendor) is now justified because multiple workbenches will exist
- Default-expanded Configurations node means zero extra clicks for the common case
- Disabling Configurations hides all config content but preserves data — re-enabling restores it
