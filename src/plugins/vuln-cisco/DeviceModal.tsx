import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { X, Eye, EyeOff, Server, KeyRound } from 'lucide-react';
import { useForgeStore } from '../../store/index.ts';
import type { SecretEntry } from '../../types/secrets-provider.ts';
import type { VulnDevice } from './types.ts';

interface DeviceModalProps {
  open: boolean;
  device: VulnDevice | null;
  onSave: (device: VulnDevice) => void;
  onClose: () => void;
}

export default function DeviceModal({ open, device, onSave, onClose }: DeviceModalProps) {
  const [hostname, setHostname] = useState('');
  const [ip, setIp] = useState('');
  const [snmpCommunity, setSnmpCommunity] = useState('');
  const [showSnmp, setShowSnmp] = useState(false);
  const [snmpSource, setSnmpSource] = useState<'manual' | 'infisical'>('manual');
  const [selectedSecretKey, setSelectedSecretKey] = useState('');

  // Infisical secret picker state
  const [secrets, setSecrets] = useState<SecretEntry[]>([]);
  const [secretsLoading, setSecretsLoading] = useState(false);

  const hostnameRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const getSecretsProviders = useForgeStore((s) => s.getSecretsProviders);
  const getPlugin = useForgeStore((s) => s.getPlugin);

  const providers = getSecretsProviders();
  const hasProvider = providers.length > 0 && providers[0].isConnected();

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
      setTimeout(() => hostnameRef.current?.focus(), 50);
    }
  }, [open, device]);

  // Load Infisical secret keys when modal opens and provider is available
  useEffect(() => {
    if (!open || !hasProvider) return;

    const infisicalPlugin = getPlugin('forge-infisical');
    const projectId = infisicalPlugin?.settings?.defaultProjectId as string | undefined;
    const env = (infisicalPlugin?.settings?.defaultEnvironment as string) || 'dev';
    if (!projectId) return;

    setSecretsLoading(true);
    const provider = providers[0];
    void provider
      .listSecrets(projectId, env)
      .then((entries) => setSecrets(entries))
      .catch(() => setSecrets([]))
      .finally(() => setSecretsLoading(false));
  }, [open, hasProvider, providers, getPlugin]);

  // When user picks a secret, fetch its value for the scan
  const handleSecretSelect = useCallback(
    async (key: string) => {
      if (!key || !hasProvider) return;
      setSelectedSecretKey(key);

      const infisicalPlugin = getPlugin('forge-infisical');
      const projectId = infisicalPlugin?.settings?.defaultProjectId as string | undefined;
      const env = (infisicalPlugin?.settings?.defaultEnvironment as string) || 'dev';
      if (!projectId) return;

      try {
        const value = await providers[0].getSecret(projectId, env, key);
        if (value) setSnmpCommunity(value);
      } catch {
        /* failed — user can type manually */
      }
    },
    [hasProvider, providers, getPlugin],
  );

  // ESC key handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!hostname.trim() || !ip.trim()) return;

    onSave({
      id: device?.id ?? crypto.randomUUID(),
      hostname: hostname.trim(),
      ip: ip.trim(),
      snmpCommunity: snmpCommunity || undefined,
      snmpSecretKey: snmpSource === 'infisical' ? selectedSecretKey : undefined,
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
              onChange={(e) => setHostname(e.target.value)}
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
              onChange={(e) => setIp(e.target.value)}
              placeholder="e.g. 192.168.1.253"
              className="w-full px-3 py-2 bg-forge-obsidian border border-forge-graphite rounded-lg font-mono text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-forge-amber/50 focus:ring-1 focus:ring-forge-amber/25 transition-colors"
            />
            <p className="text-[11px] text-slate-500 mt-1">IPv4 address reachable via SNMP</p>
          </div>

          {/* SNMP Community — source toggle */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">
                SNMP Community
              </label>
              {hasProvider && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setSnmpSource('manual')}
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
                    onClick={() => setSnmpSource('infisical')}
                    className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded transition-colors flex items-center gap-1 ${
                      snmpSource === 'infisical'
                        ? 'bg-forge-amber/20 text-forge-amber'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <KeyRound size={10} />
                    Infisical
                  </button>
                </div>
              )}
            </div>

            {snmpSource === 'manual' || !hasProvider ? (
              <>
                <div className="relative">
                  <input
                    type={showSnmp ? 'text' : 'password'}
                    value={snmpCommunity}
                    onChange={(e) => setSnmpCommunity(e.target.value)}
                    placeholder="e.g. public"
                    className="w-full px-3 py-2 pr-10 bg-forge-obsidian border border-forge-graphite rounded-lg font-mono text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-forge-amber/50 focus:ring-1 focus:ring-forge-amber/25 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSnmp(!showSnmp)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors"
                    title={showSnmp ? 'Hide' : 'Show'}
                  >
                    {showSnmp ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Type the SNMP v2c community string</p>
              </>
            ) : (
              <>
                <select
                  value={selectedSecretKey}
                  onChange={(e) => void handleSecretSelect(e.target.value)}
                  disabled={secretsLoading}
                  className="w-full px-3 py-2 bg-forge-obsidian border border-forge-graphite rounded-lg text-sm text-slate-200 focus:outline-none focus:border-forge-amber/50 focus:ring-1 focus:ring-forge-amber/25 transition-colors cursor-pointer"
                >
                  <option value="">{secretsLoading ? 'Loading secrets...' : 'Select a secret key...'}</option>
                  {secrets.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.key}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {selectedSecretKey
                    ? `Using secret: ${selectedSecretKey}`
                    : 'Pick a secret key from your Infisical vault'}
                </p>
              </>
            )}
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
    </div>
  );
}
