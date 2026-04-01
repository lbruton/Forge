import { useState, useEffect, useCallback, useMemo } from 'react';
import { ShieldAlert, Plus, Play, RefreshCw, Check, Cpu, Clock, Loader2 } from 'lucide-react';
import { useForgeStore } from '../../store/index.ts';
import { pluginFetch } from '../../lib/plugin-service.ts';
import type { VulnDevice, DeviceSummary, ScanStatus, ScanEntry, SeveritySummary } from './types.ts';
import DeviceModal from './DeviceModal.tsx';
import ScanReportViewer from './ScanReportViewer.tsx';

interface VulnDashboardProps {
  pluginName: string;
  viewId: string;
}

const SCAN_STEPS = ['SNMP Detection', 'PSIRT Lookup', 'Nuclei Scan'] as const;

function severityBadges(severity: SeveritySummary | undefined) {
  if (!severity) return null;

  const levels: { key: keyof SeveritySummary; label: string; className: string }[] = [
    { key: 'critical', label: 'CRIT', className: 'bg-red-500/15 text-red-500' },
    { key: 'high', label: 'HIGH', className: 'bg-orange-500/15 text-orange-500' },
    { key: 'medium', label: 'MED', className: 'bg-yellow-500/15 text-yellow-500' },
    { key: 'low', label: 'LOW', className: 'bg-blue-500/15 text-blue-500' },
    { key: 'info', label: 'INFO', className: 'bg-gray-500/15 text-gray-500' },
  ];

  return (
    <div className="flex gap-1 flex-wrap">
      {levels
        .filter((l) => severity[l.key] > 0)
        .map((l) => (
          <span
            key={l.key}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold font-mono ${l.className}`}
          >
            {severity[l.key]} {l.label}
          </span>
        ))}
    </div>
  );
}

function getStepIndex(progress: string | undefined): number {
  if (!progress) return 0;
  const lower = progress.toLowerCase();
  if (lower.includes('nuclei')) return 2;
  if (lower.includes('psirt')) return 1;
  return 0;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatScanDate(iso: string): string {
  try {
    // Sidecar timestamps use hyphens in time/tz: 2026-03-28T15-28-00.810897+00-00
    // Convert to ISO 8601 colons: 2026-03-28T15:28:00.810897+00:00
    const fixed = iso.replace(/T(\d{2})-(\d{2})-(\d{2})(.*?)([+-]\d{2})-(\d{2})$/, 'T$1:$2:$3$4$5:$6');
    const d = new Date(fixed);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// --- Sub-views ---

/** Parse the selectedPluginNodeId into a routed view */
function parseNodeId(nodeId: string | null): {
  view: 'overview' | 'device' | 'report' | 'add-device' | 'edit-device' | 'scan';
  deviceId?: string;
  deviceIp?: string;
  timestamp?: string;
} {
  if (!nodeId || nodeId === 'vulnerabilities' || nodeId === 'cisco') {
    return { view: 'overview' };
  }
  if (nodeId === 'add-device') {
    return { view: 'add-device' };
  }
  if (nodeId.startsWith('edit-device:')) {
    return { view: 'edit-device', deviceId: nodeId.slice('edit-device:'.length) };
  }
  if (nodeId.startsWith('device:')) {
    return { view: 'device', deviceId: nodeId.slice('device:'.length) };
  }
  if (nodeId.startsWith('scan:')) {
    return { view: 'scan', deviceId: nodeId.slice('scan:'.length) };
  }
  if (nodeId.startsWith('report:')) {
    const parts = nodeId.slice('report:'.length);
    const sepIdx = parts.indexOf(':');
    if (sepIdx > 0) {
      return {
        view: 'report',
        deviceIp: parts.slice(0, sepIdx),
        timestamp: parts.slice(sepIdx + 1),
      };
    }
  }
  return { view: 'overview' };
}

// ========================
// Device Page — scan history + Scan Now
// ========================

function DevicePage({
  device,
  pluginName,
  onScanStarted,
}: {
  device: VulnDevice;
  pluginName: string;
  onScanStarted: (_scanId: string) => void;
}) {
  const getPlugin = useForgeStore((s) => s.getPlugin);
  const getSecretsProviders = useForgeStore((s) => s.getSecretsProviders);
  const setVulnScanCache = useForgeStore((s) => s.setVulnScanCache);
  const setSelectedPluginNodeId = useForgeStore((s) => s.setSelectedPluginNodeId);
  const setSelectedPluginName = useForgeStore((s) => s.setSelectedPluginName);
  const registration = getPlugin(pluginName);

  const [scans, setScans] = useState<ScanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch scan history for this device
  const fetchScans = useCallback(async () => {
    if (!registration?.endpoint || !registration?.apiKey) {
      setError('Plugin endpoint or API key is missing');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await pluginFetch(
        registration.endpoint,
        registration.apiKey,
        `/results/${encodeURIComponent(device.ip)}`,
      );

      if (response.status === 404) {
        setScans([]);
        setVulnScanCache(device.id, []);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        setError(`Sidecar returned status ${response.status}`);
        setLoading(false);
        return;
      }

      const data: ScanEntry[] = await response.json();
      const sorted = data.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setScans(sorted);
      setVulnScanCache(device.id, sorted);
    } catch (err) {
      console.error('Error fetching scan history:', err);
      setError('Unable to connect to vulnerability scanner sidecar');
    } finally {
      setLoading(false);
    }
  }, [registration, device.ip, device.id, setVulnScanCache]);

  useEffect(() => {
    void fetchScans();
  }, [fetchScans]);

  // Start scan
  const handleScan = useCallback(async () => {
    if (!registration?.endpoint || !registration?.apiKey) return;

    // Resolve PSIRT credentials from Infisical
    const ciscoClientIdKey = registration.settings?.ciscoClientIdKey as string | undefined;
    const ciscoClientSecretKey = registration.settings?.ciscoClientSecretKey as string | undefined;

    if (!ciscoClientIdKey || !ciscoClientSecretKey) {
      setError('Configure Cisco PSIRT API credentials in the plugin settings first.');
      return;
    }

    const providers = getSecretsProviders();
    const infisicalPlugin = getPlugin('forge-infisical');
    const projectId = infisicalPlugin?.settings?.defaultProjectId as string | undefined;
    const env = (infisicalPlugin?.settings?.defaultEnvironment as string) || 'dev';

    if (providers.length === 0 || !projectId) {
      setError('Infisical is not connected. Connect it first to resolve PSIRT credentials.');
      return;
    }

    let ciscoClientId: string;
    let ciscoClientSecret: string;
    try {
      ciscoClientId = await providers[0].getSecret(projectId, env, ciscoClientIdKey);
      ciscoClientSecret = await providers[0].getSecret(projectId, env, ciscoClientSecretKey);
    } catch {
      setError('Failed to retrieve PSIRT credentials from Infisical.');
      return;
    }

    if (!ciscoClientId || !ciscoClientSecret) {
      setError('PSIRT credentials are empty in Infisical. Check the secret values.');
      return;
    }

    // Resolve SNMP community
    let snmpCommunity = device.snmpCommunity ?? 'public';
    if (device.snmpSecretKey) {
      try {
        const value = await providers[0].getSecret(projectId, env, device.snmpSecretKey);
        if (value) snmpCommunity = value;
      } catch {
        setError(`Failed to retrieve SNMP secret "${device.snmpSecretKey}" from Infisical`);
        return;
      }
    }

    setError(null);

    try {
      const response = await pluginFetch(registration.endpoint, registration.apiKey, '/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: device.ip,
          hostname: device.hostname,
          snmp_community: snmpCommunity,
          cisco_client_id: ciscoClientId,
          cisco_client_secret: ciscoClientSecret,
        }),
      });

      if (!response.ok) {
        setError(`Failed to start scan (status ${response.status})`);
        return;
      }

      const result: { scanId: string } = await response.json();
      onScanStarted(result.scanId);
    } catch (err) {
      console.error('Error starting scan:', err);
      setError('Failed to start scan');
    }
  }, [registration, device, getSecretsProviders, getPlugin, onScanStarted]);

  return (
    <div className="flex flex-col h-full bg-forge-charcoal">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-forge-graphite bg-forge-charcoal">
        <Cpu size={18} className="text-forge-amber" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-200">{device.hostname}</h2>
            <span className="font-mono text-xs text-slate-400">{device.ip}</span>
          </div>
          {device.snmpSecretKey && (
            <span className="text-[11px] text-slate-500">SNMP via Infisical: {device.snmpSecretKey}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchScans}
            disabled={loading}
            className="inline-flex items-center justify-center w-8 h-8 rounded border border-forge-steel text-slate-400 hover:text-forge-amber hover:border-forge-amber/40 transition-colors disabled:opacity-50"
            title="Refresh scan history"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => void handleScan()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-forge-amber text-forge-obsidian rounded-md hover:bg-forge-amber-bright transition-colors"
          >
            <Play size={14} />
            Scan Now
          </button>
        </div>
      </div>

      {/* PSIRT creds warning */}
      {!registration?.settings?.ciscoClientIdKey && (
        <button
          type="button"
          onClick={() => {
            setSelectedPluginName(pluginName);
            setSelectedPluginNodeId(null);
          }}
          className="mx-6 mt-4 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-lg w-[calc(100%-3rem)] text-left hover:border-amber-500/40 transition-colors cursor-pointer"
        >
          <p className="text-xs text-amber-400">
            Cisco PSIRT API credentials are not configured. <span className="underline">Open plugin settings</span> to
            add your Client ID and Secret.
          </p>
        </button>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
            }}
            className="text-red-400 hover:text-red-300 text-xs font-medium ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div
              className="w-6 h-6 border-2 border-forge-amber/30 border-t-forge-amber rounded-full animate-spin"
              role="status"
              aria-label="Loading"
            />
          </div>
        )}

        {/* Empty state */}
        {!loading && scans.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Clock size={48} className="text-slate-600" />
            <div className="text-center">
              <h3 className="text-base font-semibold text-slate-200 mb-1">No scans yet</h3>
              <p className="text-sm text-slate-400">
                Click "Scan Now" to run the first vulnerability scan on this device.
              </p>
            </div>
          </div>
        )}

        {/* Scan history table */}
        {!loading && scans.length > 0 && (
          <div className="bg-forge-charcoal border border-forge-graphite rounded-xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-forge-charcoal border-b border-forge-graphite">
                    Date
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-forge-charcoal border-b border-forge-graphite">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-forge-charcoal border-b border-forge-graphite">
                    Findings
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-forge-charcoal border-b border-forge-graphite">
                    Severity
                  </th>
                </tr>
              </thead>
              <tbody>
                {scans.map((scan) => (
                  <tr
                    key={scan.timestamp}
                    className="hover:bg-white/[0.02] transition-colors border-b border-forge-graphite last:border-b-0 cursor-pointer"
                    onClick={() => {
                      setSelectedPluginNodeId(`report:${device.ip}:${scan.timestamp}`);
                    }}
                  >
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs text-slate-300">{formatScanDate(scan.timestamp)}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          scan.status === 'complete' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {scan.status === 'complete' ? 'Complete' : 'Failed'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-sm text-slate-200">
                        {scan.totalFindings || (scan.severity
                          ? Object.values(scan.severity).reduce((sum, count) => sum + count, 0)
                          : 0)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">{severityBadges(scan.severity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ========================
// Scan Progress View
// ========================

function ScanProgressView({
  pluginName,
  onComplete,
  onCancel,
}: {
  pluginName: string;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const getPlugin = useForgeStore((s) => s.getPlugin);
  const registration = getPlugin(pluginName);

  // Read scan state from store — survives component unmount
  const activeScan = useForgeStore((s) => s.activeScan);
  const updateScanStatus = useForgeStore((s) => s.updateScanStatus);

  // Elapsed timer — computed from activeScan.startedAt, ticks locally
  const [elapsed, setElapsed] = useState(0);

  // Elapsed timer — ticks every second, recomputes from stored startedAt on remount
  useEffect(() => {
    if (!activeScan) return;

    const updateElapsed = () => {
      setElapsed(Math.floor((Date.now() - activeScan.startedAt) / 1000));
    };

    updateElapsed();
    const id = setInterval(updateElapsed, 1000);
    return () => clearInterval(id);
  }, [activeScan?.startedAt]);

  // Poll scan status — resumes on remount since activeScan lives in the store
  useEffect(() => {
    if (!activeScan) return;
    const { status } = activeScan.status;
    if (status === 'complete' || status === 'failed') return;
    if (!registration?.endpoint || !registration?.apiKey) return;

    const endpoint = registration.endpoint;
    const apiKey = registration.apiKey;
    const scanId = activeScan.scanId;

    const poll = async () => {
      try {
        const resp = await pluginFetch(endpoint, apiKey, `/scan/${encodeURIComponent(scanId)}/status`);
        if (!resp.ok) return;
        // Sidecar returns snake_case (Pydantic), frontend expects camelCase
        const raw = await resp.json();
        const scanStatus: ScanStatus = {
          scanId: raw.scanId ?? raw.scan_id,
          status: raw.status,
          progress: raw.progress,
          startedAt: raw.startedAt ?? raw.started_at,
          completedAt: raw.completedAt ?? raw.completed_at,
          error: raw.error,
          device: raw.device,
          resultPath: raw.resultPath ?? raw.result_path,
        };
        updateScanStatus(scanStatus);
      } catch {
        // Silently retry on next interval
      }
    };

    // Poll immediately on mount, then every 3 seconds
    void poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [activeScan?.scanId, activeScan?.status.status, registration?.endpoint, registration?.apiKey, updateScanStatus]);

  // Completion transition — wait 1.5s for sidecar to finalize report (fixes FORGE-56)
  useEffect(() => {
    if (!activeScan || activeScan.status.status !== 'complete') return;

    const timeout = setTimeout(() => {
      onComplete();
    }, 1500);

    return () => clearTimeout(timeout);
  }, [activeScan, onComplete]);

  if (!activeScan) return null;

  const activeStep = getStepIndex(activeScan.status.progress);
  const isDone = activeScan.status.status === 'complete';
  const isFailed = activeScan.status.status === 'failed';

  return (
    <div className="flex flex-col h-full bg-forge-charcoal">
      <div className="flex-1 overflow-auto p-6">
        {/* Progress card */}
        <div className="max-w-xl mx-auto mt-10 bg-forge-charcoal border border-forge-graphite rounded-xl p-8">
          {/* Target info */}
          <div className="text-center mb-8">
            <div className="text-xl font-semibold text-slate-200 flex items-center justify-center gap-2">
              {isDone ? (
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              ) : (
                <span className="inline-block w-2 h-2 rounded-full bg-forge-amber animate-pulse" />
              )}
              {activeScan.device.hostname}
            </div>
            <div className="font-mono text-sm text-slate-400 mt-1">{activeScan.device.ip}</div>
          </div>

          {/* Steps */}
          <div className="relative flex items-start justify-between mb-8 px-5">
            <div
              className={`absolute top-5 left-[16.66%] w-[33.33%] h-0.5 ${
                activeStep > 0 || isDone ? 'bg-green-500' : 'bg-forge-graphite'
              }`}
            />
            <div
              className={`absolute top-5 left-[50%] w-[33.33%] h-0.5 ${
                activeStep > 1 || isDone ? 'bg-green-500' : 'bg-forge-graphite'
              }`}
            />

            {SCAN_STEPS.map((step, i) => {
              const done = isDone || i < activeStep;
              const active = !isDone && i === activeStep;

              return (
                <div key={step} className="flex flex-col items-center gap-2.5 z-10 flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all ${
                      done
                        ? 'bg-green-500 border-green-500 text-white'
                        : active
                          ? 'bg-forge-amber border-forge-amber text-forge-obsidian shadow-[0_0_0_4px_rgba(245,158,11,0.2)]'
                          : 'bg-forge-charcoal border-forge-graphite text-slate-500'
                    }`}
                  >
                    {done ? <Check size={18} /> : <span className={active ? 'animate-pulse' : ''}>{i + 1}</span>}
                  </div>
                  <div className="text-center">
                    <div className={`text-xs font-medium ${done || active ? 'text-slate-200' : 'text-slate-500'}`}>
                      {step}
                    </div>
                    <div
                      className={`text-[11px] font-mono ${
                        done ? 'text-green-500' : active ? 'text-forge-amber' : 'text-slate-500'
                      }`}
                    >
                      {done ? 'Complete' : active ? 'Running...' : 'Pending'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Elapsed timer */}
          <div className="text-center mb-2 font-mono text-2xl font-medium text-forge-amber">
            {formatElapsed(elapsed)}
          </div>
          <div className="text-center text-xs text-slate-500 mb-6">Elapsed time</div>

          {/* Completion transition — brief loading while report is prepared */}
          {isDone && (
            <div className="flex items-center justify-center gap-2 mb-4 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <Loader2 size={14} className="animate-spin text-green-400" />
              <p className="text-sm text-green-400">Scan complete — preparing report...</p>
            </div>
          )}

          {/* Error state */}
          {isFailed && (
            <div className="text-center mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">
                Scan failed{activeScan.status.error ? `: ${activeScan.status.error}` : ''}
              </p>
            </div>
          )}

          {/* Cancel / Back button */}
          {!isDone && (
            <div className="text-center">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-slate-400 border border-forge-graphite rounded-md hover:bg-forge-graphite hover:text-slate-200 transition-colors"
              >
                {isFailed ? 'Back to Device' : 'Cancel Scan'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ========================
// Overview — device list
// ========================

function OverviewPage({ pluginName, viewId }: { pluginName: string; viewId: string }) {
  const vulnDevices = useForgeStore((s) => s.vulnDevices);
  const vulnScanCache = useForgeStore((s) => s.vulnScanCache);
  const pluginSettings = useForgeStore((s) => s.plugins[pluginName]?.settings);
  const setSelectedPluginNodeId = useForgeStore((s) => s.setSelectedPluginNodeId);
  const setSelectedPluginName = useForgeStore((s) => s.setSelectedPluginName);

  const sortedDevices = useMemo(
    () => vulnDevices.filter((d) => d.viewId === viewId).sort((a, b) => a.hostname.localeCompare(b.hostname)),
    [vulnDevices, viewId],
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync device info + scan history from sidecar.
  // Reads all store state via getState() inside the callback to avoid
  // dependency cycles — this callback mutates the store (updateVulnDevice,
  // setVulnScanCache), so reactive selectors in deps would cause infinite loops.
  const syncFromSidecar = useCallback(async () => {
    const state = useForgeStore.getState();
    const registration = state.getPlugin(pluginName);

    if (!registration?.endpoint || !registration?.apiKey) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await pluginFetch(registration.endpoint, registration.apiKey, '/results');
      if (!response.ok) {
        setError(`Sidecar returned status ${response.status}`);
        setLoading(false);
        return;
      }

      const data: DeviceSummary[] = await response.json();
      const devices = state.vulnDevices.filter((d) => d.viewId === viewId);
      for (const summary of data) {
        const device = devices.find((d) => d.ip === summary.device);
        if (device) {
          state.updateVulnDevice(device.id, {
            lastScanAt: summary.lastScan,
            lastSeverity: summary.severity,
          });

          // Fetch scan entries for sidebar tree
          if (summary.scanCount > 0) {
            try {
              const scanResp = await pluginFetch(
                registration.endpoint,
                registration.apiKey,
                `/results/${encodeURIComponent(summary.device)}`,
              );
              if (scanResp.ok) {
                const scans: ScanEntry[] = await scanResp.json();
                state.setVulnScanCache(
                  device.id,
                  scans.sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
                );
              }
            } catch {
              // Non-critical — sidebar just won't show scan nodes
            }
          }
        }
      }
    } catch (err) {
      console.error('Error syncing from sidecar:', err);
      setError('Unable to connect to vulnerability scanner sidecar');
    } finally {
      setLoading(false);
    }
  }, [pluginName, viewId]);

  useEffect(() => {
    void syncFromSidecar();
  }, [syncFromSidecar]);

  return (
    <div className="flex flex-col h-full bg-forge-charcoal">
      {/* Header */}
      <div className="flex items-center gap-2 px-6 py-4 bg-forge-charcoal border-b border-forge-graphite">
        <ShieldAlert size={18} className="text-forge-amber" />
        <span className="text-base font-semibold text-slate-200">Cisco Vulnerability Scanner</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void syncFromSidecar()}
            disabled={loading}
            className="inline-flex items-center justify-center w-8 h-8 rounded border border-forge-steel text-slate-400 hover:text-forge-amber hover:border-forge-amber/40 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedPluginNodeId('add-device');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-forge-amber text-forge-obsidian rounded-md hover:bg-forge-amber-bright transition-colors"
          >
            <Plus size={14} strokeWidth={2.5} />
            Add Device
          </button>
        </div>
      </div>

      {/* PSIRT creds warning */}
      {!pluginSettings?.ciscoClientIdKey && !pluginSettings?.ciscoClientSecretKey && (
        <button
          type="button"
          onClick={() => {
            setSelectedPluginName(pluginName);
            setSelectedPluginNodeId(null);
          }}
          className="mx-6 mt-4 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-lg w-[calc(100%-3rem)] text-left hover:border-amber-500/40 transition-colors cursor-pointer"
        >
          <p className="text-xs text-amber-400">
            Cisco PSIRT API credentials are not configured. <span className="underline">Open plugin settings</span> to
            add your Client ID and Secret.
          </p>
        </button>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
            }}
            className="text-red-400 hover:text-red-300 text-xs font-medium ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div
              className="w-6 h-6 border-2 border-forge-amber/30 border-t-forge-amber rounded-full animate-spin"
              role="status"
              aria-label="Loading"
            />
          </div>
        )}

        {/* Empty state */}
        {!loading && sortedDevices.length === 0 && (
          <div className="bg-forge-charcoal border border-forge-graphite rounded-xl">
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <ShieldAlert size={48} className="text-slate-600" />
              <div className="text-center">
                <h3 className="text-base font-semibold text-slate-200 mb-1">No devices registered</h3>
                <p className="text-sm text-slate-400 max-w-sm mx-auto">
                  Add a Cisco device to start scanning for vulnerabilities using PSIRT advisories and Nuclei templates.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedPluginNodeId('add-device');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-forge-amber text-forge-obsidian rounded-md hover:bg-forge-amber-bright transition-colors"
              >
                <Plus size={14} strokeWidth={2.5} />
                Add Your First Device
              </button>
            </div>
          </div>
        )}

        {/* Device table */}
        {!loading && sortedDevices.length > 0 && (
          <div className="bg-forge-charcoal border border-forge-graphite rounded-xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-forge-charcoal border-b border-forge-graphite">
                    Hostname
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-forge-charcoal border-b border-forge-graphite">
                    IP Address
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-forge-charcoal border-b border-forge-graphite">
                    Last Scan
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-forge-charcoal border-b border-forge-graphite">
                    Severity
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedDevices.map((device) => (
                  <tr
                    key={device.id}
                    className="hover:bg-white/[0.02] transition-colors border-b border-forge-graphite last:border-b-0 cursor-pointer"
                    onClick={() => {
                      setSelectedPluginNodeId(`device:${device.id}`);
                    }}
                  >
                    <td className="px-4 py-3.5 text-sm font-medium text-slate-200">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5" />
                      {device.hostname}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs text-slate-300">{device.ip}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      {(() => {
                        const lastScan = device.lastScanAt || vulnScanCache[device.id]?.[0]?.timestamp;
                        return lastScan ? (
                          <span className="font-mono text-[11px] text-slate-500">
                            {formatScanDate(lastScan)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">Never</span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3.5">{severityBadges(device.lastSeverity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ========================
// Main VulnDashboard — routes based on selectedPluginNodeId
// ========================

export default function VulnDashboard({ pluginName, viewId }: VulnDashboardProps) {
  const selectedPluginNodeId = useForgeStore((s) => s.selectedPluginNodeId);
  const setSelectedPluginNodeId = useForgeStore((s) => s.setSelectedPluginNodeId);
  const getVulnDevice = useForgeStore((s) => s.getVulnDevice);
  const addVulnDevice = useForgeStore((s) => s.addVulnDevice);
  const updateVulnDevice = useForgeStore((s) => s.updateVulnDevice);

  // Active scan state — lives in Zustand store, survives component unmount
  const activeScan = useForgeStore((s) => s.activeScan);
  const setActiveScan = useForgeStore((s) => s.setActiveScan);

  const route = parseNodeId(selectedPluginNodeId);

  // DeviceModal visibility
  const showAddModal = route.view === 'add-device';
  const showEditModal = route.view === 'edit-device';
  const editDevice = showEditModal && route.deviceId ? getVulnDevice(route.deviceId) : null;

  const handleSaveDevice = useCallback(
    (device: Omit<VulnDevice, 'viewId'>) => {
      const existing = getVulnDevice(device.id);
      if (existing) {
        updateVulnDevice(device.id, device);
      } else {
        addVulnDevice({ ...device, viewId });
      }
      setSelectedPluginNodeId(`device:${device.id}`);
    },
    [getVulnDevice, addVulnDevice, updateVulnDevice, setSelectedPluginNodeId, viewId],
  );

  const handleCloseModal = useCallback(() => {
    if (showEditModal && route.deviceId) {
      setSelectedPluginNodeId(`device:${route.deviceId}`);
    } else {
      setSelectedPluginNodeId('cisco');
    }
  }, [showEditModal, route.deviceId, setSelectedPluginNodeId]);

  // Active scan in progress — activeScan lives in store, survives navigation
  if (activeScan) {
    return (
      <ScanProgressView
        pluginName={pluginName}
        onComplete={() => {
          const deviceId = activeScan.device.id;
          setActiveScan(null);
          // Navigate to device page (not report) — the sidecar stores reports
          // under started_at timestamps but completedAt uses a different value,
          // causing a 404 on direct report navigation. The device page shows the
          // scan list with correct timestamps for the user to click into.
          setSelectedPluginNodeId(`device:${deviceId}`);
        }}
        onCancel={() => {
          const deviceId = activeScan.device.id;
          setActiveScan(null);
          setSelectedPluginNodeId(`device:${deviceId}`);
        }}
      />
    );
  }

  // Scan report view
  if (route.view === 'report' && route.deviceIp && route.timestamp) {
    return (
      <div className="flex flex-col h-full bg-forge-charcoal">
        <div className="flex-1 overflow-auto p-6">
          <ScanReportViewer
            pluginName={pluginName}
            device={route.deviceIp}
            timestamp={route.timestamp}
            onBack={() => {
              const devices = useForgeStore.getState().vulnDevices;
              const device = devices.find((d) => d.ip === route.deviceIp);
              if (device) {
                setSelectedPluginNodeId(`device:${device.id}`);
              } else {
                setSelectedPluginNodeId('cisco');
              }
            }}
            onDeleted={() => {
              // Clear cached scan entry so sidebar updates
              const devices = useForgeStore.getState().vulnDevices;
              const device = devices.find((d) => d.ip === route.deviceIp);
              if (device) {
                const cache = useForgeStore.getState().vulnScanCache[device.id] ?? [];
                const remaining = cache.filter((s) => s.timestamp !== route.timestamp);
                useForgeStore.getState().setVulnScanCache(device.id, remaining);
                // Update lastSeverity to latest remaining scan, or clear if none left
                const latest = remaining.length > 0 ? remaining[0] : null;
                useForgeStore.getState().updateVulnDevice(device.id, {
                  lastSeverity: latest?.severity,
                  lastScanAt: latest?.timestamp,
                });
              }
            }}
          />
        </div>
      </div>
    );
  }

  // Device page
  if (route.view === 'device' && route.deviceId) {
    const device = getVulnDevice(route.deviceId);
    if (!device) {
      return (
        <div className="flex-1 flex items-center justify-center text-slate-500 bg-forge-charcoal">
          <p>Device not found.</p>
        </div>
      );
    }

    return (
      <DevicePage
        device={device}
        pluginName={pluginName}
        onScanStarted={(scanId) => {
          setActiveScan({
            scanId,
            device,
            status: { scanId, status: 'queued', device: device.ip },
            startedAt: Date.now(),
          });
        }}
      />
    );
  }

  // Default: overview + modals
  return (
    <>
      <OverviewPage pluginName={pluginName} viewId={viewId} />

      {/* Add Device Modal */}
      <DeviceModal open={showAddModal} device={null} onSave={handleSaveDevice} onClose={handleCloseModal} />

      {/* Edit Device Modal */}
      <DeviceModal
        open={showEditModal}
        device={editDevice ?? null}
        onSave={handleSaveDevice}
        onClose={handleCloseModal}
      />
    </>
  );
}
