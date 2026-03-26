import { describe, it, expect, beforeEach } from 'vitest';
import { useForgeStore } from '../store/index.ts';
import type { PluginManifest } from '../types/plugin.ts';

// --- Helpers ---

function validManifest(overrides?: Partial<PluginManifest>): PluginManifest {
  return {
    name: 'forge-vuln-cisco',
    displayName: 'Cisco PSIRT/Nuclei Scan',
    version: '1.0.0',
    icon: 'shield-alert',
    type: 'sidecar',
    vendors: ['cisco'],
    treeNodes: [{ id: 'vulnerabilities', label: 'Vulnerabilities', icon: 'shield-alert', vendorScoped: true }],
    ...overrides,
  };
}

/** Create a view in the store and return its ID */
function createView(name = 'Test View'): string {
  const view = useForgeStore.getState().addView(name);
  return view.id;
}

// --- Reset store between tests ---

beforeEach(() => {
  useForgeStore.getState().resetAll();
});

// --- registerPlugin ---

describe('registerPlugin', () => {
  it('registers a plugin that appears in getViewPlugins', () => {
    const viewId = createView();
    const manifest = validManifest();

    useForgeStore.getState().registerPlugin(viewId, manifest, 'http://localhost:9001', 'key');

    const plugins = useForgeStore.getState().getViewPlugins(viewId);
    expect(plugins).toHaveLength(1);
    expect(plugins[0].manifest.name).toBe('forge-vuln-cisco');
  });

  it('defaults health to unknown with empty lastChecked', () => {
    const viewId = createView();
    useForgeStore.getState().registerPlugin(viewId, validManifest());

    const plugins = useForgeStore.getState().getViewPlugins(viewId);
    expect(plugins[0].health).toEqual({ status: 'unknown', lastChecked: '' });
  });

  it('defaults enabled to true', () => {
    const viewId = createView();
    useForgeStore.getState().registerPlugin(viewId, validManifest());

    const plugins = useForgeStore.getState().getViewPlugins(viewId);
    expect(plugins[0].enabled).toBe(true);
  });
});

// --- unregisterPlugin ---

describe('unregisterPlugin', () => {
  it('removes a previously registered plugin', () => {
    const viewId = createView();
    useForgeStore.getState().registerPlugin(viewId, validManifest());

    useForgeStore.getState().unregisterPlugin(viewId, 'forge-vuln-cisco');

    const plugins = useForgeStore.getState().getViewPlugins(viewId);
    expect(plugins).toHaveLength(0);
  });
});

// --- setPluginEnabled ---

describe('setPluginEnabled', () => {
  it('disables a plugin', () => {
    const viewId = createView();
    useForgeStore.getState().registerPlugin(viewId, validManifest());

    useForgeStore.getState().setPluginEnabled(viewId, 'forge-vuln-cisco', false);

    const plugins = useForgeStore.getState().getViewPlugins(viewId);
    expect(plugins[0].enabled).toBe(false);
  });
});

// --- setPluginHealth ---

describe('setPluginHealth', () => {
  it('updates the health status of a plugin', () => {
    const viewId = createView();
    useForgeStore.getState().registerPlugin(viewId, validManifest());

    const newHealth = { status: 'active' as const, lastChecked: '2026-03-25T00:00:00.000Z' };
    useForgeStore.getState().setPluginHealth(viewId, 'forge-vuln-cisco', newHealth);

    const plugins = useForgeStore.getState().getViewPlugins(viewId);
    expect(plugins[0].health).toEqual(newHealth);
  });
});

// --- getViewPlugins ---

describe('getViewPlugins', () => {
  it('returns only plugins for the specified viewId', () => {
    const viewId1 = createView('View A');
    const viewId2 = createView('View B');

    useForgeStore.getState().registerPlugin(viewId1, validManifest({ name: 'plugin-a' }));
    useForgeStore.getState().registerPlugin(viewId2, validManifest({ name: 'plugin-b' }));

    const pluginsA = useForgeStore.getState().getViewPlugins(viewId1);
    const pluginsB = useForgeStore.getState().getViewPlugins(viewId2);

    expect(pluginsA).toHaveLength(1);
    expect(pluginsA[0].manifest.name).toBe('plugin-a');
    expect(pluginsB).toHaveLength(1);
    expect(pluginsB[0].manifest.name).toBe('plugin-b');
  });

  it('returns empty array for view with no plugins', () => {
    const viewId = createView();
    const plugins = useForgeStore.getState().getViewPlugins(viewId);
    expect(plugins).toEqual([]);
  });
});
