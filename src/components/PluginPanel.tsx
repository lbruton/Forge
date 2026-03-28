import { useState, useCallback } from 'react';
import { useForgeStore } from '../store/index.ts';
import { fetchManifest, healthCheck } from '../lib/plugin-service.ts';
import type { PluginRegistration, SettingsField } from '../types/plugin.ts';
import SetupWizard from '../plugins/infisical/SetupWizard.tsx';
import { ArrowLeft, Eye, EyeOff, Loader2, Plus, Puzzle, RefreshCw, Settings, Trash2 } from 'lucide-react';

interface PluginPanelProps {
  viewId?: string;
  pluginName: string | null;
  autoAdd?: boolean;
}

// Shared input classes matching GlobalVariablesPage style
const INPUT_CLASSES =
  'w-full px-2.5 py-1.5 bg-forge-obsidian border border-forge-steel rounded text-[13px] text-slate-200 outline-none focus:border-forge-amber focus:shadow-[0_0_0_2px_rgba(245,158,11,0.15)] transition-colors';

function StatusDot({ status }: { status: 'active' | 'inactive' | 'unknown' }) {
  const colorClass = status === 'active' ? 'bg-green-500' : status === 'inactive' ? 'bg-red-500' : 'bg-slate-500';
  return <span className={`inline-block w-2 h-2 rounded-full ${colorClass}`} />;
}

