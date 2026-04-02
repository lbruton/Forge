# Implementation Readiness Report

- **Spec**: FORGE-34-stvault-import-export-upgrade
- **Generated**: 2026-04-02T00:56:00Z
- **Recommendation**: PASS

## Requirement Coverage (16/16 mapped)

### R1: Complete Data Export (4 criteria)

- R1.1 (vulnDevices with SNMP stripped): Task 1, Task 2 ✓
- R1.2 (preferences minus expandedNodes): Task 1, Task 2 ✓
- R1.3 (vulnScanCache opt-in): Task 2, Task 5 ✓
- R1.4 (credential stripping pattern): Task 2 ✓

### R2: Complete Data Import (5 criteria)

- R2.1 (merge vuln devices by ID): Task 3 ✓
- R2.2 (deep-merge preferences): Task 3 ✓
- R2.3 (additive scan cache merge): Task 3 ✓
- R2.4 (backward compat — missing fields): Task 3, Task 4 ✓
- R2.5 (orphaned viewId reassignment): Task 3, Task 4 ✓

### R3: Plugin Re-Setup Notice (2 criteria)

- R3.1 (plugin re-setup notice): Task 6 ✓
- R3.2 (SNMP re-entry notice): Task 6 ✓

### R4: Selective Export (4 criteria)

- R4.1 (category checkboxes): Task 5 ✓
- R4.2 (unchecked excluded): Task 2, Task 5 ✓
- R4.3 (scan history opt-in): Task 5 ✓
- R4.4 (item counts): Task 5 ✓

### R5: Selective Import with Merge/Replace (6 criteria)

- R5.1 (merge/replace toggle): Task 6 ✓
- R5.2 (replace confirmation warning): Task 6 ✓
- R5.3 (resetAll before import): Task 6 ✓
- R5.4 (import category checkboxes): Task 6 ✓
- R5.5 (unchecked excluded): Task 6 ✓
- R5.6 (existing conflict UI preserved): Task 6 ✓

### R6: Enhanced Import Preview (3 criteria)

- R6.1 (full category counts): Task 6 ✓
- R6.2 (plugin re-setup in preview): Task 6 ✓
- R6.3 (vuln device notice in preview): Task 6 ✓

**Orphaned requirements:** None

## Design-Task Alignment

- VaultExportData extension: Task 1 ✓
- ExportOptions interface: Task 1 ✓
- exportData() update with credential stripping: Task 2 ✓
- importData() update with merge logic: Task 3 ✓
- VaultModal export tab checkboxes: Task 5 ✓
- VaultModal import tab merge/replace + notices: Task 6 ✓
- resetAll() integration: Task 6 ✓
- countData() expansion: Task 6 ✓

**Design elements with no implementing task:** None

## Contradictions

None found. Requirements, design, and tasks are internally consistent:

- All three documents agree on SNMP stripping approach (same as FORGE-64 plugin pattern)
- All three agree on scan cache default (off)
- All three agree on expandedNodes exclusion from preferences export
- Design's "resetAll outside importData" approach correctly reflected in Task 6 (VaultModal calls resetAll then importData)

## Prototype Consistency

N/A — design declares `Prototype Required: No`. UI changes are minor element additions (checkboxes, toggle, info boxes) to an existing modal with clear analogues.

## File Touch Map

- Task 1 touches `src/types/index.ts` — in File Touch Map ✓
- Task 2 touches `src/store/index.ts` — in File Touch Map ✓
- Task 3 touches `src/store/index.ts` — in File Touch Map ✓
- Task 4 touches `src/__tests__/vault-roundtrip.test.ts` — in File Touch Map ✓
- Task 5 touches `src/components/VaultModal.tsx` — in File Touch Map ✓
- Task 6 touches `src/components/VaultModal.tsx` — in File Touch Map ✓
- Task 7 (verification) — no new file touches, runs existing tooling ✓

**Omissions:** None

## Agent Recommendation

**PASS** — All 16 acceptance criteria across 6 requirements are mapped to implementing tasks with no orphans, gaps, or contradictions. The File Touch Map is consistent with individual task scopes. No prototype is needed (minor UI additions to an existing modal). The spec is well-scoped at 4 files and 7 tasks. Ready for implementation.
