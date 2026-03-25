import { describe, it, expect } from 'vitest';
import { parseVariables, parseSections, cleanUpSections, rebuildRawText } from '../lib/template-parser.ts';
import type { TemplateSection } from '../types/index.ts';

// Inline seed config for tests (representative Cisco IOS-style template)
const seedConfig = `!########## GENERIC IOS CONFIG ##########
!
service timestamps debug datetime msec
service timestamps log datetime msec
!
hostname $hostname
!
enable secret 9 $9$hashvaluehere
!
!########## GENERIC IOS SWITCH CONFIG ##########
!
interface vlan95
 ip address $vlan_95_ip_address 255.255.255.0
!
interface vlan25
 ip address $vlan_25_ip_address 255.255.255.0
!
interface vlan125
 ip address $vlan_125_ip_address 255.255.255.0
!
snmp-server location $snmp_location
!
ip default-gateway $default_gateway
ip route 0.0.0.0 0.0.0.0 $default_gateway
!
vtp domain $vtp_domain_name
!
!########## ISE Config ##########
!
aaa authentication dot1x default group radius
!
!########## GENERIC IOS-XE SWITCH CONFIG ##########
!
device-tracking policy DT-POLICY
!
!########## Devices Sensor ##########
!
device-sensor filter-list dhcp list DHCP-TLV
!
!########## SMART LICENSING CONFIG ##########
!
license smart transport smart
!
!########## Field VLAN Config ##########
!
interface range $accessportrange
 switchport access vlan 95
 switchport mode access
!
!########## ENABLE CDP ##########
!
cdp run
!
!########## CIS Benchmarks ##########
!
no ip http server
no ip http secure-server
`;

// ── Variable Detection ──────────────────────────────────────────

