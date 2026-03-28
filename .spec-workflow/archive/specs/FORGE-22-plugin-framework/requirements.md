# Requirements Document

## References

- **Issue:** FORGE-22
- **Spec Path:** `.spec-workflow/specs/FORGE-22-plugin-framework/`
- **Vision:** `/Users/lbruton/Devops/Forge/Vision.md` — Plugin Framework section

## Introduction

Forge is a network operations workbench — a unified shell that pulls together config generation, vulnerability scanning, config backup, runbook management, and other network ops capabilities through a plugin architecture. The config template generator that shipped as V1 is the first plugin; future capabilities extend Forge through the same framework.

The plugin framework defines how capabilities register with Forge, contribute to the sidebar tree, store settings, and communicate with backend services. It supports two plugin types:

- **Bundled plugins** — ship in the main app package, no backend needed, enable/disable toggle. Examples: Configurations (V1 core), Runbooks, Network Maps.
- **Sidecar plugins** — require a companion Docker container with a REST API. The user enters the endpoint + API key to connect. Examples: Vulnerability Scanner, Config Backup, IPAM.

Both types share the same manifest schema, Plugins panel, and enable/disable mechanics. The only difference is sidecar plugins require an endpoint and API key; bundled plugins are always "connected."

The Cisco PSIRT/Nuclei vulnerability scanner (FORGE-23) is the first sidecar consumer — its prototype is ~50% complete and informs the design. Configurations (V1 core) will be treated as the default-enabled bundled plugin conceptually, but its code is not extracted into a plugin boundary in this spec — that's a future refactor.

**Key constraint:** Forge's frontend remains a static SPA. The plugin framework adds the ability to _connect to_ sidecars via REST APIs, but the frontend never _installs_ or _manages_ containers. Installation is a Docker/infrastructure concern.

## Alignment with Product Vision

This feature implements the "Plugin Framework" section of Vision.md:
- Forge as workbench: the core is a shell, capabilities are plugins
- Two plugin types: bundled (frontend-only) and sidecar (backend service)
- Sidecar architecture: independent containers with REST APIs
- Dynamic sidebar: tree adapts to enabled/connected plugins
- Keypair-on-first-launch: zero-config trust model for sidecars
- Plugin isolation: each sidecar has its own API key
- Minimize clicks: no wizard UIs, no multi-page setup flows

## Requirements

### Requirement 1: Plugin Manifest Schema

**User Story:** As a plugin developer, I want a standardized manifest schema so that Forge can auto-discover my plugin's capabilities without hardcoded knowledge.

#### Acceptance Criteria

1. WHEN Forge connects to a sidecar plugin THEN it SHALL request `GET /forge/manifest` from the endpoint
2. WHEN Forge initializes a bundled plugin THEN it SHALL read the manifest from a static object exported by the plugin module (no network request)
3. WHEN a manifest is loaded (from either source) THEN Forge SHALL validate it contains: `name` (string), `version` (string), `icon` (string — Lucide icon name), `type` (`"bundled"` or `"sidecar"`), `vendors` (string array of supported vendor types), `treeNodes` (array of contributed sidebar node declarations), and `settingsSchema` (JSON Schema for plugin-specific settings)
4. IF the manifest is missing required fields THEN Forge SHALL reject the plugin with a descriptive error message
5. WHEN a manifest declares `treeNodes` THEN each node SHALL specify: `id` (string), `label` (string), `icon` (string — Lucide icon name), `parentScope` (where in the tree it attaches — `view` level), and `vendorScoped` (boolean — whether nodes appear per-vendor)
6. WHEN a bundled plugin manifest declares `type: "bundled"` THEN Forge SHALL NOT require an endpoint or API key for that plugin

### Requirement 2: Plugin Registration Flow

**User Story:** As a network engineer, I want to connect a plugin sidecar by entering its endpoint and API key so that new capabilities appear in my sidebar without restarting Forge.

#### Acceptance Criteria

