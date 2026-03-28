import type { PluginManifest } from '../../types/plugin.ts';

export const VULN_CISCO_MANIFEST: PluginManifest = {
  name: 'forge-vuln-cisco',
  displayName: 'Cisco Vulnerability Scanner',
  version: '1.0.0',
  icon: 'shield-alert',
  type: 'sidecar',
  vendors: ['cisco'],
  treeNodes: [
    { id: 'vulnerabilities', label: 'Vulnerabilities', icon: 'shield-alert', vendorScoped: false },
  ],
};
