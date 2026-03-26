import { useState, useCallback, useEffect } from 'react';
import { Plus, ArrowUpDown, Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useForgeStore } from './store/index.ts';
import { Sidebar } from './components/Sidebar.tsx';
import { CreateNodeModal, type CreateNodeType, type CreateNodeData } from './components/CreateNodeModal.tsx';
import WelcomeScreen from './components/WelcomeScreen.tsx';
import ConfigGenerator from './components/ConfigGenerator.tsx';
import TemplateEditor from './components/TemplateEditor.tsx';
import { GeneratedConfigViewer } from './components/GeneratedConfigViewer.tsx';
import VaultModal from './components/VaultModal.tsx';
import GlobalVariablesPage from './components/GlobalVariablesPage.tsx';
import { UnsavedChangesModal } from './components/UnsavedChangesModal.tsx';
import PluginPanel from './components/PluginPanel.tsx';
import PluginContentView from './components/PluginContentView.tsx';
import { SectionCardView, type SectionSelection } from './components/SectionCardView.tsx';
import { healthCheck } from './lib/plugin-service.ts';
import { initBundledPlugins } from './plugins/init.ts';
import { InfisicalProvider } from './plugins/infisical/provider.ts';
import { INFISICAL_MANIFEST } from './plugins/infisical/manifest.ts';

type AppMode = 'generator' | 'editor';

interface WizardState {
  step: CreateNodeType;
  viewId?: string;
  vendorId?: string;
  modelId?: string;
}

