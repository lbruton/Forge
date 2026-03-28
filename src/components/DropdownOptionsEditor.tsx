import { useState } from 'react';
import { X } from 'lucide-react';
import { normalizeOption } from '../types/index.ts';
import type { DropdownOption } from '../types/index.ts';

interface DropdownOptionsEditorProps {
  options: (string | DropdownOption)[];
  onChange: (options: (string | DropdownOption)[]) => void;
}

export function DropdownOptionsEditor({ options, onChange }: DropdownOptionsEditorProps) {
  const [valueInput, setValueInput] = useState('');
  const [labelInput, setLabelInput] = useState('');

  const addOption = () => {
    const trimmedValue = valueInput.trim();
    if (!trimmedValue) return;
    // Check for duplicate values
    if (options.some((o) => normalizeOption(o).value === trimmedValue)) return;
    const trimmedLabel = labelInput.trim();
    const newOpt: DropdownOption =
      trimmedLabel && trimmedLabel !== trimmedValue
        ? { label: trimmedLabel, value: trimmedValue }
        : { value: trimmedValue };
    onChange([...options, newOpt]);
    setValueInput('');
    setLabelInput('');
  };

  const removeOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addOption();
    }
  };

  return (
    <div>
      <div className="space-y-1.5">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={valueInput}
            onChange={(e) => setValueInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Value (substituted)..."
            className="bg-forge-charcoal border border-forge-graphite rounded px-2 py-1.5 text-[13px] text-slate-200 outline-none focus:border-forge-amber/50 flex-1 min-w-0"
          />
          <button
            type="button"
            onClick={addOption}
            className="bg-forge-graphite text-slate-400 hover:text-slate-200 rounded px-2.5 py-1.5 text-[13px] shrink-0"
          >
            Add
          </button>
        </div>
        <input
          type="text"
          value={labelInput}
          onChange={(e) => setLabelInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Label (optional, shown in dropdown)..."
          className="w-full bg-forge-charcoal border border-forge-graphite rounded px-2 py-1.5 text-[13px] text-slate-200 outline-none focus:border-forge-amber/50"
        />
      </div>

      {options.length === 0 ? (
        <p className="text-slate-500 text-[11px] mt-1">Add at least one option</p>
      ) : (
        <div className="mt-1.5 space-y-0.5">
          {options.map((option, index) => {
            const { label, value } = normalizeOption(option);
            const hasLabel = label !== value;
            return (
              <div
                key={`${value}-${index}`}
                className="flex items-center justify-between py-1 px-2 bg-forge-charcoal/50 rounded text-[13px]"
              >
                <div className="truncate">
                  {hasLabel ? (
                    <>
                      <span className="text-slate-300">{label}</span>
                      <span className="text-slate-500 mx-1.5">&rarr;</span>
                      <span className="text-slate-400 font-mono text-[12px]">{value}</span>
                    </>
                  ) : (
                    <span className="text-slate-300">{value}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  className="text-slate-500 hover:text-red-400 shrink-0 ml-2"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