describe('parseVariables', () => {
  it('returns ParsedVariables with local and global arrays', () => {
    const result = parseVariables(seedConfig);
    expect(result).toHaveProperty('local');
    expect(result).toHaveProperty('global');
    expect(Array.isArray(result.local)).toBe(true);
    expect(Array.isArray(result.global)).toBe(true);
  });

  it('detects all 8 bare $var variables as local from seed config', () => {
    const { local, global: globals } = parseVariables(seedConfig);
    const names = local.map((v) => v.name);
    expect(names).toContain('hostname');
    expect(names).toContain('vlan_95_ip_address');
    expect(names).toContain('vlan_25_ip_address');
    expect(names).toContain('vlan_125_ip_address');
    expect(names).toContain('snmp_location');
    expect(names).toContain('default_gateway');
    expect(names).toContain('accessportrange');
    expect(names).toContain('vtp_domain_name');
    expect(names).toHaveLength(8);
    expect(globals).toHaveLength(0);
  });

  it('does NOT detect Cisco type-9 passwords ($9$...)', () => {
    const { local } = parseVariables(seedConfig);
    const names = local.map((v) => v.name);
    expect(names.every((n) => !n.startsWith('9'))).toBe(true);
  });

  it('does NOT detect $9 as a variable', () => {
    const { local, global: globals } = parseVariables('enable secret 9 $9$hash');
    expect(local).toHaveLength(0);
    expect(globals).toHaveLength(0);
  });

  it('deduplicates variables (default_gateway appears twice)', () => {
    const { local } = parseVariables(seedConfig);
    const gatewayOccurrences = local.filter((v) => v.name === 'default_gateway');
    expect(gatewayOccurrences).toHaveLength(1);
  });

  it('infers correct types', () => {
    const { local } = parseVariables(seedConfig);
    const byName = Object.fromEntries(local.map((v) => [v.name, v]));

    expect(byName['hostname'].type).toBe('string');
    expect(byName['vlan_95_ip_address'].type).toBe('ip');
    expect(byName['vlan_25_ip_address'].type).toBe('ip');
    expect(byName['vlan_125_ip_address'].type).toBe('ip');
    expect(byName['default_gateway'].type).toBe('ip');
    expect(byName['accessportrange'].type).toBe('string');
    expect(byName['snmp_location'].type).toBe('string');
    expect(byName['vtp_domain_name'].type).toBe('string');
  });

  it('generates correct labels', () => {
    const { local } = parseVariables(seedConfig);
    const byName = Object.fromEntries(local.map((v) => [v.name, v]));

    expect(byName['hostname'].label).toBe('Hostname');
    expect(byName['vlan_95_ip_address'].label).toBe('VLAN 95 IP Address');
    expect(byName['default_gateway'].label).toBe('Default Gateway');
    expect(byName['snmp_location'].label).toBe('SNMP Location');
    expect(byName['vtp_domain_name'].label).toBe('VTP Domain Name');
  });

  it('handles empty input', () => {
    const empty = { local: [], global: [] };
    expect(parseVariables('')).toEqual(empty);
    expect(parseVariables(null as unknown as string)).toEqual(empty);
    expect(parseVariables(undefined as unknown as string)).toEqual(empty);
  });

  it('handles text with no variables', () => {
    expect(parseVariables('hostname Router1\ninterface vlan1')).toEqual({ local: [], global: [] });
  });

  it('puts ${variable} syntax in global as string name', () => {
    const { local, global: globals } = parseVariables('hostname ${my_host}');
    expect(globals).toHaveLength(1);
    expect(globals[0]).toBe('my_host');
    expect(local).toHaveLength(0);
  });

  it('puts bare $variable in local as VariableDefinition', () => {
    const { local, global: globals } = parseVariables('hostname $my_host');
    expect(local).toHaveLength(1);
    expect(local[0].name).toBe('my_host');
    expect(globals).toHaveLength(0);
  });

  it('braced form wins when same name appears as both $foo and ${foo}', () => {
    const { local, global: globals } = parseVariables('$foo ${foo}');
    expect(globals).toEqual(['foo']);
    expect(local).toHaveLength(0);
  });

  it('mixed local and global variables are separated correctly', () => {
    const { local, global: globals } = parseVariables('$local_var ${global_var}');
    expect(local).toHaveLength(1);
    expect(local[0].name).toBe('local_var');
    expect(globals).toEqual(['global_var']);
  });

  it('global-only text returns all in global, local empty', () => {
    const { local, global: globals } = parseVariables('${enable_password} ${ntp_server}');
    expect(local).toHaveLength(0);
    expect(globals).toContain('enable_password');
    expect(globals).toContain('ntp_server');
    expect(globals).toHaveLength(2);
  });

  it('local-only text returns all in local, global empty', () => {
    const { local, global: globals } = parseVariables('$hostname $mgmt_ip');
    expect(local).toHaveLength(2);
    expect(local.map((v) => v.name)).toContain('hostname');
    expect(local.map((v) => v.name)).toContain('mgmt_ip');
    expect(globals).toHaveLength(0);
  });

  it('type-9 hashes do not pollute local or global arrays', () => {
    const text = '$hostname\nenable secret 9 $9$hashvalue\n${ntp_server}';
    const { local, global: globals } = parseVariables(text);
    expect(local).toHaveLength(1);
    expect(local[0].name).toBe('hostname');
    expect(globals).toEqual(['ntp_server']);
  });

  it('accessportrange gets range/port description', () => {
    const { local } = parseVariables(seedConfig);
    const apv = local.find((v) => v.name === 'accessportrange');
    expect(apv?.description).toBe('e.g., Gi1/0/1-24');
  });

  it('all local variables have required: true and empty defaults', () => {
    const { local } = parseVariables(seedConfig);
    for (const v of local) {
      expect(v.required).toBe(true);
      expect(v.defaultValue).toBe('');
      expect(v.options).toEqual([]);
    }
  });
});

// ── Section Detection ───────────────────────────────────────────

