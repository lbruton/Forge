import { useState, useCallback } from 'react';
import { normalizeOption } from '../types/index.ts';
import type { VariableDefinition } from '../types/index.ts';
import { isValidIpv4 } from '../lib/validators.ts';

interface VariableInputProps {
  variableDefinition: VariableDefinition;
  value: string;
  onChange: (value: string) => void;
}

export function VariableInput({ variableDefinition, value, onChange }: VariableInputProps) {
  const { name, label, type, options, required, description } = variableDefinition;
  const [ipError, setIpError] = useState(false);

  const handleIpBlur = useCallback(() => {
    if (type === 'ip' && value.length > 0) {
      setIpError(!isValidIpv4(value));
    } else {
      setIpError(false);
    }
  }, [type, value]);

  const isEmpty = required && (!value || value.trim() === '');

  const baseInputClasses = `
    w-full px-3 py-2 text-sm font-mono
    bg-forge-obsidian border rounded-[var(--radius-sm)]
    text-slate-200 placeholder-slate-500
    outline-none transition-all duration-150
    focus:ring-1 focus:ring-forge-amber/50 focus:border-forge-amber
  `;

  const borderClass = ipError ? 'border-red-500' : isEmpty ? 'border-amber-500/60' : 'border-forge-steel';

  return (
    <div className="mb-3">
      <label htmlFor={`var-${name}`} className="flex items-center gap-1 mb-1 text-xs font-medium text-slate-300">
        {label}
        {required && <span className="text-amber-500">*</span>}
      </label>

      {type === 'dropdown' ? (
        <select
          id={`var-${name}`}
          value={value}
          onChange={(e) => { onChange(e.target.value); }}
          className={`${baseInputClasses} ${borderClass} cursor-pointer`}
        >
          <option value="">Select...</option>
          {options.map((opt, i) => {
            const { label: optLabel, value: optValue } = normalizeOption(opt);
            return (
              <option key={`${optValue}-${i}`} value={optValue}>
                {optLabel}
              </option>
            );
          })}
        </select>
      ) : type === 'integer' ? (
        <input
          id={`var-${name}`}
          type="number"
          value={value}
          onChange={(e) => { onChange(e.target.value); }}
          className={`${baseInputClasses} ${borderClass}`}
          placeholder={`Enter ${label.toLowerCase()}`}
        />
      ) : (
        <input
          id={`var-${name}`}
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); }}
          onBlur={type === 'ip' ? handleIpBlur : undefined}
          className={`${baseInputClasses} ${borderClass}`}
          placeholder={type === 'ip' ? '0.0.0.0' : `Enter ${label.toLowerCase()}`}
        />
      )}

      {ipError && <p className="mt-1 text-xs text-red-400">Invalid IPv4 address</p>}
      {isEmpty && !ipError && <p className="mt-1 text-xs text-amber-500/80">Required field</p>}
      {description && !ipError && !isEmpty && <p className="mt-1 text-xs text-slate-500">{description}</p>}
    </div>
  );
}
