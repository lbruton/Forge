# Tasks Document

## References

- **Issue:** FORGE-70
- **Spec Path:** `.spec-workflow/specs/FORGE-70-snmp-credential-encryption/`

## File Touch Map

| Action | File                                           | Scope                                                                                                                                   |
| ------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| MODIFY | `src/store/index.ts`                           | Add `encryptVulnDeviceSecrets()` / `decryptVulnDeviceSecrets()` helpers; extend `forgeStorage.getItem` and `forgeStorage.setItem` hooks |
| CREATE | `src/__tests__/vuln-device-encryption.test.ts` | Round-trip encryption tests for VulnDevice snmpCommunity                                                                                |

---

- [x] 1. Add VulnDevice encryption helpers and extend storage adapter hooks
  - **Files:** `src/store/index.ts` (MODIFY)
  - Add two helper functions (`encryptVulnDeviceSecrets`, `decryptVulnDeviceSecrets`) following the exact pattern of `encryptPluginSecrets` / `decryptPluginSecrets` at lines 28-76
  - Extend `forgeStorage.getItem` (after the existing plugin decryption block at line 100) to decrypt `vulnDevices[].snmpCommunity`
  - Extend `forgeStorage.setItem` (after the existing plugin encryption block at line 122) to encrypt `vulnDevices[].snmpCommunity`
  - **Recommended Agent:** Claude
  - _Leverage: `src/store/index.ts` (lines 28-140 — existing encryption helpers and storage adapter), `src/lib/credential-store.ts` (encryptCredential/decryptCredential API), `src/plugins/vuln-cisco/types.ts` (VulnDevice type)_
  - _Requirements: 1, 2, 3_
  - _Prompt: Implement the task for spec FORGE-70-snmp-credential-encryption, first run spec-workflow-guide to get the workflow guide then implement the task:_
    - _Role: TypeScript developer with storage encryption experience_
    - _Task: Add two async helper functions to `src/store/index.ts` that encrypt/decrypt `snmpCommunity` on `VulnDevice[]` arrays, then wire them into the existing `forgeStorage` adapter hooks._
    - _Context:_
      - _Read `src/store/index.ts` lines 28-76 to see `encryptPluginSecrets()` / `decryptPluginSecrets()` — follow this exact pattern._
      - _Read `src/lib/credential-store.ts` to understand `encryptCredential()` / `decryptCredential()` API._
      - _Read `src/plugins/vuln-cisco/types.ts` for the `VulnDevice` interface._
    - _Implementation:_
      1. _Add `async function encryptVulnDeviceSecrets(devices: VulnDevice[]): Promise<VulnDevice[]>` — iterate devices, clone each, if `snmpCommunity` is a non-empty string call `encryptCredential()` on it. Return the array._
      2. _Add `async function decryptVulnDeviceSecrets(devices: VulnDevice[]): Promise<VulnDevice[]>` — same pattern with `decryptCredential()`._
      3. _In `forgeStorage.getItem`, after the `inner.plugins` decryption block (around line 100), add: `if (inner.vulnDevices && Array.isArray(inner.vulnDevices)) { inner.vulnDevices = await decryptVulnDeviceSecrets(inner.vulnDevices as VulnDevice[]); }`_
      4. _In `forgeStorage.setItem`, after the `inner.plugins` encryption block (around line 122), add: `if (inner.vulnDevices && Array.isArray(inner.vulnDevices)) { inner.vulnDevices = await encryptVulnDeviceSecrets(inner.vulnDevices as VulnDevice[]); }`_
    - _Restrictions:_
      - _Do NOT modify `VulnDevice` type, `DeviceModal`, `VulnDashboard`, or any other file._
      - _Do NOT create new crypto utilities — reuse `encryptCredential` / `decryptCredential` from `credential-store.ts`._
      - _Do NOT change the `partialize` function._
      - _Import `VulnDevice` type — it's already imported at line 22._
    - _Success:_
      - _Two helper functions exist matching the `encryptPluginSecrets` / `decryptPluginSecrets` pattern._
      - _`forgeStorage.getItem` decrypts `vulnDevices[].snmpCommunity` after reading._
      - _`forgeStorage.setItem` encrypts `vulnDevices[].snmpCommunity` before writing._
      - _`npm run build` passes._
      - _Existing tests pass: `npm run test`._
    - _After implementation: Mark task [-] → [x] in tasks.md, log with log-implementation tool._

