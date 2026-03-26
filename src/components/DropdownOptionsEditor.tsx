import { useState } from 'react';
import { X } from 'lucide-react';

interface DropdownOptionsEditorProps {
  options: string[];
  onChange: (options: string[]) => void;
}

export function DropdownOptionsEditor({ options, onChange }: DropdownOptionsEditorProps) {
  const [inputValue, setInputValue] = useState('');

  const addOption = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (options.includes(trimmed)) return;
    onChange([...options, trimmed]);
    setInputValue('');
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
      <div className="flex gap-1.5">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add option..."
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

      {options.length === 0 ? (
        <p className="text-slate-500 text-[11px] mt-1">Add at least one option</p>
      ) : (
        <div className="mt-1.5 space-y-0.5">
          {options.map((option, index) => (
            <div
              key={`${option}-${index}`}
              className="flex items-center justify-between py-1 px-2 bg-forge-charcoal/50 rounded text-[13px] text-slate-300"
            >
              <span className="truncate">{option}</span>
              <button
                type="button"
                onClick={() => removeOption(index)}
                className="text-slate-500 hover:text-red-400 shrink-0 ml-2"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
