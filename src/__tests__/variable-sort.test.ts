import { describe, it, expect } from 'vitest';
import { mergeVariablesOrderPreserving } from '../components/TemplateEditor.tsx';
import { groupVariablesBySection } from '../components/VariableForm.tsx';
import type { VariableDefinition, VariableType, TemplateSection } from '../types/index.ts';

function makeVar(name: string, overrides?: Partial<VariableDefinition>): VariableDefinition {
  return {
    name,
    label: '',
    type: 'string' as VariableType,
    defaultValue: '',
    options: [],
    required: false,
    description: '',
    ...overrides,
  };
}

function makeSection(
  overrides: Partial<TemplateSection> & Pick<TemplateSection, 'id' | 'name'>,
): TemplateSection {
  return {
    template: '',
    order: 0,
    dividerPattern: '',
    ...overrides,
  };
}

// ── Suite A: mergeVariablesOrderPreserving ────────────────────────

describe('mergeVariablesOrderPreserving', () => {
  it('existing variables retain position after re-parse', () => {
    const existing = [makeVar('A'), makeVar('B'), makeVar('C')];
    const parsed = [makeVar('C'), makeVar('A'), makeVar('B')];
    const result = mergeVariablesOrderPreserving(existing, parsed);
    expect(result.map((v) => v.name)).toEqual(['A', 'B', 'C']);
  });

  it('new variable appended at end', () => {
    const existing = [makeVar('A'), makeVar('B')];
    const parsed = [makeVar('A'), makeVar('B'), makeVar('C')];
    const result = mergeVariablesOrderPreserving(existing, parsed);
    expect(result.map((v) => v.name)).toEqual(['A', 'B', 'C']);
  });

  it('removed variable disappears without disrupting order', () => {
    const existing = [makeVar('A'), makeVar('B'), makeVar('C')];
    const parsed = [makeVar('A'), makeVar('C')];
    const result = mergeVariablesOrderPreserving(existing, parsed);
    expect(result.map((v) => v.name)).toEqual(['A', 'C']);
  });

  it('metadata preserved from existing', () => {
    const existing = [makeVar('A', { label: 'Hostname', type: 'ip', description: 'The host' })];
    const parsed = [makeVar('A', { label: '', type: 'string', description: '' })];
    const result = mergeVariablesOrderPreserving(existing, parsed);
    expect(result[0].label).toBe('Hostname');
    expect(result[0].type).toBe('ip');
    expect(result[0].description).toBe('The host');
  });

  it('empty existing array returns all parsed in parse order', () => {
    const parsed = [makeVar('X'), makeVar('Y'), makeVar('Z')];
    const result = mergeVariablesOrderPreserving([], parsed);
    expect(result.map((v) => v.name)).toEqual(['X', 'Y', 'Z']);
  });

  it('empty parsed array returns empty result', () => {
    const existing = [makeVar('A'), makeVar('B')];
    const result = mergeVariablesOrderPreserving(existing, []);
    expect(result).toEqual([]);
  });
});

// ── Suite B: groupVariablesBySection ─────────────────────────────

describe('groupVariablesBySection', () => {
  it('groups variables by the section they appear in', () => {
    const variables = [makeVar('hostname'), makeVar('vlan_ip'), makeVar('acl_name')];
    const sections: TemplateSection[] = [
      makeSection({ id: 's1', name: 'Base', template: 'hostname $hostname', order: 0 }),
      makeSection({ id: 's2', name: 'VLAN', template: 'ip address $vlan_ip 255.255.255.0', order: 1 }),
      makeSection({ id: 's3', name: 'ACL', template: 'ip access-list $acl_name', order: 2 }),
    ];

    const groups = groupVariablesBySection(variables, sections);
    expect(groups).toHaveLength(3);
    expect(groups[0].sectionName).toBe('Base');
    expect(groups[0].vars.map((v) => v.name)).toEqual(['hostname']);
    expect(groups[1].sectionName).toBe('VLAN');
    expect(groups[1].vars.map((v) => v.name)).toEqual(['vlan_ip']);
    expect(groups[2].sectionName).toBe('ACL');
    expect(groups[2].vars.map((v) => v.name)).toEqual(['acl_name']);
  });

  it('unassigned variables go into Other group', () => {
    const variables = [makeVar('hostname'), makeVar('orphan_var')];
    const sections: TemplateSection[] = [
      makeSection({ id: 's1', name: 'Base', template: 'hostname $hostname', order: 0 }),
    ];

    const groups = groupVariablesBySection(variables, sections);
    expect(groups).toHaveLength(2);
    expect(groups[0].sectionName).toBe('Base');
    expect(groups[1].sectionName).toBe('Other');
    expect(groups[1].vars.map((v) => v.name)).toEqual(['orphan_var']);
  });

  it('variable assigned to first matching section only', () => {
    const variables = [makeVar('hostname')];
    const sections: TemplateSection[] = [
      makeSection({ id: 's1', name: 'First', template: '$hostname here', order: 0 }),
      makeSection({ id: 's2', name: 'Second', template: '$hostname again', order: 1 }),
    ];

    const groups = groupVariablesBySection(variables, sections);
    expect(groups).toHaveLength(1);
    expect(groups[0].sectionName).toBe('First');
  });

  it('empty variables returns empty groups', () => {
    const sections: TemplateSection[] = [
      makeSection({ id: 's1', name: 'Base', template: 'hostname $hostname', order: 0 }),
    ];
    const groups = groupVariablesBySection([], sections);
    expect(groups).toHaveLength(0);
  });

  // When customVariableOrder is true, VariableForm renders a flat list
  // instead of calling groupVariablesBySection. This is a rendering concern
  // (groups === null branch at line ~128 of VariableForm.tsx) and does not
  // need a unit test here since groupVariablesBySection is simply bypassed.
});
