# Tasks Document

## References

- **Issue:** FORGE-1
- **Spec Path:** `.spec-workflow/specs/FORGE-1-v1-mvp-config-generator/`

## File Touch Map

| File / Directory | Action | Scope |
|-----------------|--------|-------|
| `package.json` | CREATE | Project setup, dependencies |
| `vite.config.ts` | CREATE | Vite configuration |
| `tailwind.config.js` | CREATE | Tailwind with Forge design tokens |
| `postcss.config.js` | CREATE | PostCSS for Tailwind |
| `tsconfig.json` | CREATE | TypeScript configuration |
| `index.html` | CREATE | App entry point |
| `src/main.tsx` | CREATE | React entry point |
| `src/App.tsx` | CREATE | App shell with routing |
| `src/index.css` | CREATE | Global styles, CSS custom properties |
| `src/lib/template-parser.ts` | CREATE | Variable + section detection engine |
| `src/lib/substitution-engine.ts` | CREATE | Variable substitution engine |
| `src/lib/vault-engine.ts` | CREATE | AES-256-GCM encryption/decryption |
| `src/lib/syntax-highlighter.ts` | CREATE | Cisco CLI + XML/JSON/YAML highlighting |
| `src/lib/storage-service.ts` | CREATE | localStorage abstraction |
| `src/store/index.ts` | CREATE | Zustand store with persistence |
| `src/types/index.ts` | CREATE | TypeScript interfaces |
| `src/components/Sidebar.tsx` | CREATE | Tree navigation |
| `src/components/TreeNode.tsx` | CREATE | Recursive tree item |
| `src/components/CreateNodeModal.tsx` | CREATE | CRUD modal for tree nodes |
| `src/components/TemplateEditor.tsx` | CREATE | Config paste + edit |
| `src/components/VariableDetectionPanel.tsx` | CREATE | Auto-detected variable list |
| `src/components/ConfigGenerator.tsx` | CREATE | Main workspace |
| `src/components/VariableForm.tsx` | CREATE | Auto-generated form |
| `src/components/VariableInput.tsx` | CREATE | Typed input (text/IP/dropdown) |
| `src/components/ConfigPreview.tsx` | CREATE | Syntax-highlighted output |
| `src/components/SectionTabs.tsx` | CREATE | Section tab bar |
| `src/components/CopyButton.tsx` | CREATE | Copy with toast |
| `src/components/InterfaceBuilder.tsx` | CREATE | Port count selector |
| `src/components/VaultModal.tsx` | CREATE | Import/export UI |
| `src/components/WelcomeScreen.tsx` | CREATE | Empty state |
| `src/data/seed-cisco-ios.ts` | CREATE | Bundled seed template |
| `src/__tests__/template-parser.test.ts` | CREATE | Parser unit tests |
| `src/__tests__/substitution-engine.test.ts` | CREATE | Substitution unit tests |
| `src/__tests__/vault-engine.test.ts` | CREATE | Encryption unit tests |
| `Dockerfile` | CREATE | Nginx static container |
| `.dockerignore` | CREATE | Docker build exclusions |

## UI Prototype Gate

> **BLOCKING:** Tasks 0.1–0.3 MUST be completed and approved before ANY task tagged `ui:true` begins.

- [x] 0.1 Create visual mockup
  - Use the `frontend-design` skill to create mockups of the Forge app layout
  - Reference the branding guide at `/Users/lbruton/Devops/Forge/BRANDING.md` and showcase at `/Users/lbruton/Devops/Forge/forge-brand-showcase.html`
  - Cover states: sidebar with tree nav, config generator workspace, template editor, welcome/empty state, vault import/export modal
  - Dark theme only (per branding guide)
  - _Requirements: REQ-1, REQ-4, REQ-5, REQ-11_
  - _Prompt: Role: UI/UX Designer | Task: Create visual mockups for Forge using the frontend-design skill. Reference the branding guide at /Users/lbruton/Devops/Forge/BRANDING.md for all design tokens (colors, typography, spacing, component styles). The app has a sidebar (View>Vendor>Model>Variant tree) + main content area (config generator with variable form + config preview). Cover: sidebar navigation, config generator workspace, template editor/paste view, welcome screen ("The forge is cold"), and vault import/export modal. Dark theme only. | Restrictions: Do NOT write production React code. Output is a visual mockup only. Follow the branding guide exactly — slate backgrounds, amber accent, Inter for UI, JetBrains Mono for config. | Success: Mockups cover all major screens and states, branding guide is accurately applied._

