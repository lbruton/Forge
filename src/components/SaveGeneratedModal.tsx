import { useState, useEffect, useRef, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useForgeStore } from '../store/index.ts';
import type { GeneratedSection } from '../types/index.ts';

interface SaveGeneratedModalProps {
  isOpen: boolean;
  onClose: () => void;
  variantId: string;
  fullConfig: string;
  sections: GeneratedSection[];
  variableValues: Record<string, string>;
  globalVariableValues?: Record<string, string>;
}

export function SaveGeneratedModal({
  isOpen,
  onClose,
  variantId,
  fullConfig,
  sections,
  variableValues,
  globalVariableValues,
}: SaveGeneratedModalProps) {
  const findVariant = useForgeStore((s) => s.findVariant);
  const saveGeneratedConfig = useForgeStore((s) => s.saveGeneratedConfig);

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Auto-suggest name from hostname variable — only on open, not on every variableValues change
  const variableValuesRef = useRef(variableValues);
  variableValuesRef.current = variableValues;

  useEffect(() => {
    if (isOpen) {
      const vals = variableValuesRef.current;
      const hostnameKey = Object.keys(vals).find((k) => k.toLowerCase().includes('hostname'));
      const suggested = hostnameKey ? vals[hostnameKey] : '';
      setName(suggested || '');
      setNotes('');
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const found = findVariant(variantId);
    if (!found) return;

    saveGeneratedConfig({
      id: crypto.randomUUID(),
      name: name.trim(),
      modelId: found.model.id,
      sourceVariantId: variantId,
      sourceTemplateId: found.variant.templateId,
      variableValues,
      globalVariableValues:
        globalVariableValues && Object.keys(globalVariableValues).length > 0 ? globalVariableValues : undefined,
      fullConfig,
      sections,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    });

    onClose();
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="bg-forge-charcoal border border-forge-steel rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-forge-graphite">
          <h3 className="text-base font-semibold text-slate-200">Save Generated Config</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-forge-graphite transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[13px] font-medium text-slate-400 mb-1.5">Name</label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., switch-01"
              className="w-full px-3 py-2 bg-forge-obsidian border border-forge-graphite rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-forge-amber/50 focus:ring-1 focus:ring-forge-amber/25 transition-colors"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[13px] font-medium text-slate-400 mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Initial deploy, post-maintenance update"
              rows={3}
              className="w-full px-3 py-2 bg-forge-obsidian border border-forge-graphite rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-forge-amber/50 focus:ring-1 focus:ring-forge-amber/25 transition-colors resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 rounded-lg hover:bg-forge-graphite transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 text-sm font-semibold bg-forge-amber text-forge-obsidian rounded-lg hover:bg-forge-amber-bright disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
