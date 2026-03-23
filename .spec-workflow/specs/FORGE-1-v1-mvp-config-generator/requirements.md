# Requirements Document

## References

- **Issue:** FORGE-1
- **Spec Path:** `.spec-workflow/specs/FORGE-1-v1-mvp-config-generator/`

## Introduction

Forge V1 is a network configuration template generator that replaces Cisco DNAC's CLI template simulation workflow. Network engineers paste existing configs (from DNAC or running devices), the app auto-detects variables and section dividers, and produces a reusable template library stored in the browser. Templates can be shared across team members via encrypted `.stvault` files, enabling safe public hosting without exposing private network data.

The primary workflow is: paste config → save as template → fill variables → copy generated config. The goal is that a user can copy their template from DNAC, paste it into Forge, hit save, and be done.

## Alignment with Product Vision

This feature implements the entire V1 product as defined in the steering documents:
- **Replace DNAC dependency** — purpose-built tool eliminates the need for DNAC's CLI template simulation
- **Zero infrastructure** — static web app with browser storage, no backend
- **Team portability** — encrypted `.stvault` export enables sharing without exposing sensitive data
- **Muscle memory transfer** — DNAC-compatible `$variable` / `${variable}` syntax
- **Engineer-first UX** — terminal-style output, monospace fonts, copy-paste optimized

## Requirements

### REQ-1: Navigation Hierarchy (View > Vendor > Model > Variant)

**User Story:** As a network engineer, I want to organize my templates by organizational context, vendor, model, and variant, so that I can manage templates for multiple environments (e.g., HomeLab vs Work) and multiple device types in a structured way.

#### Acceptance Criteria

1. WHEN the app loads THEN the system SHALL display a sidebar navigation with a tree structure: View > Vendor > Model > Variant
2. WHEN the user creates a new View THEN the system SHALL prompt for a view name (e.g., "HomeLab", "Work") and persist it to localStorage
3. WHEN the user creates a new Vendor under a View THEN the system SHALL prompt for vendor name (e.g., "Cisco") and config format type (CLI, XML, JSON, YAML)
4. WHEN the user creates a new Model under a Vendor THEN the system SHALL prompt for model name (e.g., "IE3300", "C9200L") and optional description
5. WHEN the user creates a new Variant under a Model THEN the system SHALL open the template creation flow (REQ-2)
6. WHEN the user selects a Variant in the sidebar THEN the system SHALL display that variant's config generator (variable form + config preview)
7. WHEN the user right-clicks or uses a context menu on any node THEN the system SHALL offer Edit, Delete, and Export options
8. IF a View/Vendor/Model is deleted THEN the system SHALL confirm the action and cascade-delete all children

### REQ-2: Template Import via Paste

**User Story:** As a network engineer, I want to paste my existing config (from DNAC or a running device) and have the app automatically detect variables and section boundaries, so that I can create templates without manual setup.

#### Acceptance Criteria

1. WHEN the user pastes config text into the template creation textarea THEN the system SHALL scan for `$variable` and `${variable}` patterns and display a list of detected variables
2. WHEN the system detects variables THEN it SHALL auto-generate a variable definition for each with: name (from the pattern), inferred label (snake_case → Title Case), default type "string", and required=true
3. WHEN the pasted config contains divider comment patterns (e.g., lines matching `!#{3,}.*#{3,}`, `!#{3,}`, `#### .* ####`, `##### .* #####`) THEN the system SHALL auto-detect section boundaries and split the template into named sections
4. WHEN sections are auto-detected THEN the system SHALL extract the section name from the divider text (e.g., `!########## GENERIC IOS CONFIG ##########` → section name "Generic IOS Config")
5. WHEN the user saves the template THEN the system SHALL store the template text, detected variables, and sections as a new Variant under the selected Model
6. IF no divider patterns are detected THEN the system SHALL create a single section named "Full Config" containing the entire pasted text
7. WHEN the user views the template editor THEN the system SHALL provide guidance text explaining the supported divider formats for creating sections
8. WHEN the user edits an existing template THEN the system SHALL re-detect variables from the modified text and prompt to add/remove variable definitions accordingly

