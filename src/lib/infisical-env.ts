import type { PluginRegistration } from '../types/plugin.ts';

/** Resolve the Infisical environment slug for a calling plugin.
 *  Chain: plugin-level override → Infisical default → 'dev' fallback. */
export function resolveInfisicalEnv(
  callingPluginName: string,
  getPlugin: (name: string) => PluginRegistration | undefined,
): string {
  const pluginEnv = getPlugin(callingPluginName)?.settings?.infisicalEnvironment;
  if (typeof pluginEnv === 'string' && pluginEnv) return pluginEnv;

  const defaultEnv = getPlugin('forge-infisical')?.settings?.defaultEnvironment;
  if (typeof defaultEnv === 'string' && defaultEnv) return defaultEnv;

  return 'dev';
}
