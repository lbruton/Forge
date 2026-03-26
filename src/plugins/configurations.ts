import type { PluginManifest } from '../types/plugin';

export const CONFIGURATIONS_MANIFEST: PluginManifest = {
  name: 'forge-configurations',
  displayName: 'Configurations',
  version: '1.0.0',
  icon: 'file-code-2',
  type: 'bundled',
  vendors: [],
  treeNodes: [{
    id: 'configurations',
    label: 'Configurations',
    icon: 'file-code-2',
    vendorScoped: false,
  }],
};