### REQ-3: Variable Management

**User Story:** As a network engineer, I want to define, edit, and categorize template variables with type hints, so that the config generator form provides appropriate input validation and a better user experience.

#### Acceptance Criteria

1. WHEN a variable is auto-detected from template text THEN the system SHALL create a variable definition with fields: name, label, type, defaultValue, required, description
2. WHEN the user edits a variable definition THEN the system SHALL allow changing: label, type (string, ip, integer, dropdown), defaultValue, required flag, description, and dropdown options (if type=dropdown)
3. IF a variable name contains "ip" or "address" THEN the system SHALL suggest type "ip" during auto-detection
4. IF a variable name contains "range" or "port" THEN the system SHALL suggest type "string" with a description hint of "e.g., Gi1/0/1-24"
5. WHEN the user manually adds a variable THEN the system SHALL insert `$variablename` at the cursor position in the template editor and create the corresponding variable definition
6. WHEN a variable is removed from the template text THEN the system SHALL prompt the user to also remove the orphaned variable definition
7. WHEN the user views the variable list THEN the system SHALL display variables grouped by the section they first appear in

### REQ-4: Config Generator with Live Preview

**User Story:** As a network engineer, I want to fill in variable values and see a live preview of the generated config with syntax highlighting, so that I can verify the output before copying it to my clipboard.

#### Acceptance Criteria

1. WHEN the user selects a Variant THEN the system SHALL display an auto-generated form with input fields for each variable, respecting their defined types
2. WHEN the user types in a variable input field THEN the system SHALL update the config preview in real-time (debounced at ~200ms)
3. WHEN rendering the config preview THEN the system SHALL apply Cisco IOS syntax highlighting (keywords, IP addresses, interface names, comments)
4. WHEN rendering the config preview THEN the system SHALL display line numbers in the gutter
5. WHEN a variable value is empty and the variable is required THEN the system SHALL highlight the corresponding `$variable` placeholder in the preview with a warning color
6. WHEN the user fills in a variable THEN the system SHALL substitute ALL occurrences of that variable across ALL sections (e.g., `$default_gateway` used in both "Switch Base" and "Line/SSH" sections)
7. IF a variable has type "ip" THEN the input field SHALL validate IPv4 format and show an error state for invalid input
8. IF a variable has type "dropdown" THEN the input field SHALL render as a select/combobox with the defined options
9. WHEN the config preview is displayed THEN the system SHALL style it as a terminal (darker background `#0A0F1A`, monospace JetBrains Mono, line numbers in dim color)

### REQ-5: Section-Based Output and Copy

**User Story:** As a network engineer, I want to view and copy individual config sections or the full config, so that I can paste only the parts I need into my terminal session.

#### Acceptance Criteria

1. WHEN the config preview is displayed THEN the system SHALL show section tabs or an accordion allowing the user to view individual sections
2. WHEN the user clicks a section tab THEN the system SHALL display only that section's generated config
3. WHEN the user clicks "Copy" on a section THEN the system SHALL copy that section's generated config (with variables substituted) to the clipboard and show a brief confirmation
4. WHEN the user clicks "Copy All" THEN the system SHALL copy the full generated config (all sections concatenated in order) to the clipboard
5. WHEN the user views the "All Sections" tab THEN the system SHALL display section dividers between sections matching the original divider format from the template
6. WHEN copying config text THEN the system SHALL copy plain text only (no HTML formatting, no line numbers)

### REQ-6: Interface Builder

**User Story:** As a network engineer, I want a visual interface builder that generates port range configuration blocks, so that I don't have to manually write repetitive interface configs for every switch.

#### Acceptance Criteria

1. WHEN a template section contains an `$accessportrange` variable (or similar interface range variable) THEN the system SHALL offer an "Interface Builder" toggle as an alternative to the text input
2. WHEN the user opens the Interface Builder THEN the system SHALL display a port count selector and a template selector (access port, trunk port, shutdown/unused)
3. WHEN the user selects a port count and template THEN the system SHALL generate the appropriate `int range` configuration block
4. WHEN the user configures the Interface Builder THEN the system SHALL insert the generated interface range value into the `$accessportrange` variable
5. WHEN the user changes the port count or template THEN the system SHALL regenerate the interface block and update the preview in real-time

