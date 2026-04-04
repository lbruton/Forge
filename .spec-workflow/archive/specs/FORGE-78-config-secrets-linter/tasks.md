# Tasks Document

## References

- **Issue:** FORGE-78
- **Spec Path:** `.spec-workflow/specs/FORGE-78-config-secrets-linter/`

## File Touch Map

| File                                      | Action | Scope                                                  |
| ----------------------------------------- | ------ | ------------------------------------------------------ |
| `src/lib/secrets-detector.ts`             | CREATE | Detection engine — types, rules, scan function         |
| `src/__tests__/secrets-detector.test.ts`  | CREATE | Unit tests for all rule categories                     |
| `src/components/SecretsWarningBanner.tsx` | CREATE | Warning banner component with finding navigation       |
| `src/components/TemplateEditor.tsx`       | MODIFY | Integration — scan hook, banner render, scroll-to-line |

---

- [x] 1. Create detection engine (`src/lib/secrets-detector.ts`)

  **Recommended Agent:** Claude

  | File                          | Action |
  | ----------------------------- | ------ |
  | `src/lib/secrets-detector.ts` | CREATE |

  _Prompt:_

  > Implement the task for spec FORGE-78-config-secrets-linter, first run spec-workflow-guide to get the workflow guide then implement the task:
  >
  > **Role:** TypeScript Developer specializing in regex pattern matching and security scanning
  >
  > **Task:** Create `src/lib/secrets-detector.ts` — a pure-function module that scans Cisco configuration text for exposed secrets and returns structured findings.
  >
  > **Implementation details:**
  >
  > 1. Define types (co-located in this file):
  >    - `SecretSeverity = 'critical' | 'high' | 'low'`
  >    - `SecretDetectionRule` — `{ id, category, pattern: RegExp, severity: SecretSeverity | ((match: RegExpMatchArray) => SecretSeverity), description }`
  >    - `SecretFinding` — `{ ruleId, category, severity, description, line, lineText, matchStart, matchEnd }`
  > 2. Define `DETECTION_RULES: SecretDetectionRule[]` covering ALL categories from the design doc:
  >    - **Authentication & Enable:** `enable password [0|7]`, `enable password <bare>`, `enable secret 0`, `username ... password [0|7]`, `username ... secret 0`, `line ... password [0|7]`
  >    - **SNMP:** `snmp-server community <string> [RO|RW]`, `snmp-server user ... auth [md5|sha] <key>`, `snmp-server user ... priv [des|aes] <key>`, `snmp-server host ... <community>`
  >    - **AAA/TACACS+/RADIUS:** `tacacs-server key [0|7]`, `tacacs server ... key [0|7]`, `radius-server key [0|7]`, `radius server ... key [0|7]`, `server-private ... key [0|7]`
  >    - **Routing Protocol Auth:** `ip ospf authentication-key [0|7]`, `ip ospf message-digest-key ... md5 [0|7]`, `key-string [0|7]`, `neighbor ... password [0|7]`, `ip rip authentication key-string`, `isis password`, `area-password`, `domain-password`
  >    - **VPN/Crypto:** `crypto isakmp key [0|6]`, `pre-shared-key [0|6]`, `tunnel key`
  >    - **Switching/L2:** `vtp password`
  >    - **Management:** `ntp authentication-key ... md5`, `ppp chap password [0|7]`, `ppp pap sent-username ... password [0|7]`, `wlan ... security wpa-psk ascii [0|7]`, `ip http ... password [0|7]`
  >    - **ASA-Specific:** `passwd`, `tunnel-group ... pre-shared-key`, `ldap-login-password`
  >    - **Low-severity (hashed):** Lines containing `secret 5`, `secret 8`, `secret 9`, `$1$`, `$5$`, `$8$`, `$9$`, `$14$` patterns → severity `low`
  > 3. Severity logic:
  >    - Bare value or `0` prefix → `critical`
  >    - `7` prefix → `high` (Type 7 is trivially reversible)
  >    - SNMP community strings → always `critical`
  >    - `5`/`8`/`9` hash or `$1$`/`$5$`/`$8$`/`$9$`/`$14$` → `low`
  >    - For rules that can have multiple type prefixes, use a severity function that inspects the match
  > 4. Implement `scanForSecrets(text: string, format: ConfigFormat): SecretFinding[]`:
  >    - If `format !== 'cli'`, return `[]` immediately
  >    - Split text by `\n`, iterate lines (1-based line numbers)
  >    - For each line, skip if the line's value position contains only `$variable` or `${variable}` patterns
  >    - Test each rule's regex against the line. On first match per line, create a `SecretFinding`
  >    - Return all findings sorted by line number
  > 5. Pre-compile all regex patterns (define them as module-level constants, not created inside the scan function)
  > 6. Import `ConfigFormat` from `../types/index.ts`
  >
  > **Restrictions:**
  >
  > - Pure functions only — no side effects, no React, no store access
  > - Do NOT log or store matched secret values in findings — `lineText` shows the full line for context, but the description should be generic (e.g., "SNMP community string exposed") not include the actual password
  > - Do NOT flag lines where the value position is already a `$variable` or `${variable}`
  > - Each rule tested in a try/catch — a broken regex must not crash the entire scan
  > - Read `src/lib/template-parser.ts` first to understand existing hash sanitization patterns (line 76-79) and the `ConfigFormat` type import
  > - Read `src/types/index.ts` for the `ConfigFormat` type definition
  >
  > **After implementation:**
  >
  > 1. Mark task [-] in tasks.md to set in-progress before starting
  > 2. Self-review: verify all 8 rule categories are covered, severity logic is correct, variable exclusion works
  > 3. Run `npm run build` to verify no type errors
  > 4. Call `log-implementation` with full artifacts (functions, types exported)
  > 5. Mark task [x] in tasks.md
  >
  > **Success:** Module exports `scanForSecrets`, `SecretFinding`, `SecretSeverity`, and `SecretDetectionRule` types. All ~30 rules compile. Scan returns correct findings with line numbers and severity. Variable-only lines are excluded. Non-cli formats return empty array.

  _Leverage:_ `src/lib/template-parser.ts` (hash patterns, ConfigFormat import), `src/types/index.ts` (ConfigFormat type)
  _Requirements:_ 1, 5

