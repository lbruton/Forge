# Design Document

## References

- **Issue:** FORGE-70
- **Spec Path:** `.spec-workflow/specs/FORGE-70-snmp-credential-encryption/`

## Overview

Extend the Zustand storage adapter (`forgeStorage`) to encrypt and decrypt `VulnDevice.snmpCommunity` fields using the existing `credential-store.ts` infrastructure. This brings manual SNMP communities to the same encryption-at-rest standard as plugin API keys and password-type settings (FORGE-64).

The change is confined to the storage adapter layer — no modifications to the `VulnDevice` type, `DeviceModal` UI, `VulnDashboard` scan flow, or sidecar communication.

## Steering Document Alignment

### Technical Standards (tech.md)

- Uses Web Crypto API (AES-256-GCM) as documented in `tech.md` for encryption
- Follows the existing `credential-store.ts` pattern established by FORGE-64
- No new dependencies — reuses `encryptCredential()` / `decryptCredential()`

### Project Structure (structure.md)

- All changes within `src/store/index.ts` (storage adapter hooks) and `src/__tests__/`
- No new files created — extending existing infrastructure

## Code Reuse Analysis

### Existing Components to Leverage

- **`credential-store.ts`**: `encryptCredential()`, `decryptCredential()` — the exact same functions used for plugin secrets. No wrapping or adaptation needed.
- **`encryptPluginSecrets()` / `decryptPluginSecrets()`** at `store/index.ts:28-76`: The structural pattern to follow — iterate over a collection, encrypt/decrypt specific fields, return the transformed collection.
- **Hydration guard** (`hydrated` flag at `store/index.ts:84`): Already prevents race conditions where default state overwrites encrypted data on the write path.

### Integration Points

- **`forgeStorage.getItem`** (line 87-109): After decrypting plugin secrets, also decrypt vuln device SNMP communities.
- **`forgeStorage.setItem`** (line 110-136): After encrypting plugin secrets, also encrypt vuln device SNMP communities.

## Architecture

The encryption sits at the storage boundary — the thinnest possible layer. In-memory state always contains decrypted plaintext. localStorage always contains `$ENC:` encrypted envelopes.

```
┌─────────────────────────────────────────────┐
│  Zustand Store (in-memory)                  │
│  vulnDevices[].snmpCommunity = "plaintext"  │
└─────────────┬───────────────────────────────┘
              │ setItem() ↓          ↑ getItem()
┌─────────────▼───────────────────────────────┐
│  forgeStorage adapter                        │
│  ┌─────────────────────────────────────┐    │
│  │ encryptVulnDeviceSecrets()          │    │
│  │   for each device:                  │    │
│  │     if snmpCommunity → encrypt      │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ decryptVulnDeviceSecrets()          │    │
│  │   for each device:                  │    │
│  │     if snmpCommunity → decrypt      │    │
│  └─────────────────────────────────────┘    │
└─────────────┬───────────────────────────────┘
              │
┌─────────────▼───────────────────────────────┐
│  localStorage                                │
│  vulnDevices[].snmpCommunity = "$ENC:{...}" │
└─────────────────────────────────────────────┘
```

## Components and Interfaces

### `encryptVulnDeviceSecrets(devices: VulnDevice[]): Promise<VulnDevice[]>`

- **Purpose:** Encrypt `snmpCommunity` on each device before localStorage write
- **Interfaces:** Takes array of `VulnDevice`, returns array with encrypted `snmpCommunity` fields
- **Dependencies:** `encryptCredential()` from `credential-store.ts`
- **Reuses:** Exact same pattern as `encryptPluginSecrets()`
- **Logic:**
  ```
  for each device in devices:
    if device.snmpCommunity is non-empty string:
      clone device
      clone.snmpCommunity = await encryptCredential(device.snmpCommunity)
    return clone (or original if no snmpCommunity)
  ```

### `decryptVulnDeviceSecrets(devices: VulnDevice[]): Promise<VulnDevice[]>`

- **Purpose:** Decrypt `snmpCommunity` on each device after localStorage read
- **Interfaces:** Takes array of `VulnDevice`, returns array with decrypted `snmpCommunity` fields
- **Dependencies:** `decryptCredential()` from `credential-store.ts`
- **Reuses:** Exact same pattern as `decryptPluginSecrets()`
- **Logic:**
  ```
  for each device in devices:
    if device.snmpCommunity is non-empty string:
      clone device
      clone.snmpCommunity = await decryptCredential(device.snmpCommunity)
    return clone (or original if no snmpCommunity)
  ```

