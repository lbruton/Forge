import type { PluginManifest, PluginRegistration, PluginHealthStatus } from '../types/plugin';
import { CONFIGURATIONS_MANIFEST } from './configurations';

const BUNDLED_MANIFESTS: PluginManifest[] = [
  CONFIGURATIONS_MANIFEST,
];

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
    if (getPlugin(manifest.name) === undefined) {
      registerPlugin(manifest);
    }
    setPluginHealth(manifest.name, {
      status: 'active',
      lastChecked: new Date().toISOString(),
    });
  }
}
