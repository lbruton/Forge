import { useState, useEffect, useRef, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { ConfigFormat } from '../types/index.ts';

export type CreateNodeType = 'view' | 'vendor' | 'model' | 'variant';

interface CreateNodeModalProps {
  open: boolean;
  nodeType: CreateNodeType;
  onClose: () => void;
  onSubmit: (_data: CreateNodeData) => void;
}

export interface CreateNodeData {
  name: string;
  configFormat?: ConfigFormat;
  description?: string;
}

const nodeLabels: Record<CreateNodeType, string> = {
  view: 'View',
  vendor: 'Vendor',
  model: 'Model',
  variant: 'Variant',
};

export function CreateNodeModal({ open, nodeType, onClose, onSubmit }: CreateNodeModalProps) {
  const [name, setName] = useState('');
  const [configFormat, setConfigFormat] = useState<ConfigFormat>('cli');
  const [description, setDescription] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setConfigFormat('cli');
      setDescription('');
      // Focus after render
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open, nodeType]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); };
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const data: CreateNodeData = { name: name.trim() };
    if (nodeType === 'vendor') data.configFormat = configFormat;
    if (nodeType === 'model') data.description = description;
    onSubmit(data);
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
          <h3 className="text-base font-semibold text-slate-200">Create {nodeLabels[nodeType]}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-forge-graphite transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Name field — always shown */}
          <div>
            <label className="block text-[13px] font-medium text-slate-400 mb-1.5">Name</label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); }}
              placeholder={`Enter ${nodeLabels[nodeType].toLowerCase()} name`}
              className="w-full px-3 py-2 bg-forge-obsidian border border-forge-graphite rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-forge-amber/50 focus:ring-1 focus:ring-forge-amber/25 transition-colors"
            />
          </div>

          {/* Config format dropdown — vendor only */}
          {nodeType === 'vendor' && (
            <div>
              <label className="block text-[13px] font-medium text-slate-400 mb-1.5">Config Format</label>
              <select
                value={configFormat}
                onChange={(e) => { setConfigFormat(e.target.value as ConfigFormat); }}
                className="w-full px-3 py-2 bg-forge-obsidian border border-forge-graphite rounded-lg text-sm text-slate-200 focus:outline-none focus:border-forge-amber/50 focus:ring-1 focus:ring-forge-amber/25 transition-colors"
              >
                {/* TODO: re-enable xml, json, yaml when formats are tested */}
                <option value="cli">CLI</option>
              </select>
            </div>
          )}

          {/* Description — model only */}
          {nodeType === 'model' && (
            <div>
              <label className="block text-[13px] font-medium text-slate-400 mb-1.5">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => { setDescription(e.target.value); }}
                placeholder="Optional description"
                className="w-full px-3 py-2 bg-forge-obsidian border border-forge-graphite rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-forge-amber/50 focus:ring-1 focus:ring-forge-amber/25 transition-colors"
              />
            </div>
          )}

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
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
