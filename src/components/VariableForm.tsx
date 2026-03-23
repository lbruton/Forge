import { useMemo } from 'react';
import { useForgeStore } from '../store/index.ts';
import { VariableInput } from './VariableInput.tsx';
import type { VariableDefinition, TemplateSection } from '../types/index.ts';

/**
 * Groups variables by the first section they appear in.
 * Variables not found in any section go into an "Other" group.
 */
function groupVariablesBySection(
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
      if (
        section.template.includes(`$${v.name}`) ||
        section.template.includes(`\${${v.name}}`)
      ) {
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

  const found = selectedVariantId ? findVariant(selectedVariantId) : null;
  const template = found ? templates[found.variant.templateId] : undefined;

  const groups = useMemo(() => {
    if (!template) return [];
    return groupVariablesBySection(template.variables, template.sections);
  }, [template]);

  if (!selectedVariantId || !template) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        No variant selected
      </div>
    );
  }

  const values = variableValues[selectedVariantId]?.values ?? {};

  return (
    <div className="h-full overflow-y-auto p-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
        Variables
      </h3>

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
    </div>
  );
}