1. WHEN a user opens the Plugin Settings panel THEN Forge SHALL display a form with fields: endpoint URL and API key
2. WHEN the user submits the form THEN Forge SHALL attempt to fetch the manifest from the endpoint
3. IF the manifest fetch succeeds AND the API key authenticates THEN Forge SHALL register the plugin and show it as active
4. IF the manifest fetch fails (network error, auth failure, invalid manifest) THEN Forge SHALL display the error and show the plugin as inactive with diagnostic info
5. WHEN a plugin is registered THEN its contributed tree nodes SHALL appear in the sidebar immediately (no page reload required)
6. WHEN a user removes a plugin THEN its tree nodes SHALL disappear from the sidebar and its data SHALL be removed from storage

### Requirement 3: Plugin Settings Storage

**User Story:** As a network engineer, I want my plugin configurations to persist across sessions and be included in vault exports so that I can backup and restore my full Forge setup.

#### Acceptance Criteria

1. WHEN a plugin is registered THEN its configuration (endpoint, API key, enabled state, plugin-specific settings) SHALL be stored in the View's data model
2. WHEN Forge loads THEN it SHALL restore plugin registrations from persisted state
3. WHEN a `.stvault` export is created THEN plugin configurations (including encrypted API keys) SHALL be included
4. WHEN a `.stvault` file is imported THEN plugin configurations SHALL be restored
5. IF a plugin's `settingsSchema` defines additional fields (e.g., SNMP credentials, scan profiles) THEN Forge SHALL render a dynamic settings form from the schema
6. WHEN plugin settings are displayed THEN API keys SHALL be masked by default (shown as dots)

### Requirement 4: Health Monitoring

**User Story:** As a network engineer, I want to see at a glance which plugins are online so that I know which capabilities are available before I try to use them.

#### Acceptance Criteria

1. WHEN Forge loads THEN it SHALL health-check each registered plugin by requesting `GET /forge/health`
2. WHEN a health check succeeds THEN the plugin SHALL show a green active indicator in the Plugins panel
3. WHEN a health check fails THEN the plugin SHALL show a red/gray inactive indicator with the failure reason
4. WHEN a plugin is inactive THEN its contributed tree nodes SHALL be hidden from the sidebar (graceful degradation)
5. WHEN a previously inactive plugin becomes reachable THEN its tree nodes SHALL reappear (the user can manually re-check via a "Refresh" action on the plugin)

### Requirement 5: Dynamic Sidebar Tree

**User Story:** As a network engineer, I want the sidebar to automatically show plugin sections only when I have those plugins connected so that the tree stays clean and contextual.

#### Acceptance Criteria

1. WHEN no plugins are registered THEN the sidebar SHALL show only core nodes (Global Variables, Vendors, Templates, Generated)
2. WHEN a plugin is registered and active THEN its contributed tree nodes SHALL appear at the View level in the sidebar
3. IF a plugin declares `vendorScoped: true` THEN its tree nodes SHALL appear only under vendors the plugin supports (e.g., Vulnerabilities > Cisco, but not Vulnerabilities > Juniper if the plugin only supports Cisco)
4. WHEN multiple plugins are active THEN each plugin's tree nodes SHALL appear independently (no collisions)
5. WHEN a plugin's tree node is selected THEN Forge SHALL render a plugin-specific content area (the plugin declares what to show — initially an iframe or HTML renderer for scan reports, future: richer component integration)

### Requirement 6: Plugins Panel

**User Story:** As a network engineer, I want a dedicated Plugins area in the sidebar where I can manage all my plugin connections from one place.

#### Acceptance Criteria

1. WHEN Forge has at least one View THEN a "Plugins" node SHALL appear in the sidebar tree (always visible, regardless of whether any plugins are registered)
2. WHEN the Plugins node is expanded THEN it SHALL show: each registered plugin (with active/inactive indicator), and an "Add Plugin" action
3. WHEN a sidecar plugin node is selected THEN the main content area SHALL show: plugin name/version/status, connection settings (endpoint, API key), plugin-specific settings (rendered from settingsSchema), and actions (Edit, Remove, Refresh Health)
4. WHEN a bundled plugin node is selected THEN the main content area SHALL show: plugin name/version, enabled/disabled toggle, and plugin-specific settings (if any) — no endpoint or API key fields
5. WHEN "Add Plugin" is selected THEN a form SHALL appear for entering the sidecar endpoint and API key (bundled plugins are pre-registered and cannot be "added" — only enabled/disabled)