describe('parseSections', () => {
  it('detects expected sections from seed config', () => {
    const sections = parseSections(seedConfig, 'cli');
    const names = sections.map((s) => s.name);

    expect(names).toContain('GENERIC IOS CONFIG');
    expect(names).toContain('GENERIC IOS SWITCH CONFIG');
    expect(names).toContain('ISE Config');
    expect(names).toContain('GENERIC IOS-XE SWITCH CONFIG');
    expect(names).toContain('SMART LICENSING CONFIG');
    expect(names).toContain('Field VLAN Config');
    expect(names).toContain('ENABLE CDP');
    expect(names).toContain('CIS Benchmarks');
  });

  it('sections are numbered sequentially', () => {
    const sections = parseSections(seedConfig, 'cli');
    sections.forEach((s, i) => {
      expect(s.order).toBe(i);
    });
  });

  it('each section has a unique id', () => {
    const sections = parseSections(seedConfig, 'cli');
    const ids = sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sections contain template content', () => {
    const sections = parseSections(seedConfig, 'cli');
    for (const s of sections) {
      expect(s.template.length).toBeGreaterThan(0);
    }
  });

  it('handles empty input', () => {
    const sections = parseSections('', 'cli');
    expect(sections).toHaveLength(1);
    expect(sections[0].name).toBe('Full Config');
  });

  it('handles text with no dividers', () => {
    const sections = parseSections('hostname Router1\ninterface vlan1', 'cli');
    expect(sections).toHaveLength(1);
    expect(sections[0].name).toBe('Full Config');
    expect(sections[0].template).toBe('hostname Router1\ninterface vlan1');
  });

  it('JSON format returns single Full Config section', () => {
    const sections = parseSections(seedConfig, 'json');
    expect(sections).toHaveLength(1);
    expect(sections[0].name).toBe('Full Config');
  });

  it('XML section detection works', () => {
    const xml = `<!-- Header -->
<config>
  <hostname>R1</hostname>
</config>
<!-- Interfaces -->
<interfaces>
  <interface>eth0</interface>
</interfaces>`;
    const sections = parseSections(xml, 'xml');
    expect(sections.map((s) => s.name)).toContain('Header');
    expect(sections.map((s) => s.name)).toContain('Interfaces');
    expect(sections).toHaveLength(2);
  });

  it('YAML section detection works', () => {
    const yaml = `# === Global Settings ===
hostname: R1
# --- Interfaces ---
interfaces:
  - eth0`;
    const sections = parseSections(yaml, 'yaml');
    expect(sections.map((s) => s.name)).toContain('Global Settings');
    expect(sections.map((s) => s.name)).toContain('Interfaces');
    expect(sections).toHaveLength(2);
  });

  it('Devices Sensor subsection detected', () => {
    const sections = parseSections(seedConfig, 'cli');
    const names = sections.map((s) => s.name);
    expect(names).toContain('Devices Sensor');
  });

  it('detects START/END markers correctly', () => {
    const config = `!##### AAA Config - START #####
aaa authentication dot1x default group radius
aaa accounting dot1x default start-stop group radius
!##### AAA Config - END #####
!##### NAC Config - START #####
dot1x system-auth-control
!##### NAC Config - END #####`;
    const sections = parseSections(config, 'cli');
    expect(sections).toHaveLength(2);
    expect(sections[0].name).toBe('AAA Config');
    expect(sections[1].name).toBe('NAC Config');
    expect(sections[0].template).toContain('aaa authentication');
    expect(sections[1].template).toContain('dot1x system-auth-control');
  });

  it('mixed START/END and legacy dividers work together', () => {
    const config = `!##### AAA Config - START #####
aaa authentication dot1x default group radius
!##### AAA Config - END #####
!########## GENERIC IOS CONFIG ##########
hostname $hostname
service timestamps debug datetime msec`;
    const sections = parseSections(config, 'cli');
    expect(sections).toHaveLength(2);
    expect(sections[0].name).toBe('AAA Config');
    expect(sections[1].name).toBe('GENERIC IOS CONFIG');
    // Order preserved: AAA comes first (line 0), GENERIC comes second
    expect(sections[0].order).toBe(0);
    expect(sections[1].order).toBe(1);
  });

  it('duplicate section names get "(2)", "(3)" suffixes', () => {
    const config = `!########## ISE Config ##########
aaa authentication dot1x default group radius
!########## ISE Config ##########
dot1x system-auth-control
!########## ISE Config ##########
radius server ISE1`;
    const sections = parseSections(config, 'cli');
    expect(sections).toHaveLength(3);
    expect(sections[0].name).toBe('ISE Config');
    expect(sections[1].name).toBe('ISE Config (2)');
    expect(sections[2].name).toBe('ISE Config (3)');
  });

  it('duplicate names preserve order', () => {
    const config = `!########## AAA ##########
line 1
!########## VTP ##########
line 2
!########## AAA ##########
line 3`;
    const sections = parseSections(config, 'cli');
    expect(sections[0].name).toBe('AAA');
    expect(sections[1].name).toBe('VTP');
    expect(sections[2].name).toBe('AAA (2)');
    expect(sections[0].order).toBe(0);
    expect(sections[1].order).toBe(1);
    expect(sections[2].order).toBe(2);
  });

  it('START/END markers are case-insensitive', () => {
    const config = `!##### My Section - start #####
some config
!##### My Section - end #####`;
    const sections = parseSections(config, 'cli');
    expect(sections).toHaveLength(1);
    expect(sections[0].name).toBe('My Section');
  });

  it('START/END section includes content between markers', () => {
    const config = `!##### Routing - START #####
ip route 0.0.0.0 0.0.0.0 10.0.0.1
ip route 192.168.1.0 255.255.255.0 10.0.0.2
!##### Routing - END #####`;
    const sections = parseSections(config, 'cli');
    expect(sections).toHaveLength(1);
    expect(sections[0].template).toContain('ip route 0.0.0.0');
    expect(sections[0].template).toContain('ip route 192.168.1.0');
  });

  it('single section has startLine pointing to its divider', () => {
    const config = `!##### Routing - START #####
ip route 0.0.0.0 0.0.0.0 10.0.0.1
!##### Routing - END #####`;
    const sections = parseSections(config, 'cli');
    expect(sections).toHaveLength(1);
    expect(sections[0].startLine).toBe(0);
  });

  it('multiple sections have correct startLine values', () => {
    const config = `!##### AAA Config - START #####
aaa authentication dot1x default group radius
!##### AAA Config - END #####
!##### NAC Config - START #####
dot1x system-auth-control
!##### NAC Config - END #####`;
    const sections = parseSections(config, 'cli');
    expect(sections).toHaveLength(2);
    expect(sections[0].startLine).toBe(0);
    expect(sections[1].startLine).toBe(3);
  });

  it('startLine accounts for content between dividers', () => {
    const config = `!########## Base Config ##########
hostname Router1
service timestamps debug datetime msec
!
!########## VLAN Config ##########
interface vlan1
 ip address 10.0.0.1 255.255.255.0
!########## ACL Config ##########
ip access-list extended DENY_ALL
 deny ip any any`;
    const sections = parseSections(config, 'cli');
    expect(sections).toHaveLength(3);
    expect(sections[0].startLine).toBe(0);
    expect(sections[1].startLine).toBe(4);
    expect(sections[2].startLine).toBe(7);
  });

  it('startLine is undefined for sections without dividers', () => {
    const sections = parseSections('hostname Router1', 'cli');
    expect(sections).toHaveLength(1);
    expect(sections[0].startLine).toBeUndefined();
  });

  it('startLine is undefined for empty input', () => {
    const sections = parseSections('', 'cli');
    expect(sections).toHaveLength(1);
    expect(sections[0].startLine).toBeUndefined();
  });
});

