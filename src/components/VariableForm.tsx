import { useMemo } from 'react';
import { Globe, AlertTriangle, ExternalLink } from 'lucide-react';
import { useForgeStore } from '../store/index.ts';
import { VariableInput } from './VariableInput.tsx';
import type { VariableDefinition, TemplateSection } from '../types/index.ts';

/**
 * Groups variables by the first section they appear in.
 * Variables not found in any section go into an "Other" group.
 */
export function groupVariablesBySection(
  variables: VariableDefinition[],
  sections: TemplateSection[],
): { sectionName: string; vars: VariableDefinition[] }[] {
  const sorted = [...sections].sort((a, b) => a.order - b.order);
  const assigned = new Set<string>();
  const groups: { sectionName: string; vars: VariableDefinition[] }[] = [];

  for (const section of sorted) {
    const sectionVars: VariableDefinition[] = [];
    for (const v of variables) {
      if (assigned.has(v.name)) continue;
      // Check if $variable or ${variable} appears in section template
      if (section.template.includes(`$${v.name}`) || section.template.includes(`\${${v.name}}`)) {
        sectionVars.push(v);
        assigned.add(v.name);
      }
    }
    if (sectionVars.length > 0) {
      groups.push({ sectionName: section.name, vars: sectionVars });
    }
  }

  // Collect any remaining unassigned variables
  const remaining = variables.filter((v) => !assigned.has(v.name));
  if (remaining.length > 0) {
    groups.push({ sectionName: 'Other', vars: remaining });
  }

  return groups;
}

export function VariableForm() {
  const selectedVariantId = useForgeStore((s) => s.selectedVariantId);
  const templates = useForgeStore((s) => s.templates);
  const variableValues = useForgeStore((s) => s.variableValues);
  const setVariableValue = useForgeStore((s) => s.setVariableValue);
  const findVariant = useForgeStore((s) => s.findVariant);
  const setSelectedGlobalVariablesViewId = useForgeStore((s) => s.setSelectedGlobalVariablesViewId);

  const found = selectedVariantId ? findVariant(selectedVariantId) : null;
  const template = found ? templates[found.variant.templateId] : undefined;
  const globalVariables = found?.view.globalVariables ?? [];

  const groups = useMemo(() => {
    if (!template) return [];
    if (template.customVariableOrder) return null;
    return groupVariablesBySection(template.variables, template.sections);
  }, [template]);

  if (!selectedVariantId || !template) {
    return <div className="flex items-center justify-center h-full text-slate-500 text-sm">No variant selected</div>;
  }

  const values = variableValues[selectedVariantId]?.values ?? {};

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Global Variables Info Card */}
      {globalVariables.length > 0 && (
        <div className="mb-4 p-3.5 bg-emerald-500/[0.06] border border-emerald-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2.5">
            <Globe size={16} className="text-emerald-500 shrink-0" />
            <h3 className="text-[13px] font-semibold text-emerald-500 flex-1">Global Variables</h3>
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-500">
              {globalVariables.length}
            </span>
          </div>
          {globalVariables.map((gv) => (
            <div
              key={gv.name}
              className="flex items-center gap-2 py-1.5 border-b border-emerald-500/[0.08] last:border-b-0"
            >
              <span className="font-mono text-xs text-emerald-500 min-w-[140px]">
                ${'{'}
                {gv.name}
                {'}'}
              </span>
              {gv.defaultValue ? (
                <span className="font-mono text-xs text-slate-400 flex-1 truncate">
                  {gv.masked ? '••••••••' : gv.defaultValue}
                </span>
              ) : (
                <span className="text-xs text-amber-500 italic flex items-center gap-1">
                  <AlertTriangle size={11} />
                  Not set
                </span>
              )}
            </div>
          ))}
          <button
            onClick={() => found && setSelectedGlobalVariablesViewId(found.view.id)}
            className="flex items-center gap-1 text-[11px] text-emerald-500 hover:text-emerald-400 mt-2 bg-transparent border-0 cursor-pointer font-sans"
          >
            <ExternalLink size={11} />
            Manage Global Variables
          </button>
        </div>
      )}

      {globalVariables.length > 0 && <div className="h-px bg-forge-graphite mx-0 mb-4" />}

      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Variables</h3>

      {groups === null ? (
        // Custom variable order: flat list without section headers
        template.variables.length > 0 ? (
          <div className="mb-5">
            {template.variables.map((varDef) => (
              <VariableInput
                key={varDef.name}
                variableDefinition={varDef}
                value={values[varDef.name] ?? varDef.defaultValue ?? ''}
                onChange={(val) => setVariableValue(selectedVariantId, varDef.name, val)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic">No variables defined in this template.</p>
        )
      ) : (
        // Legacy section-grouped rendering
        <>
          {groups.map((group) => (
            <div key={group.sectionName} className="mb-5">
              <h4 className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2 pb-1 border-b border-forge-graphite">
                {group.sectionName}
              </h4>
              {group.vars.map((varDef) => (
                <VariableInput
                  key={varDef.name}
                  variableDefinition={varDef}
                  value={values[varDef.name] ?? varDef.defaultValue ?? ''}
                  onChange={(val) => setVariableValue(selectedVariantId, varDef.name, val)}
                />
              ))}
            </div>
          ))}

          {groups.length === 0 && (
            <p className="text-sm text-slate-500 italic">No variables defined in this template.</p>
          )}
        </>
      )}
    </div>
  );
}
