import type { ConfigFormat, HighlightToken } from '../types/index.ts';
import { SUB_START, SUB_END } from './substitution-engine.ts';

type MatchResult = { index: number; length: number; className: string; text: string };

/** Mutable box so TS tracks closure mutations correctly */
function createMatcher(source: string) {
  const state: { best: MatchResult | null } = { best: null };

  function tryMatch(re: RegExp, className: string) {
    const m = re.exec(source);
    if (m && (state.best === null || m.index < state.best.index)) {
      state.best = { index: m.index, length: m[0].length, className, text: m[0] };
    }
  }

  function reset() {
    state.best = null;
  }

  return { state, tryMatch, reset };
}

/** Consume bestMatch, push tokens, return new remaining string */
function consumeMatch(best: MatchResult, remaining: string, tokens: HighlightToken[]): string {
  if (best.index > 0) {
    tokens.push({ text: remaining.slice(0, best.index), className: 'text' });
  }
  tokens.push({ text: best.text, className: best.className });
  return remaining.slice(best.index + best.length);
}

// --- Cisco CLI ---

const CLI_KEYWORDS = new Set([
  'hostname',
  'interface',
  'ip',
  'address',
  'switchport',
  'vlan',
  'access-list',
  'permit',
  'deny',
  'shutdown',
  'no',
  'service',
  'aaa',
  'radius',
  'tacacs',
  'dot1x',
  'snmp-server',
  'logging',
  'ntp',
  'banner',
  'line',
  'crypto',
  'spanning-tree',
  'description',
  'clock',
  'username',
  'enable',
  'secret',
  'key',
  'timeout',
  'transport',
  'authentication',
  'authorization',
  'accounting',
  'device-tracking',
  'mac',
  'lldp',
  'cdp',
  'epm',
]);

const IPV4_RE = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/;
const INTERFACE_NAME_RE = /\b((?:Gi|Te|Fa|Vlan|Lo)\S+)/;
const VARIABLE_GLOBAL_RE = /(\$\{[a-zA-Z_]\w*\})/;
const VARIABLE_LOCAL_RE = /(\$[a-zA-Z_]\w*)/;
const NUMBER_RE = /\b(\d+)\b/;

// START/END section banner pattern
const SECTION_BANNER_RE = /^!#{3,}\s*.*\s*-\s*(START|END)\s*#{3,}$/i;

function tokenizeCli(line: string): HighlightToken[] {
  // Section banner lines (START/END markers) — highlight distinctly
  if (SECTION_BANNER_RE.test(line)) {
    return [{ text: line, className: 'section-banner' }];
  }

  // Comment line
  if (line.trimStart().startsWith('!')) {
    return [{ text: line, className: 'comment' }];
  }

  const tokens: HighlightToken[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    const { state, tryMatch } = createMatcher(remaining);

    tryMatch(VARIABLE_GLOBAL_RE, 'variable-global');
    tryMatch(VARIABLE_LOCAL_RE, 'variable');
    tryMatch(IPV4_RE, 'ip-address');
    tryMatch(INTERFACE_NAME_RE, 'interface-name');
    tryMatch(NUMBER_RE, 'number');

    // Check for keyword at current word boundary
    const wordMatch = /^(\S+)/.exec(remaining);
    if (wordMatch && CLI_KEYWORDS.has(wordMatch[1])) {
      if (state.best === null || 0 < state.best.index) {
        state.best = { index: 0, length: wordMatch[1].length, className: 'keyword', text: wordMatch[1] };
      }
    }

    // Also scan for keywords that appear mid-line after spaces
    const midWordRe = /(?<=\s)(\S+)/g;
    let midMatch;
    while ((midMatch = midWordRe.exec(remaining)) !== null) {
      if (CLI_KEYWORDS.has(midMatch[1])) {
        if (state.best === null || midMatch.index < state.best.index) {
          state.best = { index: midMatch.index, length: midMatch[1].length, className: 'keyword', text: midMatch[1] };
        }
        break; // take the first/earliest keyword
      }
    }

    if (state.best === null) {
      tokens.push({ text: remaining, className: 'text' });
      break;
    }

    remaining = consumeMatch(state.best, remaining, tokens);
  }

  return tokens;
}

// --- XML ---

function tokenizeXml(line: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let remaining = line;

  // XML comment
  const commentRe = /(<!--[\s\S]*?-->)/;
  // Tag (opening/closing)
  const tagRe = /(<\/?[\w:-]+|\/?>|>)/;
  // Attribute
  const attrRe = /\b([\w:-]+)(?==)/;
  // Quoted string
  const stringRe = /("[^"]*"|'[^']*')/;

  while (remaining.length > 0) {
    const { state, tryMatch } = createMatcher(remaining);

    tryMatch(commentRe, 'comment');
    tryMatch(tagRe, 'tag');
    tryMatch(attrRe, 'attribute');
    tryMatch(stringRe, 'string');
    tryMatch(VARIABLE_GLOBAL_RE, 'variable-global');
    tryMatch(VARIABLE_LOCAL_RE, 'variable');

    if (state.best === null) {
      if (remaining.length > 0) tokens.push({ text: remaining, className: 'text' });
      break;
    }

    remaining = consumeMatch(state.best, remaining, tokens);
  }

  return tokens;
}

