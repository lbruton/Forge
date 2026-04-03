/**
 * secrets-detector.ts — Scans Cisco configuration text for exposed secrets.
 *
 * Pure-function module: no side effects, no state.
 * Returns structured findings with line numbers, severity, and context.
 */

import type { ConfigFormat } from '../types/index.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SecretSeverity = 'critical' | 'high' | 'low';

export interface SecretDetectionRule {
  id: string;
  category: string;
  pattern: RegExp;
  severity: SecretSeverity | ((match: RegExpMatchArray) => SecretSeverity);
  description: string;
}

export interface SecretFinding {
  ruleId: string;
  category: string;
  severity: SecretSeverity;
  description: string;
  line: number; // 1-based
  lineText: string; // full line for context
  matchStart: number; // char offset within line
  matchEnd: number; // char offset within line
}

// ---------------------------------------------------------------------------
// Variable pattern — used to skip lines where the secret value is a template variable
// ---------------------------------------------------------------------------

const VARIABLE_PATTERN = /^\$\{?[A-Za-z_]\w*\}?$/;

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

/** Type 0 or bare = critical, type 7 = high (reversible), type 5/8/9 = low (hashed). */
function passwordTypeSeverity(match: RegExpMatchArray): SecretSeverity {
  const typeNum = match[1];
  if (!typeNum) return 'critical'; // bare — no type prefix
  if (typeNum === '0') return 'critical';
  if (typeNum === '7') return 'high';
  return 'low'; // 5, 8, 9
}

/** Enable secret: type 0 = critical, type 5/8/9 = low. */
function enableSecretSeverity(match: RegExpMatchArray): SecretSeverity {
  const typeNum = match[1];
  if (typeNum === '0') return 'critical';
  return 'low'; // 5, 8, 9
}

/** Type 0 or 6 for crypto = critical. */
function cryptoKeySeverity(match: RegExpMatchArray): SecretSeverity {
  const typeNum = match[1];
  if (!typeNum || typeNum === '0') return 'critical';
  if (typeNum === '6') return 'high';
  return 'critical';
}

// ---------------------------------------------------------------------------
// Detection Rules — grouped by category
// ---------------------------------------------------------------------------

