import type { PluginManifest, PluginRegistration, PluginHealthStatus } from '../types/plugin.ts';
import { CONFIGURATIONS_MANIFEST } from './configurations.ts';
import { INFISICAL_MANIFEST } from './infisical/manifest.ts';
import { VULN_CISCO_MANIFEST } from './vuln-cisco/manifest.ts';

const BUNDLED_MANIFESTS: PluginManifest[] = [CONFIGURATIONS_MANIFEST, INFISICAL_MANIFEST, VULN_CISCO_MANIFEST];

/** Names of all shipped plugins — these cannot be deleted by the user. */
export const BUNDLED_PLUGIN_NAMES = new Set(BUNDLED_MANIFESTS.map((m) => m.name));

/**
 * Register all bundled plugins that are not yet registered.
 * Accepts store callbacks as params for testability — does NOT import the store directly.
 */
export function initBundledPlugins(
  getPlugin: (name: string) => PluginRegistration | undefined,
  registerPlugin: (manifest: PluginManifest) => void,
  setPluginHealth: (name: string, health: PluginHealthStatus) => void,
): void {
  for (const manifest of BUNDLED_MANIFESTS) {
    // Always re-register to update manifest (settingsSchema, treeNodes, etc.)
    // registerPlugin preserves existing endpoint, apiKey, settings, and enabled state
    registerPlugin(manifest);

    const existing = getPlugin(manifest.name);
    const needsConfig = manifest.type === 'sidecar' || manifest.type === 'integration';
    const isConfigured = (existing?.endpoint && existing?.apiKey) || Object.keys(existing?.settings ?? {}).length > 0;

    if (needsConfig && !isConfigured) {
      setPluginHealth(manifest.name, {
        status: 'unknown',
        lastChecked: new Date().toISOString(),
      });
    } else {
      setPluginHealth(manifest.name, {
        status: 'active',
        lastChecked: new Date().toISOString(),
      });
    }
  }
}