---

- [x] 2. Create detection engine unit tests (`src/__tests__/secrets-detector.test.ts`)

  **Recommended Agent:** Claude

  | File                                     | Action |
  | ---------------------------------------- | ------ |
  | `src/__tests__/secrets-detector.test.ts` | CREATE |

  _Prompt:_

  > Implement the task for spec FORGE-78-config-secrets-linter, first run spec-workflow-guide to get the workflow guide then implement the task:
  >
  > **Role:** QA Engineer specializing in Vitest unit testing for TypeScript modules
  >
  > **Task:** Create `src/__tests__/secrets-detector.test.ts` — comprehensive unit tests for the secrets detection engine.
  >
  > **Test categories (one `describe` block per category):**
  >
  > 1. **Authentication & Enable** — test `enable password 0 cisco123` (critical), `enable password 7 0822455D0A16` (high), `enable secret 9 $9$...` (low), `username admin password 0 admin123` (critical), `username admin password 7 0822455D` (high)
  > 2. **SNMP** — test `snmp-server community PUBLIC RO` (critical), `snmp-server community $snmp_ro RO` (NOT flagged — variable), `snmp-server user admin auth md5 MyAuthKey` (critical)
  > 3. **AAA/TACACS+/RADIUS** — test `tacacs-server key 0 MySecret` (critical), `tacacs-server key 7 0822455D` (high), `radius-server key SecretKey` (critical)
  > 4. **Routing Protocol Auth** — test `ip ospf authentication-key MyKey` (critical), `key-string 7 0822455D` (high), `neighbor 10.0.0.1 password MyPass` (critical)
  > 5. **VPN/Crypto** — test `crypto isakmp key MyPSK address 10.0.0.1` (critical), `pre-shared-key cleartext` (critical)
  > 6. **Switching/L2** — test `vtp password MyVtpPass` (critical)
  > 7. **Management** — test `ntp authentication-key 1 md5 MyNtpKey` (critical), `ppp chap password 0 MyChapPass` (critical)
  > 8. **ASA-Specific** — test `passwd 2KFQnbNIdI.2KYOU encrypted` (high), `tunnel-group VPN pre-shared-key MyPSK` (critical)
  > 9. **Negative cases** — test: empty string returns `[]`, `$variable` in value position NOT flagged, `${variable}` NOT flagged, Type 9 hash-only config returns `low` severity only, JSON format returns `[]`, XML format returns `[]`
  > 10. **Line numbers** — test multi-line config returns correct 1-based line numbers for each finding
  > 11. **Mixed findings** — test a realistic multi-section config with multiple finding types, verify count and severity distribution
  >
  > **Restrictions:**
  >
  > - Use Vitest (`import { describe, it, expect } from 'vitest'`)
  > - Read existing test files in `src/__tests__/` to match project test patterns and import conventions
  > - Use real Cisco config snippet syntax — not made-up patterns
  > - Each test should assert: finding count, severity, ruleId or category, and line number where applicable
  > - Do NOT import from `../lib/secrets-detector` until Task 1 is complete — read the actual file first
  >
  > **After implementation:**
  >
  > 1. Mark task [-] in tasks.md
  > 2. Run `npm run test -- --run src/__tests__/secrets-detector.test.ts` to verify all tests pass
  > 3. Call `log-implementation` with test artifacts (test count, pass/fail, framework)
  > 4. Mark task [x] in tasks.md
  >
  > **Success:** All test suites pass. Every detection rule category has at least one positive and one negative test case. Line number tests verify 1-based counting. Variable exclusion tests pass. Non-cli format tests pass.

  _Leverage:_ `src/__tests__/template-parser.test.ts` (existing test patterns), `src/lib/secrets-detector.ts` (Task 1 output)
  _Requirements:_ 1, 5