export const DETECTION_RULES: SecretDetectionRule[] = [
  // ── Authentication & Enable ──────────────────────────────────────────

  {
    id: 'enable-password',
    category: 'Authentication & Enable',
    // enable password [0|7] <value>  OR  enable password <value>
    pattern: /^enable\s+password\s+(?:([07])\s+)?(\S+)$/i,
    severity: (m) => {
      const t = m[1];
      if (!t || t === '0') return 'critical';
      return 'high'; // 7
    },
    description: 'Enable password exposed',
  },
  {
    id: 'enable-secret',
    category: 'Authentication & Enable',
    // enable secret [0|5|8|9] <hash/value>
    pattern: /^enable\s+secret\s+([0589])\s+(\S+)$/i,
    severity: enableSecretSeverity,
    description: 'Enable secret detected',
  },
  {
    id: 'username-password',
    category: 'Authentication & Enable',
    // username <name> password [0|7] <value>  OR  username <name> password <value>
    pattern: /^username\s+\S+\s+password\s+(?:([07])\s+)?(\S+)$/i,
    severity: (m) => {
      const t = m[1];
      if (!t || t === '0') return 'critical';
      return 'high'; // 7
    },
    description: 'Username password exposed',
  },
  {
    id: 'username-secret',
    category: 'Authentication & Enable',
    // username <name> secret [0|5|8|9] <value>
    pattern: /^username\s+\S+\s+secret\s+([0589])\s+(\S+)$/i,
    severity: enableSecretSeverity,
    description: 'Username secret detected',
  },
  {
    id: 'line-password',
    category: 'Authentication & Enable',
    // password [0|7] <value>  (indented, under line con/vty/aux)
    pattern: /^\s*password\s+(?:([07])\s+)?(\S+)$/i,
    severity: (m) => {
      const t = m[1];
      if (!t || t === '0') return 'critical';
      return 'high'; // 7
    },
    description: 'Line password exposed',
  },

  // ── SNMP ─────────────────────────────────────────────────────────────

  {
    id: 'snmp-community',
    category: 'SNMP',
    // snmp-server community <string> [RO|RW]
    pattern: /^snmp-server\s+community\s+(\S+)(?:\s+(?:RO|RW))?/i,
    severity: 'critical',
    description: 'SNMP community string exposed',
  },
  {
    id: 'snmp-user-auth',
    category: 'SNMP',
    // snmp-server user <name> <group> ... auth [md5|sha] <key>
    pattern: /^snmp-server\s+user\s+\S+\s+\S+\s+.*\bauth\s+(?:md5|sha)\s+(\S+)/i,
    severity: 'critical',
    description: 'SNMPv3 authentication key exposed',
  },
  {
    id: 'snmp-user-priv',
    category: 'SNMP',
    // snmp-server user <name> <group> ... priv [des|aes|3des] <key>
    pattern: /^snmp-server\s+user\s+\S+\s+\S+\s+.*\bpriv\s+(?:des|aes|3des)\s+(\S+)/i,
    severity: 'critical',
    description: 'SNMPv3 privacy key exposed',
  },
  {
    id: 'snmp-host',
    category: 'SNMP',
    // snmp-server host <ip> <community>
    pattern: /^snmp-server\s+host\s+\S+\s+(\S+)/i,
    severity: 'critical',
    description: 'SNMP host community string exposed',
  },

  // ── AAA / TACACS+ / RADIUS ──────────────────────────────────────────

  {
    id: 'tacacs-server-key',
    category: 'AAA/TACACS+/RADIUS',
    // tacacs-server key [0|7] <value>
    pattern: /^tacacs-server\s+key\s+(?:([07])\s+)?(\S+)$/i,
    severity: passwordTypeSeverity,
    description: 'TACACS+ server key exposed',
  },
  {
    id: 'tacacs-key-indented',
    category: 'AAA/TACACS+/RADIUS',
    // key [0|7] <value>  (under tacacs/radius server block — matched on trimmed text)
    pattern: /^key\s+(?:([07])\s+)?(\S+)$/i,
    severity: (m) => {
      const t = m[1];
      if (!t || t === '0') return 'critical';
      return 'high';
    },
    description: 'Server key exposed',
  },
  {
    id: 'radius-server-key',
    category: 'AAA/TACACS+/RADIUS',
    // radius-server key [0|7] <value>
    pattern: /^radius-server\s+key\s+(?:([07])\s+)?(\S+)$/i,
    severity: passwordTypeSeverity,
    description: 'RADIUS server key exposed',
  },
  {
    id: 'server-private-key',
    category: 'AAA/TACACS+/RADIUS',
    // server-private <ip> key [0|7] <value>
    pattern: /^server-private\s+\S+\s+key\s+(?:([07])\s+)?(\S+)$/i,
    severity: (m) => {
      const t = m[1];
      if (!t || t === '0') return 'critical';
      return 'high';
    },
    description: 'AAA server-private key exposed',
  },

  // ── Routing Protocol Authentication ─────────────────────────────────

  {
    id: 'ospf-auth-key',
    category: 'Routing Protocol Auth',
    // ip ospf authentication-key [0|7] <value>
    pattern: /^ip\s+ospf\s+authentication-key\s+(?:([07])\s+)?(\S+)$/i,
    severity: passwordTypeSeverity,
    description: 'OSPF authentication key exposed',
  },
  {
    id: 'ospf-md5-key',
    category: 'Routing Protocol Auth',
    // ip ospf message-digest-key <id> md5 [0|7] <value>
    pattern: /^ip\s+ospf\s+message-digest-key\s+\d+\s+md5\s+(?:([07])\s+)?(\S+)$/i,
    severity: passwordTypeSeverity,
    description: 'OSPF MD5 key exposed',
  },
  {
    id: 'key-string',
    category: 'Routing Protocol Auth',
    // key-string [0|7] <value>  (key chain — EIGRP, BGP, RIP)
    pattern: /^\s*key-string\s+(?:([07])\s+)?(\S+)$/i,
    severity: passwordTypeSeverity,
    description: 'Key chain key-string exposed',
  },
  {
    id: 'bgp-neighbor-password',
    category: 'Routing Protocol Auth',
    // neighbor <ip> password [0|7] <value>
    pattern: /^neighbor\s+\S+\s+password\s+(?:([07])\s+)?(\S+)$/i,
    severity: passwordTypeSeverity,
    description: 'BGP neighbor password exposed',
  },
  {
    id: 'rip-auth-key',
    category: 'Routing Protocol Auth',
    // ip rip authentication key-string [0|7] <value>
    pattern: /^ip\s+rip\s+authentication\s+key-string\s+(?:([07])\s+)?(\S+)$/i,
    severity: passwordTypeSeverity,
    description: 'RIP authentication key exposed',
  },
  {
    id: 'isis-password',
    category: 'Routing Protocol Auth',
    // isis password <value>, area-password <value>, domain-password <value>
    pattern: /^(?:isis\s+password|area-password|domain-password)\s+(\S+)/i,
    severity: 'critical',
    description: 'IS-IS password exposed',
  },

  // ── VPN / Crypto ────────────────────────────────────────────────────

  {
    id: 'crypto-isakmp-key',
    category: 'VPN/Crypto',
    // crypto isakmp key [0|6] <value> address <ip>
    pattern: /^crypto\s+isakmp\s+key\s+(?:([06])\s+)?(\S+)\s+address\s+/i,
    severity: cryptoKeySeverity,
    description: 'ISAKMP pre-shared key exposed',
  },
  {
    id: 'ikev2-psk',
    category: 'VPN/Crypto',
    // pre-shared-key [0|6] <value>
    pattern: /^\s*pre-shared-key\s+(?:([06])\s+)?(\S+)$/i,
    severity: cryptoKeySeverity,
    description: 'IKEv2 pre-shared key exposed',
  },
  {
    id: 'tunnel-key',
    category: 'VPN/Crypto',
    // tunnel key <value>
    pattern: /^tunnel\s+key\s+(\S+)$/i,
    severity: 'critical',
    description: 'Tunnel key exposed',
  },

  // ── Switching / L2 ──────────────────────────────────────────────────

  {
    id: 'vtp-password',
    category: 'Switching/L2',
    // vtp password <value>
    pattern: /^vtp\s+password\s+(\S+)/i,
    severity: 'critical',
    description: 'VTP password exposed',
  },

  // ── Management ──────────────────────────────────────────────────────

  {
    id: 'ntp-auth-key',
    category: 'Management',
    // ntp authentication-key <id> md5 <value>
    pattern: /^ntp\s+authentication-key\s+\d+\s+md5\s+(\S+)/i,
    severity: 'critical',
    description: 'NTP authentication key exposed',
  },
  {
    id: 'ppp-chap-password',
    category: 'Management',
    // ppp chap password [0|7] <value>
    pattern: /^ppp\s+chap\s+password\s+(?:([07])\s+)?(\S+)$/i,
    severity: passwordTypeSeverity,
    description: 'PPP CHAP password exposed',
  },
  {
    id: 'ppp-pap-password',
    category: 'Management',
    // ppp pap sent-username <name> password [0|7] <value>
    pattern: /^ppp\s+pap\s+sent-username\s+\S+\s+password\s+(?:([07])\s+)?(\S+)$/i,
    severity: passwordTypeSeverity,
    description: 'PPP PAP password exposed',
  },
  {
    id: 'wlan-psk',
    category: 'Management',
    // wlan ... security wpa-psk ascii [0|7] <value>
    pattern: /^wlan\s+.*security\s+wpa-psk\s+ascii\s+(?:([07])\s+)?(\S+)/i,
    severity: passwordTypeSeverity,
    description: 'WLAN pre-shared key exposed',
  },
  {
    id: 'ip-http-password',
    category: 'Management',
    // ip http ... password [0|7] <value>
    pattern: /^ip\s+http\s+.*password\s+(?:([07])\s+)?(\S+)$/i,
    severity: passwordTypeSeverity,
    description: 'HTTP server password exposed',
  },

  // ── ASA-Specific ────────────────────────────────────────────────────

  {
    id: 'asa-passwd',
    category: 'ASA-Specific',
    // passwd <value> [encrypted]
    pattern: /^passwd\s+(\S+)(?:\s+encrypted)?$/i,
    severity: (m) => {
      // If "encrypted" keyword present, still high (reversible on older ASA)
      return m[0].toLowerCase().includes('encrypted') ? 'high' : 'critical';
    },
    description: 'ASA passwd exposed',
  },
  {
    id: 'asa-tunnel-group-psk',
    category: 'ASA-Specific',
    // tunnel-group <name> ... pre-shared-key <value>
    pattern: /^tunnel-group\s+\S+\s+.*pre-shared-key\s+(\S+)/i,
    severity: 'critical',
    description: 'ASA tunnel-group pre-shared key exposed',
  },
  {
    id: 'asa-ldap-password',
    category: 'ASA-Specific',
    // ldap-login-password <value>
    pattern: /^ldap-login-password\s+(\S+)/i,
    severity: 'critical',
    description: 'ASA LDAP login password exposed',
  },

  // ── Low-severity hashed catch-all ───────────────────────────────────

  {
    id: 'hashed-secret-catchall',
    category: 'Hashed Secrets',
    // secret [5|8|9] <hash>  OR  lines containing $1$, $5$, $8$, $9$, $14$ hash patterns
    pattern: /(?:\bsecret\s+[589]\s+\S+|\$(?:1|5|8|9|14)\$[A-Za-z0-9./]+\$[A-Za-z0-9./]+)/,
    severity: 'low',
    description: 'Hashed secret detected (not cleartext)',
  },
];

