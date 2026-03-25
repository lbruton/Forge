import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { storage } from '../lib/storage-service.ts';
import type {
  ConfigFormat,
  ForgeTree,
  GeneratedConfig,
  Model,
  Preferences,
  Template,
  VariableDefinition,
  VariableValues,
  Variant,
  VaultExportData,
  Vendor,
  View,
} from '../types/index.ts';

// --- Custom storage adapter for zustand persist ---

const forgeStorage: StateStorage = {
  getItem: (name: string) => {
    const val = storage.getItem<unknown>(name, null);
    return val === null ? null : JSON.stringify(val);
  },
  setItem: (name: string, value: string) => {
    try {
      storage.setItem(name, JSON.parse(value));
    } catch {
      storage.setItem(name, value);
    }
  },
  removeItem: (name: string) => {
    storage.removeItem(name);
  },
};

// --- Helpers ---

function now(): string {
  return new Date().toISOString();
}

function uuid(): string {
  return crypto.randomUUID();
}

const emptyTree: ForgeTree = { views: [] };

const defaultPreferences: Preferences = {
  lastSelectedVariantId: null,
  sidebarCollapsed: false,
  rightPanelCollapsed: false,
  expandedNodes: [],
};

// --- Store interface ---

interface ForgeStore {
  // Data
  tree: ForgeTree;
  templates: Record<string, Template>;
  variableValues: Record<string, VariableValues>;
  generatedConfigs: Record<string, GeneratedConfig>;
  preferences: Preferences;

  // Selection
  selectedVariantId: string | null;

  // Tree CRUD
  addView: (name: string) => View;
  addVendor: (viewId: string, name: string, configFormat: ConfigFormat) => Vendor;
  addModel: (viewId: string, vendorId: string, name: string, description: string) => Model;
  addVariant: (viewId: string, vendorId: string, modelId: string, name: string, templateId: string) => Variant;
  updateNode: (nodeType: string, path: Record<string, string>, updates: Record<string, unknown>) => void;
  deleteNode: (nodeType: string, path: Record<string, string>) => void;

  // Global variable actions
  addGlobalVariable: (viewId: string, variable: VariableDefinition) => void;
  updateGlobalVariable: (viewId: string, name: string, updates: Partial<VariableDefinition>) => void;
  deleteGlobalVariable: (viewId: string, name: string) => void;
  reorderGlobalVariables: (viewId: string, orderedNames: string[]) => void;
  autoSyncGlobals: (viewId: string, detectedNames: string[]) => void;

  // Template actions
  saveTemplate: (template: Template) => void;
  deleteTemplate: (templateId: string) => void;
  getTemplate: (templateId: string) => Template | undefined;

  // Variable values
  setVariableValue: (variantId: string, variableName: string, value: string) => void;
  getVariableValues: (variantId: string) => Record<string, string>;

  // Generated configs
  saveGeneratedConfig: (config: GeneratedConfig) => void;
  deleteGeneratedConfig: (id: string) => void;
  getGeneratedConfigs: (modelId: string) => GeneratedConfig[];

  // Selection
  setSelectedVariant: (variantId: string | null) => void;

  // Preferences
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  toggleExpandedNode: (nodeId: string) => void;

  // Bulk operations
  loadFromStorage: () => void;
  resetAll: () => void;
  importData: (data: VaultExportData) => void;
  exportData: (scope?: Record<string, string>) => VaultExportData;

  // Helpers
  findVariant: (variantId: string) => { view: View; vendor: Vendor; model: Model; variant: Variant } | null;
  getConfigFormat: (variantId: string) => ConfigFormat;
}

// --- Store ---

