import { useState, useMemo } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, Eye, EyeOff, Globe, Trash2 } from 'lucide-react';
import { useForgeStore } from '../store/index.ts';
import { ConfigPreview } from './ConfigPreview.tsx';
import { CopyButton, DownloadButton } from './CopyButton.tsx';
import { SUB_START, SUB_END } from '../lib/substitution-engine.ts';

interface GeneratedConfigViewerProps {
  configId: string;
  onBack: () => void;
}

export function GeneratedConfigViewer({ configId, onBack }: GeneratedConfigViewerProps) {
  const generatedConfigs = useForgeStore((s) => s.generatedConfigs);
  const findVariant = useForgeStore((s) => s.findVariant);
  const getConfigFormat = useForgeStore((s) => s.getConfigFormat);
  const deleteGeneratedConfig = useForgeStore((s) => s.deleteGeneratedConfig);

  const [variablesExpanded, setVariablesExpanded] = useState(false);
  const [globalsExpanded, setGlobalsExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMasked, setShowMasked] = useState(false);

  const config = generatedConfigs[configId];

  // Resolve source variant info
  const sourceInfo = useMemo(() => {
    if (!config) return null;
    return findVariant(config.sourceVariantId);
  }, [config, findVariant]);

  const configFormat = config ? getConfigFormat(config.sourceVariantId) : 'cli';

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full bg-forge-obsidian text-slate-500 text-sm">
        Generated config not found
      </div>
    );
  }

  const formattedDate = new Date(config.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const variantLabel = sourceInfo
    ? `${sourceInfo.vendor.name} / ${sourceInfo.model.name} / ${sourceInfo.variant.name}`
    : 'Source variant unavailable';

  const variableEntries = Object.entries(config.variableValues);
  const globalEntries = config.globalVariableValues ? Object.entries(config.globalVariableValues) : [];

  // Look up which global variables are masked from the current view definition.
  // If source variant was deleted, fall back to masking ALL globals as a safety net.
  const maskedNames = useMemo(() => {
    const names = new Set<string>();
    if (!sourceInfo) {
      // Source variant unavailable — mask all globals defensively
      for (const [key] of globalEntries) names.add(key);
      return names;
    }
    const globals = sourceInfo.view.globalVariables ?? [];
    for (const g of globals) {
      if (g.masked) names.add(g.name);
    }
    return names;
  }, [sourceInfo, globalEntries]);

  const hasMasked = maskedNames.size > 0;

  // Collect masked secret values for replacement
  const maskedValues = useMemo(() => {
    if (!hasMasked || !config.globalVariableValues) return [];
    const vals: string[] = [];
    for (const name of maskedNames) {
      const val = config.globalVariableValues[name];
      if (val) vals.push(val);
    }
    return vals;
  }, [hasMasked, maskedNames, config.globalVariableValues]);

  // Mask secret values in config sections (sentinel-wrapped for ConfigPreview)
  const displaySections = useMemo(() => {
    if (showMasked || maskedValues.length === 0) return config.sections;
    const maskedMarker = `${SUB_START}${'••••••••'}${SUB_END}`;
    return config.sections.map((s) => {
      let content = s.content;
      for (const val of maskedValues) {
        content = content.replaceAll(`${SUB_START}${val}${SUB_END}`, maskedMarker);
      }
      return content !== s.content ? { ...s, content } : s;
    });
  }, [config.sections, showMasked, maskedValues]);

  // Mask secret values in fullConfig (plain text for Copy/Download)
  const displayFullConfig = useMemo(() => {
    if (showMasked || maskedValues.length === 0) return config.fullConfig;
    let text = config.fullConfig;
    for (const val of maskedValues) {
      text = text.replaceAll(val, '••••••••');
    }
    return text;
  }, [config.fullConfig, showMasked, maskedValues]);

  const handleDelete = () => {
    deleteGeneratedConfig(config.id);
    onBack();
  };

  return (
    <div className="flex flex-col h-full bg-forge-obsidian">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-forge-graphite bg-forge-charcoal/30">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
              text-slate-400 hover:text-slate-200 bg-forge-graphite/50 hover:bg-forge-graphite
              border border-forge-steel/50 rounded transition-colors duration-150"
          >
            <ArrowLeft size={12} />
            Back
          </button>

          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-slate-200 truncate">{config.name}</h2>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {formattedDate} &middot; {variantLabel}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {hasMasked && (
              <button
                onClick={() => setShowMasked(!showMasked)}
                className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium
                  text-slate-400 hover:text-slate-200 bg-forge-graphite/50 hover:bg-forge-graphite
                  border border-forge-steel/50 rounded transition-colors duration-150"
                title={showMasked ? 'Hide secrets' : 'Show secrets'}
              >
                {showMasked ? <EyeOff size={12} /> : <Eye size={12} />}
                {showMasked ? 'Hide' : 'Show'} secrets
              </button>
            )}
            <CopyButton text={displayFullConfig} label="Copy All" />
            <DownloadButton text={displayFullConfig} filename={`${config.name}.txt`} label="Download" />
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium
                  text-red-400 hover:text-red-300 bg-forge-graphite/50 hover:bg-red-500/10
                  border border-forge-steel/50 hover:border-red-500/30 rounded transition-colors duration-150"
                title="Delete this saved config"
              >
                <Trash2 size={12} />
                <span>Delete</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold
                    text-red-200 bg-red-600 hover:bg-red-500
                    border border-red-500 rounded transition-colors duration-150"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium
                    text-slate-400 hover:text-slate-200 bg-forge-graphite/50 hover:bg-forge-graphite
                    border border-forge-steel/50 rounded transition-colors duration-150"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {config.notes && <p className="text-xs text-slate-500 mt-2 italic">{config.notes}</p>}
      </div>

      {/* Global variable values collapsible */}
      {globalEntries.length > 0 && (
        <div className="shrink-0 border-b border-forge-graphite">
          <button
            onClick={() => setGlobalsExpanded(!globalsExpanded)}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-emerald-500/80 hover:text-emerald-400 transition-colors"
          >
            <Globe size={12} />
            {globalsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Global Variable Values ({globalEntries.length})
          </button>
          {globalsExpanded && (
            <div className="px-4 pb-3">
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                {globalEntries.map(([key, value]) => {
                  const isMasked = maskedNames.has(key) && !showMasked;
                  return (
                    <div key={key} className="contents">
                      <span className="text-emerald-500 font-mono">${'{' + key + '}'}</span>
                      <span className="text-slate-300 font-mono truncate">
                        {isMasked ? '••••••••' : value || <span className="text-slate-600 italic">empty</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Variable values collapsible */}
      {variableEntries.length > 0 && (
        <div className="shrink-0 border-b border-forge-graphite">
          <button
            onClick={() => setVariablesExpanded(!variablesExpanded)}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors"
          >
            {variablesExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Variable Values ({variableEntries.length})
          </button>
          {variablesExpanded && (
            <div className="px-4 pb-3">
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                {variableEntries.map(([key, value]) => (
                  <div key={key} className="contents">
                    <span className="text-slate-500 font-mono">${key}</span>
                    <span className="text-slate-300 font-mono truncate">
                      {value || <span className="text-slate-600 italic">empty</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Config preview */}
      <div className="flex-1 min-h-0">
        <ConfigPreview sections={displaySections} activeSection={null} configFormat={configFormat} />
      </div>
    </div>
  );
}
