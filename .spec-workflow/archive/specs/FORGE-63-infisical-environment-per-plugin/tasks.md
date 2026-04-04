# Tasks Document

## References

- **Issue:** FORGE-63
- **Spec Path:** `.spec-workflow/specs/FORGE-63-infisical-environment-per-plugin/`

## File Touch Map

| Action | File                                          | Scope                                                  |
| ------ | --------------------------------------------- | ------------------------------------------------------ |
| CREATE | `src/lib/infisical-env.ts`                    | `resolveInfisicalEnv` helper function                  |
| CREATE | `src/__tests__/infisical-env.test.ts`         | Unit tests for helper                                  |
| MODIFY | `src/plugins/vuln-cisco/manifest.ts`          | Add `settingsSchema` with `infisicalEnvironment` field |
| MODIFY | `src/plugins/vuln-cisco/VulnDashboard.tsx`    | Refactor 1 call site to use helper                     |
| MODIFY | `src/plugins/vuln-cisco/DeviceModal.tsx`      | Refactor 3 call sites to use helper                    |
| MODIFY | `src/plugins/vuln-cisco/PsirtCredentials.tsx` | Refactor 2 call sites to use helper                    |

**Not touched:** `GlobalVariablesPage.tsx` (app-scoped, uses `defaultEnvironment` directly), `SecretsBrowser.tsx` (UI browser, user selects environment interactively).

---

- [x] 1. Create `resolveInfisicalEnv` helper function
  - **File:** `src/lib/infisical-env.ts` (CREATE)
  - Create a pure helper function that resolves the Infisical environment for a given plugin context using the three-tier fallback chain: plugin setting -> global default -> `'dev'`.
  - Function signature: `resolveInfisicalEnv(callingPluginName: string, getPlugin: (name: string) => PluginRegistration | undefined): string`
  - The function receives `getPlugin` as a parameter (not imported from the store) to keep it pure and testable.
  - Follow the pattern of existing `src/lib/validators.ts` — pure function, no side effects, no store dependency.
  - **Recommended Agent:** Claude
  - _Leverage: `src/lib/validators.ts` (pattern), `src/types/plugin.ts` (PluginRegistration type), design.md resolveInfisicalEnv section_
  - _Requirements: 2.1, 2.2, 2.3_
  - _Prompt: "Implement the task for spec FORGE-63-infisical-environment-per-plugin, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript Developer | Task: Create `src/lib/infisical-env.ts` with a single exported function `resolveInfisicalEnv(callingPluginName: string, getPlugin: (name: string) => PluginRegistration | undefined): string`. Resolution chain: (1) `getPlugin(callingPluginName)?.settings?.infisicalEnvironment` as string, (2) `getPlugin('forge-infisical')?.settings?.defaultEnvironment` as string, (3) `'dev'`. Import `PluginRegistration` from `../../types/plugin.ts`. Follow the pattern of `src/lib/validators.ts` — pure function, no side effects, named export. | Restrictions: Do NOT import the Zustand store. Do NOT add error handling beyond what the chain already provides via optional chaining. Keep it minimal — one function, one file, no classes. | Success: `resolveInfisicalEnv` returns the correct environment string for all three fallback levels. File compiles with `npx tsc --noEmit -p tsconfig.app.json` (ignoring pre-existing dompurify error). After implementing, mark this task in-progress [-] in tasks.md, call log-implementation, then mark [x]."_

- [x] 2. Add unit tests for `resolveInfisicalEnv`
  - **File:** `src/__tests__/infisical-env.test.ts` (CREATE)
  - Write Vitest tests covering all five scenarios from the design's testing strategy:
    - Plugin env set -> returns plugin env
    - Plugin env empty, global env set -> returns global env
    - Both empty -> returns `'dev'`
    - Calling plugin not registered -> falls through to global
    - Infisical plugin not registered -> returns `'dev'`
  - **Recommended Agent:** Claude
  - _Leverage: `src/__tests__/template-parser.test.ts` (test pattern), `src/lib/infisical-env.ts` (Task 1 output)_
  - _Requirements: 1.1, 1.2, 1.3_
  - _Prompt: "Implement the task for spec FORGE-63-infisical-environment-per-plugin, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Test Engineer | Task: Create `src/__tests__/infisical-env.test.ts` with Vitest tests for `resolveInfisicalEnv`. Create a mock `getPlugin` function that returns controlled `PluginRegistration` objects. Test these 5 cases: (1) Plugin has `infisicalEnvironment: 'vulnerabilities'` -> returns `'vulnerabilities'`, (2) Plugin has no `infisicalEnvironment` but Infisical plugin has `defaultEnvironment: 'production'` -> returns `'production'`, (3) Both empty -> returns `'dev'`, (4) Calling plugin not registered, Infisical has `defaultEnvironment: 'staging'` -> returns `'staging'`, (5) Neither plugin registered -> returns `'dev'`. | Restrictions: Do NOT mock the Zustand store. The helper takes `getPlugin` as a parameter — just pass a mock function. Follow existing test patterns in `src/__tests__/`. | Success: All 5 tests pass with `npm run test`. After implementing, mark this task in-progress [-] in tasks.md, call log-implementation, then mark [x]."_