### REQ-7: Multi-Vendor Config Format Support

**User Story:** As a network engineer managing both Cisco switches and cellular modems, I want to create templates in different config formats (CLI, XML, JSON, YAML), so that Forge supports my entire device fleet.

#### Acceptance Criteria

1. WHEN the user creates a new Vendor THEN the system SHALL allow selecting a config format: CLI (Cisco-style), XML, JSON, or YAML
2. WHEN the config format is CLI THEN the system SHALL apply Cisco IOS syntax highlighting in the preview
3. WHEN the config format is XML THEN the system SHALL apply XML syntax highlighting in the preview
4. WHEN the config format is JSON THEN the system SHALL apply JSON syntax highlighting in the preview
5. WHEN the config format is YAML THEN the system SHALL apply YAML syntax highlighting in the preview
6. WHEN detecting variables in non-CLI formats THEN the system SHALL still detect `$variable` and `${variable}` patterns regardless of the surrounding format
7. WHEN auto-detecting section dividers in XML configs THEN the system SHALL recognize XML comment patterns (`<!-- SECTION NAME -->`)
8. WHEN auto-detecting section dividers in JSON/YAML THEN the system SHALL recognize comment-style patterns appropriate to the format (JSON: not applicable — single section only; YAML: `# SECTION NAME`)

### REQ-8: Encrypted Export/Import (.stvault)

**User Story:** As a network engineer, I want to export my template library (or individual items) as encrypted `.stvault` files, so that I can share them with my team via a network share without exposing private network data.

#### Acceptance Criteria

1. WHEN the user selects "Export" on any navigation node (View, Vendor, Model, or Variant) THEN the system SHALL prompt for an encryption password
2. WHEN the user confirms the password THEN the system SHALL encrypt the selected item(s) and all children using AES-256-GCM with PBKDF2 key derivation and download a `.stvault` file
3. WHEN the user selects "Export All" from the top-level menu THEN the system SHALL export the entire library (all Views, Vendors, Models, Variants) as a single encrypted `.stvault` file
4. WHEN the user selects "Import" THEN the system SHALL prompt for a `.stvault` file and decryption password
5. WHEN the password is correct THEN the system SHALL decrypt the archive and merge the imported items into the existing library (add new items, prompt on conflicts)
6. IF the password is incorrect THEN the system SHALL display a clear error message and not corrupt existing data
7. WHEN importing items that conflict with existing items (same name path) THEN the system SHALL prompt the user to overwrite, skip, or rename
8. WHEN the `.stvault` file is examined outside the app THEN it SHALL contain only encrypted binary data — no plaintext network data visible

### REQ-9: Browser Storage

**User Story:** As a network engineer, I want all my templates and settings stored in my browser, so that I don't need accounts, servers, or network connectivity to use Forge.

#### Acceptance Criteria

1. WHEN the user creates, edits, or deletes any data THEN the system SHALL immediately persist to localStorage
2. WHEN the app loads THEN the system SHALL restore the complete state from localStorage (navigation tree, all models, all variables, last-selected variant)
3. IF localStorage is empty (first visit or cleared) THEN the system SHALL display an empty state with guidance: "The forge is cold. Add a template to light it." and offer Import or Create New options
4. WHEN the user opens browser DevTools THEN localStorage keys SHALL be namespaced with a `forge_` prefix to avoid collisions
5. IF localStorage approaches its size limit THEN the system SHALL warn the user and suggest exporting older/unused templates

### REQ-10: Seed Model

**User Story:** As a new user, I want the app to ship with a sample Cisco IOS switch template, so that I can see how templates work and have a starting point for customization.

#### Acceptance Criteria

