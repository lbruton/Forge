import { describe, it, expect, beforeEach } from 'vitest';
import { useForgeStore } from '../store/index.ts';
import type { PluginManifest } from '../types/plugin.ts';
import type { VaultExportData, View } from '../types/index.ts';

// --- Helpers ---

function validManifest(overrides?: Partial<PluginManifest>): PluginManifest {
  return {
    name: 'forge-test-plugin',
    displayName: 'Test Plugin',
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
  it('registers a plugin that appears in getPlugins', () => {
    createView();
    const manifest = validManifest();

    useForgeStore.getState().registerPlugin(manifest, 'http://localhost:9001', 'key');

    const plugins = useForgeStore.getState().getPlugins();
    expect(plugins).toHaveLength(1);
    expect(plugins[0].manifest.name).toBe('forge-test-plugin');
  });

  it('defaults health to unknown with empty lastChecked', () => {
    createView();
    useForgeStore.getState().registerPlugin(validManifest());

    const plugins = useForgeStore.getState().getPlugins();
    expect(plugins[0].health).toEqual({ status: 'unknown', lastChecked: '' });
  });

  it('defaults enabled to true', () => {
    createView();
    useForgeStore.getState().registerPlugin(validManifest());

    const plugins = useForgeStore.getState().getPlugins();
    expect(plugins[0].enabled).toBe(true);
  });
});

// --- unregisterPlugin ---

describe('unregisterPlugin', () => {
  it('removes a previously registered plugin', () => {
    createView();
    useForgeStore.getState().registerPlugin(validManifest());

    useForgeStore.getState().unregisterPlugin('forge-test-plugin');

    const plugins = useForgeStore.getState().getPlugins();
    expect(plugins).toHaveLength(0);
  });
});

// --- setPluginEnabled ---

describe('setPluginEnabled', () => {
  it('disables a plugin', () => {
    createView();
    useForgeStore.getState().registerPlugin(validManifest());

    useForgeStore.getState().setPluginEnabled('forge-test-plugin', false);

    const plugins = useForgeStore.getState().getPlugins();
    expect(plugins[0].enabled).toBe(false);
  });
});

// --- setPluginHealth ---

describe('setPluginHealth', () => {
  it('updates the health status of a plugin', () => {
    createView();
    useForgeStore.getState().registerPlugin(validManifest());

    const newHealth = { status: 'active' as const, lastChecked: '2026-03-25T00:00:00.000Z' };
    useForgeStore.getState().setPluginHealth('forge-test-plugin', newHealth);

    const plugins = useForgeStore.getState().getPlugins();
    expect(plugins[0].health).toEqual(newHealth);
  });
});

// --- getPlugins ---

describe('getPlugins', () => {
  it('returns all registered plugins', () => {
    createView();

    useForgeStore.getState().registerPlugin(validManifest({ name: 'plugin-a' }));
    useForgeStore.getState().registerPlugin(validManifest({ name: 'plugin-b' }));

    const plugins = useForgeStore.getState().getPlugins();
    expect(plugins).toHaveLength(2);
    const names = plugins.map((p) => p.manifest.name).sort();
    expect(names).toEqual(['plugin-a', 'plugin-b']);
  });

  it('returns empty array when no plugins registered', () => {
    createView();
    const plugins = useForgeStore.getState().getPlugins();
    expect(plugins).toEqual([]);
  });
});

// --- getPlugin ---

describe('getPlugin', () => {
  it('returns a specific plugin registration by name', () => {
    createView();
    useForgeStore.getState().registerPlugin(validManifest());

    const plugin = useForgeStore.getState().getPlugin('forge-test-plugin');
    expect(plugin).toBeDefined();
    expect(plugin!.manifest.name).toBe('forge-test-plugin');
  });

  it('returns undefined for a nonexistent plugin', () => {
    createView();
    const plugin = useForgeStore.getState().getPlugin('nonexistent');
    expect(plugin).toBeUndefined();
  });
});