- [x] 3. Add `settingsSchema` to vuln-cisco manifest
  - **File:** `src/plugins/vuln-cisco/manifest.ts` (MODIFY)
  - Replace the `// No settingsSchema` comment with an actual `settingsSchema` containing the `infisicalEnvironment` field.
  - Field config: `type: 'string'`, `label: 'Infisical Environment'`, `description` explaining it's the environment slug for this plugin's secrets, `required: false`.
  - **Recommended Agent:** Claude
  - _Leverage: `src/plugins/infisical/manifest.ts` (pattern for settingsSchema), `src/plugins/vuln-cisco/manifest.ts` (current file)_
  - _Requirements: 1.4_
  - _Prompt: "Implement the task for spec FORGE-63-infisical-environment-per-plugin, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript Developer | Task: In `src/plugins/vuln-cisco/manifest.ts`, replace the comment `// No settingsSchema — PSIRT credentials are managed via Infisical (PsirtCredentials component)` with an actual `settingsSchema` property. Add one field: `infisicalEnvironment` with `type: 'string'`, `label: 'Infisical Environment'`, `description: 'Infisical environment slug for this plugin\'s secrets (e.g., \"vulnerabilities\"). Leave blank to use the global default.'`, `required: false`. Reference `src/plugins/infisical/manifest.ts` for the settingsSchema pattern. | Restrictions: Do NOT change any other manifest fields. Only replace the comment with the settingsSchema. | Success: The vuln-cisco plugin settings panel in PluginPanel shows a new 'Infisical Environment' text input. File compiles cleanly. After implementing, mark this task in-progress [-] in tasks.md, call log-implementation, then mark [x]."_

- [x] 4. Refactor vuln-cisco call sites to use `resolveInfisicalEnv`
  - **Files:** `VulnDashboard.tsx`, `DeviceModal.tsx`, `PsirtCredentials.tsx` (MODIFY)
  - Replace all 6 inline `defaultEnvironment || 'dev'` patterns across these 3 files with calls to `resolveInfisicalEnv('forge-vuln-cisco', getPlugin)`.
  - Each file needs: import `resolveInfisicalEnv` from `../../lib/infisical-env.ts`, ensure `getPlugin` is available from the store, replace the inline pattern.
  - Specific call sites:
    - `VulnDashboard.tsx:~202` — 1 site (scan launch)
    - `DeviceModal.tsx:~61, ~98, ~349` — 3 sites (save SNMP, read SNMP, environment display)
    - `PsirtCredentials.tsx:~61, ~326` — 2 sites (credential check, credential setup)
  - **Recommended Agent:** Claude
  - _Leverage: `src/lib/infisical-env.ts` (Task 1 output), design.md Call Site Refactoring table_
  - _Requirements: 1.1, 2.1_
  - _Prompt: "Implement the task for spec FORGE-63-infisical-environment-per-plugin, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript Developer | Task: Refactor 6 call sites across 3 vuln-cisco files to use the `resolveInfisicalEnv` helper instead of inline `defaultEnvironment || 'dev'` patterns. In each file: (1) add `import { resolveInfisicalEnv } from '../../lib/infisical-env.ts';`, (2) ensure `getPlugin` is available from `useForgeStore`, (3) replace each `(infisicalPlugin?.settings?.defaultEnvironment as string) || 'dev'` with `resolveInfisicalEnv('forge-vuln-cisco', getPlugin)`. Files and sites: `VulnDashboard.tsx` (~line 202, 1 site), `DeviceModal.tsx` (~lines 61, 98, 349, 3 sites), `PsirtCredentials.tsx` (~lines 61, 326, 2 sites). Read each file first to find exact locations. Some sites may also have a `const settings = infisicalPlugin?.settings ?? {}` pattern that can be simplified when the only use was `settings.defaultEnvironment`. | Restrictions: Do NOT touch `GlobalVariablesPage.tsx` or `SecretsBrowser.tsx`. Do NOT change any logic beyond the environment resolution — same credential flow, same error handling. If a file already has `getPlugin` from the store, reuse it. If not, add it to the existing `useForgeStore` selector. | Success: All 6 call sites use `resolveInfisicalEnv`. No remaining `defaultEnvironment || 'dev'` patterns in vuln-cisco files (verify with grep). `npm run build` passes. `npm run test` passes. After implementing, mark this task in-progress [-] in tasks.md, call log-implementation, then mark [x]."_

---

## Standard Closing Tasks

- [x] 5. Final verification
  - Run `npm run build` and `npm run test` to confirm no regressions.
  - Run `npx tsc --noEmit -p tsconfig.app.json` to confirm type safety (ignore pre-existing dompurify error).
  - Grep all vuln-cisco files for any remaining `defaultEnvironment || 'dev'` patterns — should find zero matches.
  - Verify `GlobalVariablesPage.tsx` still uses `defaultEnvironment` directly (no regression).
  - _Requirements: 3.1, 3.2, 3.3_
  - _Prompt: "Implement the task for spec FORGE-63-infisical-environment-per-plugin, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA Engineer | Task: Run final verification for the FORGE-63 spec. (1) `npm run build` — must pass. (2) `npm run test` — all 11+ test suites must pass including the new infisical-env tests. (3) `npx tsc --noEmit -p tsconfig.app.json` — must pass (ignore pre-existing dompurify error). (4) `grep -rn 'defaultEnvironment.*dev' src/plugins/vuln-cisco/` — must return zero results. (5) `grep -n 'defaultEnvironment' src/components/GlobalVariablesPage.tsx` — must still show the original pattern (not refactored). | Restrictions: Do NOT fix any issues — report them. This is verification only. | Success: All checks pass, or a clear report of failures is produced. After verifying, mark this task in-progress [-] in tasks.md, call log-implementation, then mark [x]."_