---

- [x] 3. Create warning banner component (`src/components/SecretsWarningBanner.tsx`)

  **Recommended Agent:** Claude

  | File                                      | Action |
  | ----------------------------------------- | ------ |
  | `src/components/SecretsWarningBanner.tsx` | CREATE |

  _Prompt:_

  > Implement the task for spec FORGE-78-config-secrets-linter, first run spec-workflow-guide to get the workflow guide then implement the task:
  >
  > **Role:** React/TypeScript Frontend Developer working in the Forge design system (dark mode, Tailwind CSS v4, Lucide icons)
  >
  > **Task:** Create `src/components/SecretsWarningBanner.tsx` — a collapsible warning banner that displays secret findings with click-to-navigate.
  >
  > **MANDATORY BEFORE WRITING ANY UI CODE:** Read these files first:
  >
  > - `/Volumes/DATA/GitHub/DocVault/Projects/Forge/UI Design Language.md` — Forge design tokens and component patterns
  > - `src/plugins/vuln-cisco/VulnDashboard.tsx` lines 300-330 — existing amber/red banner patterns to match
  > - `/Users/lbruton/Devops/Forge/BRANDING.md` — visual design decisions
  >
  > **Implementation details:**
  >
  > 1. Props interface:
  >    ```typescript
  >    interface SecretsWarningBannerProps {
  >      findings: SecretFinding[];
  >      onNavigate: (line: number) => void;
  >      onDismiss: () => void;
  >    }
  >    ```
  > 2. States:
  >    - `expanded` (boolean, default false) — toggle finding list visibility
  >    - Component renders nothing if `findings.length === 0`
  > 3. Color logic based on highest severity:
  >    - If any `critical` finding: red treatment (`bg-red-500/10 border border-red-500/20 text-red-400`)
  >    - If highest is `high`: amber treatment (`bg-amber-500/10 border border-amber-500/20 text-amber-400`)
  >    - If all `low`: muted slate treatment (`bg-slate-500/10 border border-slate-500/20 text-slate-400`)
  > 4. Collapsed state (default):
  >    - Icon: `AlertCircle` (red) or `AlertTriangle` (amber) or `Shield` (slate/low) from lucide-react
  >    - Summary text: `"{count} exposed secrets ({N} critical, {N} high)"` — omit zero-count severities
  >    - ChevronDown button to expand
  >    - X button to dismiss
  > 5. Expanded state:
  >    - Same header as collapsed, but ChevronUp icon
  >    - Finding list below header — one row per finding:
  >      - `Line {N}` label (monospace, slate-500)
  >      - Severity dot: `bg-red-500` (critical), `bg-amber-500` (high), `bg-slate-500` (low) — `w-2 h-2 rounded-full inline-block`
  >      - Severity label in uppercase (text-xs)
  >      - Description text
  >    - Each row is clickable — calls `onNavigate(finding.line)` and has `hover:bg-white/5 cursor-pointer` treatment
  >    - Rows have `border-t border-white/5` separator
  > 6. Styling:
  >    - Banner: `mx-0 px-4 py-2.5 rounded-lg text-sm` — sits flush within the editor column
  >    - Use `transition-colors` on interactive elements
  >    - Font: default `font-sans` for text, `font-mono` for line numbers
  >
  > **Restrictions:**
  >
  > - MUST follow Forge design language exactly — read the docs first
  > - MUST match existing VulnDashboard banner patterns (amber/red with AlertTriangle/AlertCircle + dismiss)
  > - Do NOT add any store access — this is a pure presentational component
  > - Do NOT add any detection logic — findings come from props only
  > - Import `SecretFinding` type from `../lib/secrets-detector`
  >
  > **After implementation:**
  >
  > 1. Mark task [-] in tasks.md
  > 2. Run `npm run build` to verify no type errors
  > 3. Self-review against the UI Design Language warning/error banner patterns
  > 4. Call `log-implementation` with component artifacts
  > 5. Mark task [x] in tasks.md
  >
  > **Success:** Component renders correctly for all severity combinations. Collapsed/expanded toggle works. Finding rows are clickable and call onNavigate. Dismiss calls onDismiss. Styling matches Forge design language exactly.

  _Leverage:_ `src/plugins/vuln-cisco/VulnDashboard.tsx` (banner patterns), `/Volumes/DATA/GitHub/DocVault/Projects/Forge/UI Design Language.md` (design tokens), `src/lib/secrets-detector.ts` (SecretFinding type)
  _Requirements:_ 2, 3