### Requirement 7: API Security

**User Story:** As a network engineer, I want plugin communication to be secured so that my network credentials and scan data are protected from unauthorized access.

#### Acceptance Criteria

1. WHEN Forge makes a request to a plugin sidecar THEN it SHALL include `Authorization: Bearer <apiKey>` in the request header
2. IF a plugin request returns 401/403 THEN Forge SHALL mark the plugin as inactive with an "authentication failed" message
3. WHEN API keys are stored THEN they SHALL be encrypted in the Zustand persisted state (same encryption approach as .stvault)
4. WHEN a user views plugin settings THEN API keys SHALL be masked (displayed as dots) with a reveal toggle

## Open Questions

> **GATE:** All blocking questions must be resolved before this document can be approved.

### Blocking (must resolve before approval)

- [x] ~~Should plugin API keys be encrypted at rest in localStorage?~~ — Yes, but note: localStorage is inherently accessible to JS on the same origin. Encryption adds defense-in-depth for `.stvault` exports. In localStorage, keys are stored as Zustand-persisted JSON (same as all other Forge data). True at-rest encryption of individual fields in localStorage would require a separate encryption key that itself needs to be stored somewhere. **Decision:** API keys are stored as-is in localStorage (same security model as all other Forge data) but encrypted when exported to `.stvault`. Masking in the UI prevents shoulder-surfing.
- [x] ~~How does the frontend discover the sidecar's port/IP?~~ — User manually enters the endpoint URL. No auto-discovery. The sidecar's docker-compose.yml documents which port it exposes.
- [x] ~~Should plugins be View-scoped or global?~~ — View-scoped. Different Views can have different plugin configurations (e.g., "Home Network" connects to the local scanner, "Work" connects to a different one).

### Non-blocking (can defer to Design)

- [ ] Should the Plugins panel be a pinned top-level node or placed at the bottom of the sidebar tree?
- [ ] Should plugin health checks run on a periodic interval (e.g., every 60s) or only on app load + manual refresh?
- [ ] How should plugin-contributed content areas render? Options: iframe for HTML reports, React component injection via dynamic import, or a generic HTML renderer component.

### Resolved

- [x] ~~Where does plugin data live in the data model?~~ — View-level `plugins` map, persisted via Zustand store alongside existing View data.
- [x] ~~Is CORS a concern?~~ — Yes, but the sidecar container controls its own CORS headers. The manifest endpoint should return `Access-Control-Allow-Origin` for the Forge frontend origin. This is a sidecar implementation concern, not a framework concern.

## Non-Functional Requirements

### Code Architecture and Modularity
- Plugin framework code SHALL be isolated in dedicated files (`src/lib/plugin-service.ts`, `src/types/plugin.ts`, `src/components/PluginPanel.tsx`)
- Plugin types SHALL NOT be mixed into existing type files — use a separate `plugin.ts` types module
- The plugin service SHALL be a standalone module that the store consumes, not embedded in the store
- TreeNode component SHALL NOT change — plugin nodes use the existing TreeNode interface

### Performance
- Health checks SHALL use `AbortController` with a 5-second timeout to prevent slow sidecars from blocking app startup
- Health checks SHALL run in parallel (Promise.allSettled) on app load
- Plugin sidebar nodes SHALL be memoized to avoid unnecessary re-renders when plugin state hasn't changed

### Security
- API keys SHALL never appear in console logs, error messages, or network error details shown to the user
- Fetch requests to plugin sidecars SHALL use `credentials: 'omit'` to prevent cookie leakage
- Plugin endpoint URLs SHALL be validated (must be HTTP/HTTPS, must not be empty)

### Reliability
- A failing plugin SHALL NOT crash Forge or prevent other plugins from working
- All plugin fetch calls SHALL be wrapped in try/catch with graceful error handling
- If localStorage is corrupted, plugin state SHALL recover gracefully (treat as "no plugins registered")

### Usability
- Adding a plugin SHALL require exactly 2 inputs: endpoint URL and API key
- Plugin status SHALL be visible at a glance (green/red indicator) without clicking into settings
- Error messages from failed connections SHALL be human-readable, not raw HTTP/network errors
