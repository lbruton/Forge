import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Save, FileText, Layers, GripVertical, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { useForgeStore } from '../store/index.ts';
import { parseVariables, parseSections, cleanUpSections, rebuildRawText } from '../lib/template-parser.ts';
import { VariableDetectionPanel } from './VariableDetectionPanel.tsx';
import { EditorSectionTabs } from './EditorSectionTabs.tsx';
import type { VariableDefinition, TemplateSection, ConfigFormat } from '../types/index.ts';

interface TemplateEditorProps {
  variantId?: string | null;
}

function TemplateEditor({ variantId }: TemplateEditorProps) {
  const { saveTemplate, findVariant, getConfigFormat, getTemplate, preferences, toggleRightPanel } = useForgeStore();

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
  const [cleanUpToast, setCleanUpToast] = useState(false);
  const [activeSectionName, setActiveSectionName] = useState<string | null>(null);

  // Drag state for sections
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Refs for textarea/overlay scroll sync
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Clean up sections handler
  const handleCleanUp = useCallback(() => {
    const cleaned = cleanUpSections(rawText, configFormat);
    setRawText(cleaned);
    setSaved(false);

    // Re-parse immediately
    const parsedVars = parseVariables(cleaned);
    const parsedSections = parseSections(cleaned, configFormat);
    setVariables((prev) => {
      const prevByName = new Map(prev.map((v) => [v.name, v]));
      return parsedVars.map((pv) => {
        const existing = prevByName.get(pv.name);
        if (existing) {
          return { ...pv, label: existing.label, type: existing.type, description: existing.description, required: existing.required, defaultValue: existing.defaultValue, options: existing.options };
        }
        return pv;
      });
    });
    setSections(parsedSections);
    setVariableSectionMap(buildVariableSectionMap(cleaned, parsedSections));

    // Show toast
    setCleanUpToast(true);
    setTimeout(() => setCleanUpToast(false), 3000);
  }, [rawText, configFormat, buildVariableSectionMap]);

  // Drag-to-reorder handlers for sections
  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      // Save cursor position before state updates
      const selStart = textareaRef.current?.selectionStart ?? 0;
      const selEnd = textareaRef.current?.selectionEnd ?? 0;

      setSections((prev) => {
        const next = [...prev];
        const [moved] = next.splice(dragIndex, 1);
        next.splice(dragOverIndex, 0, moved);
        const reordered = next.map((s, i) => ({ ...s, order: i }));

        // Rebuild rawText to match the new section order
        const rebuilt = rebuildRawText(reordered, rawText);
        setRawText(rebuilt);
        setSaved(false);

        // Re-parse variables and section map for the rebuilt text
        const parsedVars = parseVariables(rebuilt);
        const parsedSections = parseSections(rebuilt, configFormat);
        setVariables((prevVars) => {
          const prevByName = new Map(prevVars.map((v) => [v.name, v]));
          return parsedVars.map((pv) => {
            const existing = prevByName.get(pv.name);
            if (existing) {
              return { ...pv, label: existing.label, type: existing.type, description: existing.description, required: existing.required, defaultValue: existing.defaultValue, options: existing.options };
            }
            return pv;
          });
        });
        setVariableSectionMap(buildVariableSectionMap(rebuilt, parsedSections));

        // Restore cursor position and sync overlay scroll after DOM update
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = selStart;
            textareaRef.current.selectionEnd = selEnd;
          }
          if (overlayRef.current && textareaRef.current) {
            overlayRef.current.scrollTop = textareaRef.current.scrollTop;
          }
        });

        return parsedSections;
      });
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, dragOverIndex, rawText, configFormat, buildVariableSectionMap]);

  // Sync scroll between textarea and overlay
  const handleTextareaScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Jump to a section in the textarea
  const handleJumpToSection = useCallback((section: TemplateSection) => {
    if (!textareaRef.current) return;
    const ta = textareaRef.current;
    const computedLineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 26.4;
    const lineIndex = section.startLine ?? rawText.split('\n').findIndex((line) => section.template.split('\n')[0] === line);
    if (lineIndex < 0) return;
    const scrollTop = lineIndex * computedLineHeight;
    ta.scrollTop = scrollTop;
    if (overlayRef.current) overlayRef.current.scrollTop = scrollTop;
    setActiveSectionName(section.name);
  }, [rawText]);

  // Detect which section the cursor is in (debounced)
  const detectCursorSection = useCallback(() => {
    if (cursorDebounceRef.current) clearTimeout(cursorDebounceRef.current);
    cursorDebounceRef.current = setTimeout(() => {
      if (!textareaRef.current || sections.length === 0) return;
      const pos = textareaRef.current.selectionStart;
      const cursorLine = rawText.substring(0, pos).split('\n').length - 1;

      // Walk sections in reverse order to find the one containing the cursor
      let found: string | null = null;
      for (let i = sections.length - 1; i >= 0; i--) {
        const s = sections[i];
        const sLine = s.startLine ?? rawText.split('\n').findIndex((line) => s.template.split('\n')[0] === line);
        if (sLine >= 0 && cursorLine >= sLine) {
          found = s.name;
          break;
        }
      }
      setActiveSectionName(found);
    }, 150);
  }, [sections, rawText]);

  // Build highlighted overlay text
  const highlightedText = useMemo(() => {
    if (!rawText) return null;
    // Strip Cisco type-9 password hashes before scanning (same as parseVariables)
    const sanitized = rawText.replace(/\$\d\$\S+/g, (match) => '_'.repeat(match.length));
    // Split by variable patterns, keeping delimiters
    const parts = sanitized.split(/(\$\{[A-Za-z_]\w*\}|\$[A-Za-z_]\w*)/gm);
    const varPattern = /^\$\{?[A-Za-z_]\w*\}?$/;

    // Reconstruct spans using original text positions
    let offset = 0;
    return parts.map((part, i) => {
      const original = rawText.substring(offset, offset + part.length);
      offset += part.length;
      if (varPattern.test(part)) {
        return (
          <span key={i} className="bg-amber-500/25 text-transparent rounded-sm border-b border-amber-500/40">
            {original}
          </span>
        );
      }
      return <span key={i} className="text-transparent">{original}</span>;
    });
  }, [rawText]);

  // Determine if sections are real (not just "Full Config")
  const hasRealSections = sections.length > 0 && sections[0].name !== 'Full Config';

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

      {/* Clean-up toast notification */}
      {cleanUpToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-md bg-green-600/20 border border-green-600/30 text-green-400 text-[13px] font-medium shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
          Sections cleaned up — START/END markers added
        </div>
      )}

      {/* Body: textarea + side panels */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: textarea */}
        <div className="flex-1 flex flex-col border-r border-forge-graphite min-w-0">
          <div className="px-5 py-2.5 text-[11px] font-semibold tracking-widest uppercase text-slate-500 bg-forge-charcoal border-b border-forge-graphite">
            Paste Config Template
          </div>
          <EditorSectionTabs
            sections={sections}
            activeSectionName={activeSectionName}
            onJumpTo={handleJumpToSection}
          />
          <div className="flex-1 relative">
            {/* Textarea — renders visible text */}
            <textarea
              ref={textareaRef}
              value={rawText}
              onChange={(e) => handleTextChange(e.target.value)}
              onScroll={handleTextareaScroll}
              onMouseUp={detectCursorSection}
              onKeyUp={detectCursorSection}
              placeholder={`Paste your config template here...\n\nUse $variable_name or \${variable_name} for template variables.\n\nExample:\nhostname $hostname\ninterface vlan95\n ip address $vlan_95_ip_address 255.255.255.0`}
              spellCheck={false}
              className="absolute inset-0 w-full h-full px-5 py-4 text-slate-200 font-mono text-[13px] leading-relaxed resize-none outline-none placeholder:text-slate-600 border-none relative z-10 bg-forge-obsidian"
              style={{ caretColor: '#e2e8f0' }}
            />
            {/* Highlight overlay — above textarea, pointer-events-none, only shows background highlights */}
            <div
              ref={overlayRef}
              aria-hidden="true"
              className="absolute inset-0 w-full h-full px-5 py-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words overflow-hidden pointer-events-none z-20"
            >
              {highlightedText}
            </div>
          </div>
        </div>

        {/* Right panel collapse toggle */}
        <button
          onClick={toggleRightPanel}
          className="hidden md:flex items-center justify-center w-5 shrink-0 bg-forge-charcoal border-l border-forge-graphite text-slate-500 hover:text-slate-300 hover:bg-forge-graphite"
          title={preferences.rightPanelCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {preferences.rightPanelCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Right: sections panel + variable detection panel */}
        {!preferences.rightPanelCollapsed && (
        <div className="w-80 min-w-[320px] bg-forge-charcoal shrink-0 flex flex-col overflow-hidden">
          {/* Sections panel — above variables */}
          <div className="shrink-0 border-b border-forge-graphite">
            {hasRealSections && (
              <div className="px-5 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <Layers size={12} className="text-slate-500" />
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
                    Detected Sections
                  </span>
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold">
                    {sections.length}
                  </span>
                  <div className="flex-1" />
                  <button
                    onClick={handleCleanUp}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-slate-400 hover:text-forge-amber bg-forge-obsidian border border-forge-graphite hover:border-forge-amber/30 transition-colors"
                    title="Auto-add START/END markers to sections"
                  >
                    <Sparkles size={11} />
                    Clean Up
                  </button>
                </div>
                <div className="space-y-1">
                  {sections.map((section, i) => {
                    const lineStart = rawText
                      .split('\n')
                      .findIndex((line) => section.template.split('\n')[0] === line);
                    const lineEnd = lineStart + section.template.split('\n').length - 1;
                    const isDragging = dragIndex === i;
                    const isDragOver = dragOverIndex === i;
                    const isActive = activeSectionName === section.name;
                    return (
                      <div
                        key={section.id}
                        draggable
                        onDragStart={() => handleDragStart(i)}
                        onDragOver={(e) => handleDragOver(e, i)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleJumpToSection(section)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded bg-forge-obsidian border text-[12px] cursor-pointer active:cursor-grabbing transition-all ${
                          isDragging
                            ? 'opacity-40 border-forge-amber/40'
                            : isDragOver
                              ? 'border-forge-amber/60 bg-forge-amber/5'
                              : isActive
                                ? 'border-amber-500 bg-amber-500/10'
                                : 'border-forge-graphite'
                        }`}
                      >
                        <GripVertical size={12} className="text-slate-600 shrink-0" />
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
                <div className="mt-3 p-2.5 rounded bg-forge-obsidian border border-forge-graphite text-[11px] text-slate-500 leading-relaxed font-mono space-y-1.5">
                  <div className="text-slate-400 font-sans font-semibold text-[10px] uppercase tracking-wider mb-1.5">Section Format</div>
                  <div className="pl-2 text-slate-500">
                    !##### SECTION NAME - START #####<br />
                    <span className="text-slate-600">{'  '}... config lines ...</span><br />
                    !##### SECTION NAME - END #####
                  </div>
                  <div className="text-slate-400 font-sans font-semibold text-[10px] uppercase tracking-wider mt-2 mb-1.5">Variable Format</div>
                  <div className="pl-2 text-slate-500">
                    $variable_name <span className="text-slate-600">or</span> {'${variable_name}'}
                  </div>
                  <div className="mt-2 text-slate-600 font-sans text-[11px]">
                    <span className="text-slate-500">Tip:</span> Click "Clean Up" to auto-add START/END markers to your existing sections.
                  </div>
                  <div className="text-slate-600 font-sans text-[11px]">
                    Legacy DNAC dividers (<code className="text-slate-500">!########## NAME ##########</code>) are also supported.
                  </div>
                </div>
              </div>
            )}

            {/* Clean Up button when no sections detected but text exists */}
            {!hasRealSections && rawText.trim() && (
              <div className="px-5 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <Layers size={12} className="text-slate-500" />
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
                    Sections
                  </span>
                  <div className="flex-1" />
                  <button
                    onClick={handleCleanUp}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-slate-400 hover:text-forge-amber bg-forge-obsidian border border-forge-graphite hover:border-forge-amber/30 transition-colors"
                    title="Auto-add START/END markers"
                  >
                    <Sparkles size={11} />
                    Clean Up
                  </button>
                </div>
                <div className="p-2.5 rounded bg-forge-obsidian border border-forge-graphite text-[11px] text-slate-500 leading-relaxed font-mono space-y-1.5">
                  <div className="text-slate-400 font-sans font-semibold text-[10px] uppercase tracking-wider mb-1.5">Section Format</div>
                  <div className="pl-2 text-slate-500">
                    !##### SECTION NAME - START #####<br />
                    <span className="text-slate-600">{'  '}... config lines ...</span><br />
                    !##### SECTION NAME - END #####
                  </div>
                  <div className="text-slate-400 font-sans font-semibold text-[10px] uppercase tracking-wider mt-2 mb-1.5">Variable Format</div>
                  <div className="pl-2 text-slate-500">
                    $variable_name <span className="text-slate-600">or</span> {'${variable_name}'}
                  </div>
                  <div className="mt-2 text-slate-600 font-sans text-[11px]">
                    <span className="text-slate-500">Tip:</span> Click "Clean Up" to auto-add START/END markers to your existing sections.
                  </div>
                  <div className="text-slate-600 font-sans text-[11px]">
                    Legacy DNAC dividers (<code className="text-slate-500">!########## NAME ##########</code>) are also supported.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Variable detection panel — below sections */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <VariableDetectionPanel
              variables={variables}
              onChange={setVariables}
              sectionNames={sections.map((s) => s.name)}
              variableSectionMap={variableSectionMap}
            />
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

export default TemplateEditor;
