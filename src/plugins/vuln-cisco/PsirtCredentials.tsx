import { useState, useEffect, useCallback, useRef } from 'react';
import { Shield, Download, Upload, Loader2, Search, X, Eye, EyeOff, Check } from 'lucide-react';
import { useForgeStore } from '../../store/index.ts';
import { INFISICAL_MANIFEST } from '../infisical/manifest.ts';
import { resolveInfisicalEnv } from '../../lib/infisical-env.ts';
import type { SecretEntry } from '../../types/secrets-provider.ts';

/**
 * PSIRT Credentials Section — Infisical-backed.
 *
 * Stores only the Infisical secret key names in plugin settings
 * (ciscoClientIdKey, ciscoClientSecretKey). Actual credential values
 * are never stored in localStorage — they are resolved from Infisical
 * at scan time.
 */
export default function PsirtCredentials({ pluginName }: { pluginName: string }) {
  const getPlugin = useForgeStore((s) => s.getPlugin);
  const updatePluginSettings = useForgeStore((s) => s.updatePluginSettings);
  const getSecretsProviders = useForgeStore((s) => s.getSecretsProviders);

  const registration = getPlugin(pluginName);
  const settings = registration?.settings ?? {};
  const clientIdKey = (settings.ciscoClientIdKey as string) || '';
  const clientSecretKey = (settings.ciscoClientSecretKey as string) || '';

  const providers = getSecretsProviders();
  const readableProvider = providers.find((p) => p.isConnected() && p.capabilities().read);
  const writableProvider = providers.find((p) => p.isConnected() && p.capabilities().write);
  const hasProvider = !!readableProvider;

  // Track which field is picking from Infisical
  const [pickingField, setPickingField] = useState<'clientId' | 'clientSecret' | null>(null);

  // Manual entry state (for Save to Infisical flow)
  const [manualClientId, setManualClientId] = useState('');
  const [manualClientSecret, setManualClientSecret] = useState('');
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handlePickSecret = useCallback(
    (field: 'clientId' | 'clientSecret', key: string) => {
      if (field === 'clientId') {
        updatePluginSettings(pluginName, { ciscoClientIdKey: key });
      } else {
        updatePluginSettings(pluginName, { ciscoClientSecretKey: key });
      }
      setPickingField(null);
    },
    [pluginName, updatePluginSettings],
  );

  const handleSaveToInfisical = useCallback(
    async (field: 'clientId' | 'clientSecret') => {
      if (!writableProvider?.setSecret) return;

      const value = field === 'clientId' ? manualClientId : manualClientSecret;
      if (!value.trim()) return;

      const infisicalPlugin = getPlugin(INFISICAL_MANIFEST.name);
      const projectId = infisicalPlugin?.settings?.defaultProjectId as string | undefined;
      const env = resolveInfisicalEnv(pluginName, getPlugin);
      if (!projectId) {
        setSaveError('No default project configured in Infisical plugin settings.');
        return;
      }

      const defaultKey = field === 'clientId' ? 'CISCO_OPENVULN_ID' : 'CISCO_OPENVULN_SECRET';
      const keyName = prompt(`Enter a key name for this credential:`, defaultKey);
      if (!keyName?.trim()) return;

      setSaving(field);
      setSaveError(null);
      try {
        await writableProvider.setSecret(projectId, env, keyName.trim(), value.trim());
        updatePluginSettings(pluginName, {
          [field === 'clientId' ? 'ciscoClientIdKey' : 'ciscoClientSecretKey']: keyName.trim(),
        });
        if (field === 'clientId') setManualClientId('');
        else setManualClientSecret('');
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to save to Infisical');
      } finally {
        setSaving(null);
      }
    },
    [writableProvider, manualClientId, manualClientSecret, getPlugin, pluginName, updatePluginSettings],
  );

  const handleClearKey = useCallback(
    (field: 'clientId' | 'clientSecret') => {
      updatePluginSettings(pluginName, {
        [field === 'clientId' ? 'ciscoClientIdKey' : 'ciscoClientSecretKey']: '',
      });
    },
    [pluginName, updatePluginSettings],
  );

  if (!hasProvider) {
    return (
      <div className="mt-4">
        <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-3 font-semibold">
          Cisco PSIRT API Credentials
        </h3>
        <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-xs text-amber-400">
            Connect the Infisical plugin first to manage PSIRT API credentials securely.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-3 font-semibold">
        Cisco PSIRT API Credentials
      </h3>
      <div className="px-4 py-3 mb-4 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
        <p className="text-[12px] text-cyan-400 font-medium mb-1">Where to get these credentials</p>
        <ol className="text-[11px] text-slate-400 leading-relaxed space-y-1 list-decimal list-inside">
          <li>
            Go to <span className="text-cyan-400 font-mono text-[10px]">apiconsole.cisco.com</span> and sign in with
            your Cisco CCO account
          </li>
          <li>
            Register a new app under <span className="text-cyan-400">My Apps &amp; Keys</span>
          </li>
          <li>
            Select the <span className="text-cyan-400">Cisco PSIRT openVuln API</span> and request access
          </li>
          <li>
            Copy the <span className="text-slate-200">Client ID</span> and{' '}
            <span className="text-slate-200">Client Secret</span> from your registered app
          </li>
        </ol>
        <p className="text-[11px] text-slate-500 mt-2">
          Credentials are stored in Infisical — never in the browser. Only the key name is saved locally.
        </p>
      </div>

      <div className="space-y-4">
        {/* Client ID */}
        <CredentialField
          label="Client ID"
          description="OAuth2 Client ID from the Cisco API Console"
          linkedKey={clientIdKey}
          manualValue={manualClientId}
          onManualChange={setManualClientId}
          showValue={true}
          onToggleShow={() => {
            /* Client ID visibility is always on */
          }}
          onRetrieve={() => {
            setPickingField('clientId');
          }}
          onSave={() => void handleSaveToInfisical('clientId')}
          onClear={() => {
            handleClearKey('clientId');
          }}
          saving={saving === 'clientId'}
          canWrite={!!writableProvider}
        />

        {/* Client Secret */}
        <CredentialField
          label="Client Secret"
          description="OAuth2 Client Secret for the openVuln API"
          linkedKey={clientSecretKey}
          manualValue={manualClientSecret}
          onManualChange={setManualClientSecret}
          showValue={showClientSecret}
          onToggleShow={() => {
            setShowClientSecret(!showClientSecret);
          }}
          onRetrieve={() => {
            setPickingField('clientSecret');
          }}
          onSave={() => void handleSaveToInfisical('clientSecret')}
          onClear={() => {
            handleClearKey('clientSecret');
          }}
          saving={saving === 'clientSecret'}
          canWrite={!!writableProvider}
          isSecret
        />
      </div>

      {saveError && <p className="text-[11px] text-red-400 mt-2">{saveError}</p>}

      {/* Secret Picker Modal */}
      {pickingField && readableProvider && (
        <SecretPickerModal
          provider={readableProvider}
          pluginName={pluginName}
          onPick={(key) => {
            handlePickSecret(pickingField, key);
          }}
          onClose={() => {
            setPickingField(null);
          }}
        />
      )}
    </div>
  );
}

// --- Credential Field ---

function CredentialField({
  label,
  description,
  linkedKey,
  manualValue,
  onManualChange,
  showValue,
  onToggleShow,
  onRetrieve,
  onSave,
  onClear,
  saving,
  canWrite,
  isSecret = false,
}: {
  label: string;
  description: string;
  linkedKey: string;
  manualValue: string;
  onManualChange: (_v: string) => void;
  showValue: boolean;
  onToggleShow: () => void;
  onRetrieve: () => void;
  onSave: () => void;
  onClear: () => void;
  saving: boolean;
  canWrite: boolean;
  isSecret?: boolean;
}) {
  return (
    <div className="border border-forge-graphite rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-[12px] font-medium text-slate-300">{label}</span>
          <span className="text-red-400 ml-0.5">*</span>
        </div>
        {linkedKey && (
          <div className="flex items-center gap-1.5">
            <Check size={12} className="text-green-400" />
            <span className="text-[11px] text-green-400">Linked</span>
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-500 mb-3">{description}</p>

      {linkedKey ? (
        // Linked to Infisical — show key name
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-forge-obsidian border border-forge-graphite rounded-lg">
            <Shield size={14} className="text-forge-amber shrink-0" />
            <span className="font-mono text-[13px] text-slate-200 truncate flex-1">{linkedKey}</span>
            <span className="text-[11px] text-slate-500 shrink-0">{'••••••••'}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRetrieve}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-slate-300 border border-forge-steel rounded-md hover:border-forge-amber/40 hover:text-forge-amber transition-colors"
            >
              <Download size={12} />
              Change Key
            </button>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-slate-500 border border-forge-steel rounded-md hover:border-red-500/40 hover:text-red-400 transition-colors"
            >
              Unlink
            </button>
          </div>
        </div>
      ) : (
        // Not linked — show manual entry + buttons
        <div className="space-y-2">
          <div className="relative">
            <input
              type={isSecret && !showValue ? 'password' : 'text'}
              value={manualValue}
              onChange={(e) => {
                onManualChange(e.target.value);
              }}
              placeholder={`Enter ${label.toLowerCase()} or retrieve from Infisical...`}
              className="w-full px-3 py-2 pr-10 bg-forge-obsidian border border-forge-graphite rounded-lg font-mono text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-forge-amber/50 focus:ring-1 focus:ring-forge-amber/25 transition-colors"
            />
            {isSecret && (
              <button
                type="button"
                onClick={onToggleShow}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showValue ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRetrieve}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-slate-300 border border-forge-steel rounded-md hover:border-forge-amber/40 hover:text-forge-amber transition-colors"
            >
              <Download size={12} />
              Retrieve from Infisical
            </button>
            {canWrite && manualValue.trim() && (
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-slate-300 border border-forge-steel rounded-md hover:border-forge-amber/40 hover:text-forge-amber transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                Save to Infisical
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Secret Picker Modal ---

function SecretPickerModal({
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [onClose]);

  const filtered = filter ? secrets.filter((s) => s.key.toLowerCase().includes(filter.toLowerCase())) : secrets;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
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
                  <Download size={14} className="text-slate-500 shrink-0 ml-3" />
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
