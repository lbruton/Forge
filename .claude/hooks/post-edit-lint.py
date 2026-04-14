#!/usr/bin/env python3
"""Claude Code post-edit lint hook for Forge (React 19 + Vite + TypeScript + Tailwind v4).

Reads Claude Code hook JSON from stdin, runs appropriate linters on the edited file,
and prints feedback. Always exits 0 (non-blocking, feedback only).
"""

import json
import os
import subprocess
import sys

PROJECT_DIR = "/Volumes/DATA/GitHub/Forge"
TESTS_DIR = os.path.join(PROJECT_DIR, "src/__tests__")
TSC_TIMEOUT = 30
DEFAULT_TIMEOUT = 15
TEST_TIMEOUT = 30


def run_cmd(cmd: list[str], timeout: int, max_lines: int) -> str | None:
    """Run a command and return truncated stderr+stdout on failure, or None on success."""
    try:
        result = subprocess.run(
            cmd,
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if result.returncode != 0:
            output = (result.stdout + result.stderr).strip()
            if not output:
                return None
            lines = output.splitlines()[:max_lines]
            return "\n".join(lines)
    except subprocess.TimeoutExpired:
        return f"(timed out after {timeout}s)"
    except FileNotFoundError:
        return None
    return None


def main() -> None:
    try:
        payload = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, EOFError):
        return

    tool_name = payload.get("tool_name", "")
    if tool_name not in ("Edit", "Write"):
        return

    tool_input = payload.get("tool_input", {})
    file_path = tool_input.get("file_path", "")
    if not file_path or not os.path.isfile(file_path):
        return

    ext = os.path.splitext(file_path)[1].lower()

    if ext in (".ts", ".tsx"):
        # Project-wide type check (must use tsconfig.app.json, not root tsconfig)
        tsc_err = run_cmd(
            ["npx", "tsc", "--noEmit", "-p", "tsconfig.app.json"],
            timeout=TSC_TIMEOUT,
            max_lines=15,
        )
        if tsc_err:
            print(f"[lint] tsc errors:\n{tsc_err}")

        # File-level ESLint
        eslint_err = run_cmd(
            ["npx", "eslint", file_path],
            timeout=DEFAULT_TIMEOUT,
            max_lines=10,
        )
        if eslint_err:
            print(f"[lint] eslint {os.path.basename(file_path)}:\n{eslint_err}")

        # Run matching test suite if one exists (skip test files themselves)
        base = os.path.splitext(os.path.basename(file_path))[0]
        if not base.endswith(".test"):
            test_file = os.path.join(TESTS_DIR, f"{base}.test.ts")
            if os.path.isfile(test_file):
                test_err = run_cmd(
                    ["npx", "vitest", "run", test_file],
                    timeout=TEST_TIMEOUT,
                    max_lines=20,
                )
                if test_err:
                    print(f"[lint] vitest {base}.test.ts:\n{test_err}")
                else:
                    print(f"[lint] vitest {base}.test.ts: passed")

    elif ext == ".css":
        prettier_err = run_cmd(
            ["npx", "prettier", "--check", file_path],
            timeout=DEFAULT_TIMEOUT,
            max_lines=5,
        )
        if prettier_err:
            print(f"[lint] prettier {os.path.basename(file_path)}:\n{prettier_err}")

    elif ext in (".json", ".md"):
        prettier_err = run_cmd(
            ["npx", "prettier", "--check", file_path],
            timeout=DEFAULT_TIMEOUT,
            max_lines=5,
        )
        if prettier_err:
            print(f"[lint] prettier {os.path.basename(file_path)}:\n{prettier_err}")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass  # Never crash, never block
    sys.exit(0)
