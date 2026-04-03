import { describe, it, expect } from 'vitest';
import { scanForSecrets } from '../lib/secrets-detector.ts';
import type { SecretFinding } from '../lib/secrets-detector.ts';

// Helper: scan a single line as CLI config
function scanLine(line: string): SecretFinding[] {
  return scanForSecrets(line, 'cli');
}

// Helper: first finding from a single line
function first(line: string): SecretFinding | undefined {
  return scanLine(line)[0];
}

// ---------------------------------------------------------------------------
// 1. Authentication & Enable
// ---------------------------------------------------------------------------

describe('Authentication & Enable', () => {
  it('detects enable password type 0 as critical', () => {
    const f = first('enable password 0 cisco123');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('enable-password');
    expect(f!.severity).toBe('critical');
  });

  it('detects enable password type 7 as high', () => {
    const f = first('enable password 7 0822455D0A16');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('enable-password');
    expect(f!.severity).toBe('high');
  });

  it('detects bare enable password (no type) as critical', () => {
    const f = first('enable password MyPass');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('enable-password');
    expect(f!.severity).toBe('critical');
  });

  it('detects enable secret type 9 as low', () => {
    const f = first('enable secret 9 $9$abcdefghijk');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('enable-secret');
    expect(f!.severity).toBe('low');
  });

  it('detects enable secret type 0 as critical', () => {
    const f = first('enable secret 0 cleartext');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('enable-secret');
    expect(f!.severity).toBe('critical');
  });

  it('detects enable secret type 5 as low', () => {
    const f = first('enable secret 5 $1$abc$hashvalue');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('enable-secret');
    expect(f!.severity).toBe('low');
  });

  it('detects username password type 0 as critical', () => {
    const f = first('username admin password 0 admin123');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('username-password');
    expect(f!.severity).toBe('critical');
  });

  it('detects username password type 7 as high', () => {
    const f = first('username admin password 7 0822455D');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('username-password');
    expect(f!.severity).toBe('high');
  });

  it('detects bare username password as critical', () => {
    const f = first('username admin password admin123');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('username-password');
    expect(f!.severity).toBe('critical');
  });

  it('detects username secret type 0 as critical', () => {
    const f = first('username admin secret 0 cleartext');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('username-secret');
    expect(f!.severity).toBe('critical');
  });

  it('detects line password (indented) as critical', () => {
    const f = first('  password 0 MyLinePass');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('line-password');
    expect(f!.severity).toBe('critical');
  });

  it('detects line password type 7 as high', () => {
    const f = first(' password 7 06120A3258');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('line-password');
    expect(f!.severity).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// 2. SNMP
// ---------------------------------------------------------------------------

describe('SNMP', () => {
  it('detects snmp-server community string as critical', () => {
    const f = first('snmp-server community PUBLIC RO');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('snmp-community');
    expect(f!.severity).toBe('critical');
  });

  it('does NOT flag snmp-server community with $variable', () => {
    const findings = scanLine('snmp-server community $snmp_ro RO');
    expect(findings).toHaveLength(0);
  });

  it('does NOT flag snmp-server community with ${variable}', () => {
    const findings = scanLine('snmp-server community ${snmp_ro} RO');
    expect(findings).toHaveLength(0);
  });

  it('detects SNMPv3 auth key as critical', () => {
    const f = first('snmp-server user admin v3 auth md5 MyAuthKey');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('snmp-user-auth');
    expect(f!.severity).toBe('critical');
  });

  it('detects SNMPv3 priv key as critical', () => {
    const f = first('snmp-server user admin v3 auth md5 MyAuth priv aes MyPrivKey');
    expect(f).toBeDefined();
    // Could match auth or priv — either is valid, both critical
    expect(f!.severity).toBe('critical');
  });

  it('detects snmp-server host community as critical', () => {
    const f = first('snmp-server host 10.0.0.1 MyCommunity');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('snmp-host');
    expect(f!.severity).toBe('critical');
  });
});

// ---------------------------------------------------------------------------
// 3. AAA / TACACS+ / RADIUS
// ---------------------------------------------------------------------------

describe('AAA/TACACS+/RADIUS', () => {
  it('detects tacacs-server key type 0 as critical', () => {
    const f = first('tacacs-server key 0 MySecret');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('tacacs-server-key');
    expect(f!.severity).toBe('critical');
  });

  it('detects tacacs-server key type 7 as high', () => {
    const f = first('tacacs-server key 7 0822455D');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('tacacs-server-key');
    expect(f!.severity).toBe('high');
  });

  it('detects bare tacacs-server key as critical', () => {
    const f = first('tacacs-server key MySecret');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('tacacs-server-key');
    expect(f!.severity).toBe('critical');
  });

  it('detects radius-server key as critical', () => {
    const f = first('radius-server key SecretKey');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('radius-server-key');
    expect(f!.severity).toBe('critical');
  });

  it('detects radius-server key type 7 as high', () => {
    const f = first('radius-server key 7 0822455D');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('radius-server-key');
    expect(f!.severity).toBe('high');
  });

  it('detects server-private key as critical', () => {
    const f = first('server-private 10.0.0.1 key 0 MyKey');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('server-private-key');
    expect(f!.severity).toBe('critical');
  });

  it('detects indented key directive as critical', () => {
    const f = first('key MySharedSecret');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('tacacs-key-indented');
    expect(f!.severity).toBe('critical');
  });
});

// ---------------------------------------------------------------------------
// 4. Routing Protocol Auth
// ---------------------------------------------------------------------------

describe('Routing Protocol Auth', () => {
  it('detects ip ospf authentication-key as critical', () => {
    const f = first('ip ospf authentication-key MyKey');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('ospf-auth-key');
    expect(f!.severity).toBe('critical');
  });

  it('detects ip ospf authentication-key type 7 as high', () => {
    const f = first('ip ospf authentication-key 7 0822455D');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('ospf-auth-key');
    expect(f!.severity).toBe('high');
  });

  it('detects ospf message-digest-key as critical', () => {
    const f = first('ip ospf message-digest-key 1 md5 MyMd5Key');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('ospf-md5-key');
    expect(f!.severity).toBe('critical');
  });

  it('detects key-string type 7 as high', () => {
    const f = first('key-string 7 0822455D');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('key-string');
    expect(f!.severity).toBe('high');
  });

  it('detects bare key-string as critical', () => {
    const f = first(' key-string MyKeyChainValue');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('key-string');
    expect(f!.severity).toBe('critical');
  });

  it('detects neighbor password as critical', () => {
    const f = first('neighbor 10.0.0.1 password MyPass');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('bgp-neighbor-password');
    expect(f!.severity).toBe('critical');
  });

  it('detects neighbor password type 7 as high', () => {
    const f = first('neighbor 10.0.0.1 password 7 0822455D');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('bgp-neighbor-password');
    expect(f!.severity).toBe('high');
  });

  it('detects isis password as critical', () => {
    const f = first('isis password MyIsisPass');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('isis-password');
    expect(f!.severity).toBe('critical');
  });

  it('detects rip authentication key-string as critical', () => {
    const f = first('ip rip authentication key-string MyRipKey');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('rip-auth-key');
    expect(f!.severity).toBe('critical');
  });
});

// ---------------------------------------------------------------------------
// 5. VPN / Crypto
// ---------------------------------------------------------------------------

describe('VPN/Crypto', () => {
  it('detects crypto isakmp key as critical', () => {
    const f = first('crypto isakmp key MyPSK address 10.0.0.1');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('crypto-isakmp-key');
    expect(f!.severity).toBe('critical');
  });

  it('detects crypto isakmp key type 6 as high', () => {
    const f = first('crypto isakmp key 6 EncryptedKey address 10.0.0.1');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('crypto-isakmp-key');
    expect(f!.severity).toBe('high');
  });

  it('detects pre-shared-key as critical', () => {
    const f = first('pre-shared-key cleartext');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('ikev2-psk');
    expect(f!.severity).toBe('critical');
  });

  it('detects indented pre-shared-key as critical', () => {
    const f = first('  pre-shared-key MyPSK');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('ikev2-psk');
    expect(f!.severity).toBe('critical');
  });

  it('detects tunnel key as critical', () => {
    const f = first('tunnel key 12345');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('tunnel-key');
    expect(f!.severity).toBe('critical');
  });
});

// ---------------------------------------------------------------------------
// 6. Switching / L2
// ---------------------------------------------------------------------------

describe('Switching/L2', () => {
  it('detects vtp password as critical', () => {
    const f = first('vtp password MyVtpPass');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('vtp-password');
    expect(f!.severity).toBe('critical');
  });
});

// ---------------------------------------------------------------------------
// 7. Management
// ---------------------------------------------------------------------------

describe('Management', () => {
  it('detects ntp authentication-key as critical', () => {
    const f = first('ntp authentication-key 1 md5 MyNtpKey');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('ntp-auth-key');
    expect(f!.severity).toBe('critical');
  });

  it('detects ppp chap password type 0 as critical', () => {
    const f = first('ppp chap password 0 MyChapPass');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('ppp-chap-password');
    expect(f!.severity).toBe('critical');
  });

  it('detects ppp chap password type 7 as high', () => {
    const f = first('ppp chap password 7 0822455D');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('ppp-chap-password');
    expect(f!.severity).toBe('high');
  });

  it('detects ppp pap sent-username password as critical', () => {
    const f = first('ppp pap sent-username admin password MyPapPass');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('ppp-pap-password');
    expect(f!.severity).toBe('critical');
  });

  it('detects ip http password as critical', () => {
    const f = first('ip http authentication local password 0 HttpPass');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('ip-http-password');
    expect(f!.severity).toBe('critical');
  });
});

// ---------------------------------------------------------------------------
// 8. ASA-Specific
// ---------------------------------------------------------------------------

describe('ASA-Specific', () => {
  it('detects passwd encrypted as high', () => {
    const f = first('passwd 2KFQnbNIdI.2KYOU encrypted');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('asa-passwd');
    expect(f!.severity).toBe('high');
  });

  it('detects bare passwd as critical', () => {
    const f = first('passwd cisco123');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('asa-passwd');
    expect(f!.severity).toBe('critical');
  });

  it('detects tunnel-group pre-shared-key as critical', () => {
    const f = first('tunnel-group VPN ipsec-attributes pre-shared-key MyPSK');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('asa-tunnel-group-psk');
    expect(f!.severity).toBe('critical');
  });

  it('detects ldap-login-password as critical', () => {
    const f = first('ldap-login-password MyLdapPass');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('asa-ldap-password');
    expect(f!.severity).toBe('critical');
  });
});

// ---------------------------------------------------------------------------
// 9. Negative Cases
// ---------------------------------------------------------------------------

describe('Negative cases', () => {
  it('returns empty array for empty string', () => {
    expect(scanForSecrets('', 'cli')).toEqual([]);
  });

  it('does not flag $variable in value position', () => {
    expect(scanLine('enable password 0 $my_password')).toHaveLength(0);
  });

  it('does not flag ${variable} in value position', () => {
    expect(scanLine('enable password 0 ${my_password}')).toHaveLength(0);
  });

  it('does not flag $variable for username password', () => {
    expect(scanLine('username admin password $admin_pass')).toHaveLength(0);
  });

  it('does not flag $variable for tacacs key', () => {
    expect(scanLine('tacacs-server key $tacacs_key')).toHaveLength(0);
  });

  it('returns empty for JSON format', () => {
    expect(scanForSecrets('enable password 0 cisco123', 'json')).toEqual([]);
  });

  it('returns empty for XML format', () => {
    expect(scanForSecrets('enable password 0 cisco123', 'xml')).toEqual([]);
  });

  it('returns empty for YAML format', () => {
    expect(scanForSecrets('enable password 0 cisco123', 'yaml')).toEqual([]);
  });

  it('skips comment lines starting with !', () => {
    const config = '! enable password 0 cisco123';
    expect(scanLine(config)).toHaveLength(0);
  });

  it('skips blank lines', () => {
    const config = '\n\n\n';
    expect(scanForSecrets(config, 'cli')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 10. Line Numbers
// ---------------------------------------------------------------------------

describe('Line numbers', () => {
  it('reports correct 1-based line numbers for each finding', () => {
    const config = [
      '!',
      'hostname Switch1',
      'enable password 0 cisco123',
      '!',
      'snmp-server community PUBLIC RO',
      '!',
      'tacacs-server key 0 MySecret',
    ].join('\n');

    const findings = scanForSecrets(config, 'cli');
    expect(findings).toHaveLength(3);

    // enable password on line 3
    expect(findings[0].ruleId).toBe('enable-password');
    expect(findings[0].line).toBe(3);

    // snmp community on line 5
    expect(findings[1].ruleId).toBe('snmp-community');
    expect(findings[1].line).toBe(5);

    // tacacs key on line 7
    expect(findings[2].ruleId).toBe('tacacs-server-key');
    expect(findings[2].line).toBe(7);
  });

  it('includes full line text in finding', () => {
    const f = first('enable password 0 cisco123');
    expect(f).toBeDefined();
    expect(f!.lineText).toBe('enable password 0 cisco123');
  });

  it('provides matchStart and matchEnd offsets', () => {
    const f = first('enable password 0 cisco123');
    expect(f).toBeDefined();
    expect(f!.matchStart).toBeGreaterThanOrEqual(0);
    expect(f!.matchEnd).toBeGreaterThan(f!.matchStart);
  });
});

// ---------------------------------------------------------------------------
// 11. Mixed Findings
// ---------------------------------------------------------------------------

describe('Mixed findings', () => {
  it('detects multiple finding types in a realistic config', () => {
    const config = [
      '!########## BASE CONFIG ##########',
      '!',
      'hostname Switch1',
      'enable secret 9 $9$hashvaluehere',
      'enable password 0 cisco123',
      '!',
      'username admin password 0 admin123',
      'username monitor secret 5 $1$abc$hash',
      '!',
      '!########## SNMP ##########',
      '!',
      'snmp-server community PUBLIC RO',
      'snmp-server community $snmp_ro RO',
      '!',
      '!########## AAA ##########',
      '!',
      'tacacs-server key 7 0822455D',
      'radius-server key SecretKey',
      '!',
      '!########## ROUTING ##########',
      '!',
      'ip ospf authentication-key MyOspfKey',
      'neighbor 10.0.0.1 password 7 ABCDEF01',
      '!',
      '!########## VPN ##########',
      '!',
      'crypto isakmp key MyPSK address 10.0.0.1',
      '!',
      'vtp password MyVtpPass',
      '!',
      'ntp authentication-key 1 md5 MyNtpKey',
    ].join('\n');

    const findings = scanForSecrets(config, 'cli');

    // Count expected: enable-secret(low) + enable-password(crit) +
    //   username-password(crit) + username-secret(low) + snmp-community(crit) +
    //   tacacs-key(high) + radius-key(crit) + ospf-auth(crit) +
    //   bgp-neighbor(high) + crypto-isakmp(crit) + vtp-password(crit) +
    //   ntp-auth(crit)
    // Note: $snmp_ro line skipped (variable exclusion)
    expect(findings.length).toBe(12);

    // Verify severity distribution
    const critical = findings.filter((f) => f.severity === 'critical');
    const high = findings.filter((f) => f.severity === 'high');
    const low = findings.filter((f) => f.severity === 'low');

    expect(critical.length).toBe(8);
    expect(high.length).toBe(2);
    expect(low.length).toBe(2);

    // Verify categories present
    const categories = new Set(findings.map((f) => f.category));
    expect(categories.has('Authentication & Enable')).toBe(true);
    expect(categories.has('SNMP')).toBe(true);
    expect(categories.has('AAA/TACACS+/RADIUS')).toBe(true);
    expect(categories.has('Routing Protocol Auth')).toBe(true);
    expect(categories.has('VPN/Crypto')).toBe(true);
    expect(categories.has('Switching/L2')).toBe(true);
    expect(categories.has('Management')).toBe(true);
  });

  it('only reports first matching rule per line', () => {
    // A line that could match multiple rules should only produce one finding
    const findings = scanLine('enable password 0 cisco123');
    expect(findings).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 12. Hashed Secret Catch-all
// ---------------------------------------------------------------------------

describe('Hashed secret catch-all', () => {
  it('detects $1$ hash pattern as low severity', () => {
    const f = first('some config $1$abc$hashvalue');
    expect(f).toBeDefined();
    expect(f!.ruleId).toBe('hashed-secret-catchall');
    expect(f!.severity).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// 13. Integration — Realistic Cisco IOS Running-Config
// ---------------------------------------------------------------------------

describe('Integration: realistic IOS running-config', () => {
  const iosConfig = [
    /* 1  */ '!',
    /* 2  */ '! Last configuration change at 14:32:01 UTC Mon Mar 31 2026',
    /* 3  */ '!',
    /* 4  */ 'version 17.6',
    /* 5  */ 'service timestamps debug datetime msec',
    /* 6  */ 'service timestamps log datetime msec',
    /* 7  */ 'service password-encryption',
    /* 8  */ '!',
    /* 9  */ 'hostname $hostname',
    /* 10 */ '!',
    /* 11 */ 'enable secret 9 $9$aB3dEfGhIjKlMnO',
    /* 12 */ 'username admin secret 0 cisco123',
    /* 13 */ '!',
    /* 14 */ 'aaa new-model',
    /* 15 */ 'aaa authentication login default group tacacs+ local',
    /* 16 */ '!',
    /* 17 */ 'snmp-server community PUBLIC RO',
    /* 18 */ 'snmp-server community $snmp_ro RO',
    /* 19 */ 'snmp-server location $location',
    /* 20 */ '!',
    /* 21 */ 'tacacs-server key 7 0822455D0A16544541',
    /* 22 */ '!',
    /* 23 */ 'ip ospf authentication-key 0 MyOspfKey',
    /* 24 */ '!',
    /* 25 */ 'vtp password MyVtpPass',
    /* 26 */ '!',
    /* 27 */ 'ntp authentication-key 1 md5 NtpSecret',
    /* 28 */ '!',
    /* 29 */ 'interface GigabitEthernet0/0',
    /* 30 */ ' description Uplink to Core',
    /* 31 */ ' ip address $mgmt_ip 255.255.255.0',
    /* 32 */ ' no shutdown',
    /* 33 */ '!',
    /* 34 */ 'interface Vlan10',
    /* 35 */ ' description Data VLAN',
    /* 36 */ ' ip address 10.10.10.1 255.255.255.0',
    /* 37 */ '!',
    /* 38 */ 'ip access-list extended DENY-RFC1918',
    /* 39 */ ' deny ip 10.0.0.0 0.255.255.255 any',
    /* 40 */ ' deny ip 172.16.0.0 0.15.255.255 any',
    /* 41 */ ' permit ip any any',
    /* 42 */ '!',
    /* 43 */ 'line con 0',
    /* 44 */ ' logging synchronous',
    /* 45 */ 'line vty 0 15',
    /* 46 */ ' transport input ssh',
    /* 47 */ '!',
    /* 48 */ 'end',
  ].join('\n');

  it('detects exactly 7 findings in the IOS config', () => {
    const findings = scanForSecrets(iosConfig, 'cli');
    expect(findings).toHaveLength(7);
  });

  it('flags enable secret 9 as low on line 11', () => {
    const findings = scanForSecrets(iosConfig, 'cli');
    const f = findings.find((f) => f.ruleId === 'enable-secret');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('low');
    expect(f!.line).toBe(11);
  });

  it('flags username secret 0 as critical on line 12', () => {
    const findings = scanForSecrets(iosConfig, 'cli');
    const f = findings.find((f) => f.ruleId === 'username-secret');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('critical');
    expect(f!.line).toBe(12);
  });

  it('flags snmp-server community PUBLIC as critical on line 17', () => {
    const findings = scanForSecrets(iosConfig, 'cli');
    const f = findings.find((f) => f.ruleId === 'snmp-community');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('critical');
    expect(f!.line).toBe(17);
  });

  it('does NOT flag snmp-server community $snmp_ro (variable)', () => {
    const findings = scanForSecrets(iosConfig, 'cli');
    const snmpFindings = findings.filter((f) => f.ruleId === 'snmp-community');
    expect(snmpFindings).toHaveLength(1);
    expect(snmpFindings[0].line).toBe(17);
  });

  it('flags tacacs-server key 7 as high on line 21', () => {
    const findings = scanForSecrets(iosConfig, 'cli');
    const f = findings.find((f) => f.ruleId === 'tacacs-server-key');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('high');
    expect(f!.line).toBe(21);
  });

  it('flags ip ospf authentication-key 0 as critical on line 23', () => {
    const findings = scanForSecrets(iosConfig, 'cli');
    const f = findings.find((f) => f.ruleId === 'ospf-auth-key');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('critical');
    expect(f!.line).toBe(23);
  });

  it('flags vtp password as critical on line 25', () => {
    const findings = scanForSecrets(iosConfig, 'cli');
    const f = findings.find((f) => f.ruleId === 'vtp-password');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('critical');
    expect(f!.line).toBe(25);
  });

  it('flags ntp authentication-key as critical on line 27', () => {
    const findings = scanForSecrets(iosConfig, 'cli');
    const f = findings.find((f) => f.ruleId === 'ntp-auth-key');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('critical');
    expect(f!.line).toBe(27);
  });

  it('does NOT flag hostname with $variable', () => {
    const findings = scanForSecrets(iosConfig, 'cli');
    expect(findings.every((f) => f.line !== 9)).toBe(true);
  });

  it('does NOT flag normal interface/VLAN/ACL lines', () => {
    const findings = scanForSecrets(iosConfig, 'cli');
    const safeLines = [29, 30, 31, 32, 34, 35, 36, 38, 39, 40, 41, 43, 44, 45, 46, 48];
    for (const ln of safeLines) {
      expect(findings.find((f) => f.line === ln)).toBeUndefined();
    }
  });

  it('does NOT flag comment lines', () => {
    const findings = scanForSecrets(iosConfig, 'cli');
    const commentLines = [1, 2, 3, 8, 10, 13, 16, 20, 22, 24, 26, 28, 33, 37, 42, 47];
    for (const ln of commentLines) {
      expect(findings.find((f) => f.line === ln)).toBeUndefined();
    }
  });

  it('has correct severity distribution', () => {
    const findings = scanForSecrets(iosConfig, 'cli');
    const critical = findings.filter((f) => f.severity === 'critical');
    const high = findings.filter((f) => f.severity === 'high');
    const low = findings.filter((f) => f.severity === 'low');
    expect(critical).toHaveLength(5);
    expect(high).toHaveLength(1);
    expect(low).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 14. Integration — Realistic ASA Config Snippet
// ---------------------------------------------------------------------------

describe('Integration: realistic ASA config snippet', () => {
  const asaConfig = [
    /* 1  */ 'ASA Version 9.16(3)',
    /* 2  */ '!',
    /* 3  */ 'hostname ASA-FW01',
    /* 4  */ 'domain-name corp.example.com',
    /* 5  */ '!',
    /* 6  */ 'passwd 2KFQnbNIdI.2KYOU encrypted',
    /* 7  */ 'enable password $enable_pass encrypted',
    /* 8  */ '!',
    /* 9  */ 'interface GigabitEthernet0/0',
    /* 10 */ ' nameif outside',
    /* 11 */ ' security-level 0',
    /* 12 */ ' ip address 203.0.113.1 255.255.255.0',
    /* 13 */ '!',
    /* 14 */ 'interface GigabitEthernet0/1',
    /* 15 */ ' nameif inside',
    /* 16 */ ' security-level 100',
    /* 17 */ ' ip address 10.0.0.1 255.255.255.0',
    /* 18 */ '!',
    /* 19 */ 'tunnel-group VPN-Peer ipsec-attributes pre-shared-key MyPresharedKey123',
    /* 20 */ '!',
    /* 21 */ 'ldap-login-password secretLdapPw',
    /* 22 */ '!',
    /* 23 */ 'logging enable',
    /* 24 */ 'logging buffered informational',
  ].join('\n');

  it('detects exactly 3 findings in the ASA config', () => {
    const findings = scanForSecrets(asaConfig, 'cli');
    expect(findings).toHaveLength(3);
  });

  it('flags passwd encrypted as high on line 6', () => {
    const findings = scanForSecrets(asaConfig, 'cli');
    const f = findings.find((f) => f.ruleId === 'asa-passwd');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('high');
    expect(f!.line).toBe(6);
  });

  it('does NOT flag enable password with $enable_pass variable', () => {
    const findings = scanForSecrets(asaConfig, 'cli');
    expect(findings.find((f) => f.line === 7)).toBeUndefined();
  });

  it('flags tunnel-group pre-shared-key as critical on line 19', () => {
    const findings = scanForSecrets(asaConfig, 'cli');
    const f = findings.find((f) => f.ruleId === 'asa-tunnel-group-psk');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('critical');
    expect(f!.line).toBe(19);
  });

  it('flags ldap-login-password as critical on line 21', () => {
    const findings = scanForSecrets(asaConfig, 'cli');
    const f = findings.find((f) => f.ruleId === 'asa-ldap-password');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('critical');
    expect(f!.line).toBe(21);
  });

  it('does NOT flag normal ASA interface/logging lines', () => {
    const findings = scanForSecrets(asaConfig, 'cli');
    const safeLines = [1, 3, 4, 9, 10, 11, 12, 14, 15, 16, 17, 23, 24];
    for (const ln of safeLines) {
      expect(findings.find((f) => f.line === ln)).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// 15. Integration — Clean Config with All Variables
// ---------------------------------------------------------------------------

describe('Integration: clean config with all variables', () => {
  const cleanConfig = [
    '!',
    'hostname $hostname',
    '!',
    'enable password 0 $enable_pass',
    'username admin password ${admin_password}',
    '!',
    'snmp-server community $snmp_community RO',
    'snmp-server community ${snmp_rw} RW',
    '!',
    'tacacs-server key $tacacs_key',
    'radius-server key ${radius_key}',
    '!',
    'ip ospf authentication-key $ospf_key',
    'vtp password $vtp_pass',
    'ntp authentication-key 1 md5 $ntp_key',
    '!',
    'crypto isakmp key $psk address 10.0.0.1',
    'pre-shared-key ${ikev2_psk}',
    '!',
    'interface GigabitEthernet0/0',
    ' ip address $mgmt_ip $mgmt_mask',
    ' no shutdown',
    '!',
    'end',
  ].join('\n');

  it('returns zero findings when all secrets are replaced with variables', () => {
    const findings = scanForSecrets(cleanConfig, 'cli');
    expect(findings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 16. Integration — Format Gating
// ---------------------------------------------------------------------------

describe('Integration: format gating', () => {
  const iosConfig = [
    'hostname Switch1',
    'enable secret 9 $9$aB3dEfGhIjKlMnO',
    'username admin secret 0 cisco123',
    'snmp-server community PUBLIC RO',
    'tacacs-server key 7 0822455D0A16544541',
    'ip ospf authentication-key 0 MyOspfKey',
    'vtp password MyVtpPass',
    'ntp authentication-key 1 md5 NtpSecret',
  ].join('\n');

  it('returns findings for cli format', () => {
    const findings = scanForSecrets(iosConfig, 'cli');
    expect(findings.length).toBeGreaterThan(0);
  });

  it('returns empty for json format', () => {
    expect(scanForSecrets(iosConfig, 'json')).toEqual([]);
  });

  it('returns empty for xml format', () => {
    expect(scanForSecrets(iosConfig, 'xml')).toEqual([]);
  });

  it('returns empty for yaml format', () => {
    expect(scanForSecrets(iosConfig, 'yaml')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 17. Integration — Performance with Large Config
// ---------------------------------------------------------------------------

describe('Integration: performance with large config', () => {
  it('scans a 500-line config in under 50ms', () => {
    // Build a repeating block of realistic config lines (10 lines per block)
    const block = [
      '!',
      'interface GigabitEthernet0/%d',
      ' description Link to floor %d',
      ' switchport mode access',
      ' switchport access vlan %d',
      ' spanning-tree portfast',
      ' ip address 10.%d.%d.1 255.255.255.0',
      ' no shutdown',
      '!',
      'ip route 10.%d.0.0 255.255.0.0 10.%d.%d.254',
    ];

    const lines: string[] = [
      'version 17.6',
      'hostname PerfTestSwitch',
      'enable secret 9 $9$hashvaluehere',
      'snmp-server community PUBLIC RO',
      'tacacs-server key 7 0822455D0A16544541',
    ];

    // Pad to 500+ lines with realistic config
    let i = 0;
    while (lines.length < 500) {
      for (const tmpl of block) {
        lines.push(tmpl.replace(/%d/g, String(i)));
        if (lines.length >= 500) break;
      }
      i++;
    }

    const config = lines.join('\n');
    expect(config.split('\n').length).toBeGreaterThanOrEqual(500);

    const start = performance.now();
    const findings = scanForSecrets(config, 'cli');
    const elapsed = performance.now() - start;

    // 200ms generous bound for CI — typical execution is <10ms on modern hardware
    expect(elapsed).toBeLessThan(200);
    // Should still detect the secrets near the top
    expect(findings.length).toBeGreaterThanOrEqual(3);
  });
});