1. WHEN the app detects an empty library (no Views in localStorage) THEN the system SHALL offer to load a seed template
2. WHEN the user accepts the seed template THEN the system SHALL create a "Sample" View > "Cisco" Vendor > "IOS Switch" Model > "Generic Template" Variant populated from the bundled `cisco-ios-generic.txt` config
3. WHEN the seed template is loaded THEN all auto-detected variables and sections SHALL be properly parsed and ready for use
4. WHEN the user modifies the seed template THEN the system SHALL treat it as a normal user-created template (fully editable, exportable, deletable)

### REQ-11: Dark Theme / Branding

**User Story:** As a user, I want the app to have a professional, dark-themed interface matching the Forge branding guide, so that it feels like a purpose-built engineering tool.

#### Acceptance Criteria

1. WHEN the app renders THEN it SHALL use the Forge color palette: Obsidian background (#0F172A), Charcoal surfaces (#1E293B), Forge Amber accent (#F59E0B)
2. WHEN displaying UI text THEN the system SHALL use Inter for all non-code text
3. WHEN displaying config/template content THEN the system SHALL use JetBrains Mono
4. WHEN displaying icons THEN the system SHALL use Lucide React icons
5. WHEN the config output area is displayed THEN it SHALL have a terminal-style darker background (#0A0F1A) with monospace font and line numbers

## Open Questions

> **GATE:** All blocking questions must be resolved before this document can be approved.

### Blocking (must resolve before approval)

- [x] ~~Tech stack choice~~ — React + Vite + Tailwind CSS (confirmed in chat)
- [x] ~~Encryption model~~ — Password-based AES-256-GCM with PBKDF2 (confirmed in chat)
- [x] ~~Multi-format meaning~~ — Native format per vendor (CLI, XML, JSON, YAML) (confirmed in chat)
- [x] ~~Section model~~ — Dynamic, user-defined via divider patterns in pasted config (confirmed in chat)

### Non-blocking (can defer to Design)

- [ ] Syntax highlighting library choice — Prism.js vs CodeMirror vs Monaco. Needs evaluation for bundle size, Cisco IOS support, and config editing needs.
- [ ] Interface builder scope for v1 — Full visual faceplate vs simplified port-count selector. Lean toward simplified for v1.
- [ ] localStorage schema versioning — how to handle data model changes across app updates

### Resolved

- [x] ~~Navigation structure~~ — View > Vendor > Model > Variant (Semaphore-inspired, confirmed in chat)
- [x] ~~Variable syntax~~ — `$variable` and `${variable}` DNAC-compatible patterns
- [x] ~~Hosting~~ — Portainer Docker container (Nginx), Cloudflare tunnel for remote access

## Non-Functional Requirements

### Code Architecture and Modularity
- **Single Responsibility Principle**: Each React component handles one concern (e.g., VariableForm, ConfigPreview, SectionTabs)
- **Modular Design**: Separate layers for storage, template engine, encryption, and UI
- **Clean Interfaces**: Context providers for shared state; hooks for reusable logic
- **Tree-shakeable**: Only import what's used from libraries (Lucide icons, etc.)

### Performance
- Config generation (variable substitution) SHALL complete in under 50ms for templates up to 500 lines
- Live preview updates SHALL render within 200ms of user input (debounced)
- App initial load SHALL complete in under 2 seconds on a standard connection
- `.stvault` encrypt/decrypt SHALL complete in under 3 seconds for libraries up to 5MB

### Security
- All `.stvault` exports SHALL use AES-256-GCM with PBKDF2 key derivation (100,000+ iterations)
- No plaintext sensitive data SHALL ever be written to disk or transmitted over the network
- The app SHALL make zero external API calls — fully self-contained
- No analytics, telemetry, or tracking of any kind
- The app SHALL be safe to host on a public URL with no authentication

### Reliability
- All data changes SHALL be persisted to localStorage immediately (no deferred writes)
- The app SHALL handle corrupted localStorage gracefully (offer to reset rather than crash)
- `.stvault` import SHALL validate data integrity before overwriting existing data

### Usability
- A user familiar with DNAC CLI templates SHALL be able to create their first Forge template in under 2 minutes
- The "paste config → save → generate" workflow SHALL require no more than 3 clicks after the paste
- Every copyable config section SHALL have a one-click copy button with visual feedback
- The interface SHALL be keyboard-navigable for power users
