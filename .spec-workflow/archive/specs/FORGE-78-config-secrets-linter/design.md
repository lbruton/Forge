# Design Document

## References

- **Issue:** FORGE-78
- **Spec Path:** `.spec-workflow/specs/FORGE-78-config-secrets-linter/`

## Overview

The Config Secrets Linter adds a detection engine and warning UI to Forge's template editor. It scans Cisco configuration text for exposed secrets (cleartext passwords, reversible Type 7 hashes, SNMP community strings, AAA keys, routing protocol auth, VPN pre-shared keys, etc.) and surfaces findings in a non-intrusive warning banner with click-to-navigate functionality.

The design prioritizes minimal integration surface — one new pure-function module, one new React component, and a small integration patch to the existing `TemplateEditor`. No Zustand store changes. No new timers. Findings are ephemeral (recomputed on each text change).

## Steering Document Alignment

### Technical Standards (tech.md)

- Pure TypeScript module with no external dependencies (Web APIs only)
- React component follows existing Forge component patterns (functional, hooks-based)
- Tailwind CSS v4 with Forge design tokens for all styling

### Project Structure (structure.md)

- Detection engine in `src/lib/` (alongside `template-parser.ts`, `substitution-engine.ts`)
- UI component in `src/components/` (alongside existing editor components)
- Types co-located in the detector module (small, self-contained — not worth a separate types file)
- Tests in `src/__tests__/` (matching existing test organization)

## Code Reuse Analysis

### Existing Components to Leverage

- **`TemplateEditor.tsx` handleTextChange debounce** (line 158-177): The secrets scan hooks into the existing 300ms debounce callback, piggybacking on the parse cycle. Zero new timers.
- **`template-parser.ts` hash sanitization** (line 76-79): Already strips `$9$` patterns. The detector complements this — parser avoids false variable detection, detector flags the secrets themselves.
- **VulnDashboard warning/error banners** (line 300-330): Exact UI pattern to follow — amber `bg-amber-500/10` with `AlertTriangle`, red `bg-red-500/10` with `AlertCircle`, dismiss button.
- **TemplateEditor highlight overlay** (line 526-558): Line-by-line processing with CSS background classes. Same approach for secret-line highlighting.
- **TemplateEditor clean-up toast** (line 266-268): Precedent for transient UI feedback in the editor.

### Integration Points

- **`TemplateEditor.tsx`**: Add `secretFindings` state, call `scanForSecrets()` in debounce, render `SecretsWarningBanner` component, handle scroll-to-line on finding click.
- **`ConfigFormat` type**: Used to gate scanning — only run on `cli` format.

## Architecture

The feature has three layers: detection engine (pure logic), banner component (presentation), and editor integration (glue).

```
TemplateEditor.tsx
  |
  |-- handleTextChange (existing 300ms debounce)
  |     |-- parseVariables()      (existing)
  |     |-- parseSections()       (existing)
  |     +-- scanForSecrets()      (NEW — only when format === 'cli')
  |           |
  |           +-- secrets-detector.ts (pure function module)
  |                 |-- DETECTION_RULES: SecretDetectionRule[]
  |                 +-- scanForSecrets(text, format): SecretFinding[]
  |
  +-- renders <SecretsWarningBanner>  (NEW component)
        |-- findings: SecretFinding[]
        |-- onNavigate: (lineNumber) => void
        +-- onDismiss: () => void
              |
              +-- TemplateEditor scrolls textarea to line
```

### Modular Design Principles

- **Single File Responsibility**: `secrets-detector.ts` handles ONLY detection logic. `SecretsWarningBanner.tsx` handles ONLY banner UI. No cross-concerns.
- **Component Isolation**: Banner receives findings as props — no direct coupling to detection engine or store.
- **Pure Functions**: `scanForSecrets()` is stateless — `(text, format) => findings[]`. Trivially testable.
- **Data-Driven Rules**: Detection rules are an array of objects, not a hard-coded if/else chain. Adding a new rule = adding one object to the array.

## Components and Interfaces

### Component 1: Detection Engine (`src/lib/secrets-detector.ts`)

- **Purpose:** Scan template text for Cisco secret patterns and return structured findings
- **Interfaces:**

```typescript
type SecretSeverity = 'critical' | 'high' | 'low';

interface SecretDetectionRule {
  id: string; // e.g., 'enable-password-cleartext'
  category: string; // e.g., 'Authentication', 'SNMP'
  pattern: RegExp; // compiled regex (created once, reused)
  severity: SecretSeverity; // critical | high | low
  description: string; // human-readable, e.g., "Enable password in cleartext"
}

interface SecretFinding {
  ruleId: string;
  category: string;
  severity: SecretSeverity;
  description: string;
  line: number; // 1-based line number
  lineText: string; // the full line (for display context)
  matchStart: number; // character offset within line
  matchEnd: number; // character offset within line
}

function scanForSecrets(text: string, format: ConfigFormat): SecretFinding[];
```

