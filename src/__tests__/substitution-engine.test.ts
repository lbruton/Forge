import { describe, it, expect } from 'vitest';
import { generateConfig } from '../lib/substitution-engine.ts';
import type { TemplateSection } from '../types/index.ts';

function makeSection(
  overrides: Partial<TemplateSection> & Pick<TemplateSection, 'template'>,
): TemplateSection {
  return {
    id: overrides.id ?? 'sec-1',
    name: overrides.name ?? 'Section',
    template: overrides.template,
    order: overrides.order ?? 0,
    dividerPattern: overrides.dividerPattern ?? '!',
  };
}

describe('generateConfig', () => {
  it('replaces a single variable in all occurrences', () => {
    const sections = [
      makeSection({ template: 'hostname $hostname\nbanner motd $hostname' }),
    ];
    const result = generateConfig(sections, { hostname: 'SWITCH01' });

    expect(result.sections[0].content).toBe('hostname SWITCH01\nbanner motd SWITCH01');
  });

  it('replaces multiple variables across multiple sections', () => {
    const sections = [
      makeSection({
        id: 's1',
        name: 'Base',
        template: 'hostname $hostname',
        order: 0,
        dividerPattern: '!',
      }),
      makeSection({
        id: 's2',
        name: 'Interface',
        template: 'interface $iface\n ip address $ip_addr 255.255.255.0',
        order: 1,
        dividerPattern: '!',
      }),
    ];
    const result = generateConfig(sections, {
      hostname: 'SWITCH01',
      iface: 'Vlan95',
      ip_addr: '10.0.95.1',
    });

    expect(result.sections[0].content).toBe('hostname SWITCH01');
    expect(result.sections[1].content).toBe('interface Vlan95\n ip address 10.0.95.1 255.255.255.0');
  });

  it('replaces cross-section variables consistently', () => {
    const sections = [
      makeSection({ id: 's1', name: 'A', template: 'set name $hostname', order: 0 }),
      makeSection({ id: 's2', name: 'B', template: 'logging host $hostname', order: 1 }),
    ];
    const result = generateConfig(sections, { hostname: 'CORE01' });

    expect(result.sections[0].content).toBe('set name CORE01');
    expect(result.sections[1].content).toBe('logging host CORE01');
  });

  it('leaves placeholder as-is when no value provided', () => {
    const sections = [makeSection({ template: 'hostname $hostname' })];
    const result = generateConfig(sections, {});

    expect(result.sections[0].content).toBe('hostname $hostname');
  });

  it('leaves placeholder as-is when value is empty string', () => {
    const sections = [makeSection({ template: 'hostname $hostname' })];
    const result = generateConfig(sections, { hostname: '' });

    expect(result.sections[0].content).toBe('hostname $hostname');
  });

  it('does not substitute Cisco password literals like $9$...', () => {
    const sections = [
      makeSection({
        template: 'enable secret $9$abc123def456\nusername admin secret $9$xyz',
      }),
    ];
    const result = generateConfig(sections, {});

    expect(result.sections[0].content).toBe(
      'enable secret $9$abc123def456\nusername admin secret $9$xyz',
    );
  });

  it('reconstructs fullConfig with dividers between sections', () => {
    const sections = [
      makeSection({ id: 's1', name: 'A', template: 'line one', order: 0, dividerPattern: '!' }),
      makeSection({ id: 's2', name: 'B', template: 'line two', order: 1, dividerPattern: '!' }),
      makeSection({ id: 's3', name: 'C', template: 'line three', order: 2, dividerPattern: '!---' }),
    ];
    const result = generateConfig(sections, {});

    expect(result.fullConfig).toBe('line one\n!\nline two\n!---\nline three');
  });

  it('returns empty result for empty sections array', () => {
    const result = generateConfig([], {});

    expect(result.fullConfig).toBe('');
    expect(result.sections).toEqual([]);
  });

  it('replaces ${variable} brace syntax correctly', () => {
    const sections = [makeSection({ template: 'hostname ${hostname}' })];
    const result = generateConfig(sections, { hostname: 'SWITCH01' });

    expect(result.sections[0].content).toBe('hostname SWITCH01');
  });

  it('replaces both $var and ${var} syntax for the same variable', () => {
    const sections = [
      makeSection({ template: 'name $hostname alias ${hostname}' }),
    ];
    const result = generateConfig(sections, { hostname: 'CORE01' });

    expect(result.sections[0].content).toBe('name CORE01 alias CORE01');
  });

  it('resolves ${var} from globalValues parameter', () => {
    const sections = [
      makeSection({ template: 'ntp server ${ntp_server}\nhostname $hostname' }),
    ];
    const result = generateConfig(sections, { hostname: 'SWITCH01' }, { ntp_server: '10.0.0.1' });

    expect(result.sections[0].content).toBe('ntp server 10.0.0.1\nhostname SWITCH01');
  });

  it('backward compat: works without globalValues parameter', () => {
    const sections = [makeSection({ template: 'hostname $hostname' })];
    const result = generateConfig(sections, { hostname: 'SWITCH01' });

    expect(result.sections[0].content).toBe('hostname SWITCH01');
  });

  it('resolves only global values when no local values match', () => {
    const sections = [
      makeSection({ template: 'ntp server ${ntp_server}\nenable secret ${enable_password}' }),
    ];
    const result = generateConfig(sections, {}, { ntp_server: '10.0.0.1', enable_password: 'secret123' });

    expect(result.sections[0].content).toBe('ntp server 10.0.0.1\nenable secret secret123');
  });

  it('leaves unfilled ${var} as-is when no global or local value provided', () => {
    const sections = [
      makeSection({ template: 'ntp server ${ntp_server}\nhostname $hostname' }),
    ];
    const result = generateConfig(sections, {}, {});

    expect(result.sections[0].content).toBe('ntp server ${ntp_server}\nhostname $hostname');
  });

  it('${var} resolved from globalValues takes priority over localValues', () => {
    const sections = [
      makeSection({ template: 'server ${shared_var}' }),
    ];
    const result = generateConfig(
      sections,
      { shared_var: 'local_value' },
      { shared_var: 'global_value' },
    );

    expect(result.sections[0].content).toBe('server global_value');
  });

  it('matches longest variable name (greedy word chars)', () => {
    const sections = [
      makeSection({ template: 'ip address $vlan_95_ip_address\nvlan $vlan' }),
    ];
    const result = generateConfig(sections, {
      vlan: '95',
      vlan_95_ip_address: '10.0.95.1',
    });

    expect(result.sections[0].content).toBe('ip address 10.0.95.1\nvlan 95');
  });
});