// ---------------------------------------------------------------------------
// Value extraction helper
// ---------------------------------------------------------------------------

/**
 * Extract the "value" portion from a rule match.
 * Convention: the last non-undefined capture group is the value.
 */
function extractValue(match: RegExpMatchArray): string | undefined {
  for (let i = match.length - 1; i >= 1; i--) {
    if (match[i] !== undefined) return match[i];
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scan configuration text for exposed secrets.
 *
 * Only operates on CLI-format configs — XML/JSON/YAML return empty results.
 * Lines that are empty, comments (`!`), or where the detected value is a
 * `$variable` / `${variable}` placeholder are skipped.
 */
export function scanForSecrets(
  text: string,
  format: ConfigFormat,
): SecretFinding[] {
  if (format !== 'cli') return [];
  if (!text) return [];

  const lines = text.split('\n');
  const findings: SecretFinding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('!')) continue;

    for (const rule of DETECTION_RULES) {
      try {
        const match = rule.pattern.exec(trimmed);
        if (!match) continue;

        // Check if the matched value portion is a template variable — skip if so
        const value = extractValue(match);
        if (value && VARIABLE_PATTERN.test(value)) continue;

        const severity =
          typeof rule.severity === 'function'
            ? rule.severity(match)
            : rule.severity;

        const fullMatch = match[0];
        const startIdx = line.indexOf(fullMatch);

        findings.push({
          ruleId: rule.id,
          category: rule.category,
          severity,
          description: rule.description,
          line: i + 1,
          lineText: line,
          matchStart: startIdx,
          matchEnd: startIdx + fullMatch.length,
        });

        break; // first match per line only
      } catch {
        // Skip broken rule — don't crash the scan
        continue;
      }
    }
  }

  return findings;
}
