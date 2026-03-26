import type { ConfigFormat, ParsedVariables, VariableDefinition, VariableType, TemplateSection } from '../types/index.ts';

export type { ParsedVariables } from '../types/index.ts';

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
 * Braced ${var} matches are treated as global (view-scoped) variables.
 * Bare $var matches are treated as local (template-scoped) variables.
 * If the same name appears in both forms, the braced form wins (global only).
 * Returns deduplicated ParsedVariables with local and global arrays.
 */
export function parseVariables(text: string): ParsedVariables {
  if (!text) return { local: [], global: [] };

  // Strip Cisco type-9 password hashes ($9$...), type-7 (7 XXXX), and
  // SNMP community strings that contain $ before scanning for variables.
  // Type-9 passwords: $9$ followed by non-whitespace chars (may contain multiple $ delimiters)
  const sanitized = text.replace(/\$\d\$\S+/g, '___HASH___');

  // Match ${varname} or $varname where varname starts with letter/underscore.
  // The $ must be preceded by whitespace or start-of-line to avoid matching
  // embedded $ in passwords, community strings, etc.
  const regex = /(?<=\s|^)\$\{([A-Za-z_]\w*)\}|(?<=\s|^)\$([A-Za-z_]\w*)/gm;
  const globalNames = new Set<string>();
  const localNames = new Set<string>();
  const localDefs: VariableDefinition[] = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(sanitized)) !== null) {
    const bracedName = match[1];
    const bareName = match[2];

    if (bracedName) {
      // Braced ${var} → global
      globalNames.add(bracedName);
    } else if (bareName) {
      // Bare $var → local (tentatively)
      if (!localNames.has(bareName)) {
        localNames.add(bareName);
        const { type, description } = inferType(bareName);
        localDefs.push({
          name: bareName,
          label: toLabel(bareName),
          type,
          defaultValue: '',
          options: [],
          required: true,
          description,
        });
      }
    }
  }

  // If a name appears in both global and local, global wins — remove from local
  const filteredLocal = localDefs.filter((v) => !globalNames.has(v.name));

  return {
    local: filteredLocal,
    global: Array.from(globalNames),
  };
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

    // Remove outer START/END pairs that fully contain inner START/END pairs.
    // When a user nests markers, the intent is to break the outer block apart —
    // the inner blocks become their own sections, and the gaps become Generic Config.
    const toRemove = new Set<number>();
    for (let i = 0; i < dividers.length; i++) {
      const outer = dividers[i];
      if (outer.endLineIndex == null) continue; // legacy divider, skip
      for (let j = 0; j < dividers.length; j++) {
        if (i === j) continue;
        const inner = dividers[j];
        // Check if inner divider is fully contained within outer's range
        if (inner.lineIndex > outer.lineIndex && inner.lineIndex < outer.endLineIndex!) {
          toRemove.add(i); // remove the outer, keep the inner
          break;
        }
      }
    }
    if (toRemove.size > 0) {
      const filtered = dividers.filter((_, i) => !toRemove.has(i));
      dividers.length = 0;
      dividers.push(...filtered);
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

  // Build sections from dividers, filling gaps with "Generic Config" sections
  const sections: TemplateSection[] = [];
  let cursor = 0; // tracks how far through the document we've processed

  for (let d = 0; d < dividers.length; d++) {
    const div = dividers[d];

    // CHECK FOR GAP: content between cursor and this divider
    if (cursor < div.lineIndex) {
      const gapLines = lines.slice(cursor, div.lineIndex);
      // Only create a section if there's meaningful content
      // (standalone '!' lines are IOS comment separators — treat as whitespace)
      const hasContent = gapLines.some(l => l.trim() !== '' && l.trim() !== '!');
      if (hasContent) {
        // Trim leading/trailing blank lines
        let gStart = 0;
        while (gStart < gapLines.length && gapLines[gStart].trim() === '') gStart++;
        let gEnd = gapLines.length - 1;
        while (gEnd > gStart && gapLines[gEnd].trim() === '') gEnd--;

        sections.push({
          id: crypto.randomUUID(),
          name: 'Generic Config',
          template: gapLines.slice(gStart, gEnd + 1).join('\n'),
          order: sections.length,
          dividerPattern: '',
          startLine: cursor + gStart,
        });
      }
    }

    // BUILD SECTION FROM DIVIDER
    if (div.endLineIndex != null) {
      // START/END mode
      const contentStart = div.lineIndex + div.spanLines;
      const contentEnd = div.endLineIndex;
      sections.push({
        id: crypto.randomUUID(),
        name: div.name,
        template: lines.slice(contentStart, contentEnd).join('\n'),
        order: sections.length,
        dividerPattern: div.pattern,
        endDividerPattern: lines[div.endLineIndex],
        startLine: div.lineIndex,
      });
      cursor = div.endLineIndex + 1;
    } else {
      // Legacy divider mode
      const contentStart = div.lineIndex + div.spanLines;
      const nextDividerLine = d + 1 < dividers.length ? dividers[d + 1].lineIndex : lines.length;
      sections.push({
        id: crypto.randomUUID(),
        name: div.name,
        template: lines.slice(contentStart, nextDividerLine).join('\n'),
        order: sections.length,
        dividerPattern: div.pattern,
        startLine: div.lineIndex,
      });
      cursor = nextDividerLine;
    }
  }

  // CHECK FOR POSTAMBLE: content after the last section
  if (cursor < lines.length) {
    const postLines = lines.slice(cursor);
    const hasContent = postLines.some(l => l.trim() !== '' && l.trim() !== '!');
    if (hasContent) {
      let gStart = 0;
      while (gStart < postLines.length && postLines[gStart].trim() === '') gStart++;
      let gEnd = postLines.length - 1;
      while (gEnd > gStart && postLines[gEnd].trim() === '') gEnd--;

      sections.push({
        id: crypto.randomUUID(),
        name: 'Generic Config',
        template: postLines.slice(gStart, gEnd + 1).join('\n'),
        order: sections.length,
        dividerPattern: '',
        startLine: cursor + gStart,
      });
    }
  }

  // Deduplicate section names (handles "Generic Config", "Generic Config (2)", etc.)
  // Strip existing (N) suffixes before counting so re-parsed names don't double-up
  const nameCount = new Map<string, number>();
  for (const section of sections) {
    const baseName = section.name.replace(/\s*\(\d+\)\s*$/, '');
    const baseKey = baseName.toLowerCase();
    const count = (nameCount.get(baseKey) ?? 0) + 1;
    nameCount.set(baseKey, count);
    section.name = count === 1 ? baseName : `${baseName} (${count})`;
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

/**
 * Locate a section's start line in the rawText lines array.
 * Uses startLine property if available, otherwise searches for the
 * divider pattern by string match.
 */
function findSectionStart(section: TemplateSection, lines: string[]): number {
  if (section.startLine != null && section.startLine >= 0 && section.startLine < lines.length) {
    return section.startLine;
  }

  // Fallback: search for the divider pattern in the lines
  const patternFirstLine = section.dividerPattern.split('\n')[0];
  if (!patternFirstLine) return -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === patternFirstLine) {
      return i;
    }
  }
  return -1;
}

