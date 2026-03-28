import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldAlert,
  Plus,
  Play,
  RefreshCw,
  Check,
  Cpu,
  Clock,
} from 'lucide-react';
import { useForgeStore } from '../../store/index.ts';
import { pluginFetch } from '../../lib/plugin-service.ts';
import type { VulnDevice, DeviceSummary, ScanStatus, ScanEntry, SeveritySummary } from './types.ts';
import DeviceModal from './DeviceModal.tsx';
import ScanReportViewer from './ScanReportViewer.tsx';

interface VulnDashboardProps {
  pluginName: string;
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
    const d = new Date(iso);
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
  onScanStarted: (scanId: string) => void;
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
    fetchScans();
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
            Cisco PSIRT API credentials are not configured.{' '}
            <span className="underline">Open plugin settings</span> to add your Client ID and Secret.
          </p>
        </button>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
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
              <p className="text-sm text-slate-400">Click "Scan Now" to run the first vulnerability scan on this device.</p>
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
                          scan.status === 'complete'
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {scan.status === 'complete' ? 'Complete' : 'Failed'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-sm text-slate-200">{scan.totalFindings}</span>
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
  device,
  scanId,
  pluginName,
  onComplete,
  onCancel,
}: {
  device: VulnDevice;
  scanId: string;
  pluginName: string;
  onComplete: (deviceIp: string, timestamp: string) => void;
  onCancel: () => void;
}) {
  const getPlugin = useForgeStore((s) => s.getPlugin);
  const registration = getPlugin(pluginName);

  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Start elapsed timer
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    // Poll scan status every 3 seconds
    pollRef.current = setInterval(async () => {
      if (!registration?.endpoint || !registration?.apiKey) return;
      try {
        const statusResp = await pluginFetch(
          registration.endpoint,
          registration.apiKey,
          `/scan/${encodeURIComponent(scanId)}/status`,
        );
        if (!statusResp.ok) return;

        const status: ScanStatus = await statusResp.json();
        setScanStatus(status);

        if (status.status === 'complete' || status.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          if (timerRef.current) clearInterval(timerRef.current);
          pollRef.current = null;
          timerRef.current = null;

          if (status.status === 'complete') {
            onComplete(device.ip, status.completedAt ?? new Date().toISOString());
          }
        }
      } catch {
        // Silently retry on next interval
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [registration, scanId, device.ip, onComplete]);

  const activeStep = getStepIndex(scanStatus?.progress);
  const isDone = scanStatus?.status === 'complete';
  const isFailed = scanStatus?.status === 'failed';

  return (
    <div className="flex flex-col h-full bg-forge-charcoal">
      <div className="flex-1 overflow-auto p-6">
        {/* Progress card */}
        <div className="max-w-xl mx-auto mt-10 bg-forge-charcoal border border-forge-graphite rounded-xl p-8">
          {/* Target info */}
          <div className="text-center mb-8">
            <div className="text-xl font-semibold text-slate-200 flex items-center justify-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-forge-amber animate-pulse" />
              {device.hostname}
            </div>
            <div className="font-mono text-sm text-slate-400 mt-1">{device.ip}</div>
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

          {/* Error state */}
          {isFailed && (
            <div className="text-center mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">Scan failed{scanStatus?.error ? `: ${scanStatus.error}` : ''}</p>
            </div>
          )}

          {/* Cancel button */}
          <div className="text-center">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-400 border border-forge-graphite rounded-md hover:bg-forge-graphite hover:text-slate-200 transition-colors"
            >
              {isFailed ? 'Back to Device' : 'Cancel Scan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========================
// Overview — device list
// ========================

function OverviewPage({ pluginName }: { pluginName: string }) {
  const getPlugin = useForgeStore((s) => s.getPlugin);
  const vulnDevices = useForgeStore((s) => s.vulnDevices);
  const updateVulnDevice = useForgeStore((s) => s.updateVulnDevice);
  const setSelectedPluginNodeId = useForgeStore((s) => s.setSelectedPluginNodeId);
  const setSelectedPluginName = useForgeStore((s) => s.setSelectedPluginName);
  const registration = getPlugin(pluginName);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync device info from sidecar (merges severity/lastScan data)
  const syncFromSidecar = useCallback(async () => {
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
      // Update existing devices with sidecar data
      for (const summary of data) {
        const device = vulnDevices.find((d) => d.ip === summary.device);
        if (device) {
          updateVulnDevice(device.id, {
            lastScanAt: summary.lastScan,
            lastSeverity: summary.severity,
          });
        }
      }
    } catch (err) {
      console.error('Error syncing from sidecar:', err);
      setError('Unable to connect to vulnerability scanner sidecar');
    } finally {
      setLoading(false);
    }
  }, [registration, vulnDevices, updateVulnDevice]);

  useEffect(() => {
    syncFromSidecar();
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
            onClick={() => setSelectedPluginNodeId('add-device')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-forge-amber text-forge-obsidian rounded-md hover:bg-forge-amber-bright transition-colors"
          >
            <Plus size={14} strokeWidth={2.5} />
            Add Device
          </button>
        </div>
      </div>

      {/* PSIRT creds warning */}
      {!registration?.settings?.ciscoClientIdKey && !registration?.settings?.ciscoClientSecretKey && (
        <button
          type="button"
          onClick={() => {
            setSelectedPluginName(pluginName);
            setSelectedPluginNodeId(null);
          }}
          className="mx-6 mt-4 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-lg w-[calc(100%-3rem)] text-left hover:border-amber-500/40 transition-colors cursor-pointer"
        >
          <p className="text-xs text-amber-400">
            Cisco PSIRT API credentials are not configured.{' '}
            <span className="underline">Open plugin settings</span> to add your Client ID and Secret.
          </p>
        </button>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-400">{error}</p>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-300 text-xs font-medium ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-forge-amber/30 border-t-forge-amber rounded-full animate-spin" role="status" aria-label="Loading" />
          </div>
        )}

        {/* Empty state */}
        {!loading && vulnDevices.length === 0 && (
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
                onClick={() => setSelectedPluginNodeId('add-device')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-forge-amber text-forge-obsidian rounded-md hover:bg-forge-amber-bright transition-colors"
              >
                <Plus size={14} strokeWidth={2.5} />
                Add Your First Device
              </button>
            </div>
          </div>
        )}

        {/* Device table */}
        {!loading && vulnDevices.length > 0 && (
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
                {vulnDevices.map((device) => (
                  <tr
                    key={device.id}
                    className="hover:bg-white/[0.02] transition-colors border-b border-forge-graphite last:border-b-0 cursor-pointer"
                    onClick={() => setSelectedPluginNodeId(`device:${device.id}`)}
                  >
                    <td className="px-4 py-3.5 text-sm font-medium text-slate-200">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5" />
                      {device.hostname}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs text-slate-300">{device.ip}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      {device.lastScanAt ? (
                        <span className="font-mono text-[11px] text-slate-500">{formatScanDate(device.lastScanAt)}</span>
                      ) : (
                        <span className="text-xs text-slate-600">Never</span>
                      )}
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

export default function VulnDashboard({ pluginName }: VulnDashboardProps) {
  const selectedPluginNodeId = useForgeStore((s) => s.selectedPluginNodeId);
  const setSelectedPluginNodeId = useForgeStore((s) => s.setSelectedPluginNodeId);
  const getVulnDevice = useForgeStore((s) => s.getVulnDevice);
  const addVulnDevice = useForgeStore((s) => s.addVulnDevice);
  const updateVulnDevice = useForgeStore((s) => s.updateVulnDevice);

  // Scan progress state (transient)
  const [activeScan, setActiveScan] = useState<{ scanId: string; device: VulnDevice } | null>(null);

  const route = parseNodeId(selectedPluginNodeId);

  // DeviceModal visibility
  const showAddModal = route.view === 'add-device';
  const showEditModal = route.view === 'edit-device';
  const editDevice = showEditModal && route.deviceId ? getVulnDevice(route.deviceId) : null;

  const handleSaveDevice = useCallback(
    (device: VulnDevice) => {
      const existing = getVulnDevice(device.id);
      if (existing) {
        updateVulnDevice(device.id, device);
      } else {
        addVulnDevice(device);
      }
      setSelectedPluginNodeId(`device:${device.id}`);
    },
    [getVulnDevice, addVulnDevice, updateVulnDevice, setSelectedPluginNodeId],
  );

  const handleCloseModal = useCallback(() => {
    if (showEditModal && route.deviceId) {
      setSelectedPluginNodeId(`device:${route.deviceId}`);
    } else {
      setSelectedPluginNodeId('cisco');
    }
  }, [showEditModal, route.deviceId, setSelectedPluginNodeId]);

  // Active scan in progress
  if (activeScan) {
    return (
      <ScanProgressView
        device={activeScan.device}
        scanId={activeScan.scanId}
        pluginName={pluginName}
        onComplete={(deviceIp, timestamp) => {
          setActiveScan(null);
          setSelectedPluginNodeId(`report:${deviceIp}:${timestamp}`);
        }}
        onCancel={() => {
          setActiveScan(null);
          setSelectedPluginNodeId(`device:${activeScan.device.id}`);
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
          setActiveScan({ scanId, device });
        }}
      />
    );
  }

  // Default: overview + modals
  return (
    <>
      <OverviewPage pluginName={pluginName} />

      {/* Add Device Modal */}
      <DeviceModal
        open={showAddModal}
        device={null}
        onSave={handleSaveDevice}
        onClose={handleCloseModal}
      />

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