- [x] 0.2 Build interactive prototype (Playground)
  - Use the `playground` skill to create a single-file HTML prototype
  - Must demonstrate: sidebar tree nav, config preview with syntax highlighting, variable form, section tabs, copy buttons
  - Use the Forge CSS custom properties from the branding guide
  - Save to `.spec-workflow/specs/FORGE-1-v1-mvp-config-generator/artifacts/playground.html`
  - _Requirements: REQ-1, REQ-4, REQ-5, REQ-11_
  - _Prompt: Role: Frontend Prototyper | Task: Build an interactive single-file HTML playground using the playground skill. Source visual design from the approved mockup (Task 0.1) and the branding guide at /Users/lbruton/Devops/Forge/BRANDING.md. Demonstrate: sidebar tree navigation (View>Vendor>Model>Variant), config generator workspace with variable form inputs, config preview with Cisco syntax highlighting and line numbers, section tabs with per-section copy buttons, and the terminal-style output area. Use the Forge CSS custom properties. Include realistic sample data from the seed config. Save to .spec-workflow/specs/FORGE-1-v1-mvp-config-generator/artifacts/playground.html | Restrictions: Single-file HTML only. Not production code. Must match branding guide exactly. | Success: User can interact with sidebar, fill variables, see live preview, switch section tabs, and click copy buttons._

- [x] 0.3 Visual approval checkpoint
  - Present prototype to user for explicit approval
  - Update design.md `Prototype Artifacts` section with playground file path
  - _Requirements: REQ-1, REQ-4, REQ-5, REQ-11_
  - _Prompt: Role: Project Coordinator | Task: Present the interactive prototype (Task 0.2) to the user. Ask explicitly — does this look and feel right? Collect approval or revision feedback. If approved, update the UI Impact Assessment section in design.md with the playground file path. | Restrictions: Do NOT proceed to any ui:true implementation task until the user explicitly approves the prototype. | Success: User has approved the visual design. design.md Prototype Artifacts section is populated._

---

## Implementation Tasks

- [x] 1. Project scaffolding — Vite + React + Tailwind + TypeScript
  - Initialize Vite React-TS project
  - Configure Tailwind with Forge design tokens from branding guide
  - Set up CSS custom properties, Google Fonts (Inter, JetBrains Mono), Lucide React
  - Configure ESLint, TypeScript strict mode
  - Create `src/types/index.ts` with all TypeScript interfaces from design doc
  - **Recommended Agent:** Claude
  - _Leverage: /Users/lbruton/Devops/Forge/BRANDING.md (design tokens, Tailwind config snippet), .spec-workflow/specs/FORGE-1-v1-mvp-config-generator/design.md (data models)_
  - _Requirements: REQ-11_
  - _Prompt: Implement the task for spec FORGE-1-v1-mvp-config-generator, first run spec-workflow-guide to get the workflow guide then implement the task. Role: Full-stack Developer specializing in React + Vite + Tailwind setup | Task: Initialize a Vite React-TS project in the repo root. Configure Tailwind CSS with the Forge design tokens from /Users/lbruton/Devops/Forge/BRANDING.md — use the Tailwind config snippet directly. Set up CSS custom properties in src/index.css matching the branding guide's :root block. Add Google Fonts (Inter, JetBrains Mono) to index.html. Install lucide-react. Configure ESLint and TypeScript strict mode. Create src/types/index.ts with ALL TypeScript interfaces from design.md (ForgeTree, View, Vendor, Model, Variant, Template, TemplateSection, VariableDefinition, VariableValues, Preferences, ConfigFormat, VariableType). | Restrictions: Do not create any UI components yet. This is pure scaffolding. All dependencies must be MIT/open source. | Success: `npm run dev` starts successfully, Tailwind classes render with Forge design tokens, TypeScript compiles cleanly, all interfaces defined. Mark task [-] in tasks.md before starting, log implementation with log-implementation tool when done, then mark [x]._

