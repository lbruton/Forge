import { useState, useEffect, useCallback, useRef } from 'react';
import { ShieldAlert, Plus, Play, FileText, MoreVertical, RefreshCw, ArrowLeft, Check } from 'lucide-react';
import { useForgeStore } from '../../store/index.ts';
import { pluginFetch } from '../../lib/plugin-service.ts';
import type { VulnDevice, DeviceSummary, ScanStatus, SeveritySummary } from './types.ts';
import DeviceModal from './DeviceModal.tsx';
import ScanReportViewer from './ScanReportViewer.tsx';

interface VulnDashboardProps {
  pluginName: string;
}

type SubView =
  | { kind: 'device-list' }
  | { kind: 'scan-progress'; scanId: string; device: VulnDevice }
  | { kind: 'scan-report'; device: string; timestamp: string };

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

export default function VulnDashboard({ pluginName }: VulnDashboardProps) {
  const getPlugin = useForgeStore((s) => s.getPlugin);
  const registration = getPlugin(pluginName);

  // Sub-view navigation
  const [subView, setSubView] = useState<SubView>({ kind: 'device-list' });

  // Device list state — local devices (not yet scanned) merged with sidecar results
  const [localDevices, setLocalDevices] = useState<VulnDevice[]>([]);
  const [sidecarDevices, setSidecarDevices] = useState<VulnDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Device modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<VulnDevice | null>(null);

  // Scan progress state
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Merged device list: sidecar results + local-only devices (not yet scanned)
  const devices: VulnDevice[] = (() => {
    const sidecarIps = new Set(sidecarDevices.map((d) => d.ip));
    const localOnly = localDevices.filter((d) => !sidecarIps.has(d.ip));
    return [...sidecarDevices, ...localOnly];
  })();

  // Fetch device list from sidecar
  const fetchDevices = useCallback(async () => {
    if (!registration?.endpoint || !registration?.apiKey) {
      setError('Plugin endpoint or API key is missing');
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
      const mapped: VulnDevice[] = data.map((d) => ({
        id: d.device,
        hostname: d.hostname ?? d.device,
        ip: d.device,
        lastScanAt: d.lastScan,
        lastSeverity: d.severity,
      }));
      setSidecarDevices(mapped);
    } catch (err) {
      console.error('Error fetching device list:', err);
      setError('Unable to connect to vulnerability scanner sidecar');
    } finally {
      setLoading(false);
    }
  }, [registration]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Start scan — reads PSIRT creds from plugin settings
  const startScan = useCallback(
    async (device: VulnDevice) => {
      if (!registration?.endpoint || !registration?.apiKey) return;

      // Read PSIRT credentials from plugin settings
      const ciscoClientId = registration.settings?.ciscoClientId as string | undefined;
      const ciscoClientSecret = registration.settings?.ciscoClientSecret as string | undefined;

      if (!ciscoClientId || !ciscoClientSecret) {
        setError('Configure Cisco PSIRT API credentials in the plugin settings first.');
        return;
      }

      setError(null);

      try {
        const response = await pluginFetch(registration.endpoint, registration.apiKey, '/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target: device.ip,
            hostname: device.hostname,
            snmp_community: device.snmpCommunity ?? 'public',
            cisco_client_id: ciscoClientId,
            cisco_client_secret: ciscoClientSecret,
          }),
        });

        if (!response.ok) {
          setError(`Failed to start scan (status ${response.status})`);
          return;
        }

        const result: { scanId: string } = await response.json();

        setScanStatus({
          scanId: result.scanId,
          status: 'queued',
          device: device.ip,
        });
        setElapsed(0);
        setSubView({ kind: 'scan-progress', scanId: result.scanId, device });

        // Start elapsed timer
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setElapsed((prev) => prev + 1);
        }, 1000);

        // Poll scan status every 3 seconds
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          try {
            const statusResp = await pluginFetch(
              registration.endpoint!,
              registration.apiKey!,
              `/scan/${encodeURIComponent(result.scanId)}/status`,
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
                await fetchDevices();
                setSubView({
                  kind: 'scan-report',
                  device: device.ip,
                  timestamp: status.completedAt ?? new Date().toISOString(),
                });
              }
            }
          } catch {
            // Silently retry on next interval
          }
        }, 3000);
      } catch (err) {
        console.error('Error starting scan:', err);
        setError('Failed to start scan');
      }
    },
    [registration, fetchDevices],
  );

  // Modal handlers
  const handleOpenAdd = () => {
    setEditingDevice(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (device: VulnDevice) => {
    setEditingDevice(device);
    setModalOpen(true);
  };

  const handleSaveDevice = (device: VulnDevice) => {
    setLocalDevices((prev) => {
      const idx = prev.findIndex((d) => d.id === device.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = device;
        return next;
      }
      return [...prev, device];
    });
    setModalOpen(false);
  };

  const formatElapsed = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // -- Scan Progress View --
  if (subView.kind === 'scan-progress') {
    const activeStep = getStepIndex(scanStatus?.progress);
    const isDone = scanStatus?.status === 'complete';
    const isFailed = scanStatus?.status === 'failed';

    return (
      <div className="flex flex-col h-full bg-forge-charcoal">
        <div className="flex-1 overflow-auto p-6">
          {/* Back link */}
          <button
            type="button"
            onClick={() => {
              if (pollRef.current) clearInterval(pollRef.current);
              if (timerRef.current) clearInterval(timerRef.current);
              pollRef.current = null;
              timerRef.current = null;
              setSubView({ kind: 'device-list' });
            }}
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-forge-amber transition-colors mb-4"
          >
            <ArrowLeft size={14} />
            Back to devices
          </button>

          {/* Progress card */}
          <div className="max-w-xl mx-auto mt-10 bg-forge-charcoal border border-forge-graphite rounded-xl p-8">
            {/* Target info */}
            <div className="text-center mb-8">
              <div className="text-xl font-semibold text-slate-200 flex items-center justify-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-forge-amber animate-pulse" />
                {subView.device.hostname}
              </div>
              <div className="font-mono text-sm text-slate-400 mt-1">{subView.device.ip}</div>
            </div>

            {/* Steps */}
            <div className="relative flex items-start justify-between mb-8 px-5">
              {/* Connectors */}
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
                onClick={() => {
                  if (pollRef.current) clearInterval(pollRef.current);
                  if (timerRef.current) clearInterval(timerRef.current);
                  pollRef.current = null;
                  timerRef.current = null;
                  setSubView({ kind: 'device-list' });
                }}
                className="px-4 py-2 text-sm font-medium text-slate-400 border border-forge-graphite rounded-md hover:bg-forge-graphite hover:text-slate-200 transition-colors"
              >
                {isFailed ? 'Back to Devices' : 'Cancel Scan'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -- Scan Report View --
  if (subView.kind === 'scan-report') {
    return (
      <div className="flex flex-col h-full bg-forge-charcoal">
        <div className="flex-1 overflow-auto p-6">
          <ScanReportViewer
            pluginName={pluginName}
            device={subView.device}
            timestamp={subView.timestamp}
            onBack={() => setSubView({ kind: 'device-list' })}
          />
        </div>
      </div>
    );
  }

  // -- Device List View (default) --
  return (
    <div className="flex flex-col h-full bg-forge-charcoal">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-forge-charcoal border-b border-forge-graphite">
        <ShieldAlert size={16} className="text-forge-amber" />
        <span className="text-sm font-medium text-slate-200">Cisco Vulnerability Scanner</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-200">Vulnerabilities</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {registration?.health?.status === 'active' && (
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5" />
              )}
              {devices.length > 0
                ? `${devices.length} device${devices.length !== 1 ? 's' : ''} registered`
                : 'No devices registered'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchDevices}
              disabled={loading}
              className="inline-flex items-center justify-center w-8 h-8 rounded border border-forge-steel text-slate-400 hover:text-forge-amber hover:border-forge-amber/40 transition-colors disabled:opacity-50"
              title="Refresh device list"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-forge-amber text-forge-obsidian rounded-md hover:bg-forge-amber-bright transition-colors"
            >
              <Plus size={14} strokeWidth={2.5} />
              Add Device
            </button>
          </div>
        </div>

        {/* PSIRT creds warning */}
        {!registration?.settings?.ciscoClientId && !registration?.settings?.ciscoClientSecret && (
          <div className="mb-4 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-xs text-amber-400">
              Cisco PSIRT API credentials are not configured. Go to the plugin settings to add your Client ID and Secret
              before scanning.
            </p>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-between">
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
        {!loading && devices.length === 0 && (
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
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-forge-amber text-forge-obsidian rounded-md hover:bg-forge-amber-bright transition-colors"
              >
                <Plus size={14} strokeWidth={2.5} />
                Add Your First Device
              </button>
            </div>
          </div>
        )}

        {/* Device table */}
        {!loading && devices.length > 0 && (
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
                    Severity Summary
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-forge-charcoal border-b border-forge-graphite w-[120px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr
                    key={device.id}
                    className="hover:bg-white/[0.02] transition-colors border-b border-forge-graphite last:border-b-0"
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
                        <span className="font-mono text-[11px] text-slate-500">{device.lastScanAt}</span>
                      ) : (
                        <span className="text-xs text-slate-600">Never</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">{severityBadges(device.lastSeverity)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        {/* Scan button */}
                        <button
                          type="button"
                          onClick={() => void startScan(device)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-forge-amber/10 text-forge-amber border border-forge-amber/25 rounded-md hover:bg-forge-amber/20 transition-colors"
                        >
                          <Play size={12} />
                          Scan
                        </button>
                        {/* View report */}
                        {device.lastScanAt && (
                          <button
                            type="button"
                            onClick={() =>
                              setSubView({
                                kind: 'scan-report',
                                device: device.ip,
                                timestamp: device.lastScanAt!,
                              })
                            }
                            className="inline-flex items-center justify-center w-7 h-7 rounded text-slate-500 hover:text-slate-200 hover:bg-forge-graphite transition-colors"
                            title="View report"
                          >
                            <FileText size={16} />
                          </button>
                        )}
                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(device)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded text-slate-500 hover:text-slate-200 hover:bg-forge-graphite transition-colors"
                          title="Edit device"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Device modal */}
      <DeviceModal
        open={modalOpen}
        device={editingDevice}
        onSave={handleSaveDevice}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