// ── cleanUpSections ─────────────────────────────────────────────

describe('cleanUpSections', () => {
  it('injects START/END markers around legacy divider sections', () => {
    const config = `!########## ISE Config ##########
aaa authentication dot1x default group radius
!########## VTP Config ##########
vtp domain CORP`;
    const result = cleanUpSections(config, 'cli');
    expect(result).toContain('!##### ISE Config - START #####');
    expect(result).toContain('!##### ISE Config - END #####');
    expect(result).toContain('!##### VTP Config - START #####');
    expect(result).toContain('!##### VTP Config - END #####');
    // Original legacy dividers are REPLACED (not preserved) to avoid duplication
    expect(result).not.toContain('!########## ISE Config ##########');
    expect(result).not.toContain('!########## VTP Config ##########');
    // Content is preserved
    expect(result).toContain('aaa authentication dot1x default group radius');
    expect(result).toContain('vtp domain CORP');
  });

  it('applies duplicate suffixes in output', () => {
    const config = `!########## ISE Config ##########
section 1
!########## ISE Config ##########
section 2`;
    const result = cleanUpSections(config, 'cli');
    expect(result).toContain('!##### ISE Config - START #####');
    expect(result).toContain('!##### ISE Config - END #####');
    expect(result).toContain('!##### ISE Config (2) - START #####');
    expect(result).toContain('!##### ISE Config (2) - END #####');
  });

  it('does not double-inject markers on text that already has them', () => {
    const config = `!##### AAA Config - START #####
aaa new-model
!##### AAA Config - END #####`;
    const result = cleanUpSections(config, 'cli');
    // Count occurrences of START marker
    const startCount = (result.match(/AAA Config - START/gi) || []).length;
    expect(startCount).toBe(1);
  });

  it('handles empty input', () => {
    expect(cleanUpSections('', 'cli')).toBe('');
  });

  it('wraps single section (no dividers) with START/END', () => {
    const config = `hostname Router1
interface vlan1`;
    const result = cleanUpSections(config, 'cli');
    expect(result).toContain('!##### Full Config - START #####');
    expect(result).toContain('!##### Full Config - END #####');
    expect(result).toContain('hostname Router1');
  });

  it('preserves all original config lines', () => {
    const config = `!########## ISE Config ##########
aaa authentication dot1x default group radius
aaa accounting dot1x default start-stop group radius`;
    const result = cleanUpSections(config, 'cli');
    expect(result).toContain('aaa authentication dot1x default group radius');
    expect(result).toContain('aaa accounting dot1x default start-stop group radius');
  });
});