export const useForgeStore = create<ForgeStore>()(
  persist(
    (set, get) => ({
      // Initial state
      tree: emptyTree,
      templates: {},
      variableValues: {},
      generatedConfigs: {},
      preferences: defaultPreferences,
      selectedVariantId: null,

      // --- Tree CRUD ---

      addView: (name) => {
        const ts = now();
        const view: View = {
          id: uuid(),
          name,
          vendors: [],
          globalVariables: [],
          createdAt: ts,
          updatedAt: ts,
        };
        set((state) => ({
          tree: { views: [...state.tree.views, view] },
        }));
        return view;
      },

      addVendor: (viewId, name, configFormat) => {
        const ts = now();
        const vendor: Vendor = {
          id: uuid(),
          name,
          configFormat,
          models: [],
          createdAt: ts,
          updatedAt: ts,
        };
        set((state) => ({
          tree: {
            views: state.tree.views.map((v) =>
              v.id === viewId
                ? { ...v, vendors: [...v.vendors, vendor], updatedAt: ts }
                : v,
            ),
          },
        }));
        return vendor;
      },

      addModel: (viewId, vendorId, name, description) => {
        const ts = now();
        const model: Model = {
          id: uuid(),
          name,
          description,
          variants: [],
          createdAt: ts,
          updatedAt: ts,
        };
        set((state) => ({
          tree: {
            views: state.tree.views.map((v) =>
              v.id === viewId
                ? {
                    ...v,
                    updatedAt: ts,
                    vendors: v.vendors.map((vn) =>
                      vn.id === vendorId
                        ? { ...vn, models: [...vn.models, model], updatedAt: ts }
                        : vn,
                    ),
                  }
                : v,
            ),
          },
        }));
        return model;
      },

      addVariant: (viewId, vendorId, modelId, name, templateId) => {
        const ts = now();
        const variant: Variant = {
          id: uuid(),
          name,
          templateId,
          createdAt: ts,
          updatedAt: ts,
        };
        set((state) => ({
          tree: {
            views: state.tree.views.map((v) =>
              v.id === viewId
                ? {
                    ...v,
                    updatedAt: ts,
                    vendors: v.vendors.map((vn) =>
                      vn.id === vendorId
                        ? {
                            ...vn,
                            updatedAt: ts,
                            models: vn.models.map((m) =>
                              m.id === modelId
                                ? { ...m, variants: [...m.variants, variant], updatedAt: ts }
                                : m,
                            ),
                          }
                        : vn,
                    ),
                  }
                : v,
            ),
          },
        }));
        return variant;
      },

      updateNode: (nodeType, path, updates) => {
        const ts = now();
        set((state) => {
          const tree = structuredClone(state.tree);
          switch (nodeType) {
            case 'view': {
              const view = tree.views.find((v) => v.id === path.viewId);
              if (view) Object.assign(view, updates, { updatedAt: ts });
              break;
            }
            case 'vendor': {
              const view = tree.views.find((v) => v.id === path.viewId);
              const vendor = view?.vendors.find((vn) => vn.id === path.vendorId);
              if (vendor) Object.assign(vendor, updates, { updatedAt: ts });
              break;
            }
            case 'model': {
              const view = tree.views.find((v) => v.id === path.viewId);
              const vendor = view?.vendors.find((vn) => vn.id === path.vendorId);
              const model = vendor?.models.find((m) => m.id === path.modelId);
              if (model) Object.assign(model, updates, { updatedAt: ts });
              break;
            }
            case 'variant': {
              const view = tree.views.find((v) => v.id === path.viewId);
              const vendor = view?.vendors.find((vn) => vn.id === path.vendorId);
              const model = vendor?.models.find((m) => m.id === path.modelId);
              const variant = model?.variants.find((va) => va.id === path.variantId);
              if (variant) Object.assign(variant, updates, { updatedAt: ts });
              break;
            }
          }
          return { tree };
        });
      },

      deleteNode: (nodeType, path) => {
        set((state) => {
          const tree = structuredClone(state.tree);
          const templates = { ...state.templates };
          const variableValues = { ...state.variableValues };

          // Collect variant IDs and template IDs to clean up
          const collectVariantCleanup = (variants: Variant[]) => {
            for (const va of variants) {
              delete variableValues[va.id];
              // Only delete template if no other variant references it
              const allVariants = tree.views.flatMap((v) =>
                v.vendors.flatMap((vn) => vn.models.flatMap((m) => m.variants)),
              );
              const otherRefs = allVariants.filter(
                (other) => other.id !== va.id && other.templateId === va.templateId,
              );
              if (otherRefs.length === 0) {
                delete templates[va.templateId];
              }
            }
          };

          switch (nodeType) {
            case 'view': {
              const view = tree.views.find((v) => v.id === path.viewId);
              if (view) {
                for (const vendor of view.vendors) {
                  for (const model of vendor.models) {
                    collectVariantCleanup(model.variants);
                  }
                }
                tree.views = tree.views.filter((v) => v.id !== path.viewId);
              }
              break;
            }
            case 'vendor': {
              const view = tree.views.find((v) => v.id === path.viewId);
              if (view) {
                const vendor = view.vendors.find((vn) => vn.id === path.vendorId);
                if (vendor) {
                  for (const model of vendor.models) {
                    collectVariantCleanup(model.variants);
                  }
                  view.vendors = view.vendors.filter((vn) => vn.id !== path.vendorId);
                }
              }
              break;
            }
            case 'model': {
              const view = tree.views.find((v) => v.id === path.viewId);
              const vendor = view?.vendors.find((vn) => vn.id === path.vendorId);
              if (vendor) {
                const model = vendor.models.find((m) => m.id === path.modelId);
                if (model) {
                  collectVariantCleanup(model.variants);
                  vendor.models = vendor.models.filter((m) => m.id !== path.modelId);
                }
              }
              break;
            }
            case 'variant': {
              const view = tree.views.find((v) => v.id === path.viewId);
              const vendor = view?.vendors.find((vn) => vn.id === path.vendorId);
              const model = vendor?.models.find((m) => m.id === path.modelId);
              if (model) {
                const variant = model.variants.find((va) => va.id === path.variantId);
                if (variant) {
                  collectVariantCleanup([variant]);
                  model.variants = model.variants.filter((va) => va.id !== path.variantId);
                }
              }
              break;
            }
          }

          return { tree, templates, variableValues };
        });
      },

      // --- Global variable actions ---

      addGlobalVariable: (viewId, variable) => {
        const ts = now();
        set((state) => ({
          tree: {
            views: state.tree.views.map((v) =>
              v.id === viewId
                ? { ...v, globalVariables: [...(v.globalVariables ?? []), variable], updatedAt: ts }
                : v,
            ),
          },
        }));
      },

      updateGlobalVariable: (viewId, name, updates) => {
        const ts = now();
        set((state) => ({
          tree: {
            views: state.tree.views.map((v) =>
              v.id === viewId
                ? {
                    ...v,
                    updatedAt: ts,
                    globalVariables: (v.globalVariables ?? []).map((gv) =>
                      gv.name === name ? { ...gv, ...updates } : gv,
                    ),
                  }
                : v,
            ),
          },
        }));
      },

      deleteGlobalVariable: (viewId, name) => {
        const ts = now();
        set((state) => ({
          tree: {
            views: state.tree.views.map((v) =>
              v.id === viewId
                ? {
                    ...v,
                    updatedAt: ts,
                    globalVariables: (v.globalVariables ?? []).filter((gv) => gv.name !== name),
                  }
                : v,
            ),
          },
        }));
      },

      reorderGlobalVariables: (viewId, orderedNames) => {
        const ts = now();
        set((state) => ({
          tree: {
            views: state.tree.views.map((v) => {
              if (v.id !== viewId) return v;
              const globals = v.globalVariables ?? [];
              const byName = new Map(globals.map((gv) => [gv.name, gv]));
              const reordered = orderedNames
                .map((n) => byName.get(n))
                .filter((gv): gv is VariableDefinition => gv !== undefined);
              return { ...v, globalVariables: reordered, updatedAt: ts };
            }),
          },
        }));
      },

      autoSyncGlobals: (viewId, detectedNames) => {
        const ts = now();
        set((state) => ({
          tree: {
            views: state.tree.views.map((v) => {
              if (v.id !== viewId) return v;
              const existing = v.globalVariables ?? [];
              const existingNames = new Set(existing.map((gv) => gv.name));
              const newGlobals = detectedNames
                .filter((n) => !existingNames.has(n))
                .map((n): VariableDefinition => ({
                  name: n,
                  label: n.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                  type: 'string',
                  defaultValue: '',
                  options: [],
                  required: false,
                  description: '',
                }));
              if (newGlobals.length === 0) return v;
              return { ...v, globalVariables: [...existing, ...newGlobals], updatedAt: ts };
            }),
          },
        }));
      },

      // --- Template actions ---

      saveTemplate: (template) => {
        set((state) => ({
          templates: { ...state.templates, [template.id]: template },
        }));
      },

      deleteTemplate: (templateId) => {
        set((state) => {
          const templates = { ...state.templates };
          delete templates[templateId];
          return { templates };
        });
      },

      getTemplate: (templateId) => {
        return get().templates[templateId];
      },

      // --- Variable values ---

      setVariableValue: (variantId, variableName, value) => {
        const ts = now();
        set((state) => {
          const existing = state.variableValues[variantId];
          const values = existing ? { ...existing.values } : {};
          values[variableName] = value;
          return {
            variableValues: {
              ...state.variableValues,
              [variantId]: { variantId, values, updatedAt: ts },
            },
          };
        });
      },

      getVariableValues: (variantId) => {
        return get().variableValues[variantId]?.values ?? {};
      },

      // --- Generated configs ---

      saveGeneratedConfig: (config) => {
        storage.setItem(`generated_${config.id}`, config);
        set((state) => ({
          generatedConfigs: { ...state.generatedConfigs, [config.id]: config },
        }));
      },

      deleteGeneratedConfig: (id) => {
        storage.removeItem(`generated_${id}`);
        set((state) => {
          const generatedConfigs = { ...state.generatedConfigs };
          delete generatedConfigs[id];
          return { generatedConfigs };
        });
      },

      getGeneratedConfigs: (modelId) => {
        return Object.values(get().generatedConfigs)
          .filter((c) => c.modelId === modelId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      },

      // --- Selection ---

      setSelectedVariant: (variantId) => {
        set({
          selectedVariantId: variantId,
          preferences: { ...get().preferences, lastSelectedVariantId: variantId },
        });
      },

      // --- Preferences ---

      toggleSidebar: () => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            sidebarCollapsed: !state.preferences.sidebarCollapsed,
          },
        }));
      },

      toggleRightPanel: () => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            rightPanelCollapsed: !state.preferences.rightPanelCollapsed,
          },
        }));
      },

      toggleExpandedNode: (nodeId) => {
        set((state) => {
          const expanded = state.preferences.expandedNodes;
          const next = expanded.includes(nodeId)
            ? expanded.filter((id) => id !== nodeId)
            : [...expanded, nodeId];
          return {
            preferences: { ...state.preferences, expandedNodes: next },
          };
        });
      },

      // --- Bulk operations ---

      loadFromStorage: () => {
        // Zustand persist handles this automatically on init.
        // This method exists for manual re-hydration if needed.
        const tree = storage.getItem<ForgeTree>('tree', emptyTree);
        const templates = storage.getItem<Record<string, Template>>('templates', {});
        const variableValues = storage.getItem<Record<string, VariableValues>>('variableValues', {});
        const preferences = storage.getItem<Preferences>('preferences', defaultPreferences);

        // Load individually-stored generated configs
        const generatedConfigs: Record<string, GeneratedConfig> = {};
        for (const key of storage.getAllKeys()) {
          if (key.startsWith('generated_')) {
            const config = storage.getItem<GeneratedConfig | null>(key, null);
            if (config) {
              generatedConfigs[config.id] = config;
            }
          }
        }

        set({ tree, templates, variableValues, generatedConfigs, preferences });
      },

      resetAll: () => {
        storage.clear();
        set({
          tree: emptyTree,
          templates: {},
          variableValues: {},
          generatedConfigs: {},
          preferences: defaultPreferences,
          selectedVariantId: null,
        });
      },

      importData: (data) => {
        set((state) => {
          const tree = structuredClone(state.tree);
          const templates = { ...state.templates };
          const variableValues = { ...state.variableValues };
          const generatedConfigs = { ...state.generatedConfigs };

          // Merge templates (new only, don't overwrite existing)
          for (const [id, tmpl] of Object.entries(data.templates)) {
            if (!templates[id]) {
              templates[id] = tmpl;
            }
          }

          // Merge variable values (new only)
          for (const [id, vals] of Object.entries(data.variableValues)) {
            if (!variableValues[id]) {
              variableValues[id] = vals;
            }
          }

          // Merge generated configs (new only)
          if (data.generatedConfigs) {
            for (const [id, config] of Object.entries(data.generatedConfigs)) {
              if (!generatedConfigs[id]) {
                generatedConfigs[id] = config;
                storage.setItem(`generated_${id}`, config);
              }
            }
          }

          // Merge views from the export
          if (data.views) {
            for (const importedView of data.views) {
              const existingView = tree.views.find((v) => v.id === importedView.id);
              if (!existingView) {
                tree.views.push(importedView);
              } else {
                // Merge globalVariables additively: imported values update existing,
                // new names added, existing names not in import preserved
                const importedGlobals = importedView.globalVariables ?? [];
                if (importedGlobals.length > 0) {
                  const existing = existingView.globalVariables ?? [];
                  const existingByName = new Map(existing.map((gv) => [gv.name, gv]));
                  for (const igv of importedGlobals) {
                    existingByName.set(igv.name, igv);
                  }
                  existingView.globalVariables = Array.from(existingByName.values());
                  existingView.updatedAt = now();
                }
              }
            }
          }

          return { tree, templates, variableValues, generatedConfigs };
        });
      },

      exportData: (_scope?) => {
        const state = get();
        return {
          exportedAt: now(),
          views: state.tree.views,
          templates: state.templates,
          variableValues: state.variableValues,
          generatedConfigs: state.generatedConfigs,
        };
      },

      // --- Helpers ---

      findVariant: (variantId) => {
        const { tree } = get();
        for (const view of tree.views) {
          for (const vendor of view.vendors) {
            for (const model of vendor.models) {
              for (const variant of model.variants) {
                if (variant.id === variantId) {
                  return { view, vendor, model, variant };
                }
              }
            }
          }
        }
        return null;
      },

      getConfigFormat: (variantId) => {
        const found = get().findVariant(variantId);
        return found?.vendor.configFormat ?? 'cli';
      },
    }),
    {
      name: 'forge-store',
      storage: createJSONStorage(() => forgeStorage),
    },
  ),
);
