# Technology Stack

## Project Type
Static web application — runs entirely in the browser with no backend. Hosted as static files on any web server, Portainer stack (homelab), or static hosting provider.

## Core Technologies

### Primary Language(s)
- **Language**: TBD — options under consideration:
  - **Vanilla JavaScript**: Zero build step, same pattern as StakTrakr. Simple deployment, no toolchain.
  - **React + Vite**: Component-based, Tailwind CSS integration, modern DX. More complex deployment but better for UI-heavy apps.
- **Runtime**: Browser-native (no server-side runtime)

### Key Dependencies/Libraries (Planned)
- **UI Icons**: Lucide (React or vanilla depending on stack choice)
- **Fonts**: Inter (UI), JetBrains Mono (code/config)
- **Encryption**: Web Crypto API (AES-GCM for `.stvault` encryption) or node-forge
- **Syntax Highlighting**: TBD (for config output preview)
- **CSS**: CSS Custom Properties defined in branding guide; Tailwind if React stack chosen

### Application Architecture
Template-driven config generator:

- **Models**: Device definitions with metadata and template sections
- **Templates**: Text blocks with `$variable` / `${variable}` placeholders, tagged by section type
- **Variables**: Auto-detected from template text or manually defined; typed (string, IP, integer, dropdown)
- **Generator**: Variable substitution engine producing final config output
- **Vault**: AES encryption/decryption for `.stvault` export/import

### Data Storage
- **Primary storage**: `localStorage` for all models, templates, variables, and preferences
- **Export format**: `.stvault` — encrypted archive containing all models and templates
- **No server storage**: All data lives in the browser; sharing is via encrypted file exchange

### External Integrations
- None in v1 — fully self-contained, no API calls

## Development Environment

### Build & Development Tools
- TBD based on stack choice:
  - **Vanilla JS**: No build step. Open `index.html` in browser.
  - **React + Vite**: `npm run dev` for development, `npm run build` for production static output.

### Code Quality Tools
- **Linting**: ESLint
- **Code Quality**: Codacy (GitHub integration)
- **Testing**: TBD

### Version Control & Collaboration
- **VCS**: Git (GitHub)
- **Branching Strategy**: `main` (single branch). Feature work on worktree branches that PR into `main`.
- **Code Review**: Codacy quality gates on PRs

## Deployment & Distribution
- **Target Platform**: Any modern browser (Chrome, Firefox, Safari, Edge)
- **Distribution Method**: Static files served from Portainer (homelab) initially; publicly hostable
- **Docker**: Nginx or Caddy container serving static files
- **No authentication**: App is public-safe due to encrypted storage model

## Technical Requirements & Constraints

### Performance Requirements
- Instant config generation (template substitution is trivial computation)
- Smooth UI for model libraries up to 50+ device models
- Fast `.stvault` encrypt/decrypt for libraries up to 5MB

### Security & Compliance
- **Encryption**: AES-256-GCM for `.stvault` files (password-based key derivation via PBKDF2)
- **No plaintext export**: Sensitive data (IPs, credentials, TACACS keys) only ever exported encrypted
- **No telemetry**: Zero external calls, no analytics, no tracking
- **CSP-compatible**: Must work behind strict Content Security Policy headers

### Known Constraints
- `localStorage` limit (~5-10MB) bounds total template library size
- No concurrent editing — single-browser assumption
- No real-time sync between team members in v1

## Technical Decisions & Rationale

### Decision Log
1. **Browser-only, no backend**: Keeps deployment trivial (static files), eliminates authentication complexity, and ensures the app can be hosted publicly without risk.
2. **DNAC variable syntax**: `$variable` / `${variable}` chosen for team familiarity — zero learning curve for existing DNAC template authors.
3. **`.stvault` encrypted export**: Enables public hosting and file-based team sharing without exposing private network configuration data.
4. **Section-based templates**: Matches how network engineers think about configs (base, auth, interfaces, ACLs are distinct concerns) and enables selective copy-paste.