// ── rebuildRawText ──────────────────────────────────────────────

// Helper to build a TemplateSection for testing
function makeTestSection(
  overrides: Partial<TemplateSection> & Pick<TemplateSection, 'id' | 'name' | 'dividerPattern'>,
): TemplateSection {
  return {
    id: overrides.id,
    name: overrides.name,
    template: overrides.template ?? '',
    order: overrides.order ?? 0,
    dividerPattern: overrides.dividerPattern,
    endDividerPattern: overrides.endDividerPattern,
    startLine: overrides.startLine,
  };
}

describe('rebuildRawText', () => {
  const twoSectionConfig = `!##### AAA Config - START #####
aaa authentication dot1x default group radius
aaa accounting dot1x default start-stop group radius
!##### AAA Config - END #####
!##### NAC Config - START #####
dot1x system-auth-control
dot1x critical eapol
!##### NAC Config - END #####`;

  const sectionA = makeTestSection({
    id: 'sec-aaa',
    name: 'AAA Config',
    dividerPattern: '!##### AAA Config - START #####',
    endDividerPattern: '!##### AAA Config - END #####',
    startLine: 0,
  });

  const sectionB = makeTestSection({
    id: 'sec-nac',
    name: 'NAC Config',
    dividerPattern: '!##### NAC Config - START #####',
    endDividerPattern: '!##### NAC Config - END #####',
    startLine: 4,
  });

  it('reorders two sections correctly', () => {
    // Original order: AAA, NAC. Request: NAC, AAA.
    const result = rebuildRawText([sectionB, sectionA], twoSectionConfig);
    const lines = result.split('\n');

    // NAC block should come before AAA block
    const nacStartIdx = lines.findIndex((l) => l.includes('NAC Config - START'));
    const aaaStartIdx = lines.findIndex((l) => l.includes('AAA Config - START'));
    expect(nacStartIdx).toBeLessThan(aaaStartIdx);

    // Both blocks present
    expect(result).toContain('aaa authentication dot1x default group radius');
    expect(result).toContain('dot1x system-auth-control');
  });

  it('preserves line count after reorder', () => {
    const result = rebuildRawText([sectionB, sectionA], twoSectionConfig);
    const originalLineCount = twoSectionConfig.split('\n').length;
    const resultLineCount = result.split('\n').length;
    expect(resultLineCount).toBe(originalLineCount);
  });

  it('preserves preamble and postamble text', () => {
    const configWithPreambleAndPostamble = `! Global preamble
service timestamps debug datetime msec
!##### AAA Config - START #####
aaa new-model
!##### AAA Config - END #####
!##### VTP Config - START #####
vtp domain CORP
!##### VTP Config - END #####
! Final line - postamble`;

    const secAAA = makeTestSection({
      id: 'sec-aaa-2',
      name: 'AAA Config',
      dividerPattern: '!##### AAA Config - START #####',
      endDividerPattern: '!##### AAA Config - END #####',
      startLine: 2,
    });

    const secVTP = makeTestSection({
      id: 'sec-vtp',
      name: 'VTP Config',
      dividerPattern: '!##### VTP Config - START #####',
      endDividerPattern: '!##### VTP Config - END #####',
      startLine: 5,
    });

    // Reorder: VTP first, then AAA
    const result = rebuildRawText([secVTP, secAAA], configWithPreambleAndPostamble);

    // Preamble preserved at the start
    expect(result.startsWith('! Global preamble\nservice timestamps debug datetime msec')).toBe(true);

    // Postamble preserved at the end
    expect(result.endsWith('! Final line - postamble')).toBe(true);

    // Content still present
    expect(result).toContain('aaa new-model');
    expect(result).toContain('vtp domain CORP');
  });

  it('works without startLine (fallback to divider pattern matching)', () => {
    const secANoLine = makeTestSection({
      id: 'sec-aaa',
      name: 'AAA Config',
      dividerPattern: '!##### AAA Config - START #####',
      endDividerPattern: '!##### AAA Config - END #####',
      // no startLine
    });

    const secBNoLine = makeTestSection({
      id: 'sec-nac',
      name: 'NAC Config',
      dividerPattern: '!##### NAC Config - START #####',
      endDividerPattern: '!##### NAC Config - END #####',
      // no startLine
    });

    const result = rebuildRawText([secBNoLine, secANoLine], twoSectionConfig);
    const lines = result.split('\n');
    const nacIdx = lines.findIndex((l) => l.includes('NAC Config - START'));
    const aaaIdx = lines.findIndex((l) => l.includes('AAA Config - START'));
    expect(nacIdx).toBeLessThan(aaaIdx);
  });

  it('handles sections without END dividers (legacy style)', () => {
    const legacyConfig = `!########## ISE Config ##########
aaa authentication dot1x default group radius
!########## VTP Config ##########
vtp domain CORP`;

    const secISE = makeTestSection({
      id: 'sec-ise',
      name: 'ISE Config',
      dividerPattern: '!########## ISE Config ##########',
      startLine: 0,
    });

    const secVTP = makeTestSection({
      id: 'sec-vtp',
      name: 'VTP Config',
      dividerPattern: '!########## VTP Config ##########',
      startLine: 2,
    });

    // Reorder: VTP first, then ISE
    const result = rebuildRawText([secVTP, secISE], legacyConfig);
    const lines = result.split('\n');
    const vtpIdx = lines.findIndex((l) => l.includes('VTP Config'));
    const iseIdx = lines.findIndex((l) => l.includes('ISE Config'));
    expect(vtpIdx).toBeLessThan(iseIdx);
    expect(result).toContain('aaa authentication dot1x default group radius');
    expect(result).toContain('vtp domain CORP');
  });

  it('returns rawText unchanged when sections array is empty', () => {
    expect(rebuildRawText([], twoSectionConfig)).toBe(twoSectionConfig);
  });

  it('returns empty string for empty rawText', () => {
    expect(rebuildRawText([sectionA], '')).toBe('');
  });
});