- **Dependencies:** `ConfigFormat` type from `types/index.ts`
- **Reuses:** Pattern knowledge from `template-parser.ts` hash sanitization

**Rule organization:** Rules grouped by category constant arrays, then flattened into a single `DETECTION_RULES` array. Each rule's regex uses named groups where helpful for clarity.

**Severity assignment logic:**

- Commands with `password 0` or bare `password <value>` (no type prefix) → `critical`
- Commands with `password 7 <hash>` → `high` (Type 7 is trivially reversible)
- Commands with `secret 5`, `secret 8`, `secret 9`, or `$1$`/`$8$`/`$9$` hash patterns → `low`
- SNMP community strings → always `critical` (no encoding option in IOS)
- Rules that can appear with multiple type prefixes will use a single regex with capture groups to determine severity at match time

**Line scanning approach:** Split text by `\n`, iterate lines, test each rule against each line. Return on first rule match per line (a line can only have one secret). This is O(lines \* rules) but with ~30 rules and typical configs of 100-500 lines, this completes in microseconds.

### Component 2: Warning Banner (`src/components/SecretsWarningBanner.tsx`)

- **Purpose:** Display findings summary with navigation to flagged lines
- **Interfaces:**

```typescript
interface SecretsWarningBannerProps {
  findings: SecretFinding[];
  onNavigate: (line: number) => void;
  onDismiss: () => void;
}
```

- **Dependencies:** `lucide-react` (AlertTriangle, AlertCircle, ChevronDown, ChevronUp, X icons)
- **Reuses:** Forge design language banner patterns from `VulnDashboard.tsx`

**Layout:**

```
+-----------------------------------------------------------------------+
| [!] 4 exposed secrets (2 critical, 2 high)            [v] [X]        |
+-----------------------------------------------------------------------+
| When expanded:                                                         |
| Line 12  CRITICAL  snmp-server community — Community string exposed   |
| Line 28  CRITICAL  enable password — Enable password in cleartext     |
| Line 45  HIGH      tacacs-server key — TACACS+ key (Type 7)          |
| Line 61  HIGH      username admin password — User password (Type 7)  |
+-----------------------------------------------------------------------+
```

- **Collapsed state** (default): One-line summary with count + severity breakdown. Chevron to expand. X to dismiss.
- **Expanded state**: Finding list with one row per finding. Each row is clickable — triggers `onNavigate(finding.line)`.
- **Dismissed state**: Banner hidden, but re-appears on next scan if findings remain (not permanently suppressed).
- **Color logic**: If any finding is `critical` → red border/icon. If highest is `high` → amber. If all `low` → slate/muted informational.
- **Severity badges**: Inline colored dots — `bg-red-500` (critical), `bg-amber-500` (high), `bg-slate-500` (low).

### Component 3: Editor Integration (changes to `TemplateEditor.tsx`)

- **Purpose:** Wire detection engine to banner and handle scroll-to-line navigation
- **Changes:**
  1. Import `scanForSecrets` and `SecretsWarningBanner`
  2. Add state: `const [secretFindings, setSecretFindings] = useState<SecretFinding[]>([])`
  3. Add state: `const [bannerDismissed, setBannerDismissed] = useState(false)`
  4. In `handleTextChange` debounce callback (after existing parse calls): `setSecretFindings(scanForSecrets(text, configFormat))`
  5. Reset `bannerDismissed` to `false` when findings change (new scan may have different results)
  6. Render `<SecretsWarningBanner>` between `EditorSectionTabs` and the textarea container
  7. Implement `handleNavigateToLine(line: number)`:
     - Calculate pixel offset: `lineHeight * (line - 1)`
     - Set `textareaRef.current.scrollTop` to bring line into view
     - Apply a brief highlight flash (CSS animation class on the overlay line span)

**Scroll-to-line implementation detail:** The textarea uses `font-mono text-[13px] leading-relaxed`. `leading-relaxed` = 1.625 line-height = ~21.125px per line. Calculate scroll position as `(lineNumber - 1) * lineHeight` with a small offset to center the line in the viewport rather than placing it at the top edge.

**Highlight flash:** Add a temporary CSS class to the corresponding line span in the highlight overlay (same layer that handles `BANNER_RE` section banners). Use a `setTimeout` to remove the class after 1.5s. Class applies `bg-amber-500/20` pulse animation.

## Data Models

### SecretDetectionRule (compile-time constant)

```typescript
{
  id: string; // 'snmp-community', 'enable-password-0', etc.
  category: string; // 'SNMP', 'Authentication', 'AAA', etc.
  pattern: RegExp; // pre-compiled, reused across scans
  severity: SecretSeverity; // or a function (match) => SecretSeverity for multi-type rules
  description: string; // human-readable finding text
}
```

### SecretFinding (ephemeral per scan)

```typescript
{
  ruleId: string;
  category: string;
  severity: SecretSeverity;
  description: string;
  line: number; // 1-based
  lineText: string; // full line for context display
  matchStart: number; // char offset within line
  matchEnd: number; // char offset within line
}
```

No persistent data model changes. No Zustand store additions. Findings live in component state only.

