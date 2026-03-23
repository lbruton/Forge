import { describe, it, expect } from 'vitest';
import { parseVariables, parseSections } from '../lib/template-parser.ts';

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
  it('detects all 8 variables from seed config', () => {
    const vars = parseVariables(seedConfig);
    const names = vars.map((v) => v.name);
    expect(names).toContain('hostname');
    expect(names).toContain('vlan_95_ip_address');
    expect(names).toContain('vlan_25_ip_address');
    expect(names).toContain('vlan_125_ip_address');
    expect(names).toContain('snmp_location');
    expect(names).toContain('default_gateway');
    expect(names).toContain('accessportrange');
    expect(names).toContain('vtp_domain_name');
    expect(names).toHaveLength(8);
  });

  it('does NOT detect Cisco type-9 passwords ($9$...)', () => {
    const vars = parseVariables(seedConfig);
    const names = vars.map((v) => v.name);
    // No variable starting with 9
    expect(names.every((n) => !n.startsWith('9'))).toBe(true);
  });

  it('does NOT detect $9 as a variable', () => {
    const vars = parseVariables('enable secret 9 $9$hash');
    expect(vars).toHaveLength(0);
  });

  it('deduplicates variables (default_gateway appears twice)', () => {
    const vars = parseVariables(seedConfig);
    const gatewayOccurrences = vars.filter((v) => v.name === 'default_gateway');
    expect(gatewayOccurrences).toHaveLength(1);
  });

  it('infers correct types', () => {
    const vars = parseVariables(seedConfig);
    const byName = Object.fromEntries(vars.map((v) => [v.name, v]));

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
    const vars = parseVariables(seedConfig);
    const byName = Object.fromEntries(vars.map((v) => [v.name, v]));

    expect(byName['hostname'].label).toBe('Hostname');
    expect(byName['vlan_95_ip_address'].label).toBe('VLAN 95 IP Address');
    expect(byName['default_gateway'].label).toBe('Default Gateway');
    expect(byName['snmp_location'].label).toBe('SNMP Location');
    expect(byName['vtp_domain_name'].label).toBe('VTP Domain Name');
  });

  it('handles empty input', () => {
    expect(parseVariables('')).toEqual([]);
    expect(parseVariables(null as unknown as string)).toEqual([]);
    expect(parseVariables(undefined as unknown as string)).toEqual([]);
  });

  it('handles text with no variables', () => {
    expect(parseVariables('hostname Router1\ninterface vlan1')).toEqual([]);
  });

  it('handles ${variable} syntax', () => {
    const vars = parseVariables('hostname ${my_host}');
    expect(vars).toHaveLength(1);
    expect(vars[0].name).toBe('my_host');
  });

  it('accessportrange gets range/port description', () => {
    const vars = parseVariables(seedConfig);
    const apv = vars.find((v) => v.name === 'accessportrange');
    expect(apv?.description).toBe('e.g., Gi1/0/1-24');
  });

  it('all variables have required: true and empty defaults', () => {
    const vars = parseVariables(seedConfig);
    for (const v of vars) {
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
});