function formatTimestamp(iso: string): string {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

// --- Add Plugin Form ---

function AddPluginForm({ onDone }: { onDone: () => void }) {
  const registerPlugin = useForgeStore((s) => s.registerPlugin);
  const setPluginHealth = useForgeStore((s) => s.setPluginHealth);

  const [endpoint, setEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    if (!endpoint.trim()) {
      setError('Endpoint URL is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const manifest = await fetchManifest(endpoint.trim(), apiKey);
      registerPlugin(manifest, endpoint.trim(), apiKey);
      const health = await healthCheck(endpoint.trim(), apiKey);
      setPluginHealth(manifest.name, health);
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to connect to plugin');
    } finally {
      setLoading(false);
    }
  }, [endpoint, apiKey, registerPlugin, setPluginHealth, onDone]);

  return (
    <div className="bg-forge-charcoal border border-forge-graphite rounded-lg p-4 mt-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-3">Add Sidecar Plugin</h3>

      <div className="space-y-3">
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">Endpoint URL</label>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="https://sidecar.example.com"
            className={INPUT_CLASSES}
          />
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Bearer token"
            className={INPUT_CLASSES}
          />
        </div>

        {error && <p className="text-[12px] text-red-400">{error}</p>}

        <div className="flex items-center gap-2">
          <button
            onClick={handleConnect}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-forge-amber text-forge-obsidian text-[13px] font-semibold rounded-md hover:bg-amber-400 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect'
            )}
          </button>
          <button
            onClick={onDone}
            className="px-4 py-2 text-[13px] text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Settings Form ---

function SettingsForm({
  pluginName,
  schema,
  currentSettings,
}: {
  pluginName: string;
  schema: Record<string, SettingsField>;
  currentSettings: Record<string, string | number | boolean>;
}) {
  const updatePluginSettings = useForgeStore((s) => s.updatePluginSettings);
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());

  const toggleReveal = useCallback((fieldKey: string) => {
    setRevealedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldKey)) {
        next.delete(fieldKey);
      } else {
        next.add(fieldKey);
      }
      return next;
    });
  }, []);

  const handleChange = useCallback(
    (key: string, value: string | number | boolean) => {
      updatePluginSettings(pluginName, { [key]: value });
    },
    [pluginName, updatePluginSettings],
  );

  const entries = Object.entries(schema);
  if (entries.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-3 font-semibold">Settings</h3>
      <div className="space-y-3">
        {entries.map(([key, field]) => {
          const val = currentSettings[key] ?? field.default ?? '';

          return (
            <div key={key}>
              <label className="block text-[12px] text-slate-300 mb-1">
                {field.label}
                {field.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              {field.description && <p className="text-[11px] text-slate-500 mb-1">{field.description}</p>}

              {field.type === 'boolean' ? (
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(val)}
                    onChange={(e) => handleChange(key, e.target.checked)}
                    className="rounded border-forge-steel bg-forge-obsidian text-forge-amber focus:ring-forge-amber"
                  />
                  <span className="text-[12px] text-slate-400">{val ? 'Enabled' : 'Disabled'}</span>
                </label>
              ) : field.type === 'select' ? (
                <select
                  value={String(val)}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className={`${INPUT_CLASSES} cursor-pointer`}
                >
                  <option value="">Select...</option>
                  {(field.options ?? []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'number' ? (
                <input
                  type="number"
                  value={val === '' ? '' : Number(val)}
                  onChange={(e) => handleChange(key, e.target.value === '' ? '' : Number(e.target.value))}
                  className={INPUT_CLASSES}
                />
              ) : field.type === 'password' ? (
                <div className="relative">
                  <input
                    type={revealedFields.has(key) ? 'text' : 'password'}
                    value={String(val)}
                    onChange={(e) => handleChange(key, e.target.value)}
                    className={INPUT_CLASSES}
                  />
                  <button
                    type="button"
                    onClick={() => toggleReveal(key)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {revealedFields.has(key) ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  value={String(val)}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className={INPUT_CLASSES}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Plugin Detail View ---

function PluginDetail({ registration, onBack }: { registration: PluginRegistration; onBack: () => void }) {
  const setPluginEnabled = useForgeStore((s) => s.setPluginEnabled);
  const setPluginHealth = useForgeStore((s) => s.setPluginHealth);
  const unregisterPlugin = useForgeStore((s) => s.unregisterPlugin);

  const [refreshing, setRefreshing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [apiKeyRevealed, setApiKeyRevealed] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const { manifest } = registration;
  const isSidecar = manifest.type === 'sidecar';
  const isIntegration = manifest.type === 'integration';

  // Auto-show wizard for integration plugins with no endpoint configured
  const hasEndpoint = Boolean(registration.settings?.endpoint);
  const shouldShowWizard = isIntegration && (!hasEndpoint || showWizard);

  if (shouldShowWizard) {
    return (
      <SetupWizard
        pluginName={manifest.name}
        onComplete={() => {
          setShowWizard(false);
          onBack();
        }}
        onCancel={() => {
          setShowWizard(false);
          if (!hasEndpoint) onBack();
        }}
      />
    );
  }

  const handleRefreshHealth = useCallback(async () => {
    if (!registration.endpoint || !registration.apiKey) return;
    setRefreshing(true);
    try {
      const health = await healthCheck(registration.endpoint, registration.apiKey);
      setPluginHealth(manifest.name, health);
    } finally {
      setRefreshing(false);
    }
  }, [manifest.name, registration.endpoint, registration.apiKey, setPluginHealth]);

  const handleRemove = useCallback(() => {
    unregisterPlugin(manifest.name);
    onBack();
  }, [manifest.name, unregisterPlugin, onBack]);

  const maskedApiKey = registration.apiKey ? '\u2022'.repeat(16) : '';

  return (
    <div className="flex flex-col h-full bg-forge-obsidian">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-forge-graphite bg-forge-charcoal">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-200 truncate">{manifest.displayName}</h2>
            {manifest.type === 'bundled' && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-forge-graphite text-slate-400">
                Built-in
              </span>
            )}
            {manifest.type === 'integration' && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-forge-amber/15 text-forge-amber">
                Integration
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-500">v{manifest.version}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Health status */}
        <div className="bg-forge-charcoal border border-forge-graphite rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusDot status={registration.health.status} />
              <span className="text-[13px] text-slate-200 capitalize">{registration.health.status}</span>
            </div>
            <span className="text-[11px] text-slate-500">
              Last checked: {formatTimestamp(registration.health.lastChecked)}
            </span>
          </div>
          {registration.health.error && <p className="text-[12px] text-red-400 mt-2">{registration.health.error}</p>}
        </div>

        {/* Enable/Disable toggle */}
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-slate-300">Enabled</span>
          <button
            onClick={() => setPluginEnabled(manifest.name, !registration.enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              registration.enabled ? 'bg-forge-amber' : 'bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                registration.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Sidecar-specific info */}
        {isSidecar && (
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">Endpoint URL</label>
              <div className="px-2.5 py-1.5 bg-forge-obsidian border border-forge-graphite rounded text-[13px] text-slate-400 font-mono">
                {registration.endpoint}
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">API Key</label>
              <div className="relative">
                <div className="px-2.5 py-1.5 bg-forge-obsidian border border-forge-graphite rounded text-[13px] text-slate-400 font-mono pr-10 min-h-[34px]">
                  {apiKeyRevealed ? registration.apiKey : maskedApiKey}
                </div>
                <button
                  type="button"
                  onClick={() => setApiKeyRevealed((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {apiKeyRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              onClick={handleRefreshHealth}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-forge-charcoal border border-forge-graphite text-[12px] text-slate-300 rounded hover:border-forge-amber transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              Refresh Health
            </button>
          </div>
        )}

        {/* Integration reconfigure button */}
        {isIntegration && hasEndpoint && (
          <button
            onClick={() => setShowWizard(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-forge-charcoal border border-forge-graphite text-[12px] text-slate-300 rounded hover:border-forge-amber transition-colors"
          >
            <Settings size={12} />
            Reconfigure
          </button>
        )}

        {/* Dynamic settings form (hidden for integration plugins — wizard handles settings) */}
        {!isIntegration && manifest.settingsSchema && Object.keys(manifest.settingsSchema).length > 0 && (
          <SettingsForm
            pluginName={manifest.name}
            schema={manifest.settingsSchema}
            currentSettings={registration.settings}
          />
        )}

        {/* Remove Plugin — hidden for bundled plugins */}
        {manifest.type !== 'bundled' && (
          <div className="pt-4 border-t border-forge-graphite">
            {confirmRemove ? (
              <div className="flex items-center gap-3">
                <span className="text-[12px] text-red-400">Remove {manifest.displayName}? This cannot be undone.</span>
                <button
                  onClick={handleRemove}
                  className="px-3 py-1.5 text-[12px] font-semibold text-red-400 border border-red-500 rounded hover:bg-red-500/10 transition-colors"
                >
                  Confirm Remove
                </button>
                <button
                  onClick={() => setConfirmRemove(false)}
                  className="px-3 py-1.5 text-[12px] text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmRemove(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-red-400 border border-red-500 rounded hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={12} />
                Remove Plugin
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main PluginPanel ---

export default function PluginPanel({ pluginName, autoAdd }: PluginPanelProps) {
  const setSelectedPluginName = useForgeStore((s) => s.setSelectedPluginName);
  const getPlugins = useForgeStore((s) => s.getPlugins);
  const getPlugin = useForgeStore((s) => s.getPlugin);

  const [showAddForm, setShowAddForm] = useState(autoAdd ?? false);

  const plugins = getPlugins();

  // Plugin Detail view
  if (pluginName) {
    const registration = getPlugin(pluginName);
    if (!registration) {
      return (
        <div className="flex-1 flex items-center justify-center text-slate-500 bg-forge-obsidian">
          <p>Plugin not found.</p>
        </div>
      );
    }
    return <PluginDetail registration={registration} onBack={() => setSelectedPluginName(null)} />;
  }

  // Plugin List view
  return (
    <div className="flex flex-col h-full bg-forge-obsidian">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-forge-graphite bg-forge-charcoal">
        <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2.5">
          <Puzzle size={20} className="text-forge-amber" />
          Plugins
          {plugins.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-forge-amber/20 text-forge-amber text-[11px] font-bold">
              {plugins.length}
            </span>
          )}
        </h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-forge-amber text-forge-obsidian text-[13px] font-semibold rounded-md hover:bg-amber-400 transition-colors"
        >
          <Plus size={14} />
          Add Plugin
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {showAddForm && <AddPluginForm onDone={() => setShowAddForm(false)} />}

        {plugins.length === 0 && !showAddForm ? (
          <div className="text-center py-12 text-slate-500">
            <Puzzle size={48} className="mx-auto mb-4 text-slate-600" />
            <p className="text-[13px] leading-relaxed max-w-[420px] mx-auto">
              No plugins registered for this View. Add a sidecar plugin to extend Forge with vulnerability scanning,
              compliance checks, and more.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 bg-forge-amber text-forge-obsidian text-[13px] font-semibold rounded-md hover:bg-amber-400 transition-colors"
            >
              <Plus size={14} />
              Add Plugin
            </button>
          </div>
        ) : (
          <div className="space-y-2 mt-4">
            {[...plugins]
              .sort((a, b) => {
                if (a.manifest.type === b.manifest.type) return 0;
                return a.manifest.type === 'bundled' ? -1 : 1;
              })
              .map((reg) => (
                <button
                  key={reg.manifest.name}
                  onClick={() => setSelectedPluginName(reg.manifest.name)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-forge-charcoal border border-forge-graphite rounded-lg hover:border-forge-amber/50 transition-colors text-left"
                >
                  <StatusDot status={reg.health.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-slate-200 truncate">
                        {reg.manifest.displayName}
                      </span>
                      {reg.manifest.type === 'bundled' && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-forge-graphite text-slate-400 shrink-0">
                          Built-in
                        </span>
                      )}
                      {reg.manifest.type === 'integration' && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-forge-amber/15 text-forge-amber shrink-0">
                          Integration
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">v{reg.manifest.version}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full ${
                        reg.enabled ? 'bg-green-500/10 text-green-400' : 'bg-slate-700 text-slate-500'
                      }`}
                    >
                      {reg.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
