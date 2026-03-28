import { useState, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { useForgeStore } from '../../store/index.ts';
import { pluginFetch } from '../../lib/plugin-service.ts';

interface ScanReportViewerProps {
  pluginName: string;
  device: string;
  timestamp: string;
  onBack: () => void;
}

type ReportState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'loaded'; html: string };

export default function ScanReportViewer({ pluginName, device, timestamp, onBack }: ScanReportViewerProps) {
  const [state, setState] = useState<ReportState>({ kind: 'loading' });
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
        { headers: { Accept: 'text/html' } },
      );

      if (!response.ok) {
        setState({ kind: 'error', message: `Failed to load report (status ${response.status})` });
        return;
      }

      const html = await response.text();
      // Sanitize all sidecar HTML — same DOMPurify config as PluginContentView
      const clean = DOMPurify.sanitize(html, {
        ADD_TAGS: ['style'],
        ADD_ATTR: ['class', 'style'],
      });

      setState({ kind: 'loaded', html: clean });
    } catch (err) {
      console.error('Error fetching scan report:', err);
      setState({ kind: 'error', message: 'Unable to load scan report from sidecar' });
    }
  }, [pluginName, device, timestamp, getPlugin]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return (
    <div className="flex flex-col h-full">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-forge-amber transition-colors mb-4 self-start"
      >
        <ArrowLeft size={14} />
        Back to devices
      </button>

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

      {/* Report content — HTML is sanitized by DOMPurify above */}
      {state.kind === 'loaded' && (
        <div className="flex-1 overflow-auto bg-[#0c1222] border border-forge-graphite rounded-xl">
          {/* Terminal bar */}
          <div className="flex items-center gap-2 px-4 py-2 bg-forge-charcoal border-b border-forge-graphite">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="ml-2 text-xs text-slate-400 font-mono">
              scan-report &mdash; {device} &mdash; {timestamp}
            </span>
          </div>
          <div className="p-5" dangerouslySetInnerHTML={{ __html: state.html }} />
        </div>
      )}
    </div>
  );
}
