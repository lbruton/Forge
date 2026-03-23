import type { ConfigFormat, VariableDefinition, VariableType, TemplateSection } from '../types/index.ts';

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

// START/END marker patterns
const START_MARKER_RE = /^!#{3,}\s*(.*?)\s*-\s*START\s*#{3,}$/i;
const END_MARKER_RE = /^!#{3,}\s*(.*?)\s*-\s*END\s*#{3,}$/i;

interface Divider {
  lineIndex: number;
  name: string;
  pattern: string;    // the divider line(s)
  spanLines: number;  // how many lines the divider occupies
  endLineIndex?: number; // line index of matching END marker (START/END mode)
}

/**
 * Deduplicate section names by appending " (2)", " (3)", etc. for repeats.
 * Order is always preserved.
 */
function deduplicateNames(dividers: Divider[]): void {
  const counts = new Map<string, number>();
  for (const d of dividers) {
    const count = (counts.get(d.name) ?? 0) + 1;
    counts.set(d.name, count);
    if (count > 1) {
      d.name = `${d.name} (${count})`;
    }
  }
}

/**
 * Detect section boundaries from divider comment patterns.
 * Supports START/END markers, legacy DNAC dividers, and mixed usage.
 */
export function parseSections(text: string, format: ConfigFormat): TemplateSection[] {
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
  const dividers: Divider[] = [];

  if (format === 'cli') {
    // First pass: detect START/END marker pairs
    const startMarkers: { lineIndex: number; name: string }[] = [];
    const endMarkers: { lineIndex: number; name: string }[] = [];
    const usedLines = new Set<number>();

    for (let i = 0; i < lines.length; i++) {
      const startMatch = lines[i].match(START_MARKER_RE);
      if (startMatch) {
        startMarkers.push({ lineIndex: i, name: startMatch[1].trim() });
        usedLines.add(i);
        continue;
      }
      const endMatch = lines[i].match(END_MARKER_RE);
      if (endMatch) {
        endMarkers.push({ lineIndex: i, name: endMatch[1].trim() });
        usedLines.add(i);
      }
    }

    // Match START markers with their END markers
    for (const start of startMarkers) {
      const matchingEnd = endMarkers.find(
        (e) => e.name.toLowerCase() === start.name.toLowerCase() && e.lineIndex > start.lineIndex
      );
      dividers.push({
        lineIndex: start.lineIndex,
        name: start.name,
        pattern: lines[start.lineIndex],
        spanLines: 1,
        endLineIndex: matchingEnd?.lineIndex,
      });
      if (matchingEnd) {
        usedLines.add(matchingEnd.lineIndex);
      }
    }

    // Second pass: detect legacy dividers on lines NOT consumed by START/END
    for (let i = 0; i < lines.length; i++) {
      if (usedLines.has(i)) continue;
      const line = lines[i];

      // Pattern 1: !########## SECTION NAME ########## or ########## SECTION NAME ##########
      const inlineMatch = line.match(/^[!]?\s*(#{3,})\s+(.+?)\s+#{3,}\s*$/);
      if (inlineMatch) {
        const name = inlineMatch[2].trim();
        // Skip if this looks like a START or END marker (already handled)
        if (/\s*-\s*(START|END)\s*$/i.test(name)) continue;
        dividers.push({ lineIndex: i, name, pattern: line, spanLines: 1 });
        usedLines.add(i);
        continue;
      }

      // Pattern 2: !############################## followed by ! SECTION NAME on next line
      const solidMatch = line.match(/^[!]?\s*#{10,}\s*$/);
      if (solidMatch && i + 1 < lines.length && !usedLines.has(i + 1)) {
        const nextLine = lines[i + 1];
        const nameMatch = nextLine.match(/^!\s+(.+?)\s*$/);
        if (nameMatch) {
          const name = nameMatch[1].trim();
          if (i + 2 < lines.length && /^[!]?\s*#{10,}\s*$/.test(lines[i + 2])) {
            dividers.push({
              lineIndex: i,
              name,
              pattern: line + '\n' + nextLine + '\n' + lines[i + 2],
              spanLines: 3,
            });
            usedLines.add(i);
            usedLines.add(i + 1);
            usedLines.add(i + 2);
          } else {
            dividers.push({
              lineIndex: i,
              name,
              pattern: line + '\n' + nextLine,
              spanLines: 2,
            });
            usedLines.add(i);
            usedLines.add(i + 1);
          }
        }
      }
    }

    // Sort dividers by line index to preserve document order
    dividers.sort((a, b) => a.lineIndex - b.lineIndex);
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

  // Deduplicate section names
  deduplicateNames(dividers);

  // Build sections from dividers
  const sections: TemplateSection[] = [];

  for (let d = 0; d < dividers.length; d++) {
    const startLine = dividers[d].lineIndex;
    let endLine: number;

    if (dividers[d].endLineIndex != null) {
      // START/END mode: include up to and including the END marker line
      endLine = dividers[d].endLineIndex! + 1;
    } else {
      endLine = d + 1 < dividers.length ? dividers[d + 1].lineIndex : lines.length;
    }

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

/**
 * Takes raw config text, detects sections, and returns a new string with
 * START/END markers injected around each section boundary.
 * Original divider lines are preserved; markers are added around them.
 * Duplicate section names get sequence numbers applied.
 */
export function cleanUpSections(text: string, format: ConfigFormat): string {
  if (!text) return '';

  // Parse sections to get boundaries
  const sections = parseSections(text, format);

  // If single "Full Config" section with no divider, wrap the whole thing
  if (sections.length === 1 && sections[0].dividerPattern === '') {
    const name = sections[0].name;
    return `!##### ${name} - START #####\n${text}\n!##### ${name} - END #####`;
  }

  const result: string[] = [];

  for (let s = 0; s < sections.length; s++) {
    const section = sections[s];
    const sectionLines = section.template.split('\n');

    // Filter out legacy divider lines and existing START/END markers from the section content
    const contentLines = sectionLines.filter((line) => {
      // Remove START/END markers (we'll add fresh ones)
      if (START_MARKER_RE.test(line) || END_MARKER_RE.test(line)) return false;
      // Remove legacy inline dividers: !########## SECTION NAME ##########
      if (/^[!]?\s*#{3,}\s+.+?\s+#{3,}\s*$/.test(line)) return false;
      // Remove solid hash lines: !##############################
      if (/^[!]?\s*#{10,}\s*$/.test(line)) return false;
      // Remove standalone section name lines that follow solid hash lines: ! SECTION NAME
      // These are tricky — only remove if they match a known section name
      return true;
    });

    // Trim leading/trailing empty lines from content
    let start = 0;
    while (start < contentLines.length && contentLines[start].trim() === '') start++;
    let end = contentLines.length - 1;
    while (end > start && contentLines[end].trim() === '') end--;
    const trimmedContent = contentLines.slice(start, end + 1);

    // Add START marker
    result.push(`!##### ${section.name} - START #####`);

    // Add the cleaned content
    for (const line of trimmedContent) {
      result.push(line);
    }

    // Add END marker
    result.push(`!##### ${section.name} - END #####`);

    // Add blank line between sections (except after last)
    if (s < sections.length - 1) {
      result.push('');
    }
  }

  return result.join('\n');
}
