import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { X, Eye, EyeOff, Server, KeyRound, Download, Upload, Loader2, Shield, Search } from 'lucide-react';
import { useForgeStore } from '../../store/index.ts';
import type { SecretEntry } from '../../types/secrets-provider.ts';
import type { VulnDevice } from './types.ts';
import { INFISICAL_MANIFEST } from '../infisical/manifest.ts';
import { resolveInfisicalEnv } from '../../lib/infisical-env.ts';

interface DeviceModalProps {
  open: boolean;
  device: VulnDevice | null;
  pluginName: string;
  onSave: (_device: Omit<VulnDevice, 'viewId'>) => void;
  onClose: () => void;
}

export default function DeviceModal({ open, device, pluginName, onSave, onClose }: DeviceModalProps) {
  const [hostname, setHostname] = useState('');
  const [ip, setIp] = useState('');
  const [snmpCommunity, setSnmpCommunity] = useState('');
  const [showSnmp, setShowSnmp] = useState(false);
  const [snmpSource, setSnmpSource] = useState<'manual' | 'infisical'>('manual');
  const [selectedSecretKey, setSelectedSecretKey] = useState('');

  // Infisical secret picker state
  const [showSecretPicker, setShowSecretPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hostnameRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const getSecretsProviders = useForgeStore((s) => s.getSecretsProviders);
  const getPlugin = useForgeStore((s) => s.getPlugin);

  const providers = getSecretsProviders();
  const readableProvider = providers.find((p) => p.isConnected() && p.capabilities().read);
  const writableProvider = providers.find((p) => p.isConnected() && p.capabilities().write);

  const isEditing = device !== null;

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setHostname(device?.hostname ?? '');
      setIp(device?.ip ?? '');
      setSnmpCommunity(device?.snmpCommunity ?? '');
      setShowSnmp(false);
      setSnmpSource(device?.snmpSecretKey ? 'infisical' : 'manual');
      setSelectedSecretKey(device?.snmpSecretKey ?? '');
      setShowSecretPicker(false);
      setSaveError(null);
      setTimeout(() => hostnameRef.current?.focus(), 50);
    }
  }, [open, device]);

  // Save SNMP community to Infisical
  const handleSaveToInfisical = useCallback(async () => {
    if (!writableProvider?.setSecret || !snmpCommunity.trim()) return;

    const infisicalPlugin = getPlugin(INFISICAL_MANIFEST.name);
    const projectId = infisicalPlugin?.settings?.defaultProjectId as string | undefined;
    const env = resolveInfisicalEnv(pluginName, getPlugin);
    if (!projectId) {
      setSaveError('No default project configured in Infisical plugin settings.');
      return;
    }

    const keyName = prompt(
      'Enter a key name for this SNMP credential:',
      `FORGE_SNMP_${hostname.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`,
    );
    if (!keyName?.trim()) return;

    setSaving(true);
    setSaveError(null);
    try {
      await writableProvider.setSecret(projectId, env, keyName.trim(), snmpCommunity);
      setSelectedSecretKey(keyName.trim());
      setSnmpSource('infisical');
      setSnmpCommunity('');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save to Infisical');
    } finally {
      setSaving(false);
    }
  }, [writableProvider, snmpCommunity, hostname, getPlugin]);

  // Handle picking a secret from Infisical
  const handlePickSecret = useCallback(
    async (key: string) => {
      setSelectedSecretKey(key);
      setSnmpSource('infisical');
      setShowSecretPicker(false);

      // Fetch the value to populate the field (masked)
      if (!readableProvider) return;
      const infisicalPlugin = getPlugin(INFISICAL_MANIFEST.name);
      const projectId = infisicalPlugin?.settings?.defaultProjectId as string | undefined;
      const env = resolveInfisicalEnv(pluginName, getPlugin);
      if (!projectId) return;

      try {
        const value = await readableProvider.getSecret(projectId, env, key);
        if (value) setSnmpCommunity(value);
      } catch {
        /* failed — user can type manually */
      }
    },
    [readableProvider, getPlugin],
  );

  // ESC key handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSecretPicker) {
          setShowSecretPicker(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [open, onClose, showSecretPicker]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!hostname.trim() || !ip.trim()) return;

    onSave({
      id: device?.id ?? crypto.randomUUID(),
      hostname: hostname.trim(),
      ip: ip.trim(),
      snmpCommunity: snmpSource === 'manual' ? snmpCommunity || undefined : undefined,
      snmpSecretKey: snmpSource === 'infisical' ? selectedSecretKey || undefined : undefined,
      lastScanAt: device?.lastScanAt,
      lastSeverity: device?.lastSeverity,
    });
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
          <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
            <Server size={18} className="text-forge-amber" />
            {isEditing ? 'Edit Device' : 'Add Device'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-forge-graphite transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Hostname */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Hostname
            </label>
            <input
              ref={hostnameRef}
              type="text"
              value={hostname}
              onChange={(e) => {
                setHostname(e.target.value);
              }}
              placeholder="e.g. SW-CORE-01"
              className="w-full px-3 py-2 bg-forge-obsidian border border-forge-graphite rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-forge-amber/50 focus:ring-1 focus:ring-forge-amber/25 transition-colors"
            />
            <p className="text-[11px] text-slate-500 mt-1">A friendly name for this device</p>
          </div>

          {/* IP Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              IP Address
            </label>
            <input
              type="text"
              value={ip}
              onChange={(e) => {
                setIp(e.target.value);
              }}
              placeholder="e.g. 192.168.1.253"
              className="w-full px-3 py-2 bg-forge-obsidian border border-forge-graphite rounded-lg font-mono text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-forge-amber/50 focus:ring-1 focus:ring-forge-amber/25 transition-colors"
            />
            <p className="text-[11px] text-slate-500 mt-1">IPv4 address reachable via SNMP</p>
          </div>

          {/* SNMP Credentials Section */}
          <div className="border border-forge-graphite rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <KeyRound size={12} />
                SNMP Community
              </label>
              {readableProvider && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSnmpSource('manual');
                    }}
                    className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded transition-colors ${
                      snmpSource === 'manual'
                        ? 'bg-forge-amber/20 text-forge-amber'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Manual
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSnmpSource('infisical');
                    }}
                    className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded transition-colors flex items-center gap-1 ${
                      snmpSource === 'infisical'
                        ? 'bg-forge-amber/20 text-forge-amber'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Shield size={10} />
                    Infisical
                  </button>
                </div>
              )}
            </div>

            {snmpSource === 'manual' || !readableProvider ? (
              <>
                <div className="relative">
                  <input
                    type={showSnmp ? 'text' : 'password'}
                    value={snmpCommunity}
                    onChange={(e) => {
                      setSnmpCommunity(e.target.value);
                    }}
                    placeholder="e.g. public"
                    className="w-full px-3 py-2 pr-10 bg-forge-obsidian border border-forge-graphite rounded-lg font-mono text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-forge-amber/50 focus:ring-1 focus:ring-forge-amber/25 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowSnmp(!showSnmp);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors"
                    title={showSnmp ? 'Hide' : 'Show'}
                  >
                    {showSnmp ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Save to Infisical button */}
                {writableProvider && snmpCommunity.trim() && (
                  <button
                    type="button"
                    onClick={() => void handleSaveToInfisical()}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-slate-300 border border-forge-steel rounded-md hover:border-forge-amber/40 hover:text-forge-amber transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    Save to Infisical
                  </button>
                )}
              </>
            ) : (
              <>
                {/* Currently selected secret key */}
                {selectedSecretKey && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-forge-obsidian border border-forge-graphite rounded-lg">
                    <Shield size={14} className="text-forge-amber shrink-0" />
                    <span className="font-mono text-[13px] text-slate-200 truncate">{selectedSecretKey}</span>
                    <span className="text-[11px] text-slate-500 shrink-0">{'••••••••'}</span>
                  </div>
                )}

                {/* Retrieve from Infisical button */}
                <button
                  type="button"
                  onClick={() => {
                    setShowSecretPicker(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-slate-300 border border-forge-steel rounded-md hover:border-forge-amber/40 hover:text-forge-amber transition-colors"
                >
                  <Download size={12} />
                  {selectedSecretKey ? 'Change Secret' : 'Retrieve from Infisical'}
                </button>

                {!selectedSecretKey && (
                  <p className="text-[11px] text-slate-500">Pick a secret key from your Infisical vault</p>
                )}
              </>
            )}

            {saveError && <p className="text-[11px] text-red-400">{saveError}</p>}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 rounded-lg hover:bg-forge-graphite transition-colors border border-forge-graphite"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!hostname.trim() || !ip.trim()}
              className="px-4 py-2 text-sm font-semibold bg-forge-amber text-forge-obsidian rounded-lg hover:bg-forge-amber-bright disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isEditing ? 'Save Changes' : 'Add Device'}
            </button>
          </div>
        </form>
      </div>

      {/* Infisical Secret Picker Modal */}
      {showSecretPicker && readableProvider && (
        <SecretPickerOverlay
          provider={readableProvider}
          pluginName={pluginName}
          onPick={handlePickSecret}
          onClose={() => {
            setShowSecretPicker(false);
          }}
        />
      )}
    </div>
  );
}