function App() {
  const {
    tree,
    selectedVariantId,
    selectedGlobalVariablesViewId,
    selectedPluginName,
    selectedPluginNodeId,
    preferences,
    toggleSidebar,
    addView,
    addVendor,
    addModel,
    addVariant,
    saveTemplate,
    setSelectedVariant,
    setSelectedGlobalVariablesViewId,
    setSelectedPluginName,
    setSelectedPluginNodeId,
    setPluginHealth,
    getPlugins,
    getPlugin,
    registerPlugin,
    toggleExpandedNode,
    editorDirty,
    pendingSaveCallback,
    setEditorDirty,
    registerSecretsProvider,
  } = useForgeStore();

  const [mode, setMode] = useState<AppMode>('generator');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [vaultInitialTab, setVaultInitialTab] = useState<'export' | 'import'>('export');
  const [selectedGeneratedConfigId, setSelectedGeneratedConfigId] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<SectionSelection | null>(null);

  // Wizard for "Add Template" button
  const [wizard, setWizard] = useState<WizardState | null>(null);

  // Navigation guard state
  const [pendingNavAction, setPendingNavAction] = useState<(() => void) | null>(null);

  const guardNavigation = useCallback((action: () => void) => {
    if (editorDirty && mode === 'editor') {
      setPendingNavAction(() => action);
    } else {
      action();
    }
  }, [editorDirty, mode]);

  // Modal handlers for unsaved changes
  const handleSaveAndContinue = useCallback(() => {
    pendingSaveCallback?.();
    pendingNavAction?.();
    setPendingNavAction(null);
  }, [pendingSaveCallback, pendingNavAction]);

  const handleDiscard = useCallback(() => {
    setEditorDirty(false);
    pendingNavAction?.();
    setPendingNavAction(null);
  }, [pendingNavAction, setEditorDirty]);

  const handleCancelNav = useCallback(() => {
    setPendingNavAction(null);
  }, []);

  // Warn on tab/window close when editor has unsaved changes
  useEffect(() => {
    if (!editorDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [editorDirty]);

  // Register bundled plugins + health check all sidecar plugins on mount (fire-and-forget)
  useEffect(() => {
    initBundledPlugins(getPlugin, registerPlugin, setPluginHealth);

    const allPlugins = getPlugins();
    const sidecarPlugins = allPlugins.filter(
      (p) => p.manifest.type === 'sidecar' && p.endpoint && p.apiKey,
    );
    if (sidecarPlugins.length > 0) {
      void Promise.allSettled(
        sidecarPlugins.map(async (reg) => {
          const result = await healthCheck(reg.endpoint!, reg.apiKey!);
          setPluginHealth(reg.manifest.name, result);
        }),
      );
    }

    // Initialize Infisical secrets provider if plugin is enabled and configured
    const infisicalPlugin = getPlugin(INFISICAL_MANIFEST.name);
    if (infisicalPlugin?.enabled) {
      const { endpoint, clientId, clientSecret } = infisicalPlugin.settings as Record<string, string>;
      if (endpoint && clientId && clientSecret) {
        const provider = new InfisicalProvider(endpoint, clientId, clientSecret);
        void provider.connect().then((result) => {
          setPluginHealth(INFISICAL_MANIFEST.name, {
            status: result.connected ? 'active' : 'inactive',
            lastChecked: new Date().toISOString(),
            error: result.error,
          });
          if (result.connected) {
            registerSecretsProvider(provider);
          }
        }).catch((err: unknown) => {
          setPluginHealth(INFISICAL_MANIFEST.name, {
            status: 'inactive',
            lastChecked: new Date().toISOString(),
            error: err instanceof Error ? err.message : 'Connection failed',
          });
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasVariants = tree.views.some((v) =>
    v.vendors.some((vn) => vn.models.some((m) => m.variants.length > 0)),
  );

  const handleAddTemplate = useCallback(() => {
    // If no views exist, start from view creation
    if (tree.views.length === 0) {
      setWizard({ step: 'view' });
    } else if (tree.views.length === 1) {
      const view = tree.views[0];
      if (view.vendors.length === 0) {
        setWizard({ step: 'vendor', viewId: view.id });
      } else if (view.vendors.length === 1) {
        const vendor = view.vendors[0];
        if (vendor.models.length === 0) {
          setWizard({ step: 'model', viewId: view.id, vendorId: vendor.id });
        } else if (vendor.models.length === 1) {
          setWizard({ step: 'variant', viewId: view.id, vendorId: vendor.id, modelId: vendor.models[0].id });
        } else {
          setWizard({ step: 'variant', viewId: view.id, vendorId: vendor.id });
        }
      } else {
        setWizard({ step: 'vendor', viewId: view.id });
      }
    } else {
      setWizard({ step: 'view' });
    }
  }, [tree]);

  const handleWizardSubmit = useCallback(
    (data: CreateNodeData) => {
      if (!wizard) return;

      switch (wizard.step) {
        case 'view': {
          const view = addView(data.name);
          toggleExpandedNode(view.id);
          setWizard({ step: 'vendor', viewId: view.id });
          break;
        }
        case 'vendor': {
          if (wizard.viewId) {
            const vendor = addVendor(wizard.viewId, data.name, data.configFormat ?? 'cli');
            toggleExpandedNode(vendor.id);
            setWizard({ step: 'model', viewId: wizard.viewId, vendorId: vendor.id });
          }
          break;
        }
        case 'model': {
          if (wizard.viewId && wizard.vendorId) {
            const model = addModel(wizard.viewId, wizard.vendorId, data.name, data.description ?? '');
            toggleExpandedNode(model.id);
            setWizard({ step: 'variant', viewId: wizard.viewId, vendorId: wizard.vendorId, modelId: model.id });
          }
          break;
        }
        case 'variant': {
          if (wizard.viewId && wizard.vendorId && wizard.modelId) {
            const templateId = crypto.randomUUID();
            saveTemplate({
              id: templateId,
              sections: [],
              variables: [],
              rawSource: '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            const variant = addVariant(wizard.viewId, wizard.vendorId, wizard.modelId, data.name, templateId);
            setSelectedVariant(variant.id);
            setMode('editor');
            setWizard(null);
          }
          break;
        }
      }
    },
    [wizard, addView, addVendor, addModel, addVariant, saveTemplate, setSelectedVariant, toggleExpandedNode],
  );

  const switchToEditor = useCallback(() => setMode('editor'), []);

  const openVaultImport = useCallback(() => {
    setVaultInitialTab('import');
    setVaultOpen(true);
  }, []);

  const openVaultExport = useCallback(() => {
    setVaultInitialTab('export');
    setVaultOpen(true);
  }, []);

  const handleSelectGeneratedConfig = useCallback((configId: string) => {
    guardNavigation(() => {
      setSelectedGeneratedConfigId(configId);
      setSelectedVariant(null);
      setSelectedGlobalVariablesViewId(null);
      setSelectedPluginName(null);
      setSelectedPluginNodeId(null);
      setSelectedSection(null);
    });
  }, [guardNavigation, setSelectedVariant, setSelectedGlobalVariablesViewId, setSelectedPluginName, setSelectedPluginNodeId]);

  const handleBackFromViewer = useCallback(() => {
    setSelectedGeneratedConfigId(null);
  }, []);

  const handleSelectVariant = useCallback((variantId: string) => {
    guardNavigation(() => {
      setSelectedGlobalVariablesViewId(null);
      setSelectedVariant(variantId);
      setSelectedPluginName(null);
      setSelectedPluginNodeId(null);
      setSelectedSection(null);
    });
  }, [guardNavigation, setSelectedVariant, setSelectedGlobalVariablesViewId, setSelectedPluginName, setSelectedPluginNodeId]);

  const handleSelectGlobalVariables = useCallback((viewId: string) => {
    guardNavigation(() => {
      setSelectedGlobalVariablesViewId(viewId);
      setSelectedPluginName(null);
      setSelectedPluginNodeId(null);
      setSelectedSection(null);
    });
  }, [guardNavigation, setSelectedGlobalVariablesViewId, setSelectedPluginName, setSelectedPluginNodeId]);

  const handleSelectPlugin = useCallback((pluginName: string | null, nodeId: string | null) => {
    guardNavigation(() => {
      setSelectedPluginName(pluginName);
      setSelectedPluginNodeId(nodeId);
      setSelectedVariant(null);
      setSelectedGlobalVariablesViewId(null);
      setSelectedGeneratedConfigId(null);
      setSelectedSection(null);
    });
  }, [guardNavigation, setSelectedPluginName, setSelectedPluginNodeId, setSelectedVariant, setSelectedGlobalVariablesViewId]);

  const handleSelectSection = useCallback((sel: SectionSelection) => {
    guardNavigation(() => {
      setSelectedSection(sel);
      setSelectedVariant(null);
      setSelectedGlobalVariablesViewId(null);
      setSelectedPluginName(null);
      setSelectedPluginNodeId(null);
      setSelectedGeneratedConfigId(null);
    });
  }, [guardNavigation, setSelectedVariant, setSelectedGlobalVariablesViewId, setSelectedPluginName, setSelectedPluginNodeId]);

  // Determine main content
  const renderMainContent = () => {
    // Plugin List — show add form when + is clicked on Plugins node
    if (selectedPluginName === '__add_plugin__') {
      return <PluginPanel pluginName={null} autoAdd />;
    }

    // Plugin Panel — when a plugin name is selected but no specific node
    if (selectedPluginName && !selectedPluginNodeId) {
      const reg = getPlugin(selectedPluginName);
      if (reg) {
        return <PluginPanel pluginName={selectedPluginName} />;
      }
      return (
        <div className="flex-1 flex items-center justify-center text-slate-500">
          Plugin "{selectedPluginName}" not found.
        </div>
      );
    }

    // Plugin Content — when both plugin and node are selected
    if (selectedPluginName && selectedPluginNodeId) {
      const reg = getPlugin(selectedPluginName);
      if (reg) {
        // Derive viewId for content context: use the selected variant's view, or fall back to first view
        const variantInfo = selectedVariantId ? tree.views.find(v =>
          v.vendors.some(vn => vn.models.some(m => m.variants.some(va => va.id === selectedVariantId)))
        ) : null;
        const contextViewId = variantInfo?.id ?? tree.views[0]?.id ?? '';
        return <PluginContentView pluginName={selectedPluginName} nodeId={selectedPluginNodeId} viewId={contextViewId} />;
      }
      return (
        <div className="flex-1 flex items-center justify-center text-slate-500">
          Plugin "{selectedPluginName}" not found.
        </div>
      );
    }

    // Generated config viewer takes priority when a config is selected
    if (selectedGeneratedConfigId) {
      return (
        <GeneratedConfigViewer
          configId={selectedGeneratedConfigId}
          onBack={handleBackFromViewer}
        />
      );
    }

    // Section card view when a section node is selected
    if (selectedSection) {
      return (
        <SectionCardView
          selection={selectedSection}
          onNavigateVariant={handleSelectVariant}
          onNavigateGeneratedConfig={handleSelectGeneratedConfig}
          onNavigateSection={handleSelectSection}
        />
      );
    }

    // Global variables page when a view's global variables node is selected
    if (selectedGlobalVariablesViewId) {
      return <GlobalVariablesPage viewId={selectedGlobalVariablesViewId} />;
    }

    if (!hasVariants || !selectedVariantId) {
      return (
        <WelcomeScreen
          onRequestImport={openVaultImport}
          onRequestAddTemplate={handleAddTemplate}
          onRequestPlugins={() => handleSelectPlugin('__add_plugin__', null)}
        />
      );
    }

    if (mode === 'editor') {
      return <TemplateEditor variantId={selectedVariantId} />;
    }

    return <ConfigGenerator onEditTemplate={switchToEditor} />;
  };

  return (
    <div className="h-screen flex flex-col bg-forge-obsidian text-slate-200 overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 flex items-center gap-4 px-4 h-12 bg-forge-terminal border-b border-forge-steel">
        {/* Mobile hamburger */}
        <button
          className="md:hidden p-1 text-slate-400 hover:text-slate-200 transition-colors"
          onClick={() => {
            toggleSidebar();
            setMobileMenuOpen(!mobileMenuOpen);
          }}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-lg tracking-[0.2em] text-slate-100">FORGE</span>
          <span className="hidden sm:inline text-[9px] font-medium tracking-[0.25em] uppercase text-slate-500 mt-0.5">
            Network Workshop
          </span>
        </div>

        <div className="flex-1" />

        {/* Mode tabs (when a variant is selected) */}
        {selectedVariantId && (
          <div className="hidden sm:flex items-center gap-1 mr-4">
            <button
              onClick={() => guardNavigation(() => setMode('generator'))}
              className={`px-3 py-1.5 text-xs font-mono font-medium tracking-wider rounded transition-colors ${
                mode === 'generator'
                  ? 'text-forge-amber border-b-2 border-forge-amber'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              GENERATE
            </button>
            <button
              onClick={() => setMode('editor')}
              className={`px-3 py-1.5 text-xs font-mono font-medium tracking-wider rounded transition-colors ${
                mode === 'editor'
                  ? 'text-forge-amber border-b-2 border-forge-amber'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              EDITOR
            </button>
          </div>
        )}

        {/* Action buttons */}
        <button
          onClick={handleAddTemplate}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold bg-forge-amber text-forge-obsidian rounded-md hover:bg-forge-amber-bright transition-colors"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Add Template</span>
        </button>

        <button
          onClick={openVaultExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-slate-300 border border-forge-steel rounded-md hover:bg-forge-graphite transition-colors"
        >
          <ArrowUpDown size={14} />
          <span className="hidden sm:inline">Import/Export</span>
        </button>
      </header>

      {/* Body: sidebar + main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — 240px on desktop, overlay on mobile */}
        {(!preferences.sidebarCollapsed || mobileMenuOpen) && (
          <div
            className={`
              ${mobileMenuOpen ? 'fixed inset-0 top-12 z-40 md:relative md:inset-auto' : 'hidden md:block'}
              w-60 shrink-0
            `}
          >
            <Sidebar
              onSwitchToEditor={switchToEditor}
              onSelectGeneratedConfig={handleSelectGeneratedConfig}
              onSelectVariant={handleSelectVariant}
              onSelectGlobalVariables={handleSelectGlobalVariables}
              onSelectPlugin={handleSelectPlugin}
              onSelectSection={handleSelectSection}
            />
          </div>
        )}

        {/* Desktop sidebar collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="hidden md:flex items-center justify-center w-5 shrink-0 bg-forge-charcoal border-r border-forge-graphite text-slate-500 hover:text-slate-300 hover:bg-forge-graphite"
          title={preferences.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {preferences.sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Mobile overlay backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 top-12 z-30 bg-black/40 md:hidden"
            onClick={() => {
              setMobileMenuOpen(false);
              toggleSidebar();
            }}
          />
        )}

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {renderMainContent()}
        </main>
      </div>

      {/* Wizard modal for Add Template flow */}
      <CreateNodeModal
        open={wizard !== null}
        nodeType={wizard?.step ?? 'view'}
        onClose={() => setWizard(null)}
        onSubmit={handleWizardSubmit}
      />

      {/* Vault Import/Export modal */}
      <VaultModal
        isOpen={vaultOpen}
        onClose={() => setVaultOpen(false)}
        initialTab={vaultInitialTab}
      />

      {/* Unsaved changes confirmation */}
      <UnsavedChangesModal
        open={pendingNavAction !== null}
        onSave={handleSaveAndContinue}
        onDiscard={handleDiscard}
        onCancel={handleCancelNav}
      />
    </div>
  );
}

export default App;
