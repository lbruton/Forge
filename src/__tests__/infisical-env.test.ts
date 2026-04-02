import { describe, it, expect } from 'vitest';
import { resolveInfisicalEnv } from '../lib/infisical-env.ts';
import type { PluginRegistration } from '../types/plugin.ts';

/** Helper to build a minimal PluginRegistration with given settings */
function fakePlugin(settings: Record<string, string | number | boolean>): PluginRegistration {
  return {
    manifest: { name: '', displayName: '', version: '1.0.0', icon: '', type: 'bundled', vendors: [], treeNodes: [] },
    enabled: true,
    settings,
    health: { status: 'active', lastChecked: new Date().toISOString() },
  };
}

describe('resolveInfisicalEnv', () => {
  it('returns the plugin-level infisicalEnvironment when set', () => {
    const getPlugin = (name: string) => {
      if (name === 'forge-vuln-cisco') return fakePlugin({ infisicalEnvironment: 'vulnerabilities' });
      if (name === 'forge-infisical') return fakePlugin({ defaultEnvironment: 'production' });
      return undefined;
    };
    expect(resolveInfisicalEnv('forge-vuln-cisco', getPlugin)).toBe('vulnerabilities');
  });

  it('falls back to Infisical defaultEnvironment when plugin env is empty', () => {
    const getPlugin = (name: string) => {
      if (name === 'forge-vuln-cisco') return fakePlugin({});
      if (name === 'forge-infisical') return fakePlugin({ defaultEnvironment: 'production' });
      return undefined;
    };
    expect(resolveInfisicalEnv('forge-vuln-cisco', getPlugin)).toBe('production');
  });

  it('returns "dev" when neither plugin nor Infisical has an environment', () => {
    const getPlugin = (name: string) => {
      if (name === 'forge-vuln-cisco') return fakePlugin({});
      if (name === 'forge-infisical') return fakePlugin({});
      return undefined;
    };
    expect(resolveInfisicalEnv('forge-vuln-cisco', getPlugin)).toBe('dev');
  });

  it('falls back to Infisical default when calling plugin is not registered', () => {
    const getPlugin = (name: string) => {
      if (name === 'forge-infisical') return fakePlugin({ defaultEnvironment: 'staging' });
      return undefined;
    };
    expect(resolveInfisicalEnv('forge-vuln-cisco', getPlugin)).toBe('staging');
  });

  it('returns "dev" when neither plugin is registered', () => {
    const getPlugin = () => undefined;
    expect(resolveInfisicalEnv('forge-vuln-cisco', getPlugin)).toBe('dev');
  });
});
