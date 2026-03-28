import type { PluginManifest } from '../../types/plugin.ts';

export const INFISICAL_MANIFEST: PluginManifest = {
  name: 'forge-infisical',
  displayName: 'Infisical Secrets',
  version: '1.0.0',
  icon: 'shield',
  type: 'integration',
  vendors: [],
  treeNodes: [
    {
      id: 'secrets',
      label: 'Secrets',
      icon: 'shield',
      vendorScoped: false,
    },
  ],
  settingsSchema: {
    endpoint: { type: 'string', label: 'Infisical API URL', required: true },
    clientId: { type: 'string', label: 'Client ID', required: true },
    clientSecret: { type: 'password', label: 'Client Secret', required: true },
    defaultProjectId: { type: 'string', label: 'Default Project ID' },
    defaultEnvironment: { type: 'string', label: 'Default Environment', default: 'dev' },
  },
};
