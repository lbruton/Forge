---
name: release
description: Forge-specific release override — Phase 1 version bump recipe for package.json, version.lock, and CHANGELOG.md.
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
---

# Release — Forge Project Override

Overrides Phase 1 of the user-level `/release` skill. The parent skill handles
everything else (lock protocol, worktree, PR, GitHub Release, cleanup).

## Phase 1: Version Bump (Forge-specific)

All edits happen inside the worktree directory.

### 1.1: `package.json`

Update the `version` field to `NEW_VERSION`:

```json
"version": "NEW_VERSION"
```

### 1.2: `devops/version.lock`

Update the top-level `version` field to `NEW_VERSION`.
The parent skill's Step 0.2 should have already done this during claim,
but verify it matches. If it doesn't, fix it now.

```json
{
  "version": "NEW_VERSION",
  "claims": [...]
}
```

### 1.3: `CHANGELOG.md`

Insert a new section before the first versioned heading:

```markdown
## [NEW_VERSION] - YYYY-MM-DD

### Changed

- **Label**: Description (FORGE-XX)

---
```

Use the commit log and issue references gathered in Phase 0.3 to populate the bullets.

## Phase 2: Verify (Forge-specific)

1. Confirm version string appears in both `package.json` and `devops/version.lock`:

   ```bash
   grep "NEW_VERSION" package.json devops/version.lock
   ```

2. Run the build to verify `__APP_VERSION__` will render correctly:

   ```bash
   npm run build
   ```

3. Run the full test suite:

   ```bash
   npm run test
   ```

4. Type-check (Forge-specific gotcha — root tsconfig has `files: []`):
   ```bash
   npx tsc --noEmit -p tsconfig.app.json
   ```
   Ignore the pre-existing `dompurify` type error.

## Notes

- Forge PRs directly to `main` (no `dev` branch)
- Version displays in the app header via `v{__APP_VERSION__}` (Vite injects from package.json)
- `chore:` PRs from `/gsd` sessions skip version bump — they roll into the next release
