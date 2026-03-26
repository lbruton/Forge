// Plugin type definitions for the Forge plugin framework

/** PluginManifest — describes what a plugin is and what it contributes */
export interface PluginManifest {
  name: string;           // unique identifier, e.g., "forge-vuln-cisco"
  displayName: string;    // human-readable, e.g., "Cisco PSIRT/Nuclei Scan"
  version: string;        // semver, e.g., "1.0.0"
  icon: string;           // Lucide icon name, e.g., "shield-alert"
  type: 'bundled' | 'sidecar';
  vendors: string[];      // vendor types supported, e.g., ["cisco"]
  treeNodes: PluginTreeNode[];
  settingsSchema?: Record<string, SettingsField>;
}

/** PluginTreeNode — a sidebar tree node contributed by a plugin */
export interface PluginTreeNode {
  id: string;             // unique node ID, e.g., "vulnerabilities"
  label: string;          // display name, e.g., "Vulnerabilities"
  icon: string;           // Lucide icon name
  vendorScoped: boolean;  // if true, appears under matching vendors only
}

/** SettingsField — describes a single setting in the plugin's settings form */
export interface SettingsField {
  type: 'string' | 'password' | 'number' | 'boolean' | 'select';
  label: string;
  description?: string;
  required?: boolean;
  default?: string | number | boolean;
  options?: { label: string; value: string }[];  // for 'select' type
}

/** PluginRegistration — stored per-View, represents a connected plugin */
export interface PluginRegistration {
  manifest: PluginManifest;
  endpoint?: string;      // sidecar only — URL of the sidecar API
  apiKey?: string;        // sidecar only — Bearer token
  enabled: boolean;
  settings: Record<string, string | number | boolean>;
  health: PluginHealthStatus;
}

/** PluginHealthStatus — current health of a plugin's sidecar */
export interface PluginHealthStatus {
  status: 'active' | 'inactive' | 'unknown';
  lastChecked: string;    // ISO timestamp
  error?: string;         // human-readable error if inactive
}
