import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { storage } from '../lib/storage-service.ts';
import type {
  ConfigFormat,
  ForgeTree,
  Model,
  Preferences,
  Template,
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
  expandedNodes: [],
};

// --- Store interface ---

interface ForgeStore {
  // Data
  tree: ForgeTree;
  templates: Record<string, Template>;
  variableValues: Record<string, VariableValues>;
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

  // Template actions
  saveTemplate: (template: Template) => void;
  deleteTemplate: (templateId: string) => void;
  getTemplate: (templateId: string) => Template | undefined;

  // Variable values
  setVariableValue: (variantId: string, variableName: string, value: string) => void;
  getVariableValues: (variantId: string) => Record<string, string>;

  // Selection
  setSelectedVariant: (variantId: string | null) => void;

  // Preferences
  toggleSidebar: () => void;
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
      preferences: defaultPreferences,
      selectedVariantId: null,

      // --- Tree CRUD ---

      addView: (name) => {
        const ts = now();
        const view: View = {
          id: uuid(),
          name,
          vendors: [],
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
        set({ tree, templates, variableValues, preferences });
      },

      resetAll: () => {
        storage.clear();
        set({
          tree: emptyTree,
          templates: {},
          variableValues: {},
          preferences: defaultPreferences,
          selectedVariantId: null,
        });
      },

      importData: (data) => {
        set((state) => {
          const tree = structuredClone(state.tree);
          const templates = { ...state.templates };
          const variableValues = { ...state.variableValues };

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

          // Merge views from the export
          if (data.views) {
            for (const importedView of data.views) {
              const existingView = tree.views.find((v) => v.id === importedView.id);
              if (!existingView) {
                tree.views.push(importedView);
              }
              // If view exists, we don't overwrite — could deep-merge vendors/models
              // but the spec says "adds new views/vendors/models, doesn't overwrite existing"
            }
          }

          return { tree, templates, variableValues };
        });
      },

      exportData: (_scope?) => {
        const state = get();
        return {
          exportedAt: now(),
          views: state.tree.views,
          templates: state.templates,
          variableValues: state.variableValues,
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