---

- [x] 4. Integrate into TemplateEditor (`src/components/TemplateEditor.tsx`)

  **Recommended Agent:** Claude

  | File                                | Action |
  | ----------------------------------- | ------ |
  | `src/components/TemplateEditor.tsx` | MODIFY |

  _Prompt:_

  > Implement the task for spec FORGE-78-config-secrets-linter, first run spec-workflow-guide to get the workflow guide then implement the task:
  >
  > **Role:** React/TypeScript Developer integrating new functionality into an existing complex component
  >
  > **Task:** Integrate the secrets detection engine and warning banner into the existing `TemplateEditor.tsx`.
  >
  > **MANDATORY FIRST:** Read the full `src/components/TemplateEditor.tsx` file to understand the existing structure, state, and render layout.
  >
  > **Implementation details:**
  >
  > 1. **Add imports:**
  >    ```typescript
  >    import { scanForSecrets } from '../lib/secrets-detector';
  >    import type { SecretFinding } from '../lib/secrets-detector';
  >    import { SecretsWarningBanner } from './SecretsWarningBanner';
  >    ```
  > 2. **Add state** (alongside existing editor state around line 87-100):
  >    ```typescript
  >    const [secretFindings, setSecretFindings] = useState<SecretFinding[]>([]);
  >    const [bannerDismissed, setBannerDismissed] = useState(false);
  >    ```
  > 3. **Hook into existing debounce** — in `handleTextChange` (around line 158-177), ADD after the existing `parseSections`/`setVariableSectionMap` calls inside the `setTimeout`:
  >    ```typescript
  >    setSecretFindings(scanForSecrets(text, configFormat));
  >    setBannerDismissed(false);
  >    ```
  > 4. **Also scan on format change** — add a `useEffect` that re-scans when `configFormat` changes:
  >    ```typescript
  >    useEffect(() => {
  >      if (rawText) {
  >        setSecretFindings(scanForSecrets(rawText, configFormat));
  >        setBannerDismissed(false);
  >      }
  >    }, [configFormat]);
  >    ```
  > 5. **Implement scroll-to-line handler:**
  >    ```typescript
  >    const handleNavigateToFinding = useCallback((line: number) => {
  >      if (!textareaRef.current) return;
  >      const lineHeight = 21.125; // 13px * 1.625 (leading-relaxed)
  >      const targetScroll = (line - 1) * lineHeight - textareaRef.current.clientHeight / 3;
  >      textareaRef.current.scrollTop = Math.max(0, targetScroll);
  >      // Also sync overlay scroll
  >      if (overlayRef.current) {
  >        overlayRef.current.scrollTop = textareaRef.current.scrollTop;
  >      }
  >    }, []);
  >    ```
  > 6. **Render banner** — insert `<SecretsWarningBanner>` between the `EditorSectionTabs` component and the `<div className="flex-1 relative">` textarea container (around line 646-660):
  >    ```tsx
  >    {
  >      secretFindings.length > 0 && !bannerDismissed && (
  >        <div className="px-5 py-2 border-b border-forge-graphite">
  >          <SecretsWarningBanner
  >            findings={secretFindings}
  >            onNavigate={handleNavigateToFinding}
  >            onDismiss={() => setBannerDismissed(true)}
  >          />
  >        </div>
  >      );
  >    }
  >    ```
  >
  > **Restrictions:**
  >
  > - MINIMAL changes to existing code — do not refactor, restructure, or reformat any existing lines
  > - Do NOT modify the existing `handleTextChange` logic — only ADD the scan call after existing parse calls
  > - Do NOT add any new dependencies or timers
  > - Do NOT modify the highlight overlay logic (the line highlighting via CSS flash is deferred — not needed for Phase 1 MVP if it adds complexity)
  > - Preserve all existing functionality — run `npm run test` to verify nothing breaks
  > - Read the existing TemplateEditor.tsx thoroughly before making any changes
  >
  > **After implementation:**
  >
  > 1. Mark task [-] in tasks.md
  > 2. Run `npm run build` to verify no type errors
  > 3. Run `npm run test` to verify all existing tests still pass
  > 4. Self-review: verify banner appears between section tabs and textarea, scan runs on text change and format change
  > 5. Call `log-implementation` with full artifacts
  > 6. Mark task [x] in tasks.md
  >
  > **Success:** Banner appears when template contains secrets. Clicking a finding scrolls the textarea to that line. Dismissing the banner hides it until the next scan. Switching format away from CLI clears findings. All existing TemplateEditor tests pass unchanged.

  _Leverage:_ `src/components/TemplateEditor.tsx` (full file — read first), `src/lib/secrets-detector.ts` (Task 1), `src/components/SecretsWarningBanner.tsx` (Task 3)
  _Requirements:_ 2, 3, 4

