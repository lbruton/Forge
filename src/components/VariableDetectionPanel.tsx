import { useState, useCallback } from 'react';
import type { VariableDefinition, VariableType } from '../types/index.ts';
import { Plus, ChevronDown, Trash2, ArrowUpCircle, GripVertical } from 'lucide-react';
import { DropdownOptionsEditor } from './DropdownOptionsEditor.tsx';

interface VariableDetectionPanelProps {
  variables: VariableDefinition[];
  onChange: (variables: VariableDefinition[]) => void;
  sectionNames: string[];
  variableSectionMap: Record<string, string>;
  hideHeader?: boolean;
  onPromoteToGlobal?: (varName: string) => void;
  onReorder?: () => void;
}

const VARIABLE_TYPES: VariableType[] = ['string', 'ip', 'integer', 'dropdown'];

export function VariableDetectionPanel({
  variables,
  onChange,
  sectionNames,
  variableSectionMap,
  hideHeader = false,
  onPromoteToGlobal,
  onReorder,
}: VariableDetectionPanelProps) {
  const [expandedVar, setExpandedVar] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (dragIndex !== null && dragIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [dragIndex],
  );

  const handleDragEnd = useCallback(() => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      const reordered = [...variables];
      const [moved] = reordered.splice(dragIndex, 1);
      reordered.splice(dragOverIndex, 0, moved);
      onChange(reordered);
      onReorder?.();
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, dragOverIndex, variables, onChange, onReorder]);

  const updateVariable = (index: number, updates: Partial<VariableDefinition>) => {
    const next = variables.map((v, i) => (i === index ? { ...v, ...updates } : v));
    onChange(next);
  };

  const removeVariable = (index: number) => {
    onChange(variables.filter((_, i) => i !== index));
  };

  const addVariable = () => {
    const newVar: VariableDefinition = {
      name: `new_variable_${variables.length + 1}`,
      label: `New Variable ${variables.length + 1}`,
      type: 'string',
      defaultValue: '',
      options: [],
      required: true,
      description: '',
    };
    onChange([...variables, newVar]);
    setExpandedVar(newVar.name);
  };

  // Group variables by section
  const grouped: Record<string, { variable: VariableDefinition; index: number }[]> = {};
  variables.forEach((variable, index) => {
    const section = variableSectionMap[variable.name] || 'Ungrouped';
    if (!grouped[section]) grouped[section] = [];
    grouped[section].push({ variable, index });
  });

  // Order groups by sectionNames, then Ungrouped at end
  const orderedGroups = [
    ...sectionNames.filter((s) => grouped[s]),
    ...(grouped['Ungrouped'] ? ['Ungrouped'] : []),
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      {!hideHeader && (
      <div className="px-5 py-2.5 text-[11px] font-semibold tracking-widest uppercase text-slate-500 border-b border-forge-graphite flex items-center justify-between">
        <span>
          Detected Variables
          {variables.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-forge-amber/20 text-forge-amber text-[11px] font-bold">
              {variables.length}
            </span>
          )}
        </span>
        <button
          onClick={addVariable}
          className="p-1 rounded text-slate-500 hover:text-forge-amber hover:bg-forge-graphite transition-colors"
          title="Add variable manually"
        >
          <Plus size={14} />
        </button>
      </div>
      )}

      {/* Variable list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {variables.length === 0 ? (
          <p className="text-slate-500 text-[13px] italic text-center py-5">
            Paste a template to detect variables
          </p>
        ) : (
          orderedGroups.map((sectionName) => (
            <div key={sectionName}>
              {orderedGroups.length > 1 && (
                <div className="text-[10px] font-semibold tracking-wider uppercase text-slate-600 mb-2">
                  {sectionName}
                </div>
              )}
              <div className="space-y-2">
                {grouped[sectionName].map(({ variable, index }) => {
                  const isExpanded = expandedVar === variable.name;
                  return (
                    <div
                      key={`${variable.name}-${index}`}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`bg-forge-obsidian border border-forge-graphite rounded-md overflow-hidden transition-colors ${
                        dragIndex === index ? 'opacity-50 !border-amber-500' : ''
                      } ${dragOverIndex === index ? '!border-green-500 shadow-[0_0_0_2px_rgba(34,197,94,0.2)]' : ''}`}
                    >
                      {/* Collapsed row */}
                      <div className="w-full flex items-center gap-2 px-3 py-2">
                        <GripVertical size={14} className="text-slate-500 cursor-grab flex-shrink-0" />
                        <button
                          className="flex items-center gap-2 flex-1 min-w-0 text-left hover:bg-forge-graphite/50 transition-colors rounded"
                          onClick={() => setExpandedVar(isExpanded ? null : variable.name)}
                        >
                          <span className="text-forge-amber-dark font-mono text-[13px]">$</span>
                          <span className="text-forge-amber font-mono text-[13px] font-medium flex-1 truncate">
                            {variable.name}
                          </span>
                          <span className="text-[11px] text-slate-500 font-sans">{variable.type}</span>
                          <ChevronDown
                            size={12}
                            className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </div>

                      {/* Expanded edit form */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-forge-graphite">
                          {/* Label */}
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                              Label
                            </label>
                            <input
                              type="text"
                              value={variable.label}
                              onChange={(e) => updateVariable(index, { label: e.target.value })}
                              className="w-full bg-forge-charcoal border border-forge-graphite rounded px-2 py-1.5 text-[13px] text-slate-200 outline-none focus:border-forge-amber/50"
                            />
                          </div>

                          {/* Type */}
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                              Type
                            </label>
                            <select
                              value={variable.type}
                              onChange={(e) =>
                                updateVariable(index, { type: e.target.value as VariableType })
                              }
                              className="w-full bg-forge-charcoal border border-forge-graphite rounded px-2 py-1.5 text-[13px] text-slate-200 outline-none focus:border-forge-amber/50 appearance-none cursor-pointer"
                            >
                              {VARIABLE_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                            {variable.type === 'dropdown' && (
                              <div className="mt-2">
                                <DropdownOptionsEditor
                                  options={variable.options}
                                  onChange={(newOptions) => updateVariable(index, { options: newOptions })}
                                />
                              </div>
                            )}
                          </div>

                          {/* Description */}
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                              Description
                            </label>
                            <input
                              type="text"
                              value={variable.description}
                              onChange={(e) => updateVariable(index, { description: e.target.value })}
                              placeholder="Optional description..."
                              className="w-full bg-forge-charcoal border border-forge-graphite rounded px-2 py-1.5 text-[13px] text-slate-200 placeholder:text-slate-600 outline-none focus:border-forge-amber/50"
                            />
                          </div>

                          {/* Required toggle + Promote + Delete */}
                          <div className="flex items-center justify-between pt-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={variable.required}
                                onChange={(e) => updateVariable(index, { required: e.target.checked })}
                                className="accent-forge-amber"
                              />
                              <span className="text-[12px] text-slate-400">Required</span>
                            </label>
                            <div className="flex items-center gap-1">
                              {onPromoteToGlobal && (
                                <button
                                  onClick={() => onPromoteToGlobal(variable.name)}
                                  className="p-1 rounded text-slate-600 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                                  title={`Promote $${variable.name} to global \${${variable.name}}`}
                                >
                                  <ArrowUpCircle size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => removeVariable(index)}
                                className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-forge-graphite transition-colors"
                                title="Remove variable"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