### Storage adapter hook modifications

**`forgeStorage.getItem`** — add after the existing plugin decryption block:

```typescript
if (inner.vulnDevices && Array.isArray(inner.vulnDevices)) {
  inner.vulnDevices = await decryptVulnDeviceSecrets(inner.vulnDevices as VulnDevice[]);
}
```

**`forgeStorage.setItem`** — add after the existing plugin encryption block:

```typescript
if (inner.vulnDevices && Array.isArray(inner.vulnDevices)) {
  inner.vulnDevices = await encryptVulnDeviceSecrets(inner.vulnDevices as VulnDevice[]);
}
```

## Data Models

No changes to data models. `VulnDevice.snmpCommunity` remains `string?`. The encryption is transparent at the storage boundary — the type system sees plaintext in both directions.

```typescript
// No change — existing type
export interface VulnDevice {
  id: string;
  viewId: string;
  hostname: string;
  ip: string;
  snmpCommunity?: string; // plaintext in-memory, $ENC: in localStorage
  snmpSecretKey?: string; // Infisical key reference (unaffected)
  lastScanAt?: string;
  lastSeverity?: SeveritySummary;
}
```

## UI Impact Assessment

### Has UI Changes: No

No UI changes. The encryption is entirely at the storage adapter layer. Users see no difference in behavior — `DeviceModal` reads/writes the same `snmpCommunity` field, which is always plaintext in the Zustand store.

## Open Questions

### Resolved

- [x] ~~Should `exportData()` strip `snmpCommunity` from `vulnDevices`?~~ — Not needed for this spec. `vulnDevices` is already excluded from `exportData()` output (confirmed at `store/index.ts:967-974`). If export scope expands in the future, that would be a separate issue.
- [x] ~~Should the broader pattern (encrypting synced global variables) be addressed here?~~ — No. That's a separate concern tracked as a follow-up. This spec is scoped to `VulnDevice.snmpCommunity` only.

## Error Handling

### Error Scenarios

1. **Encryption failure (e.g., Web Crypto unavailable)**
   - **Handling:** `encryptCredential()` would throw. The existing `try/catch` in `forgeStorage.setItem` catches all errors and falls back to raw localStorage write. The community string would persist as plaintext — same as current behavior. No regression.
   - **User Impact:** None visible. Degraded to current (unencrypted) behavior.

2. **Decryption failure (e.g., key mismatch after localStorage clear)**
   - **Handling:** `decryptCredential()` returns the original `$ENC:` string on failure (as documented in `credential-store.ts:176-178`). The `snmpCommunity` field would contain a garbage string.
   - **User Impact:** SNMP scan would fail with an "SNMP unreachable" error. User would need to re-enter the community string in `DeviceModal`. This is the same failure mode as plugin API key corruption — acceptable.

3. **Mixed plaintext and encrypted values in the same array**
   - **Handling:** `decryptCredential()` passes through non-`$ENC:` strings as-is. Each device is processed independently. Some devices can have plaintext (pre-migration) and others encrypted — both work correctly.
   - **User Impact:** None. Transparent migration on next write cycle.

## Testing Strategy

### Unit Tests

- **New test suite:** `src/__tests__/vuln-device-encryption.test.ts`
  - Round-trip: create `VulnDevice` with `snmpCommunity`, serialize through `encryptVulnDeviceSecrets()`, verify `$ENC:` prefix, deserialize through `decryptVulnDeviceSecrets()`, verify original value restored
  - No-op: device with only `snmpSecretKey` (no `snmpCommunity`) passes through unchanged
  - Backward compat: device with plaintext `snmpCommunity` (no `$ENC:` prefix) passes through `decryptVulnDeviceSecrets()` unchanged
  - Empty/undefined: device with empty or undefined `snmpCommunity` passes through without error
  - Mixed array: array with some encrypted, some plaintext, some undefined — all handled correctly

### Manual Verification

- Add a device with manual SNMP community → inspect localStorage → verify `$ENC:` envelope
- Reload page → verify device still shows correct community in DeviceModal
- Start a scan → verify SNMP detection succeeds with the decrypted community
