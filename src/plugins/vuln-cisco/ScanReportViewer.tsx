import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  AlertTriangle,
  ExternalLink,
  Trash2,
  ShieldAlert,
} from 'lucide-react';
import { useForgeStore } from '../../store/index.ts';
import { pluginFetch } from '../../lib/plugin-service.ts';

interface ScanReportViewerProps {
  pluginName: string;
  device: string;
  timestamp: string;
  onBack: () => void;
  onDeleted?: () => void;
}

interface Finding {
  source: string;
  advisory_id: string;
  title: string;
  cve_ids: string[];
  severity: string;
  cvss_base: number;
  cwe: string[];
  summary: string;
  first_fixed: string[];
  first_published: string;
  url: string;
  bug_ids: string[];
}

interface ScanReport {
  scan_date: string;
  scanner: string;
  device_info: {
    ip: string;
    hostname: string;
    platform: string;
    version: string;
    model: string;
    image?: string;
    sysdescr?: string;
    location?: string;
    uptime?: string;
  };
  severity_summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  findings_count: number;
  findings: Finding[];
  notes: string[];
}

type ReportState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; report: ScanReport };

function fixTimestamp(ts: string): string {
  return ts.replace(
    /T(\d{2})-(\d{2})-(\d{2})(.*?)([+-]\d{2})-(\d{2})$/,
    'T$1:$2:$3$4$5:$6',
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(fixTimestamp(iso));
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const SEV_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  CRITICAL: { bg: 'bg-red-600', text: 'text-red-500', bar: 'bg-red-600' },
  HIGH: { bg: 'bg-orange-600', text: 'text-orange-500', bar: 'bg-orange-600' },
  MEDIUM: { bg: 'bg-yellow-600', text: 'text-yellow-500', bar: 'bg-yellow-600' },
  LOW: { bg: 'bg-blue-600', text: 'text-blue-500', bar: 'bg-blue-600' },
  INFO: { bg: 'bg-slate-600', text: 'text-slate-500', bar: 'bg-slate-600' },
};

const SOURCE_STYLES: Record<string, string> = {
  cisco_openvuln: 'bg-emerald-900/50 text-emerald-400',
  nuclei: 'bg-purple-900/50 text-purple-400',
  nvd: 'bg-blue-900/50 text-blue-400',
};

export default function ScanReportViewer({
  pluginName,
  device,
  timestamp,
  onBack,
  onDeleted,
}: ScanReportViewerProps) {
  const [state, setState] = useState<ReportState>({ kind: 'loading' });
  const [deleting, setDeleting] = useState(false);
  const getPlugin = useForgeStore((s) => s.getPlugin);

  const fetchReport = useCallback(async () => {
    const registration = getPlugin(pluginName);
    if (!registration?.endpoint || !registration?.apiKey) {
      setState({ kind: 'error', message: 'Plugin endpoint or API key is missing' });
      return;
    }

    setState({ kind: 'loading' });

    try {
      const response = await pluginFetch(
        registration.endpoint,
        registration.apiKey,
        `/results/${encodeURIComponent(device)}/${encodeURIComponent(timestamp)}`,
        { headers: { Accept: 'application/json' } },
      );

      if (!response.ok) {
        setState({ kind: 'error', message: `Failed to load report (status ${response.status})` });
        return;
      }

      const report: ScanReport = await response.json();
      setState({ kind: 'loaded', report });
    } catch (err) {
      console.error('Error fetching scan report:', err);
      setState({ kind: 'error', message: 'Unable to load scan report from sidecar' });
    }
  }, [pluginName, device, timestamp, getPlugin]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleDelete = useCallback(async () => {
    const registration = getPlugin(pluginName);
    if (!registration?.endpoint || !registration?.apiKey) return;
    if (!confirm('Delete this scan result? This cannot be undone.')) return;

    setDeleting(true);
    try {
      const response = await pluginFetch(
        registration.endpoint,
        registration.apiKey,
        `/results/${encodeURIComponent(device)}/${encodeURIComponent(timestamp)}`,
        { method: 'DELETE' },
      );
      if (response.ok || response.status === 204) {
        onDeleted?.();
        onBack();
      } else {
        alert('Failed to delete scan result.');
      }
    } catch {
      alert('Failed to delete scan result.');
    } finally {
      setDeleting(false);
    }
  }, [pluginName, device, timestamp, getPlugin, onBack, onDeleted]);

  return (
    <div className="flex flex-col h-full">
      {/* Back button + delete */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-forge-amber transition-colors"
        >
          <ArrowLeft size={14} />
          Back to device
        </button>
        {state.kind === 'loaded' && (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 border border-red-500/30 rounded-md hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            <Trash2 size={12} />
            Delete Scan
          </button>
        )}
      </div>

      {/* Loading */}
      {state.kind === 'loading' && (
        <div className="flex-1 flex items-center justify-center">
          <div
            className="w-6 h-6 border-2 border-forge-amber/30 border-t-forge-amber rounded-full animate-spin"
            role="status"
            aria-label="Loading report"
          />
        </div>
      )}

      {/* Error */}
      {state.kind === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <AlertTriangle size={24} className="text-red-400" />
          <p className="text-sm text-slate-500">{state.message}</p>
          <button
            type="button"
            onClick={fetchReport}
            className="px-3 py-1.5 text-xs font-medium text-forge-amber border border-forge-amber/40 rounded-md hover:bg-forge-amber/10 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Report content */}
      {state.kind === 'loaded' && <ReportContent report={state.report} />}
    </div>
  );
}

// ========================
// Report Content — native React rendering
// ========================

function ReportContent({ report }: { report: ScanReport }) {
  const { device_info, severity_summary, findings, notes } = report;
  const total = findings.length;
  const sev = severity_summary;

  // Severity bar segments
  const segments = [
    { label: 'Critical', count: sev.critical, color: 'bg-red-600' },
    { label: 'High', count: sev.high, color: 'bg-orange-600' },
    { label: 'Medium', count: sev.medium, color: 'bg-yellow-600' },
    { label: 'Low', count: sev.low + sev.info, color: 'bg-blue-600' },
  ].filter((s) => s.count > 0);

  return (
    <div className="flex-1 overflow-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
        <div>
          <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
            <ShieldAlert size={20} className="text-forge-amber" />
            Vulnerability Scan Report
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Forge Cisco Vulnerability Scanner
          </p>
        </div>
        <div className="text-xs text-slate-500 sm:text-right">
          <div>{formatDate(report.scan_date)}</div>
          <div>{report.scanner}</div>
        </div>
      </div>

      {/* Device info card */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 bg-forge-charcoal border border-forge-graphite rounded-lg p-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Hostname</div>
          <div className="text-sm text-slate-200 mt-0.5 font-mono">{device_info.hostname}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">IP Address</div>
          <div className="text-sm text-slate-200 mt-0.5 font-mono">{device_info.ip}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Platform</div>
          <div className="text-sm text-slate-200 mt-0.5">Cisco {device_info.platform.toUpperCase()}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Software Version</div>
          <div className="text-sm text-slate-200 mt-0.5 font-mono">{device_info.version}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Model</div>
          <div className="text-sm text-slate-200 mt-0.5">{device_info.model}</div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="flex gap-3 flex-wrap">
        <StatCard label="Total" count={total} colorClass="text-sky-400" />
        <StatCard label="Critical" count={sev.critical} colorClass="text-red-500" />
        <StatCard label="High" count={sev.high} colorClass="text-orange-500" />
        <StatCard label="Medium" count={sev.medium} colorClass="text-yellow-500" />
        <StatCard label="Low" count={sev.low + sev.info} colorClass="text-blue-500" />
      </div>

      {/* Severity bar */}
      {total > 0 && (
        <div className="flex h-10 rounded-lg overflow-hidden bg-forge-charcoal">
          {segments.map((seg) => (
            <div
              key={seg.label}
              className={`${seg.color} flex items-center justify-center text-xs font-semibold text-white`}
              style={{ flex: seg.count }}
            >
              {seg.count} {seg.label}
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {notes.length > 0 && (
        <div className="bg-forge-charcoal border border-forge-graphite rounded-lg p-4">
          <h3 className="text-xs font-semibold text-sky-400 mb-2">Notes</h3>
          <ul className="list-disc pl-5 space-y-0.5">
            {notes.map((note, i) => (
              <li key={i} className="text-xs text-slate-400">{note}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Findings table */}
      <div className="bg-forge-charcoal border border-forge-graphite rounded-lg overflow-x-auto">
        <table className="w-full border-collapse text-[13px] min-w-[900px]">
          <thead>
            <tr className="bg-forge-graphite/50">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Severity</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">CVSS</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">CVE</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Advisory</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Description</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Fix Version</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Bug IDs</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Source</th>
            </tr>
          </thead>
          <tbody>
            {findings.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                  No vulnerabilities found.
                </td>
              </tr>
            ) : (
              findings.map((f, i) => <FindingRow key={`${f.advisory_id}-${i}`} finding={f} />)
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] text-slate-600 pb-4">
        Sources: Cisco PSIRT openVuln API &middot; Nuclei Network Scanner
      </div>
    </div>
  );
}

function StatCard({ label, count, colorClass }: { label: string; count: number; colorClass: string }) {
  return (
    <div className="flex-1 min-w-[100px] bg-forge-charcoal border border-forge-graphite rounded-lg p-3 text-center">
      <div className={`text-2xl font-bold font-mono ${colorClass}`}>{count}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  const sev = finding.severity;
  const colors = SEV_COLORS[sev] ?? SEV_COLORS.INFO;
  const sourceStyle = SOURCE_STYLES[finding.source] ?? 'bg-slate-700 text-slate-300';

  return (
    <tr className="border-t border-forge-graphite/50 hover:bg-white/[0.02] transition-colors">
      {/* Severity badge */}
      <td className="px-4 py-2.5">
        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold text-white ${colors.bg}`}>
          {sev}
        </span>
      </td>

      {/* CVSS */}
      <td className="px-3 py-2.5 font-mono font-bold text-sm text-slate-200">
        {finding.cvss_base.toFixed(1)}
      </td>

      {/* CVE links */}
      <td className="px-3 py-2.5">
        {finding.cve_ids.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {finding.cve_ids.map((cve) => (
              <a
                key={cve}
                href={`https://nvd.nist.gov/vuln/detail/${cve}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:underline text-xs font-mono inline-flex items-center gap-1"
              >
                {cve}
                <ExternalLink size={10} />
              </a>
            ))}
          </div>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>

      {/* Advisory link */}
      <td className="px-3 py-2.5">
        {finding.advisory_id && finding.url ? (
          <a
            href={finding.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 hover:underline text-xs inline-flex items-center gap-1"
          >
            {finding.advisory_id}
            <ExternalLink size={10} />
          </a>
        ) : (
          <span className="text-xs text-slate-500">{finding.advisory_id || '—'}</span>
        )}
      </td>

      {/* Description */}
      <td className="px-3 py-2.5 text-xs text-slate-300 max-w-[300px]">
        {finding.title}
      </td>

      {/* Fix version */}
      <td className="px-3 py-2.5 text-xs text-slate-400 font-mono">
        {finding.first_fixed?.join(', ') || '—'}
      </td>

      {/* Bug IDs */}
      <td className="px-3 py-2.5 text-xs text-slate-400 font-mono">
        {finding.bug_ids?.join(', ') || '—'}
      </td>

      {/* Source badge */}
      <td className="px-3 py-2.5">
        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${sourceStyle}`}>
          {finding.source === 'cisco_openvuln' ? 'Cisco' : finding.source}
        </span>
      </td>
    </tr>
  );
}
