# Requirements Document

## References

- **Issue:** FORGE-70
- **Spec Path:** `.spec-workflow/specs/FORGE-70-snmp-credential-encryption/`

## Introduction

When a user adds a device to the Cisco vulnerability scanner with a manual SNMP community string (rather than an Infisical secret reference), the raw community string is persisted as plaintext in browser localStorage via the Zustand store. This bypasses the credential encryption infrastructure (AES-256-GCM via `credential-store.ts`) that already protects plugin API keys and password-type settings.

This spec addresses the gap by extending the existing storage adapter encryption hooks to also cover `VulnDevice.snmpCommunity` fields, bringing them in line with the FORGE-64 credential hardening baseline.

## Alignment with Product Vision

Forge's security model (documented in `product.md` and the UI Design Language) establishes that credentials must never appear as plaintext in localStorage or plugin settings. The Infisical integration path (`snmpSecretKey` → SecretsProvider resolve at runtime) already follows this principle. The manual SNMP entry path is an escape hatch that currently bypasses the same protections. Closing this gap maintains the security posture expected of a network configuration tool handling device credentials.

## Requirements

### Requirement 1: Encrypt manual SNMP communities at rest

**User Story:** As a network engineer using the vulnerability scanner with manual SNMP communities, I want my community strings encrypted in browser storage, so that they are not exposed as plaintext in DevTools, browser profile backups, or extension access.

#### Acceptance Criteria

1. WHEN a `VulnDevice` with a non-empty `snmpCommunity` field is persisted to localStorage THEN the storage adapter SHALL encrypt the value using `encryptCredential()` before writing.
2. WHEN the store rehydrates from localStorage THEN the storage adapter SHALL decrypt `snmpCommunity` values using `decryptCredential()` before populating the Zustand state.
3. WHEN a `VulnDevice` has no `snmpCommunity` (uses `snmpSecretKey` instead) THEN the storage adapter SHALL not attempt encryption/decryption on that device.

### Requirement 2: Backward-compatible migration of existing plaintext values

**User Story:** As an existing user with devices already saved with plaintext SNMP communities, I want my data to automatically migrate to encrypted storage on the next app load, so that I don't need to re-enter any device information.

#### Acceptance Criteria

1. WHEN the store rehydrates and encounters a `snmpCommunity` value without the `$ENC:` prefix THEN the system SHALL treat it as plaintext (backward compatibility built into `decryptCredential()`).
2. WHEN the store next persists after rehydration THEN the previously-plaintext `snmpCommunity` values SHALL be encrypted via `encryptCredential()` on the write path.
3. IF an existing device record has a `snmpCommunity` value THEN after one load-save cycle the localStorage representation SHALL contain an `$ENC:` prefixed envelope, not plaintext.

### Requirement 3: No functional regression

**User Story:** As a network engineer, I want the vulnerability scanner to work identically after this change, so that scan initiation and SNMP credential resolution are unaffected.

#### Acceptance Criteria

1. WHEN `VulnDashboard` resolves SNMP credentials for a scan THEN the `snmpCommunity` field on the in-memory `VulnDevice` SHALL contain the decrypted plaintext value (ready for use).
2. WHEN a user edits an existing device with a manual SNMP community THEN `DeviceModal` SHALL display the decrypted value in the input field.
3. WHEN a user adds a new device with a manual SNMP community THEN the save flow SHALL work identically to the current behavior (the encryption happens transparently at the storage layer).

## Open Questions

> **GATE:** All blocking questions must be resolved before this document can be approved.

### Blocking (must resolve before approval)

None — all blocking questions were resolved during the discovery phase.

### Non-blocking (can defer to Design)

- [ ] Should `exportData()` explicitly strip `snmpCommunity` from `vulnDevices` as defense-in-depth, even though `vulnDevices` are currently excluded from `.stvault` export? (Future-proofing if export scope expands.)
- [ ] Should the broader pattern (encrypting global variables with `syncToSecrets: true`) be tracked as a follow-up issue?

### Resolved

- [x] ~~Does `.stvault` export include `vulnDevices`?~~ — No. `exportData()` only exports `views`, `templates`, `variableValues`, `generatedConfigs`, `plugins`. Confirmed by reading `store/index.ts:942-975`.
- [x] ~~Is there existing encryption infrastructure to reuse?~~ — Yes. `credential-store.ts` provides `encryptCredential()` / `decryptCredential()` with AES-256-GCM and `$ENC:` envelope. Used by plugin secrets since FORGE-64.
- [x] ~~How does backward compatibility work?~~ — `decryptCredential()` passes through non-`$ENC:` strings as-is. Plaintext values auto-encrypt on the next write cycle.
- [x] ~~Which approach?~~ — Approach B (encrypt through existing credential-store) selected during discovery. Matches FORGE-64 pattern exactly.

## Non-Functional Requirements

### Code Architecture and Modularity

- **Reuse existing infrastructure**: Use `encryptCredential()` / `decryptCredential()` from `credential-store.ts` — no new crypto code.
- **Storage adapter pattern**: Extend the existing `forgeStorage.setItem` / `getItem` hooks, matching the `encryptPluginSecrets` / `decryptPluginSecrets` pattern.
- **Type stability**: No changes to `VulnDevice` type definition — `snmpCommunity` remains `string?`.

### Performance

- Encryption/decryption adds negligible latency (AES-GCM is hardware-accelerated in modern browsers).
- The `vulnDevices` array is small (typically < 20 devices) — no batch optimization needed.

### Security

- Encryption is intentional obfuscation, not a security boundary (as documented in `credential-store.ts` header). It prevents plaintext grep and casual DevTools viewing.
- The same threat model as FORGE-64 applies: an attacker with full browser-profile access can extract the key. This is accepted for a homelab alpha.

### Reliability

- The hydration guard (`hydrated` flag at `store/index.ts:84`) already prevents race conditions where default state overwrites encrypted credentials. The same protection covers `vulnDevices`.
- `decryptCredential()` failure returns the original stored value rather than empty string, preventing data loss on key mismatch or corruption.
