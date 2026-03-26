import { useCallback, useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { useForgeStore } from '../store/index.ts';
import { pluginFetch } from '../lib/plugin-service.ts';

interface PluginContentViewProps {
  pluginName: string;
  nodeId: string;
  viewId: string;
}

type ContentState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; html: string }
  | { kind: 'bundled' };

export default function PluginContentView({ pluginName, nodeId, viewId: _viewId }: PluginContentViewProps) {
  const [state, setState] = useState<ContentState>({ kind: 'loading' });
  const getPlugin = useForgeStore((s) => s.getPlugin);

  const registration = getPlugin(pluginName);
  const displayName = registration?.manifest.displayName ?? pluginName;
  const nodeLabel = registration?.manifest.treeNodes.find((n) => n.id === nodeId)?.label ?? nodeId;

  const fetchContent = useCallback(async () => {
    if (!registration) {
      setState({ kind: 'error', message: `Plugin "${pluginName}" is not registered` });
      return;
    }

    if (registration.manifest.type === 'bundled') {
      setState({ kind: 'bundled' });
      return;
    }

    // Sidecar plugin — fetch content
    if (!registration.endpoint || !registration.apiKey) {
      setState({ kind: 'error', message: 'Plugin endpoint or API key is missing' });
      return;
    }

    setState({ kind: 'loading' });

    try {
      const response = await pluginFetch(
        registration.endpoint,
        registration.apiKey,
        '/content/' + nodeId,
      );

      if (!response.ok) {
        setState({ kind: 'error', message: `Unable to load data from ${displayName}` });
        return;
      }

      const html = await response.text();
      // ALL sidecar HTML MUST be sanitized — no exceptions
      const clean = DOMPurify.sanitize(html, {
        ADD_TAGS: ['style'],
        ADD_ATTR: ['class', 'style'],
      });

      setState({ kind: 'loaded', html: clean });
    } catch (err) {
      console.error(`Error fetching content from plugin '${pluginName}':`, err);
      setState({ kind: 'error', message: `Unable to load data from ${displayName}` });
    }
  }, [registration, pluginName, nodeId, displayName]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  return (
    <div className="flex flex-col h-full bg-forge-terminal">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-forge-charcoal border-b border-forge-graphite">
        <span className="text-sm font-medium text-slate-200">{displayName}</span>
        <span className="text-slate-600 text-sm">/</span>
        <span className="text-sm text-slate-400">{nodeLabel}</span>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {state.kind === 'loading' && (
          <div className="flex items-center justify-center h-full">
            <div
              className="w-6 h-6 border-2 border-forge-amber/30 border-t-forge-amber rounded-full animate-spin"
              role="status"
              aria-label="Loading"
            />
          </div>
        )}

        {state.kind === 'error' && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-sm text-slate-500">{state.message}</p>
            <button
              type="button"
              onClick={fetchContent}
              className="px-3 py-1.5 text-xs font-medium text-forge-amber border border-forge-amber/40 rounded-md hover:bg-forge-amber/10 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {state.kind === 'loaded' && (
          <div
            className="p-6"
            dangerouslySetInnerHTML={{ __html: state.html }}
          />
        )}

        {state.kind === 'bundled' && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-slate-500">
              Content not available for bundled plugins
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
