# Requirements Document

## References

- **Issue:** FORGE-78
- **Spec Path:** `.spec-workflow/specs/FORGE-78-config-secrets-linter/`

## Introduction

Forge's template editor accepts raw Cisco configuration text, which frequently contains exposed secrets — cleartext passwords (Type 0), reversible obfuscated passwords (Type 7), SNMP community strings, TACACS/RADIUS shared keys, and other sensitive values. Currently, Forge treats all template text as inert content with no security awareness.

This feature adds a **config secrets linter** — a detection engine that scans template text for known Cisco secret patterns and surfaces a non-intrusive warning banner with jump-to-line navigation. The goal is to nudge engineers toward replacing exposed values with `$variables`, which can then be synced to Infisical via the existing secrets pipeline.

This is Phase 1 (detect + warn + navigate). Phase 2 (bulk replace + Infisical sync) will be a separate issue.

## Alignment with Product Vision

The product steering document identifies "public hosting safe" and "no risk of private data exposure" as key objectives. The `.stvault` encryption layer protects data at export time, but secrets embedded in templates remain exposed during editing and in localStorage. The secrets linter adds a complementary defense layer — catching secrets at the editing stage before they persist. Combined with the Infisical integration (FORGE-26), this creates a complete secrets hygiene pipeline: detect → variablize → vault.

## Requirements

### Requirement 1: Detection Engine

**User Story:** As a network engineer, I want Forge to automatically detect exposed secrets in my configuration templates, so that I know which values need to be secured before sharing or deploying.

#### Acceptance Criteria

1. WHEN a template contains a Cisco configuration line with a cleartext password (Type 0) THEN the system SHALL flag the line with severity "critical"
2. WHEN a template contains a Cisco configuration line with a Type 7 reversible password THEN the system SHALL flag the line with severity "high"
3. WHEN a template contains a Cisco configuration line with a Type 5, Type 8, or Type 9 hashed password THEN the system SHALL flag the line with severity "low" (informational)
4. WHEN a template contains an SNMP community string THEN the system SHALL flag the line with severity "critical" (community strings are always cleartext)
5. WHEN a template contains TACACS+, RADIUS, or other AAA shared keys THEN the system SHALL flag the line with the appropriate severity based on encoding type
6. WHEN a flagged value position already contains a `$variable` or `${variable}` pattern THEN the system SHALL NOT flag that line
7. WHEN the config format is not `cli` (i.e., JSON, XML, or YAML) THEN the system SHALL skip the Cisco-specific secret scan
8. WHEN the detection engine scans a template THEN each finding SHALL include: line number, matched text excerpt, rule ID, category, severity, and a human-readable description

### Requirement 2: Warning Banner

**User Story:** As a network engineer, I want to see a clear but non-intrusive warning when my template contains exposed secrets, so that I'm aware of the issue without my workflow being interrupted.

#### Acceptance Criteria

1. WHEN the detection engine finds one or more secrets THEN the system SHALL display a warning banner above the template editor textarea
2. WHEN the banner is displayed THEN it SHALL show a summary count with severity breakdown (e.g., "3 exposed secrets: 1 critical, 2 high")
3. WHEN no secrets are detected THEN the banner SHALL NOT be rendered (no empty-state banner)
4. WHEN the banner is displayed THEN it SHALL use the Forge design language warning/error color tokens: red (`bg-red-500/10 border-red-500/20`) for findings including critical severity, amber (`bg-amber-500/10 border-amber-500/20`) for high-only findings
5. WHEN the user dismisses the banner THEN it SHALL collapse but the warning indicator SHALL remain accessible (not permanently hidden)
6. IF low-severity-only findings exist (all hashed passwords) THEN the banner SHALL use a subdued informational style, not the warning/error treatment

### Requirement 3: Jump-to-Line Navigation

**User Story:** As a network engineer, I want to click on a finding to jump to that line in the template editor, so that I can quickly locate and address the exposed secret.

#### Acceptance Criteria

1. WHEN the user clicks a finding in the banner THEN the template editor SHALL scroll to bring the flagged line into view
2. WHEN the editor scrolls to a finding THEN the flagged line SHALL be briefly highlighted (visual flash or background pulse) to draw attention
3. WHEN multiple findings exist THEN the user SHALL be able to navigate between them (clicking individual findings or cycling through them)
4. WHEN a finding references a line number THEN the line number SHALL correspond to the correct line in the currently displayed section (accounting for section tab filtering)

### Requirement 4: Scan Triggers

**User Story:** As a network engineer, I want the secrets scan to run automatically when I paste or save a template, so that I don't have to remember to manually trigger it.

#### Acceptance Criteria

