import { CopyButton, DownloadButton } from './CopyButton.tsx';
import { stripSubMarkers } from '../lib/substitution-engine.ts';
import type { GeneratedSection } from '../types/index.ts';

interface SectionTabsProps {
  sections: GeneratedSection[];
  activeSection: string | null; // null = "All Sections"
  onSelectSection: (sectionName: string | null) => void;
  hostname: string; // used for per-section download filename
}

export function SectionTabs({ sections, activeSection, onSelectSection, hostname }: SectionTabsProps) {
  const allText = sections
    .map((s, i) => {
      const parts: string[] = [];
      if (s.divider && (i > 0 || s.endDivider)) {
        parts.push(s.divider);
      }
      parts.push(s.content);
      if (s.endDivider) {
        parts.push(s.endDivider);
      }
      return parts.join('\n');
    })
    .join('\n');

  const safeHostname = (hostname || 'config').replace(/[^a-zA-Z0-9_-]/g, '_');

  return (
    <div className="border-b border-forge-graphite bg-forge-charcoal/50 px-2">
      <div className="flex flex-wrap items-center gap-1">
        {/* All Sections tab */}
        <button
          onClick={() => onSelectSection(null)}
          className={`
            px-3 py-2 text-xs font-medium transition-colors duration-150 border-b-2
            ${activeSection === null
              ? 'border-forge-amber text-forge-amber'
              : 'border-transparent text-slate-500 hover:text-slate-300'
            }
          `}
        >
          All Sections
        </button>

        {sections.map((section) => (
          <button
            key={section.name}
            onClick={() => onSelectSection(section.name)}
            className={`
              px-3 py-2 text-xs font-medium transition-colors duration-150 border-b-2
              ${activeSection === section.name
                ? 'border-forge-amber text-forge-amber'
                : 'border-transparent text-slate-500 hover:text-slate-300'
              }
            `}
          >
            {section.name}
          </button>
        ))}

        {/* Copy/download buttons — always visible */}
        <div className="flex items-center gap-1 py-1 ml-auto">
        {activeSection === null ? (
          <>
            <CopyButton text={stripSubMarkers(allText)} label="Copy" />
            <DownloadButton
              text={stripSubMarkers(allText)}
              filename={`${safeHostname}-all.txt`}
              label="Download"
            />
          </>
        ) : (
          (() => {
            const section = sections.find((s) => s.name === activeSection);
            if (!section) return null;
            const safeName = section.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
            return (
              <>
                <CopyButton text={stripSubMarkers(section.content)} label="Copy" />
                <DownloadButton
                  text={stripSubMarkers(section.content)}
                  filename={`${safeHostname}-${safeName}.txt`}
                  label="Download"
                />
              </>
            );
          })()
        )}
        </div>
      </div>
    </div>
  );
}
