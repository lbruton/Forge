import { useMemo } from 'react';
import { highlight } from '../lib/syntax-highlighter.ts';
import type { ConfigFormat, GeneratedSection, HighlightToken } from '../types/index.ts';

interface ConfigPreviewProps {
  sections: GeneratedSection[];
  activeSection: string | null;
  configFormat: ConfigFormat;
}

/** Map token classNames to Tailwind color classes */
const TOKEN_STYLES: Record<string, string> = {
  keyword: 'text-sky-400',
  'ip-address': 'text-violet-400',
  comment: 'text-slate-500 italic',
  'interface-name': 'text-green-400',
  number: 'text-orange-300',
  variable: 'text-amber-500 bg-amber-500/10 rounded px-0.5',
  text: 'text-slate-200',
  // XML / JSON / YAML specific
  tag: 'text-sky-400',
  attribute: 'text-green-400',
  string: 'text-green-300',
  key: 'text-sky-300',
  boolean: 'text-orange-300',
  punctuation: 'text-slate-400',
};

function renderToken(token: HighlightToken, key: number) {
  const style = TOKEN_STYLES[token.className] ?? TOKEN_STYLES.text;
  return (
    <span key={key} className={style}>
      {token.text}
    </span>
  );
}

export function ConfigPreview({ sections, activeSection, configFormat }: ConfigPreviewProps) {
  // Build the text to display based on active section filter
  const displayText = useMemo(() => {
    if (activeSection === null) {
      // All sections — reconstruct with START/END markers
      return sections
        .map((s, i) => {
          const parts: string[] = [];
          if (s.divider) {
            if (i > 0 || s.endDivider) {
              parts.push(s.divider);
            }
          }
          parts.push(s.content);
          if (s.endDivider) {
            parts.push(s.endDivider);
          }
          return parts.join('\n');
        })
        .join('\n');
    }
    const section = sections.find((s) => s.name === activeSection);
    return section?.content ?? '';
  }, [sections, activeSection]);

  // Tokenize lines
  const tokenizedLines = useMemo(() => {
    if (!displayText) return [];
    return highlight(displayText, configFormat);
  }, [displayText, configFormat]);

  if (sections.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-forge-terminal text-slate-500 text-sm font-mono">
        No template loaded
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-forge-terminal font-mono text-sm">
      <table className="w-full border-collapse">
        <tbody>
          {tokenizedLines.map((lineTokens, lineIdx) => (
            <tr key={lineIdx} className="hover:bg-white/[0.02]">
              <td className="select-none text-right pr-4 pl-3 py-0 text-slate-600 text-xs w-[1%] whitespace-nowrap align-top leading-[1.65rem]">
                {lineIdx + 1}
              </td>
              <td className="pr-4 py-0 whitespace-pre leading-[1.65rem]">
                {lineTokens.map((token, tokenIdx) => renderToken(token, tokenIdx))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
