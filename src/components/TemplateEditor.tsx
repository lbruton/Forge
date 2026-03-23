import { useState, useRef, useCallback, useEffect } from 'react';
import { Save, FileText, Layers, AlertCircle } from 'lucide-react';
import { useForgeStore } from '../store/index.ts';
import { parseVariables, parseSections } from '../lib/template-parser.ts';
import { VariableDetectionPanel } from './VariableDetectionPanel.tsx';
import type { VariableDefinition, TemplateSection, ConfigFormat } from '../types/index.ts';

interface TemplateEditorProps {
  variantId?: string | null;
}

function TemplateEditor({ variantId }: TemplateEditorProps) {
  const { saveTemplate, findVariant, getConfigFormat, getTemplate } = useForgeStore();

  // Resolve variant context
  const context = variantId ? findVariant(variantId) : null;
  const configFormat: ConfigFormat = variantId ? getConfigFormat(variantId) : 'cli';
  const existingTemplate = context?.variant.templateId
    ? getTemplate(context.variant.templateId)
    : undefined;

  // Editor state
  const [rawText, setRawText] = useState(existingTemplate?.rawSource ?? '');
  const [variables, setVariables] = useState<VariableDefinition[]>(
    existingTemplate?.variables ?? [],
  );
  const [sections, setSections] = useState<TemplateSection[]>(
    existingTemplate?.sections ?? [],
  );
  const [variableSectionMap, setVariableSectionMap] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build variable-to-section mapping
  const buildVariableSectionMap = useCallback(
    (text: string, parsedSections: TemplateSection[]): Record<string, string> => {
      const map: Record<string, string> = {};
      const varRegex = /(?<=\s|^)\$\{?([A-Za-z_]\w*)\}?/gm;

      for (const section of parsedSections) {
        let match: RegExpExecArray | null;
        const sectionRegex = new RegExp(varRegex.source, varRegex.flags);
        while ((match = sectionRegex.exec(section.template)) !== null) {
          const name = match[1];
          if (!map[name]) {
            map[name] = section.name;
          }
        }
      }

      // Fallback: scan full text for any variables not yet mapped
      let match: RegExpExecArray | null;
      const fullRegex = new RegExp(varRegex.source, varRegex.flags);
      while ((match = fullRegex.exec(text)) !== null) {
        const name = match[1];
        if (!map[name]) {
          map[name] = parsedSections[0]?.name ?? 'Full Config';
        }
      }

      return map;
    },
    [],
  );

  // Parse on text change with debounce
  const handleTextChange = useCallback(
    (text: string) => {
      setRawText(text);
      setSaved(false);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const parsedVars = parseVariables(text);
        const parsedSections = parseSections(text, configFormat);

        // Merge: keep user edits for existing variables, add new ones
        setVariables((prev) => {
          const prevByName = new Map(prev.map((v) => [v.name, v]));
          return parsedVars.map((pv) => {
            const existing = prevByName.get(pv.name);
            if (existing) {
              // Keep user edits to label, type, description, required
              return { ...pv, label: existing.label, type: existing.type, description: existing.description, required: existing.required, defaultValue: existing.defaultValue, options: existing.options };
            }
            return pv;
          });
        });

        setSections(parsedSections);
        setVariableSectionMap(buildVariableSectionMap(text, parsedSections));
      }, 300);
    },
    [configFormat, buildVariableSectionMap],
  );

  // Re-parse on initial load if we have existing text
  useEffect(() => {
    if (rawText) {
      const parsedSections = parseSections(rawText, configFormat);
      setSections(parsedSections);
      setVariableSectionMap(buildVariableSectionMap(rawText, parsedSections));
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save template
  const handleSave = () => {
    const templateId = existingTemplate?.id ?? crypto.randomUUID();
    const ts = new Date().toISOString();

    saveTemplate({
      id: templateId,
      sections,
      variables,
      rawSource: rawText,
      createdAt: existingTemplate?.createdAt ?? ts,
      updatedAt: ts,
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // Count variable occurrences for the summary
  const countOccurrences = (text: string, varName: string): number => {
    const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\$\\{?${escaped}\\}?`, 'g');
    return (text.match(regex) || []).length;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-forge-graphite bg-forge-charcoal flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-base font-semibold text-slate-200">Template Editor</h2>
          {context ? (
            <p className="text-[12px] text-slate-500 mt-0.5">
              {context.vendor.name} / {context.model.name} / {context.variant.name}
            </p>
          ) : (
            <p className="text-[12px] text-slate-500 mt-0.5">New Template</p>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={!rawText.trim()}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium transition-all
            ${
              saved
                ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                : rawText.trim()
                  ? 'bg-forge-amber text-forge-obsidian hover:bg-forge-amber-bright active:bg-forge-amber-dark'
                  : 'bg-forge-graphite text-slate-500 cursor-not-allowed'
            }
          `}
        >
          <Save size={14} />
          {saved ? 'Saved!' : 'Save Template'}
        </button>
      </div>

      {/* Body: textarea + side panels */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: textarea */}
        <div className="flex-1 flex flex-col border-r border-forge-graphite min-w-0">
          <div className="px-5 py-2.5 text-[11px] font-semibold tracking-widest uppercase text-slate-500 bg-forge-charcoal border-b border-forge-graphite">
            Paste Config Template
          </div>
          <div className="flex-1 relative">
            <textarea
              value={rawText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={`Paste your config template here...\n\nUse $variable_name or \${variable_name} for template variables.\n\nExample:\nhostname $hostname\ninterface vlan95\n ip address $vlan_95_ip_address 255.255.255.0`}
              spellCheck={false}
              className="absolute inset-0 w-full h-full px-5 py-4 bg-forge-terminal text-slate-200 font-mono text-[13px] leading-relaxed resize-none outline-none placeholder:text-slate-600 border-none"
            />
          </div>

          {/* Variable summary below textarea */}
          {variables.length > 0 && (
            <div className="px-5 py-3 bg-forge-charcoal border-t border-forge-graphite shrink-0">
              <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 mb-2">
                Detected in template
              </div>
              <div className="flex flex-wrap gap-1.5">
                {variables.map((v) => {
                  const count = countOccurrences(rawText, v.name);
                  return (
                    <span
                      key={v.name}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-forge-obsidian border border-forge-graphite font-mono text-[12px]"
                    >
                      <span className="text-forge-amber-dark">$</span>
                      <span className="text-forge-amber font-medium">{v.name}</span>
                      <span className="text-slate-600 text-[10px] ml-0.5">{count}x</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sections panel */}
          {sections.length > 0 && sections[0].name !== 'Full Config' && (
            <div className="px-5 py-3 bg-forge-charcoal border-t border-forge-graphite shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <Layers size={12} className="text-slate-500" />
                <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
                  Detected Sections
                </span>
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold">
                  {sections.length}
                </span>
              </div>
              <div className="space-y-1">
                {sections.map((section, i) => {
                  const lineStart = rawText
                    .split('\n')
                    .findIndex((line) => section.template.split('\n')[0] === line);
                  const lineEnd = lineStart + section.template.split('\n').length - 1;
                  return (
                    <div
                      key={section.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-forge-obsidian border border-forge-graphite text-[12px]"
                    >
                      <FileText size={12} className="text-slate-500 shrink-0" />
                      <span className="text-slate-300 font-medium truncate flex-1">
                        {section.name}
                      </span>
                      <span className="text-slate-600 text-[11px] shrink-0">
                        lines {lineStart > -1 ? lineStart + 1 : (i * 10) + 1}-
                        {lineStart > -1 ? lineEnd + 1 : (i + 1) * 10}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Guidance text */}
              <div className="mt-2.5 flex items-start gap-1.5 text-[11px] text-slate-600 leading-relaxed">
                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                <span>
                  Sections are auto-detected from divider patterns. Supported formats:{' '}
                  <code className="text-slate-500">!########## SECTION NAME ##########</code>,{' '}
                  <code className="text-slate-500">#### SECTION NAME ####</code>,{' '}
                  <code className="text-slate-500">{'<!-- SECTION NAME -->'}</code> (XML),{' '}
                  <code className="text-slate-500"># === SECTION NAME ===</code> (YAML)
                </span>
              </div>
            </div>
          )}

          {/* Guidance when no sections detected */}
          {(sections.length === 0 || (sections.length === 1 && sections[0].name === 'Full Config')) && rawText.trim() && (
            <div className="px-5 py-3 bg-forge-charcoal border-t border-forge-graphite shrink-0">
              <div className="flex items-start gap-1.5 text-[11px] text-slate-600 leading-relaxed">
                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                <span>
                  No section dividers detected. To split into sections, add divider comments:{' '}
                  <code className="text-slate-500">!########## SECTION NAME ##########</code>,{' '}
                  <code className="text-slate-500">{'<!-- SECTION NAME -->'}</code> (XML), or{' '}
                  <code className="text-slate-500"># === SECTION NAME ===</code> (YAML)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: variable detection panel */}
        <div className="w-80 min-w-[320px] bg-forge-charcoal shrink-0">
          <VariableDetectionPanel
            variables={variables}
            onChange={setVariables}
            sectionNames={sections.map((s) => s.name)}
            variableSectionMap={variableSectionMap}
          />
        </div>
      </div>
    </div>
  );
}

export default TemplateEditor;
