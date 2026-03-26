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
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add option..."
          className="bg-forge-obsidian border border-forge-graphite rounded-lg text-sm text-slate-200 px-3 py-1.5 flex-1"
        />
        <button
          type="button"
          onClick={addOption}
          className="bg-forge-graphite text-slate-400 hover:text-slate-200 rounded-lg px-3 py-1.5 text-sm"
        >
          Add
        </button>
      </div>

      {options.length === 0 ? (
        <p className="text-slate-500 text-xs mt-1">Add at least one option</p>
      ) : (
        <div className="mt-2 space-y-1">
          {options.map((option, index) => (
            <div
              key={`${option}-${index}`}
              className="flex items-center justify-between py-1 px-2 bg-forge-obsidian/50 rounded text-sm text-slate-300"
            >
              <span>{option}</span>
              <button
                type="button"
                onClick={() => removeOption(index)}
                className="text-slate-500 hover:text-red-400"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