## UI Impact Assessment

### Has UI Changes: Yes

### Visual Scope

- **Impact Level:** Minor element additions — one new banner component rendered conditionally above the editor textarea
- **Components Affected:** `TemplateEditor.tsx` (modified — adds banner render slot), `SecretsWarningBanner.tsx` (new)
- **Prototype Required:** No — the banner follows the exact existing Forge warning/error banner pattern documented in the UI Design Language and demonstrated in `VulnDashboard.tsx`. No new layout, no uncertain visual hierarchy. Single existing-pattern component.

### Prototype Artifacts

- **Stitch Screen IDs:** N/A
- **Playground File:** N/A
- **Reference HTML/Mockup:** N/A — follows existing `VulnDashboard.tsx` banner pattern exactly

### Design Constraints

- **Theme Compatibility:** Dark mode only (Forge is dark-only per branding)
- **Existing Patterns to Match:** `VulnDashboard.tsx` warning banner (amber), error banner (red), dismiss button pattern
- **Responsive Behavior:** Banner is full-width within the editor column, text wraps naturally. No special mobile treatment needed (Forge is desktop-focused).

### Visual Approval Gate

> Prototype NOT required — this component is a direct application of the documented Forge warning banner pattern. No new layout or visual hierarchy decisions.

## Open Questions

### Blocking (must resolve before approval)

_None._

### Resolved

- [x] ~~Navigation UX style~~ — Expandable finding list with clickable rows. Each row shows line number, severity badge, and description. Clicking scrolls to line. Simple, consistent with how the VulnDashboard shows scan results. Arrow cycling deferred to Phase 2 if needed.
- [x] ~~Low-severity display~~ — Include in Phase 1 but visually subdued (slate/muted, not amber/red). Collapsed by default in a separate "Informational" group if present alongside critical/high findings.
- [x] ~~Scan button placement~~ — No dedicated scan button in Phase 1. Scan is automatic (debounced). A manual "re-scan" button can be added in Phase 2 if users request it.
- [x] ~~Section-aware line numbers~~ — Findings report line numbers relative to the full `rawText`, which is what the textarea displays. Section tabs filter the view but don't change the underlying text. When a section tab is active, findings outside that section's line range are visually dimmed in the banner but still navigable.

## Error Handling

### Error Scenarios

1. **Malformed regex in a detection rule**
   - **Handling:** Each rule is tested individually in a try/catch. A failing rule is skipped (logged to console.warn in dev) and doesn't prevent other rules from running.
   - **User Impact:** None — the banner shows findings from all working rules. One broken rule doesn't crash the editor.

2. **Extremely large template (10,000+ lines)**
   - **Handling:** The scan runs inside the existing 300ms debounce. If scan time exceeds 100ms (measured via `performance.now()`), log a warning but do not abort. The 30-rule linear scan is fast enough that this is unlikely to be a real issue.
   - **User Impact:** Possible minor delay in findings appearing, but editor remains responsive since scan is synchronous within a debounce callback (not blocking input).

3. **Scroll-to-line targeting an out-of-view line**
   - **Handling:** Clamp the scroll position to `[0, textarea.scrollHeight - textarea.clientHeight]`. If the textarea hasn't rendered yet (edge case), no-op.
   - **User Impact:** Line scrolls into view or nothing happens — no crash.

## Testing Strategy

### Unit Tests (Primary)

**File:** `src/__tests__/secrets-detector.test.ts`

Test each detection rule category with real Cisco config snippets:

- Authentication: `enable password 0 cisco123`, `enable password 7 0822455D0A16`, `enable secret 9 $9$...`
- SNMP: `snmp-server community PUBLIC RO`, `snmp-server community $snmp_ro RO` (should NOT match)
- TACACS/RADIUS: `tacacs-server key 0 MySecret`, `tacacs-server key 7 0822455D`
- Routing: `ip ospf authentication-key MyKey`, `key-string 7 0822455D`, `neighbor 10.0.0.1 password MyPass`
- VPN: `crypto isakmp key MyPSK address 10.0.0.1`, `pre-shared-key cleartext`
- L2: `vtp password MyVtpPass`
- Management: `ntp authentication-key 1 md5 MyNtpKey`
- ASA: `passwd 2KFQnbNIdI.2KYOU encrypted`, `tunnel-group VPN pre-shared-key MyPSK`
- Negative cases: `$variable`, `${variable}`, Type 9 hash only, JSON/XML format → no findings

Test severity classification:

- Type 0 → critical
- Type 7 → high
- Type 5/8/9 → low
- SNMP community → critical

Test edge cases:

- Empty text → no findings
- Text with only variables → no findings
- Mixed findings across multiple lines → correct line numbers
- Lines with both a variable and a secret pattern → finding reported correctly

### Manual Verification

- Paste a real Cisco `show running-config` output into the template editor
- Verify banner appears with correct count and severity
- Click findings and verify scroll-to-line works
- Switch format to JSON → verify findings clear
- Switch back to CLI → verify findings reappear
