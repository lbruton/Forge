import { useState, useEffect, useCallback, useRef } from 'react';
import { Eye, EyeOff, Copy, Check, RefreshCw, AlertTriangle, Shield } from 'lucide-react';
import { useForgeStore } from '../../store/index.ts';
import type { SecretEntry, SecretProject } from '../../types/secrets-provider.ts';

interface SecretsBrowserProps {
  pluginName: string;
  viewId: string;
}

export default function SecretsBrowser({ pluginName }: SecretsBrowserProps) {
  const getSecretsProvider = useForgeStore((s) => s.getSecretsProvider);
  const getPlugin = useForgeStore((s) => s.getPlugin);

  const provider = getSecretsProvider(pluginName);
  const registration = getPlugin(pluginName);
  const settings = registration?.settings ?? {};

  // State
  const [projects, setProjects] = useState<SecretProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>((settings.defaultProjectId as string) || '');
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>(
    (settings.defaultEnvironment as string) || 'dev',
  );
  const [secrets, setSecrets] = useState<SecretEntry[]>([]);
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(false);

  // Track reveal timeouts for cleanup
  const revealTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Cleanup reveal timers on unmount
  useEffect(() => {
    return () => {
      Object.values(revealTimers.current).forEach(clearTimeout);
    };
  }, []);

  // Load projects on mount
  useEffect(() => {
    if (!provider?.isConnected()) return;

    setProjectsLoading(true);
    provider
      .listProjects()
      .then((p) => {
        setProjects(p);
      })
      .catch((err) => {
        setError(`Failed to load projects: ${err instanceof Error ? err.message : String(err)}`);
      })
      .finally(() => setProjectsLoading(false));
  }, [provider]);

  // Auto-select default project when projects load and none is selected
  useEffect(() => {
    if (!selectedProject && projects.length > 0) {
      const defaultId = (settings.defaultProjectId as string) || '';
      const match = defaultId ? projects.find((p) => p.id === defaultId) : undefined;
      setSelectedProject(match ? match.id : projects[0].id);
    }
  }, [projects, selectedProject, settings.defaultProjectId]);

  // Get environments for selected project
  const selectedProjectData = projects.find((p) => p.id === selectedProject);
  const environments = selectedProjectData?.environments ?? [];

  // Auto-select first environment if current selection is not valid
  useEffect(() => {
    if (environments.length > 0 && !environments.find((e) => e.slug === selectedEnvironment)) {
      setSelectedEnvironment(environments[0].slug);
    }
  }, [environments, selectedEnvironment]);

  // Fetch secrets when project/environment changes
  const fetchSecrets = useCallback(async () => {
    if (!provider?.isConnected() || !selectedProject || !selectedEnvironment) return;

    setLoading(true);
    setError(null);

    try {
      const entries = await provider.listSecrets(selectedProject, selectedEnvironment);
      setSecrets(entries);
    } catch (err) {
      setError(`Failed to load secrets: ${err instanceof Error ? err.message : String(err)}`);
      setSecrets([]);
    } finally {
      setLoading(false);
    }
  }, [provider, selectedProject, selectedEnvironment]);

  useEffect(() => {
    if (selectedProject && selectedEnvironment) {
      fetchSecrets();
    }
  }, [fetchSecrets, selectedProject, selectedEnvironment]);

  // Reveal a secret value for 60 seconds
  const handleReveal = useCallback(
    async (key: string) => {
      // If already revealed, hide it
      if (revealedValues[key] !== undefined) {
        setRevealedValues((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        if (revealTimers.current[key]) {
          clearTimeout(revealTimers.current[key]);
          delete revealTimers.current[key];
        }
        return;
      }

      if (!provider || !selectedProject || !selectedEnvironment) return;

      try {
        const value = await provider.getSecret(selectedProject, selectedEnvironment, key);
        setRevealedValues((prev) => ({ ...prev, [key]: value }));

        // Auto-hide after 60 seconds
        revealTimers.current[key] = setTimeout(() => {
          setRevealedValues((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
          delete revealTimers.current[key];
        }, 60_000);
      } catch (err) {
        console.error(`Failed to reveal secret "${key}":`, err);
      }
    },
    [provider, selectedProject, selectedEnvironment, revealedValues],
  );

  // Copy secret value to clipboard without revealing in UI
  const handleCopy = useCallback(
    async (key: string) => {
      if (!provider || !selectedProject || !selectedEnvironment) return;

      try {
        // If already revealed, copy from cache; otherwise fetch and discard
        const value = revealedValues[key] ?? (await provider.getSecret(selectedProject, selectedEnvironment, key));

        await navigator.clipboard.writeText(value);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
      } catch (err) {
        console.error(`Failed to copy secret "${key}":`, err);
      }
    },
    [provider, selectedProject, selectedEnvironment, revealedValues],
  );

  const isReadOnly = provider ? !provider.capabilities().write : true;

  // Disconnected state
  if (!provider || !provider.isConnected()) {
    return (
      <div className="flex flex-col h-full bg-forge-charcoal">
        <div className="flex items-center gap-2 px-4 py-3 bg-forge-charcoal border-b border-forge-graphite">
          <Shield size={16} className="text-forge-amber" />
          <span className="text-sm font-medium text-slate-200">Secrets Browser</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <AlertTriangle size={32} className="text-slate-600" />
          <p className="text-sm text-slate-500">Not connected to Infisical.</p>
          <p className="text-xs text-slate-600">Check plugin settings and reconnect to browse secrets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-forge-charcoal">
      {/* Header with selectors */}
      <div className="flex items-center gap-3 px-4 py-3 bg-forge-charcoal border-b border-forge-graphite">
        <Shield size={16} className="text-forge-amber" />
        <span className="text-sm font-medium text-slate-200">Secrets Browser</span>

        <div className="flex-1" />

        {/* Project selector */}
        <select
          value={selectedProject}
          onChange={(e) => { setSelectedProject(e.target.value); }}
          disabled={projectsLoading || projects.length === 0}
          className="px-2.5 py-1.5 bg-forge-obsidian border border-forge-steel rounded text-xs text-slate-300 outline-none cursor-pointer focus:border-forge-amber/50 transition-colors"
        >
          {projects.length === 0 && <option value="">No projects</option>}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {/* Environment selector */}
        <select
          value={selectedEnvironment}
          onChange={(e) => setSelectedEnvironment(e.target.value)}
          disabled={environments.length === 0}
          className="px-2.5 py-1.5 bg-forge-obsidian border border-forge-steel rounded text-xs text-slate-300 outline-none cursor-pointer focus:border-forge-amber/50 transition-colors"
        >
          {environments.length === 0 && <option value="">No environments</option>}
          {environments.map((env) => (
            <option key={env.slug} value={env.slug}>
              {env.name}
            </option>
          ))}
        </select>

        {/* Refresh button */}
        <button
          type="button"
          onClick={fetchSecrets}
          disabled={loading}
          className="inline-flex items-center justify-center w-8 h-8 rounded border border-forge-steel text-slate-400 hover:text-forge-amber hover:border-forge-amber/40 transition-colors disabled:opacity-50"
          title="Refresh secrets"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Read-only banner */}
      {isReadOnly && (
        <div className="mx-4 mt-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-xs text-amber-400">
            Connected in read-only mode. To enable sync features, update the machine identity role in Infisical.
          </p>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center h-full gap-2">
            <div
              className="w-5 h-5 border-2 border-forge-amber/30 border-t-forge-amber rounded-full animate-spin"
              role="status"
              aria-label="Loading"
            />
            <span className="text-sm text-slate-500">Loading secrets...</span>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <AlertTriangle size={24} className="text-red-400" />
            <p className="text-sm text-slate-500">{error}</p>
            <button
              type="button"
              onClick={fetchSecrets}
              className="px-3 py-1.5 text-xs font-medium text-forge-amber border border-forge-amber/40 rounded-md hover:bg-forge-amber/10 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && secrets.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Shield size={32} className="text-slate-600" />
            <p className="text-sm text-slate-500">No secrets found in this project/environment.</p>
          </div>
        )}

        {/* Secrets table */}
        {!loading && !error && secrets.length > 0 && (
          <div className="space-y-1">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_200px_auto] gap-3 px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase text-slate-500">
              <span>Key</span>
              <span>Value</span>
              <span>Actions</span>
            </div>

            {/* Secret rows */}
            {secrets.map((secret) => {
              const isRevealed = revealedValues[secret.key] !== undefined;
              const isCopied = copiedKey === secret.key;

              return (
                <div
                  key={secret.id}
                  className="grid grid-cols-[1fr_200px_auto] gap-3 items-center px-3 py-2.5 bg-forge-obsidian border border-forge-steel/50 rounded-lg hover:border-forge-steel transition-colors"
                >
                  {/* Key */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[13px] text-slate-200 truncate">{secret.key}</span>
                    {secret.tags.length > 0 && (
                      <div className="flex gap-1 flex-shrink-0">
                        {secret.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-forge-amber/10 text-forge-amber border border-forge-amber/20"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Value (masked or revealed) */}
                  <span
                    className={`text-[13px] truncate ${
                      isRevealed ? 'font-mono text-slate-300' : 'text-slate-500 tracking-wider'
                    }`}
                  >
                    {isRevealed ? revealedValues[secret.key] : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {/* Reveal toggle */}
                    <button
                      type="button"
                      onClick={() => handleReveal(secret.key)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded text-slate-500 hover:text-forge-amber hover:bg-forge-amber/10 transition-colors"
                      title={isRevealed ? 'Hide value' : 'Reveal value (60s)'}
                    >
                      {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>

                    {/* Copy */}
                    <button
                      type="button"
                      onClick={() => handleCopy(secret.key)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded text-slate-500 hover:text-forge-amber hover:bg-forge-amber/10 transition-colors"
                      title="Copy value to clipboard"
                    >
                      {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