- [x] 2. Storage service + Zustand store
  - Create `src/lib/storage-service.ts` — localStorage CRUD with `forge_` namespace, corruption recovery, quota monitoring
  - Create `src/store/index.ts` — Zustand store with slices for tree, selected variant, preferences; localStorage persistence middleware
  - **Recommended Agent:** Claude
  - _Leverage: design.md (data models, storage strategy)_
  - _Requirements: REQ-9_
  - _Prompt: Implement the task for spec FORGE-1-v1-mvp-config-generator, first run spec-workflow-guide to get the workflow guide then implement the task. Role: React State Management Developer | Task: Create src/lib/storage-service.ts — a localStorage abstraction with: forge_ key prefix, JSON serialize/deserialize with try/catch corruption recovery, quota monitoring (warn at 80% of 5MB), getItem/setItem/removeItem/getAllKeys methods. Then create src/store/index.ts — a Zustand store with slices: tree (ForgeTree CRUD), templates (Template CRUD by ID), selectedVariantId, variableValues (per-variant), preferences (sidebar state, expanded nodes). Add localStorage persistence middleware that auto-saves on every state change using the StorageService. Include actions: addView, addVendor, addModel, addVariant, deleteNode (with cascade), updateNode, setSelectedVariant, setVariableValue, loadFromStorage, resetAll. | Restrictions: Use zustand with its persist middleware. All localStorage access through StorageService only. Handle missing/corrupt data gracefully — never crash. | Success: Store persists across page reloads, CRUD operations work for all node types, cascade delete works, corruption recovery works. Mark task [-] in tasks.md before starting, log implementation with log-implementation tool when done, then mark [x]._

- [x] 3. Template parser engine
  - Create `src/lib/template-parser.ts` — variable detection, section splitting, type inference
  - Create `src/__tests__/template-parser.test.ts` — unit tests with the seed config
  - **Recommended Agent:** Claude
  - _Leverage: design.md (parser specification), seed-models/cisco-ios-generic.txt (test fixture)_
  - _Requirements: REQ-2, REQ-3, REQ-7_
  - _Prompt: Implement the task for spec FORGE-1-v1-mvp-config-generator, first run spec-workflow-guide to get the workflow guide then implement the task. Role: Parser Developer | Task: Create src/lib/template-parser.ts with two main functions. (1) parseVariables(text): scan for $variable and dollar-brace variable syntax patterns using a regex that matches both $varname and dollar-brace-varname patterns where variable names start with a letter or underscore. CRITICAL: must reject Cisco type-9 password literals like $9$... (variable names must start with letter/underscore). Deduplicate results. Infer types: names containing "ip"/"address"/"gateway" → ip, names containing "range"/"port" → string with hint. (2) parseSections(text, format): detect section boundaries from divider comment patterns. For CLI: lines with repeated hash/bang characters like "!########## SECTION ##########" or "#### SECTION ####". For XML: comment tags wrapping SECTION NAME. For YAML: # === SECTION === patterns. Extract section name from divider text. If no dividers found, return single "Full Config" section. Also create src/__tests__/template-parser.test.ts testing against the actual seed config at seed-models/cisco-ios-generic.txt — verify it detects all 8 variables ($hostname, $vlan_95_ip_address, $vlan_25_ip_address, $vlan_125_ip_address, $snmp_location, $default_gateway, $accessportrange, $vtp_domain_name) and splits into the correct sections. Test that $9$... passwords are NOT detected as variables. | Restrictions: Pure functions, no side effects, no UI dependencies. Must handle edge cases: empty input, no variables, no sections, mixed divider styles. | Success: Parser correctly detects all 8 variables from seed config, splits into correct sections, rejects password literals, all tests pass. Mark task [-] in tasks.md before starting, log implementation with log-implementation tool when done, then mark [x]._

