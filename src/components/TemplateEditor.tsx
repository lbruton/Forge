import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Save,
  FileText,
  Layers,
  GripVertical,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Globe,
  ExternalLink,
  Scissors,
  Copy,
  ClipboardPaste,
} from 'lucide-react';
import { useForgeStore } from '../store/index.ts';
import { parseVariables, parseSections, cleanUpSections, rebuildRawText } from '../lib/template-parser.ts';
import { VariableDetectionPanel } from './VariableDetectionPanel.tsx';
import { EditorSectionTabs } from './EditorSectionTabs.tsx';
import type { VariableDefinition, TemplateSection, ConfigFormat } from '../types/index.ts';
import { scanForSecrets } from '../lib/secrets-detector.ts';
import type { SecretFinding } from '../lib/secrets-detector.ts';
import { SecretsWarningBanner } from './SecretsWarningBanner.tsx';

/**
 * Order-preserving merge of parsed variables into an existing array.
 * - Existing variables keep their position if still present in parsed output
 * - Metadata (label, type, etc.) from the existing variable is preserved
 * - Newly detected variables are appended at the end
 * - Variables no longer in parsed output are removed
 */
export function mergeVariablesOrderPreserving(
  existing: VariableDefinition[],
  parsed: VariableDefinition[],
): VariableDefinition[] {
  const parsedByName = new Map(parsed.map((v) => [v.name, v]));
  const existingNames = new Set(existing.map((v) => v.name));

  // Keep existing variables that still appear in parsed output, preserving order and metadata
  const kept = existing
    .filter((v) => parsedByName.has(v.name))
    .map((v) => {
      const pv = parsedByName.get(v.name)!;
      return {
        ...pv,
        label: v.label,
        type: v.type,
        description: v.description,
        required: v.required,
        defaultValue: v.defaultValue,
        options: v.options,
      };
    });

  // Append newly detected variables (in parsed output but not in existing)
  const added = parsed.filter((v) => !existingNames.has(v.name));

  return [...kept, ...added];
}

interface TemplateEditorProps {
  variantId?: string | null;
}

