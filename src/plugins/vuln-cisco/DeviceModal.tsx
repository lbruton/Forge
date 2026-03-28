import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { X, Eye, EyeOff, Server, KeyRound, Loader2 } from 'lucide-react';
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

  const hostnameRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const getSecretsProviders = useForgeStore((s) => s.getSecretsProviders);
  const getPlugin = useForgeStore((s) => s.getPlugin);
  const providers = getSecretsProviders();
  const hasSecretsProvider = providers.length > 0;
  const [infisicalSecrets, setInfisicalSecrets] = useState<SecretEntry[]>([]);
  const [loadingSecrets, setLoadingSecrets] = useState(false);

  const isEditing = device !== null;

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setHostname(device?.hostname ?? '');
      setIp(device?.ip ?? '');
      setSnmpCommunity(device?.snmpCommunity ?? '');
      setShowSnmp(false);
      setTimeout(() => hostnameRef.current?.focus(), 50);
    }
  }, [open, device]);

  // Load Infisical secrets list when modal opens (for the selector)
  useEffect(() => {
    if (!open || !hasSecretsProvider) return;
    const infisicalPlugin = getPlugin('forge-infisical');
    const projectId = infisicalPlugin?.settings?.defaultProjectId as string | undefined;
    const env = (infisicalPlugin?.settings?.defaultEnvironment as string) || 'dev';
    if (!projectId) return;

    setLoadingSecrets(true);
    const provider = providers[0];
    void provider
      .listSecrets(projectId, env)
      .then((secrets) => setInfisicalSecrets(secrets))
      .catch(() => setInfisicalSecrets([]))
      .finally(() => setLoadingSecrets(false));
  }, [open, hasSecretsProvider, providers, getPlugin]);

  // When user selects a secret from the dropdown, fetch its value
  const selectSecret = useCallback(
    async (secretKey: string) => {
      if (!hasSecretsProvider) return;
      const infisicalPlugin = getPlugin('forge-infisical');
      const projectId = infisicalPlugin?.settings?.defaultProjectId as string | undefined;
      const env = (infisicalPlugin?.settings?.defaultEnvironment as string) || 'dev';
      if (!projectId) return;

      const provider = providers[0];
      try {
        const value = await provider.getSecret(projectId, env, secretKey);
        if (value) setSnmpCommunity(value);
      } catch {
        /* failed to fetch secret value */
      }
    },
    [hasSecretsProvider, providers, getPlugin],
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
        <div className="flex items-center justify-between px-6 py-5 border-b border-forge-graphite">
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
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
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
              className="w-full px-3 py-2 bg-forge-obsidian border border-forge-graphite rounded-md font-mono text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-forge-amber/50 focus:ring-1 focus:ring-forge-amber/25 transition-colors"
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
              className="w-full px-3 py-2 bg-forge-obsidian border border-forge-graphite rounded-md font-mono text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-forge-amber/50 focus:ring-1 focus:ring-forge-amber/25 transition-colors"
            />
            <p className="text-[11px] text-slate-500 mt-1">IPv4 address reachable via SNMP</p>
          </div>

          {/* SNMP Community */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              SNMP Community
            </label>
            <div className="relative">
              <input
                type={showSnmp ? 'text' : 'password'}
                value={snmpCommunity}
                onChange={(e) => setSnmpCommunity(e.target.value)}
                placeholder="e.g. public"
                className="w-full px-3 py-2 pr-10 bg-forge-obsidian border border-forge-graphite rounded-md font-mono text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-forge-amber/50 focus:ring-1 focus:ring-forge-amber/25 transition-colors"
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
            <p className="text-[11px] text-slate-500 mt-1">SNMP v2c community string for device polling</p>
          </div>

          {/* Infisical secret selector */}
          {hasSecretsProvider && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                <KeyRound size={12} className="inline mr-1" />
                Fill from Infisical
              </label>
              {loadingSecrets ? (
                <div className="flex items-center gap-2 text-[12px] text-slate-500">
                  <Loader2 size={12} className="animate-spin" /> Loading secrets...
                </div>
              ) : infisicalSecrets.length > 0 ? (
                <select
                  onChange={(e) => {
                    if (e.target.value) void selectSecret(e.target.value);
                  }}
                  defaultValue=""
                  className="w-full px-3 py-2 bg-forge-obsidian border border-forge-graphite rounded-md text-sm text-slate-200 focus:outline-none focus:border-forge-amber/50 focus:ring-1 focus:ring-forge-amber/25 transition-colors cursor-pointer"
                >
                  <option value="" disabled>
                    Select a secret to use as SNMP community...
                  </option>
                  {infisicalSecrets
                    .filter(
                      (s) =>
                        s.key.toLowerCase().includes('snmp') ||
                        s.key.toLowerCase().includes('community') ||
                        s.key.toLowerCase().includes('auth'),
                    )
                    .map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.key}
                      </option>
                    ))}
                  <option disabled>{'--- All secrets ---'}</option>
                  {infisicalSecrets.map((s) => (
                    <option key={`all-${s.key}`} value={s.key}>
                      {s.key}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-[12px] text-slate-500">No secrets available in Infisical</p>
              )}
            </div>
          )}

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
