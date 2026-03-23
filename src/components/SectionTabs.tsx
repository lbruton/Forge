import { CopyButton, DownloadButton } from './CopyButton.tsx';
import type { GeneratedSection } from '../types/index.ts';

interface SectionTabsProps {
  sections: GeneratedSection[];
  activeSection: string | null; // null = "All Sections"
  onSelectSection: (sectionName: string | null) => void;
  hostname: string; // used for per-section download filename
}

export function SectionTabs({ sections, activeSection, onSelectSection, hostname }: SectionTabsProps) {
  const allText = sections
    .map((s, i) => (i === 0 ? s.content : s.divider + '\n' + s.content))
    .join('\n');

  const safeHostname = (hostname || 'config').replace(/[^a-zA-Z0-9_-]/g, '_');

  return (
    <div className="flex items-center gap-1 border-b border-forge-graphite bg-forge-charcoal/50 px-2 overflow-x-auto">
      {/* All Sections tab */}
      <button
        onClick={() => onSelectSection(null)}
        className={`
          shrink-0 px-3 py-2 text-xs font-medium transition-colors duration-150 border-b-2
          ${activeSection === null
            ? 'border-forge-amber text-forge-amber'
            : 'border-transparent text-slate-500 hover:text-slate-300'
          }
        `}
      >
        All Sections
      </button>

      {sections.map((section) => (
        <div key={section.name} className="flex items-center shrink-0">
          <button
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
        </div>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Per-section or global copy/download buttons */}
      <div className="flex items-center gap-1 py-1">
        {activeSection === null ? (
          <>
            <CopyButton text={allText} label="Copy" />
            <DownloadButton
              text={allText}
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
                <CopyButton text={section.content} label="Copy" />
                <DownloadButton
                  text={section.content}
                  filename={`${safeHostname}-${safeName}.txt`}
                  label="Download"
                />
              </>
            );
          })()
        )}
      </div>
    </div>
  );
}