// --- JSON ---

function tokenizeJson(line: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let remaining = line;

  // Key: quoted string followed by a colon
  const keyRe = /("(?:[^"\\]|\\.)*")\s*(?=:)/;
  // String value
  const stringRe = /("(?:[^"\\]|\\.)*")/;
  // Number
  const numberRe = /\b(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/;
  // Boolean/null
  const boolRe = /\b(true|false|null)\b/;
  // Punctuation
  const punctRe = /([{}[\],::])/;

  while (remaining.length > 0) {
    const { state, tryMatch } = createMatcher(remaining);

    // Key must be checked before generic string
    tryMatch(keyRe, 'key');
    if (state.best === null || state.best.className !== 'key' || state.best.index > 0) {
      tryMatch(stringRe, 'string');
    }
    // If we matched a key at a position, but a string is earlier, the string wins (it's a value before a key)
    tryMatch(numberRe, 'number');
    tryMatch(boolRe, 'boolean');
    tryMatch(punctRe, 'punctuation');
    tryMatch(VARIABLE_GLOBAL_RE, 'variable-global');
    tryMatch(VARIABLE_LOCAL_RE, 'variable');

    if (state.best === null) {
      if (remaining.length > 0) tokens.push({ text: remaining, className: 'text' });
      break;
    }

    remaining = consumeMatch(state.best, remaining, tokens);
  }

  return tokens;
}

// --- YAML ---

function tokenizeYaml(line: string): HighlightToken[] {
  // Comment line
  if (line.trimStart().startsWith('#')) {
    return [{ text: line, className: 'comment' }];
  }

  const tokens: HighlightToken[] = [];
  let remaining = line;

  // Key: word(s) before a colon (at start or after indent)
  const keyRe = /^(\s*[\w][\w\s.-]*?)(?=:\s|:$)/;
  const keyMatch = keyRe.exec(remaining);
  if (keyMatch) {
    tokens.push({ text: keyMatch[1], className: 'key' });
    remaining = remaining.slice(keyMatch[1].length);
    // consume the colon and space
    const colonRe = /^(:\s?)/;
    const colonMatch = colonRe.exec(remaining);
    if (colonMatch) {
      tokens.push({ text: colonMatch[1], className: 'text' });
      remaining = remaining.slice(colonMatch[1].length);
    }
  }

  // Now tokenize the value portion
  while (remaining.length > 0) {
    const { state, tryMatch } = createMatcher(remaining);

    tryMatch(/("[^"]*"|'[^']*')/, 'string');
    tryMatch(/\b(-?\d+(?:\.\d+)?)\b/, 'number');
    tryMatch(/\b(true|false|null|yes|no)\b/, 'boolean');
    // Inline comment
    tryMatch(/(#.*)$/, 'comment');
    tryMatch(VARIABLE_GLOBAL_RE, 'variable-global');
    tryMatch(VARIABLE_LOCAL_RE, 'variable');

    if (state.best === null) {
      if (remaining.length > 0) tokens.push({ text: remaining, className: 'text' });
      break;
    }

    remaining = consumeMatch(state.best, remaining, tokens);
  }

  return tokens;
}

// --- Main export ---

const tokenizers: Record<ConfigFormat, (line: string) => HighlightToken[]> = {
  cli: tokenizeCli,
  xml: tokenizeXml,
  json: tokenizeJson,
  yaml: tokenizeYaml,
};

/**
 * Tokenize a line that may contain substitution sentinels.
 * Splits on sentinel boundaries, tokenizes non-substituted segments normally,
 * and emits 'variable-value' tokens for substituted values.
 */
function tokenizeWithSubstitutions(line: string, tokenizer: (l: string) => HighlightToken[]): HighlightToken[] {
  // Fast path: no sentinels in this line
  if (!line.includes(SUB_START)) {
    return tokenizer(line);
  }

  const tokens: HighlightToken[] = [];
  // Split by sentinel pairs: text \uE000value\uE001 text ...
  const re = new RegExp(`${SUB_START}(.*?)${SUB_END}`, 'g');
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(line)) !== null) {
    // Tokenize text before the substitution normally
    if (match.index > lastIndex) {
      const before = line.slice(lastIndex, match.index);
      tokens.push(...tokenizer(before));
    }
    // Emit the substituted value as a variable-value token
    tokens.push({ text: match[1], className: 'variable-value' });
    lastIndex = match.index + match[0].length;
  }

  // Tokenize any remaining text after the last substitution
  if (lastIndex < line.length) {
    tokens.push(...tokenizer(line.slice(lastIndex)));
  }

  return tokens;
}

/**
 * Tokenize text into highlighted spans, grouped by line.
 * Returns an array of lines, each line being an array of HighlightToken objects.
 * Handles substitution sentinel markers from the substitution engine.
 */
export function highlight(text: string, format: ConfigFormat): HighlightToken[][] {
  const lines = text.split('\n');
  const tokenizer = tokenizers[format];
  return lines.map((line) =>
    line.length === 0 ? [{ text: '', className: 'text' }] : tokenizeWithSubstitutions(line, tokenizer),
  );
}
