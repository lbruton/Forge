import type { VariableDefinition, VariableType, TemplateSection } from '../types/index.ts';

const UPPERCASE_SEGMENTS = new Set(['vlan', 'ip', 'snmp', 'vtp', 'id', 'cdp', 'ssh', 'ntp', 'aaa', 'acl', 'dns', 'dhcp', 'nac', 'ise']);

/**
 * Convert snake_case variable name to Title Case label.
 * Special segments (vlan, ip, snmp, vtp, etc.) become all-caps.
 */
function toLabel(name: string): string {
  return name
    .split('_')
    .map((seg) => {
      if (UPPERCASE_SEGMENTS.has(seg.toLowerCase())) {
        return seg.toUpperCase();
      }
      // If the segment is purely numeric, keep as-is
      if (/^\d+$/.test(seg)) return seg;
      // Title case
      return seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Infer variable type and description from variable name.
 */
function inferType(name: string): { type: VariableType; description: string } {
  const lower = name.toLowerCase();

  if (lower.includes('ip') || lower.includes('address') || lower.includes('gateway')) {
    return { type: 'ip', description: 'IP address (e.g., 192.168.1.1)' };
  }
  if (lower.includes('range') || lower.includes('port')) {
    return { type: 'string', description: 'e.g., Gi1/0/1-24' };
  }
  if (lower.includes('vlan') && lower.includes('id')) {
    return { type: 'integer', description: 'VLAN ID number' };
  }
  return { type: 'string', description: '' };
}

/**
 * Scan text for $variable and ${variable} patterns.
 * Does NOT match Cisco type-9 password literals ($9$...).
 * Returns deduplicated VariableDefinition array.
 */
export function parseVariables(text: string): VariableDefinition[] {
  if (!text) return [];

  // Strip Cisco type-9 password hashes ($9$...), type-7 (7 XXXX), and
  // SNMP community strings that contain $ before scanning for variables.
  // Type-9 passwords: $9$ followed by non-whitespace chars (may contain multiple $ delimiters)
  const sanitized = text.replace(/\$\d\$\S+/g, '___HASH___');

  // Match ${varname} or $varname where varname starts with letter/underscore.
  // The $ must be preceded by whitespace or start-of-line to avoid matching
  // embedded $ in passwords, community strings, etc.
  const regex = /(?<=\s|^)\$\{([A-Za-z_]\w*)\}|(?<=\s|^)\$([A-Za-z_]\w*)/gm;
  const seen = new Set<string>();
  const result: VariableDefinition[] = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(sanitized)) !== null) {
    const name = match[1] || match[2];
    if (seen.has(name)) continue;
    seen.add(name);

    const { type, description } = inferType(name);
    result.push({
      name,
      label: toLabel(name),
      type,
      defaultValue: '',
      options: [],
      required: true,
      description,
    });
  }

  return result;
}

/**
 * Detect section boundaries from divider comment patterns.
 */
export function parseSections(text: string, format: 'cli' | 'xml' | 'json' | 'yaml'): TemplateSection[] {
  if (!text) {
    return [{
      id: crypto.randomUUID(),
      name: 'Full Config',
      template: '',
      order: 0,
      dividerPattern: '',
    }];
  }

  if (format === 'json') {
    return [{
      id: crypto.randomUUID(),
      name: 'Full Config',
      template: text,
      order: 0,
      dividerPattern: '',
    }];
  }

  const lines = text.split('\n');

  interface Divider {
    lineIndex: number;
    name: string;
    pattern: string;    // the divider line(s)
    spanLines: number;  // how many lines the divider occupies
  }

  const dividers: Divider[] = [];

  if (format === 'cli') {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Pattern 1: !########## SECTION NAME ########## or ########## SECTION NAME ##########
      // Also matches #### SECTION NAME #### and ##### SECTION NAME #####
      const inlineMatch = line.match(/^[!]?\s*(#{3,})\s+(.+?)\s+#{3,}\s*$/);
      if (inlineMatch) {
        const name = inlineMatch[2].trim();
        dividers.push({ lineIndex: i, name, pattern: line, spanLines: 1 });
        continue;
      }

      // Pattern 2: !############################## followed by ! SECTION NAME on next line
      // Then optionally another !############################## line
      const solidMatch = line.match(/^[!]?\s*#{10,}\s*$/);
      if (solidMatch && i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nameMatch = nextLine.match(/^!\s+(.+?)\s*$/);
        if (nameMatch) {
          const name = nameMatch[1].trim();
          // Check if there's a closing hash line
          if (i + 2 < lines.length && /^[!]?\s*#{10,}\s*$/.test(lines[i + 2])) {
            dividers.push({
              lineIndex: i,
              name,
              pattern: line + '\n' + nextLine + '\n' + lines[i + 2],
              spanLines: 3,
            });
          } else {
            dividers.push({
              lineIndex: i,
              name,
              pattern: line + '\n' + nextLine,
              spanLines: 2,
            });
          }
        }
      }
    }
  } else if (format === 'xml') {
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^<!--\s+(.+?)\s+-->$/);
      if (match) {
        dividers.push({ lineIndex: i, name: match[1].trim(), pattern: lines[i], spanLines: 1 });
      }
    }
  } else if (format === 'yaml') {
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^#\s+[=\-]{3,}\s+(.+?)\s+[=\-]{3,}\s*$/);
      if (match) {
        dividers.push({ lineIndex: i, name: match[1].trim(), pattern: lines[i], spanLines: 1 });
      }
    }
  }

  // No dividers found → single section
  if (dividers.length === 0) {
    return [{
      id: crypto.randomUUID(),
      name: 'Full Config',
      template: text,
      order: 0,
      dividerPattern: '',
    }];
  }

  // Build sections from dividers
  const sections: TemplateSection[] = [];

  for (let d = 0; d < dividers.length; d++) {
    const startLine = dividers[d].lineIndex;
    const endLine = d + 1 < dividers.length ? dividers[d + 1].lineIndex : lines.length;

    // Section content: from divider start through end
    const sectionLines = lines.slice(startLine, endLine);
    sections.push({
      id: crypto.randomUUID(),
      name: dividers[d].name,
      template: sectionLines.join('\n'),
      order: d,
      dividerPattern: dividers[d].pattern,
    });
  }

  // If there's content before the first divider, prepend it to the first section
  if (dividers[0].lineIndex > 0) {
    const preamble = lines.slice(0, dividers[0].lineIndex).join('\n');
    sections[0].template = preamble + '\n' + sections[0].template;
  }

  return sections;
}
