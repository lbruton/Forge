import { describe, test, expect } from 'vitest';
import { normalizeOption } from '../types/index.ts';
import type { DropdownOption } from '../types/index.ts';

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

  describe('normalizeOption (label/value pairs)', () => {
    test('normalizes plain string to { label, value }', () => {
      expect(normalizeOption('access')).toEqual({ label: 'access', value: 'access' });
    });

    test('normalizes DropdownOption with label', () => {
      const opt: DropdownOption = { label: 'Access Mode', value: 'access' };
      expect(normalizeOption(opt)).toEqual({ label: 'Access Mode', value: 'access' });
    });

    test('uses value as label when label is omitted', () => {
      const opt: DropdownOption = { value: 'trunk' };
      expect(normalizeOption(opt)).toEqual({ label: 'trunk', value: 'trunk' });
    });

    test('mixed array of strings and objects normalizes correctly', () => {
      const options: (string | DropdownOption)[] = [
        'plain',
        { label: 'Labeled', value: 'labeled-val' },
        { value: 'no-label' },
      ];
      const normalized = options.map(normalizeOption);
      expect(normalized).toEqual([
        { label: 'plain', value: 'plain' },
        { label: 'Labeled', value: 'labeled-val' },
        { label: 'no-label', value: 'no-label' },
      ]);
    });
  });
});