- [x] 4. Substitution engine + syntax highlighter
  - Create `src/lib/substitution-engine.ts` — variable replacement across sections
  - Create `src/lib/syntax-highlighter.ts` — Cisco CLI, XML, JSON, YAML token highlighting
  - Create `src/__tests__/substitution-engine.test.ts`
  - **Recommended Agent:** Claude
  - _Leverage: design.md (engine specs, highlighter tokens)_
  - _Requirements: REQ-4, REQ-7_
  - _Prompt: Implement the task for spec FORGE-1-v1-mvp-config-generator, first run spec-workflow-guide to get the workflow guide then implement the task. Role: Engine Developer | Task: Create src/lib/substitution-engine.ts with function generateConfig(template, values) that: (1) iterates each section, (2) replaces all $variable and dollar-brace variable syntax occurrences with values from the Record of string to string, (3) leaves unsubstituted placeholders as-is for preview highlighting, (4) reconstructs section dividers in output, (5) returns an object with fullConfig (string) and sections array (each with name, content, divider). Then create src/lib/syntax-highlighter.ts that tokenizes config text into spans for rendering. Cisco CLI tokens: keywords (hostname, interface, ip address, switchport, vlan, access-list, permit, deny, shutdown, no, service, aaa, radius, tacacs, dot1x, snmp-server, logging, ntp, banner, line, crypto, spanning-tree), IP addresses (IPv4 dotted quad pattern), comments (lines starting with !), interfaces (Gi, Te, Fa, Vlan, Lo prefixes), unsubstituted variables in amber. Also support XML (tags, attributes, comments), JSON (keys, strings, numbers), YAML (keys, values, comments) highlighting. Export a function highlight(text, format) → array of token objects (text, className). Create unit tests for the substitution engine. | Restrictions: Pure functions. Highlighter returns data, not JSX — the component layer renders. Keep token rules simple — this is config preview, not an IDE. | Success: Substitution works across sections with shared variables, syntax highlighting produces correct token classes for all 4 formats, tests pass. Mark task [-] in tasks.md before starting, log implementation with log-implementation tool when done, then mark [x]._

- [x] 5. Vault engine (.stvault encryption)
  - Create `src/lib/vault-engine.ts` — AES-256-GCM encrypt/decrypt with PBKDF2
  - Create `src/__tests__/vault-engine.test.ts`
  - **Recommended Agent:** Claude
  - _Leverage: design.md (vault engine specification)_
  - _Requirements: REQ-8_
  - _Prompt: Implement the task for spec FORGE-1-v1-mvp-config-generator, first run spec-workflow-guide to get the workflow guide then implement the task. Role: Security Engineer | Task: Create src/lib/vault-engine.ts using the Web Crypto API (NOT node-forge — browser-native only). Export: (1) async encryptVault(data: object, password: string): Promise returning Blob — serialize to JSON, generate random 96-bit IV and 128-bit salt, derive 256-bit key via PBKDF2 (SHA-256, 100000 iterations), encrypt with AES-256-GCM, package as JSON envelope with fields: version (1), iv (base64), salt (base64), iterations (100000), data (base64), return as .stvault Blob. (2) async decryptVault(file: File, password: string): Promise returning object — read file, parse JSON envelope, derive key from password+salt, decrypt, parse JSON, validate structure, return data. (3) File extension: .stvault. Create unit tests: round-trip encrypt/decrypt, wrong password throws, malformed file throws, large payload handling. | Restrictions: Web Crypto API only — no third-party crypto libraries. Must work in all modern browsers. Never expose plaintext outside the function scope. | Success: Round-trip encryption works, wrong password is cleanly rejected, malformed files are caught, all tests pass. Mark task [-] in tasks.md before starting, log implementation with log-implementation tool when done, then mark [x]._

