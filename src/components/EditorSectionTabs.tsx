import type { TemplateSection } from '../types/index.ts';

interface EditorSectionTabsProps {
  sections: TemplateSection[];
  activeSectionName: string | null;
  onJumpTo: (section: TemplateSection) => void;
}

export function EditorSectionTabs({ sections, activeSectionName, onJumpTo }: EditorSectionTabsProps) {
  if (sections.length === 0 || sections[0].name === 'Full Config') return null;

  return (
    <div className="border-b border-forge-graphite bg-forge-charcoal/50 px-2">
      <div className="flex flex-wrap items-center gap-1">
        {sections.map((section) => {
          const isActive = activeSectionName === section.name;
          return (
            <button
              key={section.id}
              onClick={() => onJumpTo(section)}
              className={`
                px-3 py-2 text-xs font-medium transition-colors duration-150 border-b-2
                ${isActive
                  ? 'border-amber-500 text-amber-400 bg-amber-500/20'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
                }
              `}
            >
              {section.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
