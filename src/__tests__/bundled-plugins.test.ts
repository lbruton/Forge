import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useForgeStore } from '../store/index.ts';
import { CONFIGURATIONS_MANIFEST } from '../plugins/configurations.ts';
import { initBundledPlugins } from '../plugins/init.ts';
import { validateManifest } from '../lib/plugin-service.ts';
import type { PluginManifest } from '../types/plugin.ts';

// --- Reset store between tests ---

beforeEach(() => {
  useForgeStore.getState().resetAll();
});

// --- initBundledPlugins ---

describe('initBundledPlugins', () => {
  it('registers Configurations when not present', () => {
    const getPlugin = vi.fn().mockReturnValue(undefined);
    const registerPlugin = vi.fn();
    const setPluginHealth = vi.fn();

    initBundledPlugins(getPlugin, registerPlugin, setPluginHealth);

    expect(registerPlugin).toHaveBeenCalledWith(CONFIGURATIONS_MANIFEST);
    expect(setPluginHealth).toHaveBeenCalledWith('forge-configurations', expect.objectContaining({ status: 'active' }));
  });

  it('skips registration when already registered', () => {
    const getPlugin = vi.fn().mockReturnValue({
      manifest: CONFIGURATIONS_MANIFEST,
      enabled: true,
      health: { status: 'unknown', lastChecked: '' },
    });
    const registerPlugin = vi.fn();
    const setPluginHealth = vi.fn();

    initBundledPlugins(getPlugin, registerPlugin, setPluginHealth);

    expect(registerPlugin).not.toHaveBeenCalled();
    expect(setPluginHealth).toHaveBeenCalledWith('forge-configurations', expect.objectContaining({ status: 'active' }));
  });
});

// --- Store bundled deletion guard ---

describe('Store bundled plugin deletion guard', () => {
  it('blocks deletion of bundled plugins', () => {
    useForgeStore.getState().registerPlugin(CONFIGURATIONS_MANIFEST);

    useForgeStore.getState().unregisterPlugin('forge-configurations');

    const plugin = useForgeStore.getState().getPlugin('forge-configurations');
    expect(plugin).toBeDefined();
    expect(plugin!.manifest.name).toBe('forge-configurations');
  });

  it('allows deletion of sidecar plugins', () => {
    const sidecarManifest: PluginManifest = {
      name: 'forge-test-sidecar',
      displayName: 'Test Sidecar',
      version: '1.0.0',
      icon: 'shield-alert',
      type: 'sidecar',
      vendors: ['cisco'],
      treeNodes: [{ id: 'test', label: 'Test', icon: 'shield-alert', vendorScoped: true }],
    };

    useForgeStore.getState().registerPlugin(sidecarManifest, 'http://localhost:9001', 'key');
    expect(useForgeStore.getState().getPlugin('forge-test-sidecar')).toBeDefined();

    useForgeStore.getState().unregisterPlugin('forge-test-sidecar');

    expect(useForgeStore.getState().getPlugin('forge-test-sidecar')).toBeUndefined();
  });
});

// --- validateManifest ---

describe('CONFIGURATIONS_MANIFEST validation', () => {
  it('passes validateManifest without errors', () => {
    expect(() => validateManifest(CONFIGURATIONS_MANIFEST)).not.toThrow();
    const result = validateManifest(CONFIGURATIONS_MANIFEST);
    expect(result.name).toBe('forge-configurations');
    expect(result.type).toBe('bundled');
  });
});