- [x] 6. App shell + sidebar navigation (ui:true)
  - Create `src/App.tsx` — layout shell with sidebar + main content routing
  - Create `src/components/Sidebar.tsx`, `TreeNode.tsx`, `CreateNodeModal.tsx`
  - Wire to Zustand store for tree data
  - **Recommended Agent:** Claude
  - _Leverage: approved prototype (artifacts/playground.html), design.md (component specs)_
  - _Requirements: REQ-1, REQ-11_
  - _Prompt: Implement the task for spec FORGE-1-v1-mvp-config-generator, first run spec-workflow-guide to get the workflow guide then implement the task. Role: React Frontend Developer | Task: Create the App shell and sidebar navigation. Source your visual design from the approved prototype at .spec-workflow/specs/FORGE-1-v1-mvp-config-generator/artifacts/playground.html — do NOT reinvent the layout. App.tsx: sidebar (240px, Charcoal bg) + main content area with hash routing. Sidebar.tsx: renders the ForgeTree as a collapsible tree — View > Vendor > Model > Variant. TreeNode.tsx: recursive tree item with expand/collapse, click to select (amber left border on active), right-click context menu. CreateNodeModal.jsx: modal form for creating Views (name), Vendors (name + config format dropdown), Models (name + description), Variants (name → opens template editor). Wire all CRUD to the Zustand store actions. Use Lucide icons: FolderOpen for Views, Server for Vendors, Cpu for Models, FileCode2 for Variants, Plus for add buttons, Trash2 for delete. Style with Tailwind + Forge design tokens. | Restrictions: Must match the approved prototype layout. Dark theme only. Responsive — sidebar collapses below 768px. | Success: Tree navigation renders, CRUD creates/edits/deletes nodes at all levels, selection updates the store, sidebar matches branding guide. Mark task [-] in tasks.md before starting, log implementation with log-implementation tool when done, then mark [x]._

- [x] 7. Template editor + paste flow (ui:true)
  - Create `src/components/TemplateEditor.tsx`, `VariableDetectionPanel.tsx`
  - Paste textarea → auto-detect variables + sections → save as Variant template
  - **Recommended Agent:** Claude
  - _Leverage: approved prototype, src/lib/template-parser.ts, src/store/index.ts_
  - _Requirements: REQ-2, REQ-3_
  - _Prompt: Implement the task for spec FORGE-1-v1-mvp-config-generator, first run spec-workflow-guide to get the workflow guide then implement the task. Role: React Frontend Developer | Task: Create the template editor for the paste-and-save flow. Source visual design from the approved prototype. TemplateEditor.tsx: large monospace textarea (JetBrains Mono, terminal bg) for pasting config text. On paste/input, call parseVariables() and parseSections() from template-parser.ts and display results. Include guidance text explaining supported divider formats. VariableDetectionPanel.tsx: shows detected variables in a list — each with editable fields (label, type dropdown, default value, required toggle, description). Auto-suggests types based on parser inference. Shows which section each variable first appears in. Save button creates a Template in the store and links it to the current Variant. Also support editing existing templates — re-detect variables on text change, prompt to add/remove orphaned definitions. | Restrictions: Must match prototype layout. Must use the template-parser.ts engine — don't duplicate detection logic. | Success: User can paste the seed config, see all 8 variables auto-detected with correct type suggestions, see section boundaries, save the template, and edit it later. Mark task [-] in tasks.md before starting, log implementation with log-implementation tool when done, then mark [x]._