1. WHEN the user modifies template text (typing, pasting, or programmatic change) THEN the system SHALL run the secrets scan after the existing debounce period (currently 300ms)
2. WHEN the user saves the template THEN the system SHALL run the secrets scan
3. WHEN the secrets scan runs THEN it SHALL NOT block the UI or cause perceptible lag (scan should complete in under 50ms for typical templates)
4. IF the user switches config format away from `cli` THEN any existing findings SHALL be cleared

### Requirement 5: Detection Rule Coverage

**User Story:** As a network engineer working with Cisco IOS, IOS-XE, and ASA configurations, I want the linter to detect all common secret patterns across these platforms, so that no exposed credentials slip through.

#### Acceptance Criteria

1. The detection engine SHALL include rules for all of the following categories:
   - **Authentication & Enable**: `enable password`, `enable secret 0`, `username ... password`, `username ... secret 0`, `line ... password`
   - **SNMP**: `snmp-server community`, `snmp-server user ... auth`, `snmp-server user ... priv`, `snmp-server host ... community`
   - **AAA/TACACS+/RADIUS**: `tacacs-server key`, `tacacs server ... key`, `radius-server key`, `radius server ... key`, `server-private ... key`
   - **Routing Protocol Auth**: `ip ospf authentication-key`, `ip ospf message-digest-key`, `key-string`, `neighbor ... password`, `ip rip authentication key-string`, `isis password`, `area-password`, `domain-password`
   - **VPN/Crypto**: `crypto isakmp key`, `pre-shared-key`, `tunnel key`
   - **Switching/L2**: `vtp password`
   - **Management**: `ntp authentication-key`, `ppp chap password`, `ppp pap sent-username ... password`, `wlan ... security wpa-psk ascii`, `ip http ... password`
   - **ASA-Specific**: `passwd`, `tunnel-group ... pre-shared-key`, `ldap-login-password`
2. Each rule SHALL correctly distinguish between cleartext (Type 0), Type 7 (reversible), and Type 5/8/9 (hashed) encodings where applicable
3. Each rule SHALL have at least one unit test with a real Cisco config snippet

## Open Questions

> **GATE:** All blocking questions must be resolved before this document can be approved.

### Blocking (must resolve before approval)

_None — all questions resolved during /chat and /discover phases._

### Non-blocking (can defer to Design)

- [ ] Navigation UX: arrow cycling vs dropdown vs inline clickable row — decide during UI prototype
- [ ] Low-severity display: should Type 5/8/9 findings show in a collapsed informational section or be hidden entirely in Phase 1?
- [ ] Scan button placement: in the editor toolbar area or inside the banner

### Resolved

- [x] ~~Scope of auto-fix~~ — No auto-fix in Phase 1. Phase 2 will add bulk replace.
- [x] ~~Per-section vs whole-template scan~~ — Scan the full `rawText` (whole template), not individual sections. Line numbers map to the full text.
- [x] ~~Custom rules~~ — Not in Phase 1. Keep it Cisco-focused.
- [x] ~~Store persistence~~ — Findings are ephemeral, recomputed on every text change. No Zustand store changes needed in Phase 1.
- [x] ~~Real-time vs debounced~~ — Piggyback on existing 300ms debounce in `handleTextChange`, not real-time per-keystroke.
- [x] ~~Type parsing depth~~ — Keep it simple. Severity classification (critical/high/low) is the main value. Don't over-engineer type parsing.

## Non-Functional Requirements

### Code Architecture and Modularity

- **Single Responsibility**: `secrets-detector.ts` is a pure-function module — no side effects, no store access, no React dependencies
- **Modular Design**: Detection rules are data-driven (array of rule objects), not hard-coded if/else chains — easy to add new rules
- **Clear Interfaces**: `SecretDetectionRule` and `SecretFinding` types defined in `types/` or co-located in the detector module
- **Separation of Concerns**: Banner component receives findings as props — no direct coupling to the detection engine

### Performance

- Secret scan SHALL complete in under 50ms for a 500-line template (typical config size)
- Scan runs inside existing 300ms debounce — no additional timers or requestAnimationFrame
- Rule regex patterns SHALL be pre-compiled (not re-created on each scan)

### Security

- The detection engine SHALL NOT log, store, or transmit matched secret values
- Findings SHALL include line numbers and rule metadata but SHALL mask the actual secret value in the finding description (show command context, not the password itself)

### Reliability

- A malformed regex in one rule SHALL NOT crash the entire scan — each rule should be independently fault-tolerant
- If the detection engine throws, the template editor SHALL continue to function normally (graceful degradation)

### Usability

- The warning banner SHALL be dismissible — it is a nudge, not a blocker
- The banner SHALL not obscure or shift the template editor layout in a disorienting way
- Findings SHALL use plain-language descriptions (e.g., "SNMP community string exposed in cleartext") not regex jargon
