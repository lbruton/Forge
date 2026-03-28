import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Search, Shield, Download, Loader2, AlertTriangle } from 'lucide-react';
import type { SecretsProvider, SecretEntry } from '../types/secrets-provider.ts';

interface ImportSecretPickerProps {
  provider: SecretsProvider;
  projectId: string;
  environment: string;
  existingNames: Set<string>;
  onImport: (key: string, value: string) => void;
  onClose: () => void;
}

export function ImportSecretPicker({
  provider,
  projectId,
  environment,
  existingNames,
  onImport,
  onClose,
}: ImportSecretPickerProps) {
  const [secrets, setSecrets] = useState<SecretEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    provider
      .listSecrets(projectId, environment)
      .then((entries) => {
        if (!cancelled) setSecrets(entries);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load secrets');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [provider, projectId, environment]);

  useEffect(() => {
    setTimeout(() => filterRef.current?.focus(), 50);
  }, []);

  const handleImport = useCallback(
    async (key: string) => {
      setImporting(key);
      try {
        const value = await provider.getSecret(projectId, environment, key);
        onImport(key, value);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch secret value');
        setImporting(null);
      }
    },
    [provider, projectId, environment, onImport],
  );

  const filtered = filter
    ? secrets.filter((s) => s.key.toLowerCase().includes(filter.toLowerCase()))
    : secrets;

  const alreadyImported = (key: string) => existingNames.has(key.toLowerCase());

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="w-full max-w-lg bg-slate-800 border border-slate-700 rounded-xl shadow-2xl flex flex-col max-h-[70vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Shield size={16} className="text-amber-500" />
            Import from Infisical
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-700/30">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              ref={filterRef}
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter secrets..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/50 rounded-lg text-[13px] text-slate-200 outline-none focus:border-amber-500/50 placeholder:text-slate-600 transition-colors"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2">
              <Loader2 size={18} className="animate-spin text-amber-500" />
              <span className="text-sm text-slate-500">Loading secrets...</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertTriangle size={24} className="text-red-400" />
              <p className="text-sm text-slate-400">{error}</p>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-slate-500">
                {secrets.length === 0
                  ? 'No secrets found in this project/environment.'
                  : 'No secrets match your filter.'}
              </p>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="space-y-1">
              {filtered.map((secret) => {
                const imported = alreadyImported(secret.key);
                const isImporting = importing === secret.key;

                return (
                  <button
                    key={secret.id}
                    onClick={() => !imported && !isImporting && handleImport(secret.key)}
                    disabled={imported || isImporting}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                      imported
                        ? 'bg-slate-800/50 opacity-50 cursor-not-allowed'
                        : isImporting
                          ? 'bg-amber-500/10 border border-amber-500/20 cursor-wait'
                          : 'bg-slate-900 border border-slate-700/50 hover:border-amber-500/40 hover:bg-slate-800 cursor-pointer'
                    }`}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-mono text-[13px] text-slate-200 truncate">
                        {secret.key}
                      </span>
                      {secret.comment && (
                        <span className="text-[11px] text-slate-500 truncate mt-0.5">
                          {secret.comment}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      {imported && (
                        <span className="text-[11px] text-slate-500">Already imported</span>
                      )}
                      {isImporting && (
                        <Loader2 size={14} className="animate-spin text-amber-500" />
                      )}
                      {!imported && !isImporting && (
                        <Download size={14} className="text-slate-500" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-700/30 text-[11px] text-slate-500">
          {secrets.length > 0 && `${secrets.length} secret${secrets.length === 1 ? '' : 's'} in ${environment}`}
        </div>
      </div>
    </div>
  );
}
