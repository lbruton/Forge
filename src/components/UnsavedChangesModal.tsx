import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface UnsavedChangesModalProps {
  open: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function UnsavedChangesModal({ open, onSave, onDiscard, onCancel }: UnsavedChangesModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === overlayRef.current) onCancel();
      }}
    >
      <div className="bg-forge-obsidian border border-forge-steel rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-200">
            Unsaved Changes
          </h3>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-forge-graphite transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <p className="text-sm text-slate-400 mt-3">
          You have unsaved changes to this template. What would you like to do?
        </p>

        {/* Actions */}
        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-forge-graphite text-slate-400 rounded-lg hover:bg-forge-graphite/80 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onDiscard}
            className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 text-sm"
          >
            Discard
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 text-sm font-medium"
          >
            Save &amp; Continue
          </button>
        </div>
      </div>
    </div>
  );
}
