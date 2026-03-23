# Project Structure

## Directory Organization

```
Forge/
├── index.html              # Application entry point
├── CLAUDE.md               # Claude Code project instructions
├── package.json            # Dev dependencies (if React) or metadata
├── .claude/                # Claude Code config
│   └── project.json        # Project metadata (name, tag, issue prefix)
├── .spec-workflow/         # Spec workflow plugin
│   ├── steering/           # Product, tech, structure steering docs
│   ├── specs/              # Active specifications
│   ├── approvals/          # Spec approval snapshots
│   ├── templates/          # Spec templates
│   └── archive/            # Completed specs
├── .github/                # GitHub Actions, Copilot instructions
└── src/                    # Application source (structure TBD based on stack)
```

> **Note**: Detailed source structure will be defined once the technology stack is chosen (vanilla JS vs React). This document will be updated at that time.

## Naming Conventions

### Files
- **Source files**: `kebab-case` (e.g., `model-library.js`, `config-generator.js`)
- **Components** (if React): `PascalCase` (e.g., `ModelEditor.jsx`, `ConfigPreview.jsx`)
- **CSS/styles**: `kebab-case` (e.g., `config-output.css`)
- **Tests**: `*.test.js` or `*.spec.js`

### Code
- **Functions/Methods**: `camelCase` (e.g., `generateConfig()`, `parseVariables()`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `SECTION_TYPES`, `VARIABLE_PATTERN`)
- **Variables**: `camelCase` (e.g., `selectedModel`, `templateSections`)
- **DOM IDs**: `kebab-case` (e.g., `config-output`, `model-selector`)
- **CSS classes**: `kebab-case` (e.g., `.config-section`, `.variable-input`)

## Core Data Models

### Device Model
```
{
  id: string,
  name: string,           // e.g., "Cisco IE3300"
  vendor: string,         // e.g., "cisco", "paloalto"
  description: string,
  sections: Section[],
  variables: Variable[],
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Template Section
```
{
  id: string,
  name: string,           // e.g., "Base", "Auth", "VLAN"
  type: string,           // section tag/category
  template: string,       // raw template text with $variables
  order: number           // display/output order
}
```

### Variable
```
{
  name: string,           // e.g., "hostname", "mgmt_ip"
  label: string,          // display label
  type: string,           // "string", "ip", "integer", "dropdown"
  defaultValue: string,
  options: string[],      // for dropdown type
  required: boolean,
  description: string
}
```

## Module Boundaries (Conceptual)

| Layer | Responsibility |
|-------|---------------|
| **Models** | Device model CRUD, storage, import/export |
| **Templates** | Template section management, variable detection |
| **Generator** | Variable substitution, multi-format output |
| **Vault** | AES encryption/decryption for `.stvault` files |
| **UI** | Model library, editor, config preview, variable forms |
| **Storage** | localStorage abstraction, data persistence |

## Documentation Standards
- JSDoc or TSDoc comments on public functions
- Inline comments only where logic is non-obvious
- All architecture and design docs in DocVault (`Projects/Forge/`)
- CLAUDE.md kept concise — points to DocVault for details