function TemplateEditor({ variantId }: TemplateEditorProps) {
  const {
    saveTemplate,
    findVariant,
    getConfigFormat,
    getTemplate,
    preferences,
    toggleRightPanel,
    autoSyncGlobals,
    setSelectedGlobalVariablesViewId,
    setEditorDirty,
    setPendingSaveCallback,
  } = useForgeStore();

  // Resolve variant context
  const context = variantId ? findVariant(variantId) : null;
  const configFormat: ConfigFormat = variantId ? getConfigFormat(variantId) : 'cli';
  const existingTemplate = context?.variant.templateId ? getTemplate(context.variant.templateId) : undefined;

  // Editor state
  const [rawText, setRawText] = useState(existingTemplate?.rawSource ?? '');
  const [variables, setVariables] = useState<VariableDefinition[]>(existingTemplate?.variables ?? []);
  const [sections, setSections] = useState<TemplateSection[]>(existingTemplate?.sections ?? []);
  const [variableSectionMap, setVariableSectionMap] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [cleanUpToast, setCleanUpToast] = useState(false);
  const [activeSectionName, setActiveSectionName] = useState<string | null>(null);
  const [variablesCollapsed, setVariablesCollapsed] = useState(false);
  const [sectionsCollapsed, setSectionsCollapsed] = useState(false);
  const [globalNames, setGlobalNames] = useState<string[]>([]);
  const [globalVarsCollapsed, setGlobalVarsCollapsed] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [addSectionName, setAddSectionName] = useState('');
  const [customVariableOrder, setCustomVariableOrder] = useState(existingTemplate?.customVariableOrder ?? false);
  const [secretFindings, setSecretFindings] = useState<SecretFinding[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Context menu state for section marker insertion
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    cursorPos: number;
    selStart: number;
    selEnd: number;
  } | null>(null);
  const [pendingSectionName, setPendingSectionName] = useState<string | null>(null);

  // All global variables from the View (not just detected ones)
  const viewGlobalVariables = useMemo(() => {
    return context?.view.globalVariables ?? [];
  }, [context?.view.globalVariables]);

  // Drag state for sections
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Refs for textarea/overlay scroll sync
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const addSectionInputRef = useRef<HTMLInputElement>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rawTextRef = useRef(rawText);
  rawTextRef.current = rawText;

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
      setEditorDirty(true);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const parsedVars = parseVariables(text);
        const parsedSections = parseSections(text, configFormat);

        setVariables((prev) => mergeVariablesOrderPreserving(prev, parsedVars.local));

        setGlobalNames(parsedVars.global);
        setSections(parsedSections);
        setVariableSectionMap(buildVariableSectionMap(text, parsedSections));
        setSecretFindings(scanForSecrets(text, configFormat));
        setBannerDismissed(false);
      }, 300);
    },
    [configFormat, buildVariableSectionMap, setEditorDirty],
  );

  // Promote a local variable to global by converting $varName to ${varName}
  const handlePromoteVariable = useCallback(
    (varName: string) => {
      const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const promoted = rawText.replace(new RegExp(`(\\$)(?!\\{)(${escaped})\\b`, 'g'), `\${${varName}}`);
      if (promoted !== rawText) {
        handleTextChange(promoted);
      }
    },
    [rawText, handleTextChange],
  );

  // Re-parse on initial load if we have existing text
  useEffect(() => {
    if (rawText) {
      const parsedSections = parseSections(rawText, configFormat);
      setSections(parsedSections);
      setVariableSectionMap(buildVariableSectionMap(rawText, parsedSections));
      setSecretFindings(scanForSecrets(rawText, configFormat));
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-scan for secrets when config format changes
  useEffect(() => {
    if (rawTextRef.current) {
      setSecretFindings(scanForSecrets(rawTextRef.current, configFormat));
      setBannerDismissed(false);
    }
  }, [configFormat]);

  // Sync detected global variable names to the View
  useEffect(() => {
    const viewId = context?.view.id;
    if (viewId && globalNames.length > 0) {
      autoSyncGlobals(viewId, globalNames);
    }
  }, [globalNames, context?.view.id, autoSyncGlobals]);

  const handleVariableReorder = useCallback(() => {
    setCustomVariableOrder(true);
    setEditorDirty(true);
  }, [setEditorDirty]);

  // Save template
  const handleSave = useCallback(() => {
    const templateId = existingTemplate?.id ?? crypto.randomUUID();
    const ts = new Date().toISOString();

    saveTemplate({
      id: templateId,
      sections,
      variables,
      customVariableOrder,
      rawSource: rawText,
      createdAt: existingTemplate?.createdAt ?? ts,
      updatedAt: ts,
    });

    setEditorDirty(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); }, 2500);
  }, [existingTemplate, sections, variables, customVariableOrder, rawText, saveTemplate, setEditorDirty]);

  // Register save callback for unsaved-changes guard (re-registers when handleSave changes)
  useEffect(() => {
    setPendingSaveCallback(() => handleSave);
    return () => {
      setPendingSaveCallback(null);
    };
  }, [handleSave, setPendingSaveCallback]);

  // Clear dirty flag only on unmount (navigating away from editor)
  useEffect(() => {
    return () => {
      setEditorDirty(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clean up sections handler
  const handleCleanUp = useCallback(() => {
    const cleaned = cleanUpSections(rawText, configFormat);
    setRawText(cleaned);
    setSaved(false);
    setEditorDirty(true);

    // Re-parse immediately
    const parsedVars = parseVariables(cleaned);
    const parsedSections = parseSections(cleaned, configFormat);
    setVariables((prev) => mergeVariablesOrderPreserving(prev, parsedVars.local));
    setGlobalNames(parsedVars.global);
    setSections(parsedSections);
    setVariableSectionMap(buildVariableSectionMap(cleaned, parsedSections));
    setSecretFindings(scanForSecrets(cleaned, configFormat));
    setBannerDismissed(false);

    // Show toast
    setCleanUpToast(true);
    setTimeout(() => { setCleanUpToast(false); }, 3000);
  }, [rawText, configFormat, buildVariableSectionMap, setEditorDirty]);

  // Auto-focus the add-section input when shown
  useEffect(() => {
    if (showAddSection && addSectionInputRef.current) {
      addSectionInputRef.current.focus();
    }
  }, [showAddSection]);

  // Confirm adding a new section
  const handleConfirmAddSection = useCallback(() => {
    const name = addSectionName.trim();
    if (name) {
      const newText = rawText + `\n\n!##### ${name} - START #####\n\n!##### ${name} - END #####`;
      handleTextChange(newText);
    }
    setShowAddSection(false);
    setAddSectionName('');
  }, [addSectionName, rawText, handleTextChange]);

  // Handle keydown on the add-section input
  const handleAddSectionKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleConfirmAddSection();
      } else if (e.key === 'Escape') {
        setShowAddSection(false);
        setAddSectionName('');
      }
    },
    [handleConfirmAddSection],
  );

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
      setEditorDirty(true);

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
        setVariables((prevVars) => mergeVariablesOrderPreserving(prevVars, parsedVars.local));
        setGlobalNames(parsedVars.global);
        setVariableSectionMap(buildVariableSectionMap(rebuilt, parsedSections));
        setSecretFindings(scanForSecrets(rebuilt, configFormat));
        setBannerDismissed(false);

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
  }, [dragIndex, dragOverIndex, rawText, configFormat, buildVariableSectionMap, setEditorDirty]);

  // Sync scroll between textarea and overlay
  const handleTextareaScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Navigate to a specific line (used by secrets warning banner)
  const handleNavigateToFinding = useCallback((line: number) => {
    // Clear section filter so full rawText is visible
    setActiveSectionName(null);
    // Use requestAnimationFrame to wait for re-render with full text
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      const lineHeight = 21.125; // 13px font * 1.625 (leading-relaxed)
      const targetScroll = (line - 1) * lineHeight - textareaRef.current.clientHeight / 3;
      textareaRef.current.scrollTop = Math.max(0, targetScroll);
      if (overlayRef.current) {
        overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      }
    });
  }, []);

  // Jump to a section in the textarea
  // Section selection handler — sets active section for filtering
  const handleSelectSection = useCallback((sectionName: string | null) => {
    setActiveSectionName(sectionName);
    // Scroll textarea to top when switching sections
    if (textareaRef.current) textareaRef.current.scrollTop = 0;
    if (overlayRef.current) overlayRef.current.scrollTop = 0;
  }, []);

  // Compute display text based on active section filter
  const { displayText, sectionRange } = useMemo(() => {
    if (activeSectionName === null || sections.length === 0) {
      return { displayText: rawText, sectionRange: null };
    }
    const section = sections.find((s) => s.name === activeSectionName);
    if (!section) return { displayText: rawText, sectionRange: null };

    const lines = rawText.split('\n');
    const startLine = section.startLine ?? 0;

    // Find end line: either the END marker line + 1, or the start of next section
    let endLine: number;
    if (section.endDividerPattern) {
      // Find the END marker line after startLine
      endLine = lines.findIndex((l, i) => i > startLine && l === section.endDividerPattern);
      endLine = endLine >= 0 ? endLine + 1 : lines.length;
    } else {
      // Legacy: find next section's start or EOF
      const sortedSections = [...sections].sort((a, b) => (a.startLine ?? 0) - (b.startLine ?? 0));
      const idx = sortedSections.findIndex((s) => s.name === section.name);
      endLine = idx + 1 < sortedSections.length ? (sortedSections[idx + 1].startLine ?? lines.length) : lines.length;
    }

    return {
      displayText: lines.slice(startLine, endLine).join('\n'),
      sectionRange: { start: startLine, end: endLine },
    };
  }, [activeSectionName, sections, rawText]);

  // Handle text changes in filtered mode — merge edits back into full rawText
  const handleFilteredTextChange = useCallback(
    (newDisplayText: string) => {
      if (sectionRange === null) {
        // All sections mode — direct pass-through
        handleTextChange(newDisplayText);
        return;
      }
      // Replace the section's range in the full rawText
      const lines = rawText.split('\n');
      const before = lines.slice(0, sectionRange.start);
      const after = lines.slice(sectionRange.end);
      const newFullText = [...before, ...newDisplayText.split('\n'), ...after].join('\n');
      handleTextChange(newFullText);
    },
    [rawText, sectionRange, handleTextChange],
  );

  // Right-click context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const ta = e.currentTarget;
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      cursorPos: ta.selectionStart,
      selStart: ta.selectionStart,
      selEnd: ta.selectionEnd,
    });
  }, []);

  // Insert a section marker at a cursor position in displayText
  const insertMarkerAtCursor = useCallback(
    (marker: string, cursorPos: number) => {
      const text = displayText;
      // Find the line start for the cursor position
      const beforeCursor = text.substring(0, cursorPos);
      const lineStart = beforeCursor.lastIndexOf('\n') + 1;
      const newText = text.substring(0, lineStart) + marker + '\n' + text.substring(lineStart);
      handleFilteredTextChange(newText);
    },
    [displayText, handleFilteredTextChange],
  );

  const handleInsertStart = useCallback(() => {
    if (!contextMenu) return;
    const name = prompt('Section name:');
    if (!name?.trim()) {
      setContextMenu(null);
      return;
    }
    const trimmed = name.trim();
    setPendingSectionName(trimmed);
    insertMarkerAtCursor(`!##### ${trimmed} - START #####`, contextMenu.cursorPos);
    setContextMenu(null);
  }, [contextMenu, insertMarkerAtCursor]);

  const handleInsertEnd = useCallback(() => {
    if (!contextMenu) return;
    const name = pendingSectionName ?? prompt('Section name:');
    if (!name?.trim()) {
      setContextMenu(null);
      return;
    }
    insertMarkerAtCursor(`!##### ${name.trim()} - END #####`, contextMenu.cursorPos);
    setPendingSectionName(null);
    setContextMenu(null);
  }, [contextMenu, pendingSectionName, insertMarkerAtCursor]);

  const handleCut = useCallback(async () => {
    if (!contextMenu) return;
    const { selStart, selEnd } = contextMenu;
    if (selStart === selEnd) {
      setContextMenu(null);
      return;
    }
    try {
      await navigator.clipboard.writeText(displayText.substring(selStart, selEnd));
      handleFilteredTextChange(displayText.substring(0, selStart) + displayText.substring(selEnd));
    } catch {
      // Clipboard write failed — don't delete text
    } finally {
      setContextMenu(null);
    }
  }, [contextMenu, displayText, handleFilteredTextChange]);

  const handleCopy = useCallback(async () => {
    if (!contextMenu) return;
    const { selStart, selEnd } = contextMenu;
    if (selStart === selEnd) {
      setContextMenu(null);
      return;
    }
    try {
      await navigator.clipboard.writeText(displayText.substring(selStart, selEnd));
    } catch {
      // Clipboard write failed silently
    } finally {
      setContextMenu(null);
    }
  }, [contextMenu, displayText]);

  const handlePaste = useCallback(async () => {
    if (!contextMenu) return;
    const { selStart, selEnd } = contextMenu;
    try {
      const text = await navigator.clipboard.readText();
      handleFilteredTextChange(displayText.substring(0, selStart) + text + displayText.substring(selEnd));
    } catch {
      // Clipboard read failed (permissions or non-HTTPS)
    } finally {
      setContextMenu(null);
    }
  }, [contextMenu, displayText, handleFilteredTextChange]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => { setContextMenu(null); };
    window.addEventListener('click', close);
    return () => { window.removeEventListener('click', close); };
  }, [contextMenu]);

  // Build a set of 1-based line numbers that have secret findings (for red highlight)
  const secretLineSet = useMemo(() => {
    const s = new Set<number>();
    for (const f of secretFindings) s.add(f.line);
    return s;
  }, [secretFindings]);

  // Build highlighted overlay text
  const BANNER_RE = /^!#{3,}\s*.*\s*-\s*(?:START|END)\s*#{3,}$/i;
  const highlightedText = useMemo(() => {
    if (!displayText) return null;

    // Process line-by-line to detect section banners, then highlight variables within non-banner lines
    const rawLines = displayText.split('\n');
    const result: React.ReactNode[] = [];

    for (let lineIdx = 0; lineIdx < rawLines.length; lineIdx++) {
      const rawLine = rawLines[lineIdx];

      // Section banner lines get a blue background highlight
      if (BANNER_RE.test(rawLine)) {
        if (lineIdx > 0)
          result.push(
            <span key={`nl-${lineIdx}`} className="text-transparent">
              {'\n'}
            </span>,
          );
        result.push(
          <span key={`banner-${lineIdx}`} className="bg-blue-500/15 text-transparent">
            {rawLine}
          </span>,
        );
        continue;
      }

      if (lineIdx > 0)
        result.push(
          <span key={`nl-${lineIdx}`} className="text-transparent">
            {'\n'}
          </span>,
        );

      // Check if this line has a secret finding (1-based line numbers)
      const isSecretLine = secretLineSet.has(lineIdx + 1);

      // Strip Cisco type-9 password hashes before scanning (same as parseVariables)
      const sanitized = rawLine.replace(/\$\d\$\S+/g, (match) => '_'.repeat(match.length));
      // Split by variable patterns, keeping delimiters — braced form captured first
      const parts = sanitized.split(/(\$\{[A-Za-z_]\w*\}|\$[A-Za-z_]\w*)/);
      const globalVarPattern = /^\$\{[A-Za-z_]\w*\}$/;
      const localVarPattern = /^\$[A-Za-z_]\w*$/;

      // Collect part spans — wrap in red highlight if this is a secret line
      const lineSpans: React.ReactNode[] = [];
      let offset = 0;
      for (let pi = 0; pi < parts.length; pi++) {
        const part = parts[pi];
        const original = rawLine.substring(offset, offset + part.length);
        offset += part.length;
        if (globalVarPattern.test(part)) {
          lineSpans.push(
            <span
              key={`${lineIdx}-${pi}`}
              className="bg-green-500/25 text-transparent rounded-sm border-b border-green-500/40"
            >
              {original}
            </span>,
          );
        } else if (localVarPattern.test(part)) {
          lineSpans.push(
            <span
              key={`${lineIdx}-${pi}`}
              className="bg-amber-500/25 text-transparent rounded-sm border-b border-amber-500/40"
            >
              {original}
            </span>,
          );
        } else {
          lineSpans.push(
            <span key={`${lineIdx}-${pi}`} className="text-transparent">
              {original}
            </span>,
          );
        }
      }

      // Wrap secret lines in a red background highlight
      if (isSecretLine) {
        result.push(
          <span key={`secret-${lineIdx}`} className="bg-red-500/15 text-transparent">
            {lineSpans}
          </span>,
        );
      } else {
        result.push(...lineSpans);
      }
    }

    return result;
  }, [displayText, secretLineSet]);

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
          {!rawText.trim() && (
            <div className="px-5 py-2.5 text-[11px] font-semibold tracking-widest uppercase text-slate-500 bg-forge-charcoal border-b border-forge-graphite">
              Paste Config Template
            </div>
          )}
          <EditorSectionTabs
            sections={sections}
            activeSectionName={activeSectionName}
            onSelectSection={handleSelectSection}
          />
          {secretFindings.length > 0 && !bannerDismissed && (
            <div className="px-5 py-2 border-b border-forge-graphite">
              <SecretsWarningBanner
                findings={secretFindings}
                onNavigate={handleNavigateToFinding}
                onDismiss={() => setBannerDismissed(true)}
              />
            </div>
          )}
          <div className="flex-1 relative">
            {/* Textarea — renders visible text */}
            <textarea
              ref={textareaRef}
              value={displayText}
              onChange={(e) => {
                handleFilteredTextChange(e.target.value);
              }}
              onScroll={handleTextareaScroll}
              onContextMenu={handleContextMenu}
              placeholder={`Paste your config template here...\n\nUse $variable_name or \${variable_name} for template variables.\n\nExample:\nhostname $hostname\ninterface vlan95\n ip address $vlan_95_ip_address 255.255.255.0`}
              spellCheck={false}
              className="absolute inset-0 w-full h-full px-5 py-4 text-slate-400 font-mono text-[13px] leading-relaxed resize-none outline-none placeholder:text-slate-600 border-none relative z-10 bg-forge-obsidian"
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

        {/* Context menu for section marker insertion */}
        {contextMenu && (
          <div
            className="fixed z-[100] bg-forge-charcoal border border-forge-steel rounded-md shadow-xl py-1 min-w-[200px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => { e.stopPropagation(); }}
          >
            <button
              onClick={handleCut}
              disabled={contextMenu.selStart === contextMenu.selEnd}
              className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-forge-graphite flex items-center gap-2 disabled:text-slate-600 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <Scissors size={14} className="text-slate-400" />
              Cut
            </button>
            <button
              onClick={handleCopy}
              disabled={contextMenu.selStart === contextMenu.selEnd}
              className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-forge-graphite flex items-center gap-2 disabled:text-slate-600 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <Copy size={14} className="text-slate-400" />
              Copy
            </button>
            <button
              onClick={handlePaste}
              className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-forge-graphite flex items-center gap-2"
            >
              <ClipboardPaste size={14} className="text-slate-400" />
              Paste
            </button>
            <div className="my-1 border-t border-forge-steel" />
            <button
              onClick={handleInsertStart}
              className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-forge-graphite flex items-center gap-2"
            >
              <Plus size={14} className="text-blue-400" />
              Insert Section Start
            </button>
            <button
              onClick={handleInsertEnd}
              className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-forge-graphite flex items-center gap-2"
            >
              <Plus size={14} className="text-blue-400" />
              Insert Section End
              {pendingSectionName && <span className="ml-auto text-xs text-slate-500">({pendingSectionName})</span>}
            </button>
          </div>
        )}

        {/* Right panel collapse toggle */}
        <button
          onClick={toggleRightPanel}
          className="hidden md:flex items-center justify-center w-5 shrink-0 bg-forge-charcoal border-l border-forge-graphite text-slate-500 hover:text-slate-300 hover:bg-forge-graphite"
          title={preferences.rightPanelCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {preferences.rightPanelCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Right: variables + sections */}
        {!preferences.rightPanelCollapsed && (
          <div className="w-80 min-w-[320px] bg-forge-charcoal shrink-0 flex flex-col overflow-y-auto">
            {/* Global variables panel — top, collapsible, always visible when View has globals */}
            {viewGlobalVariables.length > 0 && (
              <div className="shrink-0 border-b border-forge-graphite">
                <button
                  onClick={() => { setGlobalVarsCollapsed(!globalVarsCollapsed); }}
                  className="w-full flex items-center gap-1.5 px-5 py-2.5 text-[11px] font-semibold tracking-wider uppercase text-green-400 hover:text-green-300 text-left"
                >
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${globalVarsCollapsed ? '-rotate-90' : ''}`}
                  />
                  <Globe size={12} />
                  Global Variables
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold ml-1">
                    {viewGlobalVariables.length}
                  </span>
                </button>
                {!globalVarsCollapsed && (
                  <div className="px-5 py-3 space-y-1 border-t border-forge-graphite">
                    {viewGlobalVariables.map((gv) => (
                      <div
                        key={gv.name}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded bg-forge-obsidian border border-green-500/15 border-l-[3px] border-l-green-500 ${
                          globalNames.includes(gv.name) ? '' : 'opacity-50'
                        }`}
                      >
                        <span className="text-green-400 font-mono text-[12px] font-medium flex-1 truncate">
                          {gv.name}
                        </span>
                        {gv.defaultValue ? (
                          <span className="text-slate-400 font-mono text-[11px] max-w-[100px] truncate">
                            {gv.masked ? '••••••••' : gv.defaultValue}
                          </span>
                        ) : (
                          <span className="text-amber-400 text-[11px] italic">Not set</span>
                        )}
                      </div>
                    ))}
                    {context?.view.id && (
                      <button
                        onClick={() => setSelectedGlobalVariablesViewId(context.view.id)}
                        className="flex items-center gap-1 text-[11px] text-green-400 hover:text-green-300 mt-2 transition-colors"
                      >
                        <ExternalLink size={11} />
                        Manage Global Variables
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Local variable detection panel, collapsible */}
            <div className="shrink-0 border-b border-forge-graphite">
              <div className="flex items-center shrink-0">
                <button
                  onClick={() => { setVariablesCollapsed(!variablesCollapsed); }}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-[11px] font-semibold tracking-wider uppercase text-slate-500 hover:text-slate-400 text-left flex-1"
                >
                  <ChevronDown size={12} className={`transition-transform ${variablesCollapsed ? '-rotate-90' : ''}`} />
                  Detected Variables
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-forge-amber/20 text-forge-amber text-[10px] font-bold ml-1">
                    {variables.length}
                  </span>
                </button>
                <button
                  onClick={() => {
                    const newVar: VariableDefinition = {
                      name: `new_variable_${variables.length + 1}`,
                      label: `New Variable ${variables.length + 1}`,
                      type: 'string',
                      defaultValue: '',
                      options: [],
                      required: true,
                      description: '',
                    };
                    setVariables([...variables, newVar]);
                    setEditorDirty(true);
                    if (variablesCollapsed) setVariablesCollapsed(false);
                  }}
                  className="p-1 mr-3 rounded text-slate-500 hover:text-forge-amber hover:bg-forge-graphite transition-colors shrink-0"
                  title="Add variable manually"
                >
                  <Plus size={14} />
                </button>
              </div>
              {!variablesCollapsed && (
                <VariableDetectionPanel
                  variables={variables}
                  onChange={(vars) => {
                    setVariables(vars);
                    setEditorDirty(true);
                  }}
                  sectionNames={sections.map((s) => s.name)}
                  variableSectionMap={variableSectionMap}
                  hideHeader
                  onPromoteToGlobal={handlePromoteVariable}
                  onReorder={handleVariableReorder}
                />
              )}
            </div>

            {/* Sections panel, collapsible */}
            <div className="shrink-0 border-b border-forge-graphite">
              <div className="flex items-center shrink-0">
                <button
                  onClick={() => { setSectionsCollapsed(!sectionsCollapsed); }}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-[11px] font-semibold tracking-wider uppercase text-slate-500 hover:text-slate-400 text-left flex-1"
                >
                  <ChevronDown size={12} className={`transition-transform ${sectionsCollapsed ? '-rotate-90' : ''}`} />
                  <Layers size={12} />
                  Detected Sections
                  {hasRealSections && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold ml-1">
                      {sections.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => { setShowAddSection(true); }}
                  className="p-1 rounded text-slate-400 hover:text-forge-amber hover:bg-forge-graphite transition-colors shrink-0"
                  title="Add Section"
                >
                  <Plus size={14} />
                </button>
                {rawText.trim() && (
                  <button
                    onClick={handleCleanUp}
                    className="flex items-center gap-1 px-2 py-1 mr-3 rounded text-[11px] font-medium text-slate-400 hover:text-forge-amber bg-forge-obsidian border border-forge-graphite hover:border-forge-amber/30 transition-colors shrink-0"
                    title="Auto-add START/END markers to sections"
                  >
                    <Sparkles size={11} />
                    Clean Up
                  </button>
                )}
              </div>
              {showAddSection && (
                <div className="flex items-center gap-2 px-5 py-2 border-t border-forge-graphite">
                  <input
                    ref={addSectionInputRef}
                    type="text"
                    value={addSectionName}
                    onChange={(e) => { setAddSectionName(e.target.value); }}
                    onKeyDown={handleAddSectionKeyDown}
                    placeholder="Section name..."
                    className="flex-1 px-2 py-1 rounded bg-forge-obsidian border border-forge-graphite text-slate-200 text-[12px] font-medium placeholder:text-slate-600 outline-none focus:border-forge-amber/50"
                  />
                  <button
                    onClick={handleConfirmAddSection}
                    disabled={!addSectionName.trim()}
                    className="px-2 py-1 rounded text-[11px] font-medium text-forge-amber hover:bg-forge-amber/10 border border-forge-amber/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Add
                  </button>
                </div>
              )}
              {!sectionsCollapsed && hasRealSections && (
                <div className="px-5 pb-3">
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
                          onDragStart={() => { handleDragStart(i); }}
                          onDragOver={(e) => { handleDragOver(e, i); }}
                          onDragEnd={handleDragEnd}
                          onClick={() => { handleSelectSection(section.name); }}
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
                          <span className="text-slate-300 font-medium truncate flex-1">{section.name}</span>
                          <span className="text-slate-600 text-[11px] shrink-0">
                            lines {lineStart > -1 ? lineStart + 1 : i * 10 + 1}-
                            {lineStart > -1 ? lineEnd + 1 : (i + 1) * 10}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Format reference footer — below editor */}
      <div className="shrink-0 flex gap-3 px-4 py-2 border-t border-forge-graphite bg-forge-charcoal">
        <div className="flex-1 p-2 rounded bg-forge-obsidian border border-forge-graphite text-[10px] text-slate-500 leading-relaxed font-mono">
          <span className="text-slate-400 font-sans font-semibold uppercase tracking-wider">Section: </span>
          !##### NAME - START ##### <span className="text-slate-600">...</span> !##### NAME - END #####
        </div>
        <div className="flex-1 p-2 rounded bg-forge-obsidian border border-forge-graphite text-[10px] text-slate-500 leading-relaxed font-mono">
          <span className="text-slate-400 font-sans font-semibold uppercase tracking-wider">Variables: </span>
          <span className="text-amber-500/70">$variable_name</span> <span className="text-slate-600">or</span>{' '}
          <span className="text-green-500/70">{'${variable_name}'}</span>
        </div>
      </div>
    </div>
  );
}

export default TemplateEditor;