// ========================
// Inline Secret Picker (mirrors ImportSecretPicker pattern)
// ========================

function SecretPickerOverlay({
  provider,
  pluginName,
  onPick,
  onClose,
}: {
  provider: { listSecrets: (_projectId: string, _env: string) => Promise<SecretEntry[]>; name: string };
  pluginName: string;
  onPick: (_key: string) => void;
  onClose: () => void;
}) {
  const getPlugin = useForgeStore((s) => s.getPlugin);
  const infisicalPlugin = getPlugin(INFISICAL_MANIFEST.name);
  const settings = (infisicalPlugin?.settings ?? {}) as Record<string, string>;
  const projectId = settings.defaultProjectId || '';
  const environment = resolveInfisicalEnv(pluginName, getPlugin);

  const [secrets, setSecrets] = useState<SecretEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
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
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load secrets');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [provider, projectId, environment]);

  useEffect(() => {
    setTimeout(() => filterRef.current?.focus(), 50);
  }, []);

  const filtered = filter ? secrets.filter((s) => s.key.toLowerCase().includes(filter.toLowerCase())) : secrets;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-forge-charcoal border border-forge-steel rounded-xl shadow-2xl flex flex-col max-h-[70vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-forge-graphite">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Shield size={16} className="text-forge-amber" />
            Retrieve from Infisical
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-forge-graphite/50">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              ref={filterRef}
              type="text"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
              }}
              placeholder="Filter secrets..."
              className="w-full pl-9 pr-3 py-2 bg-forge-obsidian border border-forge-graphite rounded-lg text-[13px] text-slate-200 outline-none focus:border-forge-amber/50 placeholder:text-slate-600 transition-colors"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2">
              <Loader2 size={18} className="animate-spin text-forge-amber" />
              <span className="text-sm text-slate-500">Loading secrets...</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <p className="text-sm text-slate-400">{error}</p>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-slate-500">
                {secrets.length === 0 ? 'No secrets found.' : 'No secrets match your filter.'}
              </p>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="space-y-1">
              {filtered.map((secret) => (
                <button
                  key={secret.id}
                  onClick={() => {
                    onPick(secret.key);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors bg-forge-obsidian border border-forge-graphite hover:border-forge-amber/40 hover:bg-forge-charcoal cursor-pointer"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-mono text-[13px] text-slate-200 truncate">{secret.key}</span>
                    {secret.comment && (
                      <span className="text-[11px] text-slate-500 truncate mt-0.5">{secret.comment}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className="text-[11px] text-slate-500">{'••••••••'}</span>
                    <Download size={14} className="text-slate-500" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-forge-graphite/50 text-[11px] text-slate-500">
          {secrets.length > 0 &&
            `${secrets.length} secret${secrets.length === 1 ? '' : 's'} — keys only, values masked`}
        </div>
      </div>
    </div>
  );
}