---

### Standard Closing Tasks

- [x] 5. Final verification and cleanup

  **Recommended Agent:** Claude

  | File                       | Action |
  | -------------------------- | ------ |
  | All created/modified files | VERIFY |

  _Prompt:_

  > Implement the task for spec FORGE-78-config-secrets-linter, first run spec-workflow-guide to get the workflow guide then implement the task:
  >
  > **Role:** Senior Developer performing final integration verification
  >
  > **Task:** Run all project checks and verify the complete feature works end-to-end.
  >
  > 1. Run `npm run build` — must pass with zero errors (ignore pre-existing dompurify type error)
  > 2. Run `npm run test` — all 16+ test suites must pass including the new `secrets-detector.test.ts`
  > 3. Run `npx tsc --noEmit -p tsconfig.app.json` — type check (ignore pre-existing dompurify error)
  > 4. Run `npm run lint` — ESLint must pass on all new files
  > 5. Verify the new files exist and have correct imports:
  >    - `src/lib/secrets-detector.ts` exports `scanForSecrets`, types
  >    - `src/components/SecretsWarningBanner.tsx` exports `SecretsWarningBanner`
  >    - `src/components/TemplateEditor.tsx` imports and uses both
  >    - `src/__tests__/secrets-detector.test.ts` has comprehensive coverage
  >
  > **Restrictions:** Do NOT modify any code unless a check fails. If a check fails, fix only the failing issue.
  >
  > **After verification:**
  >
  > 1. Mark task [-] in tasks.md
  > 2. Call `log-implementation` with verification results (test counts, build status)
  > 3. Mark task [x] in tasks.md
  >
  > **Success:** All checks pass. Feature is ready for version bump and PR.

  _Leverage:_ All files from Tasks 1-4
  _Requirements:_ All
