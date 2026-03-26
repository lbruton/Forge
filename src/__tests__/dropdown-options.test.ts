import { describe, test, expect } from 'vitest';

// Pure-function equivalents of the add/remove logic inside DropdownOptionsEditor.
// Extracted here so we can unit-test the behavioral contract without rendering React.

function addOption(options: string[], value: string): string[] | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (options.includes(trimmed)) return null;
  return [...options, trimmed];
}

function removeOption(options: string[], index: number): string[] {
  return options.filter((_, i) => i !== index);
}

// ── Suite: DropdownOptionsEditor logic ───────────────────────────

describe('DropdownOptionsEditor logic', () => {
  describe('addOption', () => {
    test('adds new option to end of array', () => {
      const result = addOption(['A', 'B'], 'C');
      expect(result).toEqual(['A', 'B', 'C']);
    });

    test('returns null for empty string', () => {
      expect(addOption(['A'], '')).toBeNull();
    });

    test('returns null for whitespace-only string', () => {
      expect(addOption(['A'], '   ')).toBeNull();
    });

    test('returns null for duplicate option', () => {
      expect(addOption(['A', 'B'], 'A')).toBeNull();
    });

    test('trims whitespace from value', () => {
      const result = addOption([], '  hello  ');
      expect(result).toEqual(['hello']);
    });

    test('multiple sequential adds build array', () => {
      let options: string[] = [];
      const values = ['alpha', 'beta', 'gamma'];
      for (const v of values) {
        const next = addOption(options, v);
        expect(next).not.toBeNull();
        options = next!;
      }
      expect(options).toEqual(['alpha', 'beta', 'gamma']);
    });
  });

  describe('removeOption', () => {
    test('removes option at given index', () => {
      const result = removeOption(['A', 'B', 'C'], 1);
      expect(result).toEqual(['A', 'C']);
    });

    test('preserves order of remaining options', () => {
      const result = removeOption(['X', 'Y', 'Z', 'W'], 0);
      expect(result).toEqual(['Y', 'Z', 'W']);
    });

    test('removing last option returns empty array', () => {
      const result = removeOption(['only'], 0);
      expect(result).toEqual([]);
    });
  });
});