- [x] 8. Config generator + preview (ui:true)
  - Create `src/components/ConfigGenerator.tsx`, `VariableForm.tsx`, `VariableInput.tsx`, `ConfigPreview.tsx`, `SectionTabs.tsx`, `CopyButton.tsx`
  - Wire variable inputs to substitution engine → live preview
  - **Recommended Agent:** Claude
  - _Leverage: approved prototype, src/lib/substitution-engine.ts, src/lib/syntax-highlighter.ts_
  - _Requirements: REQ-4, REQ-5_
  - _Prompt: Implement the task for spec FORGE-1-v1-mvp-config-generator, first run spec-workflow-guide to get the workflow guide then implement the task. Role: React Frontend Developer | Task: Build the main config generator workspace. Source visual design from the approved prototype. ConfigGenerator.tsx: layout with VariableForm on left/top and ConfigPreview on right/bottom. VariableForm.tsx: auto-generates input fields from the selected variant's variable definitions. VariableInput.tsx: renders typed inputs — text for string, IP-validated input for ip type (regex validation, error state on invalid), select/combobox for dropdown, text with hint for interface range. All inputs debounce at 200ms and update the store's variableValues. ConfigPreview.tsx: terminal-style display (#0A0F1A bg, JetBrains Mono, line numbers in #64748B). Calls substitutionEngine to generate output, then syntaxHighlighter to tokenize and render with colored spans. Unsubstituted variables highlighted in amber. SectionTabs.tsx: tab bar for each section + "All Sections" tab. CopyButton.tsx: copies plain text (no HTML, no line numbers) to clipboard via navigator.clipboard.writeText(), shows brief toast confirmation. Per-section and full-config copy. | Restrictions: Must match prototype. Live preview must update within 200ms. Copy must be plain text only. | Success: User selects a variant, fills variables, sees live preview update, can switch sections, copy individual sections or full config. Mark task [-] in tasks.md before starting, log implementation with log-implementation tool when done, then mark [x]._

- [x] 9. Interface builder
  - Create `src/components/InterfaceBuilder.tsx`
  - Port count selector + template chooser → generates interface range config
  - **Recommended Agent:** Claude
  - _Leverage: approved prototype, seed-models/cisco-ios-generic.txt (access port template)_
  - _Requirements: REQ-6_
  - _Prompt: Implement the task for spec FORGE-1-v1-mvp-config-generator, first run spec-workflow-guide to get the workflow guide then implement the task. Role: React Developer with network engineering knowledge | Task: Create src/components/InterfaceBuilder.tsx — a visual interface builder that replaces the text input for interface range variables (like $accessportrange). When a variable's name matches common interface range patterns (accessportrange, port_range, etc.), show a toggle to switch between text input and Interface Builder mode. The builder UI: port count number input, interface type selector (GigabitEthernet, TenGigabitEthernet, FastEthernet), starting port number, and template selector (access port, trunk port, shutdown/unused). Generate the appropriate int range command (e.g., "Gi1/0/1-24"). Preview the generated range in real-time. Insert the generated value into the variable, which flows through the normal substitution engine. | Restrictions: Keep it simple for v1 — port count + template is sufficient. No visual faceplate. | Success: Interface builder generates correct Cisco int range syntax, updates the config preview in real-time. Mark task [-] in tasks.md before starting, log implementation with log-implementation tool when done, then mark [x]._

- [x] 10. Vault import/export UI (ui:true)
  - Create `src/components/VaultModal.tsx` with export + import flows
  - Wire to vault-engine.ts for encryption/decryption
  - **Recommended Agent:** Claude
  - _Leverage: approved prototype, src/lib/vault-engine.ts, src/store/index.ts_
  - _Requirements: REQ-8_
  - _Prompt: Implement the task for spec FORGE-1-v1-mvp-config-generator, first run spec-workflow-guide to get the workflow guide then implement the task. Role: React Frontend Developer | Task: Create src/components/VaultModal.tsx — a modal with two tabs: Export and Import. Export tab: scope selector (shows which node is selected — View, Vendor, Model, or Variant; plus "Export All" option), password input with confirmation, "Export" button. On export: gather selected tree nodes + templates from store, call encryptVault(), trigger file download as .stvault. Import tab: file picker (.stvault only), password input, "Import" button. On import: call decryptVault(), show preview of contents, handle conflicts (items with same name-path) — offer overwrite/skip/rename for each conflict. Merge imported data into the store. Error handling: wrong password shows clear error, malformed file shows clear error, no data corruption on failure. Add Export option to sidebar context menu (NodeContextMenu) and a top-level Import/Export button in the app header. | Restrictions: Must match prototype styling. Never show plaintext during import preview — show structure (names/counts) only. | Success: Export creates valid .stvault file, import restores it correctly, wrong password is handled gracefully, conflicts are resolved. Mark task [-] in tasks.md before starting, log implementation with log-implementation tool when done, then mark [x]._

- [x] 11. Welcome screen + seed template
  - Create `src/components/WelcomeScreen.tsx`
  - Create `src/data/seed-cisco-ios.ts` — bundled seed config from seed-models/
  - **Recommended Agent:** Claude
  - _Leverage: seed-models/cisco-ios-generic.txt, src/lib/template-parser.ts_
  - _Requirements: REQ-9, REQ-10_
  - _Prompt: Implement the task for spec FORGE-1-v1-mvp-config-generator, first run spec-workflow-guide to get the workflow guide then implement the task. Role: React Frontend Developer | Task: Create src/components/WelcomeScreen.tsx — the empty state shown when no Views exist in the store. Display the Forge logo (SVG from /Users/lbruton/Devops/Forge/forge-logo.svg), "The forge is cold. Add a template to light it." message, and two CTA buttons: "Load Sample Template" and "Import .stvault". Style per branding guide. Create src/data/seed-cisco-ios.ts that exports the raw text content of seed-models/cisco-ios-generic.txt as a string constant, plus metadata object with viewName "Sample", vendorName "Cisco", vendorFormat "cli", modelName "IOS Switch", variantName "Generic Template". When "Load Sample Template" is clicked: create the full tree path (Sample > Cisco > IOS Switch > Generic Template), parse the seed config with template-parser, save to store, select the new variant. | Restrictions: Seed data must be bundled in the JS bundle — not fetched at runtime. Logo SVG should be inlined or imported. | Success: Fresh app shows welcome screen, clicking "Load Sample Template" creates the full tree and opens the generator with 8 variables detected. Mark task [-] in tasks.md before starting, log implementation with log-implementation tool when done, then mark [x]._

- [x] 12. Docker container + deployment config
  - Create `Dockerfile` (multi-stage: build + Nginx serve)
  - Create `.dockerignore`
  - Create `nginx.conf` for SPA routing
  - **Recommended Agent:** Claude
  - _Leverage: design.md (deployment section)_
  - _Requirements: REQ-11 (deployment)_
  - _Prompt: Implement the task for spec FORGE-1-v1-mvp-config-generator, first run spec-workflow-guide to get the workflow guide then implement the task. Role: DevOps Engineer | Task: Create a multi-stage Dockerfile: stage 1 uses node:20-alpine to npm ci and npm run build; stage 2 uses nginx:alpine to serve the dist/ folder. Create nginx.conf that serves index.html for all routes (SPA hash routing fallback), sets correct MIME types, and adds security headers (X-Frame-Options, X-Content-Type-Options, CSP). Create .dockerignore excluding node_modules, .git, .spec-workflow, seed-models, and dev files. Test that `docker build -t forge .` and `docker run -p 8080:80 forge` serves the app correctly. | Restrictions: Keep the image small — alpine bases, multi-stage build. No secrets or env vars needed — purely static. | Success: Docker image builds, container serves the app on port 80, SPA routing works, security headers present. Mark task [-] in tasks.md before starting, log implementation with log-implementation tool when done, then mark [x]._

- [x] 13. Integration testing + polish
  - End-to-end flow testing: paste config → save → generate → copy → export → import
  - Fix any integration issues between components
  - Verify all 11 requirements pass acceptance criteria
  - **Recommended Agent:** Claude
  - _Leverage: All src/ files, requirements.md (acceptance criteria)_
  - _Requirements: All_
  - _Prompt: Implement the task for spec FORGE-1-v1-mvp-config-generator, first run spec-workflow-guide to get the workflow guide then implement the task. Role: QA Integration Engineer | Task: Run the full end-to-end flow and verify all acceptance criteria from requirements.md. Flow: (1) Fresh app shows welcome screen, (2) Load seed template creates tree + parsed template, (3) Select variant shows variable form with 8 inputs, (4) Fill variables updates live preview in real-time, (5) Syntax highlighting works for Cisco CLI, (6) Section tabs switch sections, (7) Copy per-section and full-config works, (8) Create a new View/Vendor/Model/Variant manually, (9) Paste the seed config, save template, (10) Export as .stvault with password, (11) Clear localStorage, (12) Import .stvault, verify data restored, (13) Wrong password shows error, (14) Interface builder generates correct ranges, (15) Multi-format highlighting works (create a test XML/JSON/YAML template). Fix any integration bugs found. Ensure Tailwind styles match branding guide throughout. | Restrictions: Test in Chrome and Firefox at minimum. Do not skip any acceptance criteria. | Success: All 12 acceptance criteria from requirements.md pass, no console errors, branding matches throughout. Mark task [-] in tasks.md before starting, log implementation with log-implementation tool when done, then mark [x]._
