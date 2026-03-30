import type { PluginManifest, PluginRegistration, PluginHealthStatus } from '../types/plugin.ts';
import { CONFIGURATIONS_MANIFEST } from './configurations.ts';
import { INFISICAL_MANIFEST } from './infisical/manifest.ts';
import { VULN_CISCO_MANIFEST } from './vuln-cisco/manifest.ts';

const BUNDLED_MANIFESTS: PluginManifest[] = [CONFIGURATIONS_MANIFEST, INFISICAL_MANIFEST, VULN_CISCO_MANIFEST];

/** Names of all shipped plugins — these cannot be deleted by the user. */
export const BUNDLED_PLUGIN_NAMES = new Set(BUNDLED_MANIFESTS.map((m) => m.name));

/**
 * Determine whether a plugin registration is fully configured and ready to use.
 * - Bundled plugins with no external deps (type: 'bundled') → always configured
 * - Integration plugins → configured when required settings are populated
 * - Sidecar plugins → configured when endpoint + apiKey are set
 */
export function isPluginConfigured(reg: PluginRegistration): boolean {
  if (reg.manifest.type === 'bundled') return true;
  if (reg.manifest.type === 'sidecar') return Boolean(reg.endpoint && reg.apiKey);
  // Integration: check that required settings are populated
  const schema = reg.manifest.settingsSchema;
  if (!schema) return true;
  const requiredKeys = Object.entries(schema)
    .filter(([, field]) => field.required)
    .map(([key]) => key);
  return requiredKeys.every((key) => {
    const val = reg.settings[key];
    return val !== undefined && val !== '';
  });
}

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

    if (existing && !isPluginConfigured(existing)) {
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
