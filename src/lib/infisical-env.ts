import type { PluginRegistration } from '../types/plugin';

/** Resolve the Infisical environment slug for a calling plugin.
 *  Chain: plugin-level override → Infisical default → 'dev' fallback. */
export function resolveInfisicalEnv(
  callingPluginName: string,
  getPlugin: (name: string) => PluginRegistration | undefined,
): string {
  const pluginEnv = getPlugin(callingPluginName)?.settings?.infisicalEnvironment as string;
  if (pluginEnv) return pluginEnv;

  const defaultEnv = getPlugin('forge-infisical')?.settings?.defaultEnvironment as string;
  if (defaultEnv) return defaultEnv;

  return 'dev';
}
