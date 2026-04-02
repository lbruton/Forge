import { useState, useEffect, useRef, useCallback, type DragEvent } from 'react';
import { X, Upload, Download, Lock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useForgeStore } from '../store/index.ts';
import { encryptVault, decryptVault } from '../lib/vault-engine.ts';
import type { VaultExportData, View, ExportOptions } from '../types/index.ts';
import { defaultExportOptions } from '../types/index.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportScope {
  type: 'all' | 'view' | 'vendor' | 'model' | 'variant';
  viewId?: string;
  vendorId?: string;
  modelId?: string;
  variantId?: string;
}

interface VaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportScope?: ExportScope;
  initialTab?: 'export' | 'import';
}

type ConflictResolution = 'overwrite' | 'skip' | 'rename';

interface ConflictItem {
  type: string;
  name: string;
  id: string;
  resolution: ConflictResolution;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function scopeLabel(scope: ExportScope | undefined, tree: { views: View[] }): string {
  if (!scope || scope.type === 'all') return 'Everything';
  if (scope.type === 'view') {
    const v = tree.views.find((x) => x.id === scope.viewId);
    return v ? `View: ${v.name}` : 'Selected View';
  }
  if (scope.type === 'vendor') {
    for (const view of tree.views) {
      const vn = view.vendors.find((x) => x.id === scope.vendorId);
      if (vn) return `Vendor: ${vn.name}`;
    }
    return 'Selected Vendor';
  }
  if (scope.type === 'model') {
    for (const view of tree.views) {
      for (const vendor of view.vendors) {
        const m = vendor.models.find((x) => x.id === scope.modelId);
        if (m) return `Model: ${m.name}`;
      }
    }
    return 'Selected Model';
  }
  if (scope.type === 'variant') {
    for (const view of tree.views) {
      for (const vendor of view.vendors) {
        for (const model of vendor.models) {
          const va = model.variants.find((x) => x.id === scope.variantId);
          if (va) return `Variant: ${va.name}`;
        }
      }
    }
    return 'Selected Variant';
  }
  return 'Everything';
}

interface DataCounts {
  views: number;
  vendors: number;
  models: number;
  variants: number;
  templates: number;
  generatedConfigs: number;
  plugins: number;
  vulnDevices: number;
  scanEntries: number;
  hasPreferences: boolean;
}

function countData(data: VaultExportData): DataCounts {
  let views = 0;
  let vendors = 0;
  let models = 0;
  let variants = 0;

  if (data.views) {
    views = data.views.length;
    for (const v of data.views) {
      vendors += v.vendors.length;
      for (const vn of v.vendors) {
        models += vn.models.length;
        for (const m of vn.models) {
          variants += m.variants.length;
        }
      }
    }
  }
  if (data.vendors) {
    vendors += data.vendors.length;
    for (const vn of data.vendors) {
      models += vn.models.length;
      for (const m of vn.models) {
        variants += m.variants.length;
      }
    }
  }
  if (data.models) {
    models += data.models.length;
    for (const m of data.models) {
      variants += m.variants.length;
    }
  }
  if (data.variants) {
    variants += data.variants.length;
  }

  const templates = Object.keys(data.templates).length;
  const generatedConfigs = Object.keys(data.generatedConfigs ?? {}).length;
  const plugins = Object.keys(data.plugins ?? {}).length;
  const vulnDevices = (data.vulnDevices ?? []).length;
  let scanEntries = 0;
  if (data.vulnScanCache) {
    for (const entries of Object.values(data.vulnScanCache)) {
      scanEntries += entries.length;
    }
  }
  const hasPreferences = !!data.preferences;

  return { views, vendors, models, variants, templates, generatedConfigs, plugins, vulnDevices, scanEntries, hasPreferences };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VaultModal({ isOpen, onClose, exportScope, initialTab = 'export' }: VaultModalProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>(initialTab);

  // Export state
  const [exportPassword, setExportPassword] = useState('');
  const [exportPasswordConfirm, setExportPasswordConfirm] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportSuccess, setExportSuccess] = useState(false);
  const [selectedScope, setSelectedScope] = useState<'all' | 'scoped'>('all');

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [decryptedData, setDecryptedData] = useState<VaultExportData | null>(null);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [importStrategy, setImportStrategy] = useState<'merge' | 'replace'>('merge');
  const [importCategories, setImportCategories] = useState<Record<string, boolean>>({});
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tree = useForgeStore((s) => s.tree);
  const templates = useForgeStore((s) => s.templates);
  const generatedConfigs = useForgeStore((s) => s.generatedConfigs);
  const vulnDevices = useForgeStore((s) => s.vulnDevices);
  const vulnScanCache = useForgeStore((s) => s.vulnScanCache);
  const exportData = useForgeStore((s) => s.exportData);
  const importData = useForgeStore((s) => s.importData);
  const resetAll = useForgeStore((s) => s.resetAll);

  const [exportOptions, setExportOptions] = useState<ExportOptions>({ ...defaultExportOptions });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setExportPassword('');
      setExportPasswordConfirm('');
      setExportLoading(false);
      setExportError('');
      setExportSuccess(false);
      setSelectedScope(exportScope && exportScope.type !== 'all' ? 'scoped' : 'all');
      setImportFile(null);
      setImportPassword('');
      setImportLoading(false);
      setImportError('');
      setImportSuccess(false);
      setDragOver(false);
      setDecryptedData(null);
      setConflicts([]);
      setShowSummary(false);
      setExportOptions({ ...defaultExportOptions });
      setImportStrategy('merge');
      setImportCategories({});
      setReplaceConfirmed(false);
    }
  }, [isOpen, initialTab, exportScope]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); };
  }, [isOpen, onClose]);

  // Focus trap
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const modal = modalRef.current;
    if (!modal) return;

    const focusableSelector = 'button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = modal.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); };
  }, [isOpen]);

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  const handleExport = useCallback(async () => {
    setExportError('');
    setExportSuccess(false);

    if (!exportPassword) {
      setExportError('Password is required.');
      return;
    }
    if (exportPassword !== exportPasswordConfirm) {
      setExportError('Passwords do not match.');
      return;
    }
    if (exportPassword.length < 4) {
      setExportError('Password must be at least 4 characters.');
      return;
    }

    setExportLoading(true);
    try {
      const data = exportData(exportOptions);
      const blob = await encryptVault(data, exportPassword);

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `forge-export-${formatDate()}.stvault`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
    } catch {
      setExportError('Failed to encrypt vault. Please try again.');
    } finally {
      setExportLoading(false);
    }
  }, [exportPassword, exportPasswordConfirm, exportData, exportOptions]);

  // ---------------------------------------------------------------------------
  // Import — file handling
  // ---------------------------------------------------------------------------

  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.endsWith('.stvault')) {
      setImportError("This file doesn't appear to be a valid .stvault archive.");
      return;
    }
    setImportFile(file);
    setImportError('');
    setDecryptedData(null);
    setConflicts([]);
    setShowSummary(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  // ---------------------------------------------------------------------------
  // Import — decrypt
  // ---------------------------------------------------------------------------

  const handleDecrypt = useCallback(async () => {
    if (!importFile) return;
    setImportError('');
    setImportLoading(true);

    try {
      const data = await decryptVault(importFile, importPassword);

      // Detect conflicts
      const foundConflicts: ConflictItem[] = [];
      if (data.views) {
        for (const imported of data.views) {
          const existing = tree.views.find((v) => v.id === imported.id || v.name === imported.name);
          if (existing) {
            foundConflicts.push({ type: 'View', name: imported.name, id: imported.id, resolution: 'skip' });
          }
        }
      }
      if (data.templates) {
        for (const [id, tmpl] of Object.entries(data.templates)) {
          if (templates[id]) {
            foundConflicts.push({ type: 'Template', name: id, id, resolution: 'skip' });
          }
          // Suppress unused variable lint — tmpl is used in the iteration
          void tmpl;
        }
      }

      setDecryptedData(data);
      setConflicts(foundConflicts);
      setShowSummary(true);
      setImportCategories({
        views: true,
        templates: true,
        generatedConfigs: !!data.generatedConfigs,
        plugins: !!data.plugins,
        vulnDevices: !!data.vulnDevices,
        vulnScanCache: !!data.vulnScanCache,
        preferences: !!data.preferences,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('Incorrect password') || message.includes('corrupted file')) {
        setImportError('Incorrect password. Please try again.');
      } else if (message.includes('Invalid .stvault')) {
        setImportError("This file doesn't appear to be a valid .stvault archive.");
      } else {
        setImportError('Failed to decrypt file. Please check your password and try again.');
      }
    } finally {
      setImportLoading(false);
    }
  }, [importFile, importPassword, tree.views, templates]);

  // ---------------------------------------------------------------------------
  // Import — confirm
  // ---------------------------------------------------------------------------

  const handleConfirmImport = useCallback(() => {
    if (!decryptedData) return;
    if (importStrategy === 'replace' && !replaceConfirmed) return;

    try {
      // Apply conflict resolutions: filter out skipped items
      const resolvedData = structuredClone(decryptedData);
      for (const conflict of conflicts) {
        if (conflict.resolution === 'skip') {
          if (conflict.type === 'View' && resolvedData.views) {
            resolvedData.views = resolvedData.views.filter((v) => v.id !== conflict.id);
          }
          if (conflict.type === 'Template') {
            const { [conflict.id]: _, ...rest } = resolvedData.templates;
            void _;
            resolvedData.templates = rest;
          }
        }
        if (conflict.resolution === 'rename') {
          if (conflict.type === 'View' && resolvedData.views) {
            const view = resolvedData.views.find((v) => v.id === conflict.id);
            if (view) {
              view.id = crypto.randomUUID();
              view.name = `${view.name} (imported)`;
            }
          }
        }
        // 'overwrite' — keep as-is, importData will handle
      }

      // Filter by selected import categories
      const filteredData = { ...resolvedData };
      if (!importCategories.generatedConfigs) delete filteredData.generatedConfigs;
      if (!importCategories.plugins) delete filteredData.plugins;
      if (!importCategories.vulnDevices) delete filteredData.vulnDevices;
      if (!importCategories.vulnScanCache) delete filteredData.vulnScanCache;
      if (!importCategories.preferences) delete filteredData.preferences;

      // Replace strategy: erase all existing data first
      if (importStrategy === 'replace') {
        resetAll();
      }

      importData(filteredData);
      setImportSuccess(true);
    } catch {
      setImportError('Failed to import data. Your existing data has not been modified.');
    }
  }, [decryptedData, conflicts, importData, importStrategy, replaceConfirmed, importCategories, resetAll]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!isOpen) return null;

  const inputClasses =
    'w-full px-3 py-2 bg-forge-obsidian border border-forge-graphite rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-forge-amber/50 focus:ring-1 focus:ring-forge-amber/25 transition-colors';

  const canExport = exportPassword.length >= 4 && exportPassword === exportPasswordConfirm && !exportLoading;
  const canDecrypt = importFile && importPassword && !importLoading;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="bg-forge-charcoal border border-forge-steel rounded-xl shadow-2xl w-full max-w-[500px] mx-4 max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-forge-graphite shrink-0">
          <h3 className="text-base font-semibold text-slate-200">
            <Lock size={16} className="inline-block mr-2 -mt-0.5 text-forge-amber" />
            Vault
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-forge-graphite transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-forge-graphite shrink-0">
          <button
            onClick={() => { setActiveTab('export'); }}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'export'
                ? 'text-forge-amber border-b-2 border-forge-amber'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download size={14} className="inline-block mr-1.5 -mt-0.5" />
            Export
          </button>
          <button
            onClick={() => { setActiveTab('import'); }}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'import'
                ? 'text-forge-amber border-b-2 border-forge-amber'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload size={14} className="inline-block mr-1.5 -mt-0.5" />
            Import
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {/* ====================== EXPORT TAB ====================== */}
          {activeTab === 'export' && (
            <>
              {exportSuccess ? (
                <div className="flex flex-col items-center py-6 gap-3">
                  <CheckCircle size={40} className="text-green-400" />
                  <p className="text-sm text-slate-200 font-medium">Export complete!</p>
                  <p className="text-xs text-slate-400">Your .stvault file has been downloaded.</p>
                  <button
                    onClick={onClose}
                    className="mt-2 px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 rounded-lg hover:bg-forge-graphite transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  {/* Scope selector */}
                  <div>
                    <label className="block text-[13px] font-medium text-slate-400 mb-2">Export Scope</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="exportScope"
                          checked={selectedScope === 'all'}
                          onChange={() => { setSelectedScope('all'); }}
                          className="accent-amber-500"
                        />
                        <span className="text-sm text-slate-200">Everything</span>
                      </label>
                      {exportScope && exportScope.type !== 'all' && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="exportScope"
                            checked={selectedScope === 'scoped'}
                            onChange={() => { setSelectedScope('scoped'); }}
                            className="accent-amber-500"
                          />
                          <span className="text-sm text-slate-200">{scopeLabel(exportScope, tree)}</span>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Category checkboxes */}
                  <div>
                    <label className="block text-[13px] font-medium text-slate-400 mb-2">Include in Export</label>
                    <div className="space-y-1.5">
                      {/* Views & Templates — always included */}
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked
                          disabled
                          className="accent-amber-500 mt-0.5"
                        />
                        <span className="text-sm text-slate-400">Views & Templates</span>
                      </label>

                      {/* Generated Configs */}
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={exportOptions.includeGeneratedConfigs}
                          onChange={(e) => { setExportOptions((prev) => ({ ...prev, includeGeneratedConfigs: e.target.checked })); }}
                          className="accent-amber-500 mt-0.5"
                        />
                        <span className="text-sm text-slate-200">Generated Configs</span>
                      </label>

                      {/* Plugin Settings */}
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={exportOptions.includePlugins}
                          onChange={(e) => { setExportOptions((prev) => ({ ...prev, includePlugins: e.target.checked })); }}
                          className="accent-amber-500 mt-0.5"
                        />
                        <div>
                          <span className="text-sm text-slate-200">Plugin Settings</span>
                          <p className="text-xs text-slate-500">Credentials will be stripped</p>
                        </div>
                      </label>

                      {/* Vulnerability Devices */}
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={exportOptions.includeVulnDevices}
                          onChange={(e) => { setExportOptions((prev) => ({ ...prev, includeVulnDevices: e.target.checked })); }}
                          className="accent-amber-500 mt-0.5"
                        />
                        <div>
                          <span className="text-sm text-slate-200">Vulnerability Devices</span>
                          <p className="text-xs text-slate-500">SNMP communities will be stripped</p>
                        </div>
                      </label>

                      {/* Scan History */}
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={exportOptions.includeVulnScanCache}
                          onChange={(e) => { setExportOptions((prev) => ({ ...prev, includeVulnScanCache: e.target.checked })); }}
                          className="accent-amber-500 mt-0.5"
                        />
                        <div>
                          <span className="text-sm text-slate-200">Scan History</span>
                          <p className="text-xs text-slate-500">May increase file size significantly</p>
                        </div>
                      </label>

                      {/* Preferences */}
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={exportOptions.includePreferences}
                          onChange={(e) => { setExportOptions((prev) => ({ ...prev, includePreferences: e.target.checked })); }}
                          className="accent-amber-500 mt-0.5"
                        />
                        <span className="text-sm text-slate-200">Preferences</span>
                      </label>
                    </div>

                    {/* Item count summary */}
                    {(() => {
                      const parts: string[] = [];
                      const viewCount = tree.views.length;
                      const templateCount = Object.keys(templates).length;
                      if (viewCount > 0) parts.push(`${viewCount} view${viewCount !== 1 ? 's' : ''}`);
                      if (templateCount > 0) parts.push(`${templateCount} template${templateCount !== 1 ? 's' : ''}`);
                      if (exportOptions.includeGeneratedConfigs) {
                        const configCount = Object.keys(generatedConfigs).length;
                        if (configCount > 0) parts.push(`${configCount} config${configCount !== 1 ? 's' : ''}`);
                      }
                      if (exportOptions.includeVulnDevices) {
                        const deviceCount = vulnDevices.length;
                        if (deviceCount > 0) parts.push(`${deviceCount} device${deviceCount !== 1 ? 's' : ''}`);
                      }
                      if (exportOptions.includeVulnScanCache) {
                        const scanCount = Object.keys(vulnScanCache).length;
                        if (scanCount > 0) parts.push(`${scanCount} scan record${scanCount !== 1 ? 's' : ''}`);
                      }
                      return parts.length > 0 ? (
                        <p className="text-xs text-slate-500 mt-2">{parts.join(', ')}</p>
                      ) : null;
                    })()}
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-[13px] font-medium text-slate-400 mb-1.5">Password</label>
                    <input
                      type="password"
                      value={exportPassword}
                      onChange={(e) => { setExportPassword(e.target.value); }}
                      placeholder="Enter encryption password"
                      className={inputClasses}
                    />
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className="block text-[13px] font-medium text-slate-400 mb-1.5">Confirm Password</label>
                    <input
                      type="password"
                      value={exportPasswordConfirm}
                      onChange={(e) => { setExportPasswordConfirm(e.target.value); }}
                      placeholder="Re-enter password"
                      className={inputClasses}
                    />
                  </div>

                  {/* Error */}
                  {exportError && (
                    <div className="flex items-center gap-2 text-red-400 text-sm">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{exportError}</span>
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
                      type="button"
                      onClick={handleExport}
                      disabled={!canExport}
                      className="px-4 py-2 text-sm font-semibold bg-forge-amber text-forge-obsidian rounded-lg hover:bg-forge-amber-bright disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {exportLoading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Encrypting...
                        </>
                      ) : (
                        <>
                          <Download size={14} />
                          Export .stvault
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* ====================== IMPORT TAB ====================== */}
          {activeTab === 'import' && (
            <>
              {importSuccess ? (
                <div className="flex flex-col items-center py-6 gap-3">
                  <CheckCircle size={40} className="text-green-400" />
                  <p className="text-sm text-slate-200 font-medium">Import complete!</p>
                  <p className="text-xs text-slate-400">Your library has been updated.</p>
                  <button
                    onClick={onClose}
                    className="mt-2 px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 rounded-lg hover:bg-forge-graphite transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : showSummary && decryptedData ? (
                /* ---- Summary / Conflict view ---- */
                (() => {
                  const counts = countData(decryptedData);
                  const pluginNames = decryptedData.plugins ? Object.keys(decryptedData.plugins) : [];
                  const canConfirm = importStrategy === 'merge' || replaceConfirmed;
                  return (
                    <>
                      {/* Import Strategy */}
                      <div>
                        <label className="block text-[13px] font-medium text-slate-400 mb-2">Import Strategy</label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="importStrategy"
                              checked={importStrategy === 'merge'}
                              onChange={() => { setImportStrategy('merge'); setReplaceConfirmed(false); }}
                              className="accent-amber-500"
                            />
                            <span className="text-sm text-slate-200">Merge with existing</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="importStrategy"
                              checked={importStrategy === 'replace'}
                              onChange={() => { setImportStrategy('replace'); }}
                              className="accent-amber-500"
                            />
                            <span className="text-sm text-slate-200">Replace all (erase current data first)</span>
                          </label>
                        </div>
                      </div>

                      {/* Replace confirmation warning */}
                      {importStrategy === 'replace' && (
                        <div className="border border-red-500/50 bg-red-500/5 rounded-lg px-3 py-2">
                          <p className="text-sm text-red-400">This will erase all existing data before importing. This cannot be undone.</p>
                          <label className="flex items-center gap-2 mt-2 cursor-pointer">
                            <input type="checkbox" checked={replaceConfirmed} onChange={(e) => { setReplaceConfirmed(e.target.checked); }} className="accent-red-500" />
                            <span className="text-xs text-slate-300">I understand, proceed with replace</span>
                          </label>
                        </div>
                      )}

                      {/* Archive Contents */}
                      <div>
                        <h4 className="text-sm font-medium text-slate-200 mb-2">Archive Contents</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-forge-obsidian rounded-lg px-3 py-2">
                            <span className="text-slate-400">Views:</span>{' '}
                            <span className="text-slate-200 font-medium">{counts.views}</span>
                          </div>
                          <div className="bg-forge-obsidian rounded-lg px-3 py-2">
                            <span className="text-slate-400">Vendors:</span>{' '}
                            <span className="text-slate-200 font-medium">{counts.vendors}</span>
                          </div>
                          <div className="bg-forge-obsidian rounded-lg px-3 py-2">
                            <span className="text-slate-400">Models:</span>{' '}
                            <span className="text-slate-200 font-medium">{counts.models}</span>
                          </div>
                          <div className="bg-forge-obsidian rounded-lg px-3 py-2">
                            <span className="text-slate-400">Variants:</span>{' '}
                            <span className="text-slate-200 font-medium">{counts.variants}</span>
                          </div>
                          <div className="bg-forge-obsidian rounded-lg px-3 py-2">
                            <span className="text-slate-400">Templates:</span>{' '}
                            <span className="text-slate-200 font-medium">{counts.templates}</span>
                          </div>
                          {counts.generatedConfigs > 0 && (
                            <div className="bg-forge-obsidian rounded-lg px-3 py-2">
                              <span className="text-slate-400">Configs:</span>{' '}
                              <span className="text-slate-200 font-medium">{counts.generatedConfigs}</span>
                            </div>
                          )}
                          {counts.plugins > 0 && (
                            <div className="bg-forge-obsidian rounded-lg px-3 py-2">
                              <span className="text-slate-400">Plugins:</span>{' '}
                              <span className="text-slate-200 font-medium">{counts.plugins}</span>
                            </div>
                          )}
                          {counts.vulnDevices > 0 && (
                            <div className="bg-forge-obsidian rounded-lg px-3 py-2">
                              <span className="text-slate-400">Vuln Devices:</span>{' '}
                              <span className="text-slate-200 font-medium">{counts.vulnDevices}</span>
                            </div>
                          )}
                          {counts.scanEntries > 0 && (
                            <div className="bg-forge-obsidian rounded-lg px-3 py-2">
                              <span className="text-slate-400">Scan Entries:</span>{' '}
                              <span className="text-slate-200 font-medium">{counts.scanEntries}</span>
                            </div>
                          )}
                          {counts.hasPreferences && (
                            <div className="bg-forge-obsidian rounded-lg px-3 py-2">
                              <span className="text-slate-400">Preferences:</span>{' '}
                              <span className="text-slate-200 font-medium">Yes</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Import Categories */}
                      <div>
                        <label className="block text-[13px] font-medium text-slate-400 mb-2">Import Categories</label>
                        <div className="space-y-1.5">
                          {/* Views & Templates — always on */}
                          <label className="flex items-start gap-2">
                            <input type="checkbox" checked disabled className="accent-amber-500 mt-0.5" />
                            <span className="text-sm text-slate-400">Views & Templates</span>
                          </label>

                          {/* Generated Configs */}
                          {counts.generatedConfigs > 0 && (
                            <label className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!importCategories.generatedConfigs}
                                onChange={(e) => { setImportCategories((prev) => ({ ...prev, generatedConfigs: e.target.checked })); }}
                                className="accent-amber-500 mt-0.5"
                              />
                              <span className="text-sm text-slate-200">Generated Configs</span>
                            </label>
                          )}

                          {/* Plugin Settings */}
                          {counts.plugins > 0 && (
                            <label className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!importCategories.plugins}
                                onChange={(e) => { setImportCategories((prev) => ({ ...prev, plugins: e.target.checked })); }}
                                className="accent-amber-500 mt-0.5"
                              />
                              <span className="text-sm text-slate-200">Plugin Settings</span>
                            </label>
                          )}

                          {/* Vulnerability Devices */}
                          {counts.vulnDevices > 0 && (
                            <label className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!importCategories.vulnDevices}
                                onChange={(e) => { setImportCategories((prev) => ({ ...prev, vulnDevices: e.target.checked })); }}
                                className="accent-amber-500 mt-0.5"
                              />
                              <span className="text-sm text-slate-200">Vulnerability Devices</span>
                            </label>
                          )}

                          {/* Scan History */}
                          {counts.scanEntries > 0 && (
                            <label className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!importCategories.vulnScanCache}
                                onChange={(e) => { setImportCategories((prev) => ({ ...prev, vulnScanCache: e.target.checked })); }}
                                className="accent-amber-500 mt-0.5"
                              />
                              <span className="text-sm text-slate-200">Scan History</span>
                            </label>
                          )}

                          {/* Preferences */}
                          {counts.hasPreferences && (
                            <label className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!importCategories.preferences}
                                onChange={(e) => { setImportCategories((prev) => ({ ...prev, preferences: e.target.checked })); }}
                                className="accent-amber-500 mt-0.5"
                              />
                              <span className="text-sm text-slate-200">Preferences</span>
                            </label>
                          )}
                        </div>
                      </div>

                      {/* Re-setup notices */}
                      {counts.plugins > 0 && importCategories.plugins && (
                        <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                          <AlertCircle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm text-amber-300">Plugin re-setup required</p>
                            <p className="text-xs text-slate-400">{pluginNames.join(', ')} — credentials were stripped from the export. Re-configure after import.</p>
                          </div>
                        </div>
                      )}

                      {counts.vulnDevices > 0 && importCategories.vulnDevices && (
                        <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                          <AlertCircle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm text-amber-300">SNMP credentials need re-entry</p>
                            <p className="text-xs text-slate-400">{counts.vulnDevices} device{counts.vulnDevices !== 1 ? 's' : ''} — SNMP communities were stripped from the export.</p>
                          </div>
                        </div>
                      )}

                      {/* Conflicts */}
                      {conflicts.length > 0 && importStrategy === 'merge' && (
                        <div>
                          <h4 className="text-sm font-medium text-amber-400 mb-2">
                            <AlertCircle size={14} className="inline-block mr-1 -mt-0.5" />
                            {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''} found
                          </h4>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {conflicts.map((c, i) => (
                              <div
                                key={`${c.id}-${i}`}
                                className="flex items-center justify-between bg-forge-obsidian rounded-lg px-3 py-2"
                              >
                                <div className="text-sm">
                                  <span className="text-slate-400 text-xs">{c.type}:</span>{' '}
                                  <span className="text-slate-200">{c.name}</span>
                                </div>
                                <select
                                  value={c.resolution}
                                  onChange={(e) => {
                                    const updated = [...conflicts];
                                    updated[i] = { ...updated[i], resolution: e.target.value as ConflictResolution };
                                    setConflicts(updated);
                                  }}
                                  className="bg-forge-graphite border border-forge-steel rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-forge-amber/50"
                                >
                                  <option value="skip">Skip</option>
                                  <option value="overwrite">Overwrite</option>
                                  <option value="rename">Rename</option>
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Error */}
                      {importError && (
                        <div className="flex items-center gap-2 text-red-400 text-sm">
                          <AlertCircle size={14} className="shrink-0" />
                          <span>{importError}</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex justify-end gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowSummary(false);
                            setDecryptedData(null);
                            setConflicts([]);
                          }}
                          className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 rounded-lg hover:bg-forge-graphite transition-colors"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmImport}
                          disabled={!canConfirm}
                          className="px-4 py-2 text-sm font-semibold bg-forge-amber text-forge-obsidian rounded-lg hover:bg-forge-amber-bright disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                          <Upload size={14} />
                          Confirm Import
                        </button>
                      </div>
                    </>
                  );
                })()
              ) : (
                /* ---- File + password input ---- */
                <>
                  {/* Drop zone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                      dragOver
                        ? 'border-forge-amber bg-forge-amber/5'
                        : importFile
                          ? 'border-green-500/50 bg-green-500/5'
                          : 'border-forge-graphite hover:border-forge-steel'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".stvault"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                      }}
                    />
                    {importFile ? (
                      <div className="flex flex-col items-center gap-1">
                        <CheckCircle size={24} className="text-green-400" />
                        <p className="text-sm text-slate-200 font-medium">{importFile.name}</p>
                        <p className="text-xs text-slate-400">Click or drop to change file</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <Upload size={24} className="text-slate-500" />
                        <p className="text-sm text-slate-300">Drop .stvault file here</p>
                        <p className="text-xs text-slate-500">or click to browse</p>
                      </div>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-[13px] font-medium text-slate-400 mb-1.5">Password</label>
                    <input
                      type="password"
                      value={importPassword}
                      onChange={(e) => { setImportPassword(e.target.value); }}
                      placeholder="Enter vault password"
                      className={inputClasses}
                    />
                  </div>

                  {/* Error */}
                  {importError && (
                    <div className="flex items-center gap-2 text-red-400 text-sm">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{importError}</span>
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
                      type="button"
                      onClick={handleDecrypt}
                      disabled={!canDecrypt}
                      className="px-4 py-2 text-sm font-semibold bg-forge-amber text-forge-obsidian rounded-lg hover:bg-forge-amber-bright disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {importLoading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Decrypting...
                        </>
                      ) : (
                        <>
                          <Lock size={14} />
                          Decrypt & Preview
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