// --- exportData: credential stripping (FORGE-64) ---

describe('exportData credential stripping', () => {
  it('strips apiKey from sidecar plugin registrations', () => {
    createView();
    useForgeStore.getState().registerPlugin(validManifest(), 'http://localhost:9001', 'secret-bearer-token');

    const exported = useForgeStore.getState().exportData();

    const plugin = exported.plugins!['forge-test-plugin'];
    expect(plugin).toBeDefined();
    expect(plugin.apiKey).toBeUndefined();
    expect(plugin.endpoint).toBe('http://localhost:9001');
  });

  it('strips password-type settings fields', () => {
    createView();
    const manifest = validManifest({
      name: 'forge-infisical-test',
      type: 'integration',
      settingsSchema: {
        endpoint: { type: 'string', label: 'URL', required: true },
        clientId: { type: 'string', label: 'Client ID', required: true },
        clientSecret: { type: 'password', label: 'Client Secret', required: true },
      },
    });
    useForgeStore.getState().registerPlugin(manifest);
    useForgeStore.getState().updatePluginSettings('forge-infisical-test', {
      endpoint: 'https://infisical.local',
      clientId: 'my-client-id',
      clientSecret: 'super-secret',
    });

    const exported = useForgeStore.getState().exportData();

    const plugin = exported.plugins!['forge-infisical-test'];
    expect(plugin.settings.endpoint).toBe('https://infisical.local');
    expect(plugin.settings.clientId).toBe('my-client-id');
    expect(plugin.settings.clientSecret).toBeUndefined();
  });

  it('resets health to unknown in exported data', () => {
    createView();
    useForgeStore.getState().registerPlugin(validManifest(), 'http://localhost:9001', 'key');
    useForgeStore.getState().setPluginHealth('forge-test-plugin', {
      status: 'active',
      lastChecked: '2026-03-30T00:00:00.000Z',
    });

    const exported = useForgeStore.getState().exportData();

    const plugin = exported.plugins!['forge-test-plugin'];
    expect(plugin.health.status).toBe('unknown');
    expect(plugin.health.lastChecked).toBe('');
  });

  it('preserves non-sensitive settings and manifest', () => {
    createView();
    const manifest = validManifest({
      settingsSchema: {
        url: { type: 'string', label: 'URL' },
        secret: { type: 'password', label: 'Secret' },
      },
    });
    useForgeStore.getState().registerPlugin(manifest);
    useForgeStore.getState().updatePluginSettings('forge-test-plugin', {
      url: 'http://example.com',
      secret: 'hidden',
    });

    const exported = useForgeStore.getState().exportData();

    const plugin = exported.plugins!['forge-test-plugin'];
    expect(plugin.manifest.name).toBe('forge-test-plugin');
    expect(plugin.settings.url).toBe('http://example.com');
    expect(plugin.settings.secret).toBeUndefined();
  });
});

// --- Migration: old view-scoped plugins → global ---

describe('importData plugin migration', () => {
  it('migrates old view-scoped plugins to the global registry', () => {
    createView('Existing View');

    const oldFormatData: VaultExportData & { views: (View & { plugins?: Record<string, unknown> })[] } = {
      exportedAt: new Date().toISOString(),
      templates: {},
      variableValues: {},
      views: [
        {
          id: 'imported-view',
          name: 'Imported View',
          vendors: [],
          globalVariables: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // Old format: plugins lived on the view
          plugins: {
            'legacy-plugin': {
              manifest: validManifest({ name: 'legacy-plugin', displayName: 'Legacy Plugin' }),
              enabled: true,
              health: { status: 'unknown' as const, lastChecked: '' },
            },
          },
        },
      ],
    };

    useForgeStore.getState().importData(oldFormatData);

    const plugins = useForgeStore.getState().getPlugins();
    expect(plugins).toHaveLength(1);
    expect(plugins[0].manifest.name).toBe('legacy-plugin');
  });
});
