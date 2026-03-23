import { useState, useMemo, useEffect, useRef } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { useForgeStore } from '../store/index.ts';
import { generateConfig } from '../lib/substitution-engine.ts';
import { VariableForm } from './VariableForm.tsx';
import { ConfigPreview } from './ConfigPreview.tsx';
import { SectionTabs } from './SectionTabs.tsx';
import { SaveGeneratedModal } from './SaveGeneratedModal.tsx';
import type { GeneratedConfigOutput } from '../types/index.ts';

interface ConfigGeneratorProps {
  onEditTemplate?: () => void;
}

function ConfigGenerator({ onEditTemplate }: ConfigGeneratorProps) {
  const selectedVariantId = useForgeStore((s) => s.selectedVariantId);
  const templates = useForgeStore((s) => s.templates);
  const variableValues = useForgeStore((s) => s.variableValues);
  const findVariant = useForgeStore((s) => s.findVariant);
  const getConfigFormat = useForgeStore((s) => s.getConfigFormat);

  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [debouncedValues, setDebouncedValues] = useState<Record<string, string>>({});
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const found = selectedVariantId ? findVariant(selectedVariantId) : null;
  const template = found ? templates[found.variant.templateId] : undefined;
  const configFormat = selectedVariantId ? getConfigFormat(selectedVariantId) : 'cli';

  // Current variable values from store
  const currentValues = selectedVariantId
    ? variableValues[selectedVariantId]?.values ?? {}
    : {};

  // Merge default values with user-entered values
  const mergedValues = useMemo(() => {
    if (!template) return currentValues;
    const merged: Record<string, string> = {};
    for (const v of template.variables) {
      merged[v.name] = currentValues[v.name] ?? v.defaultValue ?? '';
    }
    return merged;
  }, [template, currentValues]);

  // Debounce variable changes (200ms)
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedValues(mergedValues);
    }, 200);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [mergedValues]);

  // Generate config from debounced values
  const generated: GeneratedConfigOutput = useMemo(() => {
    if (!template) return { fullConfig: '', sections: [] };
    return generateConfig(template.sections, debouncedValues);
  }, [template, debouncedValues]);

  // Derive hostname from variable values for download filenames
  const hostname = debouncedValues['hostname'] || debouncedValues['HOSTNAME'] || 'config';

  if (!selectedVariantId || !found || !template) {
    return (
      <div className="flex items-center justify-center h-full bg-forge-obsidian text-slate-500 text-sm">
        Select a variant from the sidebar to begin
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-forge-obsidian">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-forge-graphite bg-forge-charcoal/30">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-200 truncate">
            {found.model.name}
            <span className="text-slate-500 font-normal mx-2">/</span>
            <span className="text-forge-amber">{found.variant.name}</span>
          </h2>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {found.vendor.name} &middot; {configFormat.toUpperCase()} format
          </p>
        </div>

        <button
          onClick={() => setSaveModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
            text-forge-amber hover:text-forge-amber-bright bg-transparent hover:bg-forge-amber/10
            border border-forge-amber/50 rounded transition-colors duration-150"
        >
          <Save size={12} />
          Save to Generated
        </button>

        {onEditTemplate && (
          <button
            onClick={onEditTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
              text-slate-400 hover:text-slate-200 bg-forge-graphite/50 hover:bg-forge-graphite
              border border-forge-steel/50 rounded transition-colors duration-150"
          >
            <ArrowLeft size={12} />
            Edit Template
          </button>
        )}
      </div>

      {/* Main workspace: side-by-side on wide screens, stacked on narrow */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Variable Form - left panel */}
        <div className="lg:w-80 lg:shrink-0 lg:border-r border-b lg:border-b-0 border-forge-graphite overflow-hidden">
          <VariableForm />
        </div>

        {/* Preview panel - right side */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Section tabs */}
          <SectionTabs
            sections={generated.sections}
            activeSection={activeSection}
            onSelectSection={setActiveSection}
            hostname={hostname}
          />

          {/* Config preview */}
          <div className="flex-1 min-h-0">
            <ConfigPreview
              sections={generated.sections}
              activeSection={activeSection}
              configFormat={configFormat}
            />
          </div>
        </div>
      </div>
      {/* Save Generated modal */}
      <SaveGeneratedModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        variantId={selectedVariantId}
        fullConfig={generated.fullConfig}
        sections={generated.sections}
        variableValues={debouncedValues}
      />
    </div>
  );
}

export default ConfigGenerator;