/**
 * Given sections in a desired order and the current rawText, extracts each
 * section's text block (from its START divider through its END divider or
 * next section) and concatenates them in the new order.
 *
 * Text before the first section (preamble) and after the last section
 * (postamble) in the original rawText is preserved in place.
 */
export function rebuildRawText(sections: TemplateSection[], rawText: string): string {
  if (!rawText || sections.length === 0) return rawText || '';

  const lines = rawText.split('\n');

  // Build a list of section ranges: [startLineIndex, endLineIndex) for each section
  // in their ORIGINAL document order so we can extract text blocks.
  interface SectionRange {
    section: TemplateSection;
    from: number; // inclusive (first line of divider)
    to: number;   // exclusive
  }

  // First, find all section start positions
  const starts: { section: TemplateSection; from: number }[] = [];
  for (const sec of sections) {
    const from = findSectionStart(sec, lines);
    if (from >= 0) {
      starts.push({ section: sec, from });
    }
  }

  if (starts.length === 0) return rawText;

  // Sort by document position to determine boundaries
  const byPosition = [...starts].sort((a, b) => a.from - b.from);

  // Determine end of each section block
  const ranges: SectionRange[] = [];
  for (let i = 0; i < byPosition.length; i++) {
    const entry = byPosition[i];
    let to: number;

    if (entry.section.endDividerPattern) {
      // Has an END marker — find it
      const endPattern = entry.section.endDividerPattern;
      let endIdx = -1;
      for (let j = entry.from + 1; j < lines.length; j++) {
        if (lines[j] === endPattern) {
          endIdx = j;
          break;
        }
      }
      to = endIdx >= 0 ? endIdx + 1 : (i + 1 < byPosition.length ? byPosition[i + 1].from : lines.length);
    } else {
      // No END marker — runs to next section start or EOF
      to = i + 1 < byPosition.length ? byPosition[i + 1].from : lines.length;
    }

    ranges.push({ section: entry.section, from: entry.from, to });
  }

  // Identify preamble (text before first section in original order)
  const firstFrom = byPosition[0].from;
  const preamble = firstFrom > 0 ? lines.slice(0, firstFrom).join('\n') : '';

  // Identify postamble (text after last section in original order)
  const lastTo = Math.max(...ranges.map((r) => r.to));
  const postamble = lastTo < lines.length ? lines.slice(lastTo).join('\n') : '';

  // Build a lookup from section id to its extracted text block
  const blockMap = new Map<string, string>();
  for (const range of ranges) {
    blockMap.set(range.section.id, lines.slice(range.from, range.to).join('\n'));
  }

  // Reassemble in the desired order (sections array order)
  const parts: string[] = [];
  if (preamble) parts.push(preamble);

  for (const sec of sections) {
    const block = blockMap.get(sec.id);
    if (block != null) {
      parts.push(block);
    }
  }

  if (postamble) parts.push(postamble);

  return parts.join('\n');
}
