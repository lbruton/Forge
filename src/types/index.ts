// Plugin types
export * from './plugin.ts';
import type { PluginRegistration } from './plugin.ts';

// Navigation hierarchy
export type ConfigFormat = 'cli' | 'xml' | 'json' | 'yaml';
export type VariableType = 'string' | 'ip' | 'integer' | 'dropdown';

export interface ForgeTree {
  views: View[];
}

export interface View {
  id: string;
  name: string;
  vendors: Vendor[];
  globalVariables?: VariableDefinition[];
  plugins?: Record<string, PluginRegistration>;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  configFormat: ConfigFormat;
  models: Model[];
  createdAt: string;
  updatedAt: string;
}

export interface Model {
  id: string;
  name: string;
  description: string;
  variants: Variant[];
  createdAt: string;
  updatedAt: string;
}

export interface Variant {
  id: string;
  name: string;
  templateId: string;
  createdAt: string;
  updatedAt: string;
}

// Templates
export interface Template {
  id: string;
  sections: TemplateSection[];
  variables: VariableDefinition[];
  customVariableOrder?: boolean;
  rawSource: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateSection {
  id: string;
  name: string;
  template: string;
  order: number;
  dividerPattern: string;
  endDividerPattern?: string;
  startLine?: number;
}

export interface DropdownOption {
  label?: string;
  value: string;
}

export interface VariableDefinition {
  name: string;
  label: string;
  type: VariableType;
  defaultValue: string;
  options: (string | DropdownOption)[];
  required: boolean;
  description: string;
  masked?: boolean;
}

/** Normalize a dropdown option to { label, value } form */
export function normalizeOption(opt: string | DropdownOption): { label: string; value: string } {
  if (typeof opt === 'string') return { label: opt, value: opt };
  return { label: opt.label ?? opt.value, value: opt.value };
}

// Parser output — discriminates local ($var) from global (${var}) variables
export interface ParsedVariables {
  local: VariableDefinition[];
  global: string[];
}

// Runtime state
export interface VariableValues {
  variantId: string;
  values: Record<string, string>;
  updatedAt: string;
}

export interface Preferences {
  lastSelectedVariantId: string | null;
  sidebarCollapsed: boolean;
  rightPanelCollapsed: boolean;
  expandedNodes: string[];
}

// Generated output
export interface GeneratedSection {
  name: string;
  content: string;
  divider: string;
  endDivider?: string;
}

export interface GeneratedConfigOutput {
  fullConfig: string;
  sections: GeneratedSection[];
}

export interface GeneratedConfig {
  id: string;
  name: string;              // e.g., "tulsapipeconswan01"
  modelId: string;           // parent model
  sourceVariantId: string;   // which variant was used
  sourceTemplateId: string;  // template snapshot reference
  variableValues: Record<string, string>;  // exact values used
  globalVariableValues?: Record<string, string>;  // global values used at generation time
  fullConfig: string;        // final substituted output (may include manual edits)
  sections: GeneratedSection[];  // per-section output
  notes: string;             // optional user notes
  createdAt: string;         // ISO timestamp
}

// Syntax highlighting
export interface HighlightToken {
  text: string;
  className: string;
}

// Vault
export interface VaultEnvelope {
  version: number;
  iv: string;
  salt: string;
  iterations: number;
  data: string;
}

export interface VaultExportData {
  exportedAt: string;
  views?: View[];
  vendors?: Vendor[];
  models?: Model[];
  variants?: Variant[];
  templates: Record<string, Template>;
  variableValues: Record<string, VariableValues>;
  generatedConfigs?: Record<string, GeneratedConfig>;
}