- [x] 2. Add unit tests for VulnDevice credential encryption
  - **Files:** `src/__tests__/vuln-device-encryption.test.ts` (CREATE)
  - Write a Vitest test suite covering the encryption/decryption helper round-trip
  - **Recommended Agent:** Claude
  - _Leverage: `src/__tests__/plugin-store.test.ts` (existing test patterns), `src/lib/credential-store.ts` (encryptCredential/decryptCredential/isEncrypted), `src/plugins/vuln-cisco/types.ts` (VulnDevice type)_
  - _Requirements: 1, 2, 3_
  - _Prompt: Implement the task for spec FORGE-70-snmp-credential-encryption, first run spec-workflow-guide to get the workflow guide then implement the task:_
    - _Role: TypeScript test engineer using Vitest_
    - _Task: Create `src/__tests__/vuln-device-encryption.test.ts` with tests covering the `encryptVulnDeviceSecrets` and `decryptVulnDeviceSecrets` helper functions._
    - _Context:_
      - _Read `src/store/index.ts` to find the helper functions added in Task 1._
      - _Read `src/__tests__/plugin-store.test.ts` for existing test patterns and imports._
      - _Read `src/lib/credential-store.ts` for the `isEncrypted()` utility._
    - _Test cases:_
      1. _**Round-trip**: Create a `VulnDevice` with `snmpCommunity: "mySecret"`. Run through `encryptVulnDeviceSecrets()`. Verify the `snmpCommunity` field starts with `$ENC:`. Run through `decryptVulnDeviceSecrets()`. Verify original value is restored._
      2. _**No-op for snmpSecretKey devices**: Device with `snmpSecretKey: "FORGE_SNMP_CORE"` and no `snmpCommunity`. Verify it passes through both functions unchanged._
      3. _**Backward compat**: Device with plaintext `snmpCommunity` (no `$ENC:` prefix). Verify `decryptVulnDeviceSecrets()` passes it through as-is._
      4. _**Empty/undefined**: Device with `snmpCommunity: undefined` and `snmpCommunity: ""`. Verify both pass through without error._
      5. _**Mixed array**: Array with one encrypted, one plaintext, one undefined `snmpCommunity`. Verify each is handled correctly._
      6. _**Idempotency**: Running `encryptVulnDeviceSecrets()` twice on the same device does not double-encrypt (because `encryptCredential` checks for `$ENC:` prefix)._
    - _Restrictions:_
      - _Use Vitest (`describe`, `it`, `expect`)._
      - _The helpers may not be exported — if so, test via the store's serialization cycle or export them for testing._
      - _Do NOT mock `crypto.subtle` — Web Crypto is available in Node 20+ which the project uses._
    - _Success:_
      - _All 6 test cases pass: `npm run test`._
      - _Test file follows existing patterns from the `__tests__/` directory._
    - _After implementation: Mark task [-] → [x] in tasks.md, log with log-implementation tool._

---

### Standard Closing Tasks

- [x] 3. Final verification and cleanup
  - Run `npm run build` and `npm run test` to confirm no regressions
  - Run `npx tsc --noEmit -p tsconfig.app.json` for type checking (ignore pre-existing dompurify error)
  - Verify the full test suite passes
  - **Recommended Agent:** Claude
  - _Leverage: `package.json` (npm scripts)_
  - _Requirements: 3 (no functional regression)_
  - _Prompt: Implement the task for spec FORGE-70-snmp-credential-encryption, first run spec-workflow-guide to get the workflow guide then implement the task:_
    - _Role: QA verification engineer_
    - _Task: Run all verification commands and confirm no regressions from the FORGE-70 changes._
    - _Commands:_
      1. _`npm run build` — must pass_
      2. _`npm run test` — all test suites must pass (11 existing + 1 new)_
      3. _`npx tsc --noEmit -p tsconfig.app.json` — must pass (ignore pre-existing dompurify type error)_
      4. _`npm run lint` — must pass_
    - _Restrictions: Do NOT fix any pre-existing issues. Only verify that the FORGE-70 changes introduced no new problems._
    - _Success: All commands pass. No new errors or warnings introduced._
    - _After implementation: Mark task [-] → [x] in tasks.md, log with log-implementation tool._
