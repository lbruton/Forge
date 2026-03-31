import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  FolderOpen,
  Cpu,
  FileCode2,
  FileCheck,
  Globe,
  Puzzle,
  Shield,
  ShieldAlert,
  Database,
  HardDrive,
  Network,
  Server,
  Clock,
} from 'lucide-react';
import { useForgeStore } from '../store/index.ts';
import { TreeNode } from './TreeNode.tsx';
import { CreateNodeModal, type CreateNodeType, type CreateNodeData } from './CreateNodeModal.tsx';
import type { SectionSelection } from './SectionCardView.tsx';
import { isPluginConfigured } from '../plugins/init.ts';
import { VULN_CISCO_MANIFEST } from '../plugins/vuln-cisco/manifest.ts';

const PLUGIN_ICONS: Record<string, typeof Puzzle> = {
  puzzle: Puzzle,
  shield: Shield,
  'shield-alert': ShieldAlert,
  database: Database,
  'hard-drive': HardDrive,
  network: Network,
  server: Server,
  'file-code-2': FileCode2,
};

function getPluginIcon(name: string, size = 14) {
  const Icon = PLUGIN_ICONS[name] ?? Puzzle;
  return <Icon size={size} />;
}

/** Memoized alphabetical sort — usable inside nested .map() callbacks where hooks aren't allowed. */
function Sorted<T extends { name: string }>({
  items,
  children,
}: {
  items: T[];
  children: (_sorted: T[]) => React.ReactNode;
}) {
  const sorted = useMemo(() => [...items].sort((a, b) => a.name.localeCompare(b.name)), [items]);
  return <>{children(sorted)}</>;
}

interface ModalContext {
  type: CreateNodeType;
  viewId?: string;
  vendorId?: string;
  modelId?: string;
}

interface SidebarProps {
  onSwitchToEditor?: () => void;
  onSelectGeneratedConfig?: (_id: string) => void;
  onSelectVariant?: (_variantId: string) => void;
  onSelectGlobalVariables?: (_viewId: string) => void;
  onSelectPlugin?: (_pluginName: string | null, _nodeId: string | null) => void;
  onSelectSection?: (_sel: SectionSelection) => void;
}

function formatShortDate(iso: string): string {
  // Sidecar timestamps use hyphens in time/tz — normalize to colons
  const fixed = iso.replace(/T(\d{2})-(\d{2})-(\d{2})(.*?)([+-]\d{2})-(\d{2})$/, 'T$1:$2:$3$4$5:$6');
  const d = new Date(fixed);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function truncateName(name: string, max = 12): string {
  return name.length > max ? name.slice(0, max) + '...' : name;
}

export function Sidebar({
  onSwitchToEditor,
  onSelectGeneratedConfig,
  onSelectVariant,
  onSelectGlobalVariables,
  onSelectPlugin,
  onSelectSection,
}: SidebarProps) {
  const {
    tree,
    selectedVariantId,
    selectedGlobalVariablesViewId,
    getGeneratedConfigs,
    getTemplate,
    addView,
    addVendor,
    addModel,
    addVariant,
    saveTemplate,
    setSelectedVariant,
    setSelectedGlobalVariablesViewId,
    deleteNode,
    updateNode,
    toggleExpandedNode,
    deleteGeneratedConfig,
    renameGeneratedConfig,
    getPlugins,
    selectedPluginName,
    setSelectedPluginName,
    setSelectedPluginNodeId,
    setSelectedPluginViewId,
    setPluginEnabled,
    getPlugin,
    preferences,
  } = useForgeStore();

  const configurationsPlugin = getPlugin('forge-configurations');
  const configurationsEnabled = configurationsPlugin?.enabled ?? false;

  const vulnPlugin = getPlugin(VULN_CISCO_MANIFEST.name);
  const vulnEnabled = vulnPlugin?.enabled ?? false;
  const vulnDevicesRaw = useForgeStore((s) => s.vulnDevices);
  const vulnScanCache = useForgeStore((s) => s.vulnScanCache);
  const deleteVulnDevice = useForgeStore((s) => s.deleteVulnDevice);
  // vulnDevices filtered per view — computed inline in the view loop below

  // Auto-expand Configurations nodes for each view when plugin is enabled
  useEffect(() => {
    if (!configurationsEnabled) return;
    for (const view of tree.views) {
      const nodeId = `${view.id}__configurations`;
      if (!preferences.expandedNodes.includes(nodeId)) {
        toggleExpandedNode(nodeId);
      }
    }
  }, [configurationsEnabled, tree.views, toggleExpandedNode]);

  const [modalContext, setModalContext] = useState<ModalContext | null>(null);
  const [editContext, setEditContext] = useState<{
    type: CreateNodeType;
    path: Record<string, string>;
    currentName: string;
  } | null>(null);
  const [selectedGeneratedConfigId, setSelectedGeneratedConfigId] = useState<string | null>(null);

  const openCreate = useCallback((type: CreateNodeType, viewId?: string, vendorId?: string, modelId?: string) => {
    setModalContext({ type, viewId, vendorId, modelId });
  }, []);

  const handleCreate = useCallback(
    (data: CreateNodeData) => {
      if (!modalContext) return;
      const { type, viewId, vendorId, modelId } = modalContext;

      switch (type) {
        case 'view': {
          const view = addView(data.name);
          toggleExpandedNode(view.id);
          break;
        }
        case 'vendor': {
          if (viewId) {
            const vendor = addVendor(viewId, data.name, data.configFormat ?? 'cli');
            toggleExpandedNode(vendor.id);
          }
          break;
        }
        case 'model': {
          if (viewId && vendorId) {
            const model = addModel(viewId, vendorId, data.name, data.description ?? '');
            toggleExpandedNode(model.id);
          }
          break;
        }
        case 'variant': {
          if (viewId && vendorId && modelId) {
            const templateId = crypto.randomUUID();
            // Create an empty template for the variant
            saveTemplate({
              id: templateId,
              sections: [],
              variables: [],
              rawSource: '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            const variant = addVariant(viewId, vendorId, modelId, data.name, templateId);
            setSelectedVariant(variant.id);
            onSwitchToEditor?.();
          }
          break;
        }
      }
      setModalContext(null);
    },
    [
      modalContext,
      addView,
      addVendor,
      addModel,
      addVariant,
      saveTemplate,
      setSelectedVariant,
      toggleExpandedNode,
      onSwitchToEditor,
    ],
  );

  const handleEdit = useCallback((type: CreateNodeType, path: Record<string, string>, currentName: string) => {
    setEditContext({ type, path, currentName });
  }, []);

  const handleEditSubmit = useCallback(
    (data: CreateNodeData) => {
      if (!editContext) return;
      const updates: Record<string, unknown> = { name: data.name };
      if (editContext.type === 'vendor' && data.configFormat) updates.configFormat = data.configFormat;
      if (editContext.type === 'model' && data.description !== undefined) updates.description = data.description;
      updateNode(editContext.type, editContext.path, updates);
      setEditContext(null);
    },
    [editContext, updateNode],
  );

  const handleDelete = useCallback(
    (nodeType: string, path: Record<string, string>) => {
      deleteNode(nodeType, path);
    },
    [deleteNode],
  );

  const handleSelectGeneratedConfig = useCallback(
    (id: string) => {
      setSelectedPluginName(null);
      setSelectedPluginNodeId(null);
      if (onSelectGeneratedConfig) {
        onSelectGeneratedConfig(id);
      } else {
        setSelectedGeneratedConfigId(id);
        setSelectedVariant(null);
        setSelectedGlobalVariablesViewId(null);
      }
    },
    [
      setSelectedVariant,
      setSelectedGlobalVariablesViewId,
      setSelectedPluginName,
      setSelectedPluginNodeId,
      onSelectGeneratedConfig,
    ],
  );

  const handleSelectVariant = useCallback(
    (variantId: string) => {
      setSelectedGeneratedConfigId(null);
      setSelectedPluginName(null);
      setSelectedPluginNodeId(null);
      if (onSelectVariant) {
        onSelectVariant(variantId);
      } else {
        setSelectedGlobalVariablesViewId(null);
        setSelectedVariant(variantId);
      }
    },
    [
      setSelectedVariant,
      setSelectedGlobalVariablesViewId,
      setSelectedPluginName,
      setSelectedPluginNodeId,
      onSelectVariant,
    ],
  );

  return (
    <>
      <aside className="flex flex-col h-full bg-forge-charcoal border-r border-forge-graphite overflow-hidden">
        {/* Tree */}
        <div className="flex-1 overflow-y-auto py-3">
          {tree.views.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-500">No templates yet</p>
              <button
                onClick={() => {
                  openCreate('view');
                }}
                className="mt-3 text-sm text-forge-amber hover:text-forge-amber-bright transition-colors"
              >
                + Add your first view
              </button>
            </div>
          )}

          {tree.views.map((view) => (
            <TreeNode
              key={view.id}
              id={view.id}
              label={view.name}
              icon={<FolderOpen size={14} />}
              depth={0}
              hasChildren={true}
              isSection
              onAdd={() => {
                openCreate('vendor', view.id);
              }}
              onEdit={() => {
                handleEdit('view', { viewId: view.id }, view.name);
              }}
              onDelete={() => {
                handleDelete('view', { viewId: view.id });
              }}
            >
              {/* Configurations workbench node — wraps Global Variables + vendors */}
              {configurationsEnabled && (
                <TreeNode
                  id={`${view.id}__configurations`}
                  label="Configurations"
                  icon={<FileCode2 size={14} />}
                  depth={1}
                  hasChildren={true}
                  isSection
                  onAdd={() => {
                    openCreate('vendor', view.id);
                  }}
                  onSelect={() => {
                    onSelectSection?.({ type: 'configurations', viewId: view.id });
                  }}
                >
                  <TreeNode
                    id={view.id + '__globals'}
                    label={`Global Variables${(view.globalVariables?.length ?? 0) > 0 ? ` (${view.globalVariables?.length})` : ''}`}
                    icon={<Globe size={14} />}
                    depth={2}
                    hasChildren={false}
                    isSelected={selectedGlobalVariablesViewId === view.id}
                    onSelect={() => {
                      setSelectedGeneratedConfigId(null);
                      if (onSelectGlobalVariables) {
                        onSelectGlobalVariables(view.id);
                      } else {
                        setSelectedGlobalVariablesViewId(view.id);
                      }
                    }}
                  />
                  {view.vendors.map((vendor) => (
                    <TreeNode
                      key={vendor.id}
                      id={vendor.id}
                      label={vendor.name}
                      icon={<Server size={14} />}
                      depth={2}
                      hasChildren={vendor.models.length > 0}
                      isSection
                      onAdd={() => { openCreate('model', view.id, vendor.id); }}
                      onEdit={() => { handleEdit('vendor', { viewId: view.id, vendorId: vendor.id }, vendor.name); }}
                      onDelete={() => { handleDelete('vendor', { viewId: view.id, vendorId: vendor.id }); }}
                      onSelect={() => { onSelectSection?.({ type: 'vendor', viewId: view.id, vendorId: vendor.id }); }}
                    >
                      {vendor.models.map((model) => {
                        const generatedConfigs = getGeneratedConfigs(model.id);
                        const hasGenerated = generatedConfigs.length > 0;

                        return (
                          <TreeNode
                            key={model.id}
                            id={model.id}
                            label={model.name}
                            icon={<Cpu size={14} />}
                            depth={3}
                            hasChildren={model.variants.length > 0 || hasGenerated}
                            isSection
                            onAdd={() => {
                              openCreate('variant', view.id, vendor.id, model.id);
                            }}
                            onEdit={() => {
                              handleEdit(
                                'model',
                                { viewId: view.id, vendorId: vendor.id, modelId: model.id },
                                model.name,
                              );
                            }}
                            onDelete={() => {
                              handleDelete('model', { viewId: view.id, vendorId: vendor.id, modelId: model.id });
                            }}
                            onSelect={() => {
                              onSelectSection?.({
                                type: 'model',
                                viewId: view.id,
                                vendorId: vendor.id,
                                modelId: model.id,
                              });
                            }}
                          >
                            {/* Templates sub-folder */}
                            <TreeNode
                              id={`${model.id}__templates`}
                              label="Templates"
                              icon={<FileCode2 size={14} />}
                              depth={4}
                              hasChildren={model.variants.length > 0}
                              isSection
                              onAdd={() => {
                                openCreate('variant', view.id, vendor.id, model.id);
                              }}
                              onSelect={() => {
                                onSelectSection?.({
                                  type: 'templates',
                                  viewId: view.id,
                                  vendorId: vendor.id,
                                  modelId: model.id,
                                });
                              }}
                            >
                              <Sorted items={model.variants}>
                                {(sorted) =>
                                  sorted.map((variant) => (
                                    <TreeNode
                                      key={variant.id}
                                      id={variant.id}
                                      label={variant.name}
                                      icon={<FileCode2 size={14} />}
                                      depth={5}
                                      hasChildren={false}
                                      isSelected={
                                        selectedVariantId === variant.id && selectedGeneratedConfigId === null
                                      }
                                      onSelect={() => { handleSelectVariant(variant.id); }}
                                      onEdit={() => {
                                        handleEdit(
                                          'variant',
                                          {
                                            viewId: view.id,
                                            vendorId: vendor.id,
                                            modelId: model.id,
                                            variantId: variant.id,
                                          },
                                          variant.name,
                                        );
                                      }}
                                      onDuplicate={() => {
                                        const source = getTemplate(variant.templateId);
                                        if (!source) return;
                                        const clone = structuredClone(source);
                                        clone.id = crypto.randomUUID();
                                        const now = new Date().toISOString();
                                        clone.createdAt = now;
                                        clone.updatedAt = now;
                                        saveTemplate(clone);
                                        addVariant(view.id, vendor.id, model.id, `${variant.name} (copy)`, clone.id);
                                      }}
                                      onDelete={() => {
                                        handleDelete('variant', {
                                          viewId: view.id,
                                          vendorId: vendor.id,
                                          modelId: model.id,
                                          variantId: variant.id,
                                        });
                                      }}
                                    />
                                  ))
                                }
                              </Sorted>
                            </TreeNode>

                            {/* Generated sub-folder — only if there are generated configs */}
                            {hasGenerated && (
                              <TreeNode
                                id={`${model.id}__generated`}
                                label="Generated"
                                icon={<FileCheck size={14} />}
                                depth={4}
                                hasChildren={true}
                                isSection
                                onSelect={() => {
                                  onSelectSection?.({
                                    type: 'generated',
                                    viewId: view.id,
                                    vendorId: vendor.id,
                                    modelId: model.id,
                                  });
                                }}
                              >
                                {generatedConfigs.map((gc) => (
                                  <TreeNode
                                    key={gc.id}
                                    id={gc.id}
                                    label={`${truncateName(gc.name)} — ${formatShortDate(gc.createdAt)}`}
                                    icon={<FileCheck size={14} />}
                                    depth={5}
                                    hasChildren={false}
                                    isSelected={selectedGeneratedConfigId === gc.id}
                                    onSelect={() => {
                                      handleSelectGeneratedConfig(gc.id);
                                    }}
                                    onEdit={() => {
                                      const newName = prompt('Rename generated config:', gc.name);
                                      if (newName?.trim() && newName.trim() !== gc.name) {
                                        renameGeneratedConfig(gc.id, newName.trim());
                                      }
                                    }}
                                    onDelete={() => {
                                      if (confirm(`Delete "${gc.name}"?`)) {
                                        deleteGeneratedConfig(gc.id);
                                        if (selectedGeneratedConfigId === gc.id) {
                                          setSelectedGeneratedConfigId(null);
                                        }
                                      }
                                    }}
                                  />
                                ))}
                              </TreeNode>
                            )}
                          </TreeNode>
                        );
                      })}
                    </TreeNode>
                  ))}
                </TreeNode>
              )}

              {/* Vuln-cisco hierarchical tree */}
              {vulnEnabled && (
                <TreeNode
                  id={`${view.id}__vulnerabilities`}
                  label="Vulnerabilities"
                  icon={<ShieldAlert size={14} />}
                  depth={1}
                  hasChildren={true}
                  isSection
                  onSelect={() => {
                    setSelectedGeneratedConfigId(null);
                    setSelectedPluginName(VULN_CISCO_MANIFEST.name);
                    setSelectedPluginNodeId('vulnerabilities');
                    setSelectedPluginViewId(view.id);
                    onSelectPlugin?.(VULN_CISCO_MANIFEST.name, 'vulnerabilities');
                  }}
                >
                  {(() => {
                    const viewVulnDevices = vulnDevicesRaw
                      .filter((d) => d.viewId === view.id)
                      .sort((a, b) => a.hostname.localeCompare(b.hostname));
                    return (
                      <TreeNode
                        id={`${view.id}__vuln-cisco`}
                        label="Cisco"
                        icon={<Server size={14} />}
                        depth={2}
                        hasChildren={viewVulnDevices.length > 0}
                        isSection
                        onAdd={() => {
                          setSelectedGeneratedConfigId(null);
                          setSelectedPluginName(VULN_CISCO_MANIFEST.name);
                          setSelectedPluginNodeId('add-device');
                          setSelectedPluginViewId(view.id);
                          onSelectPlugin?.(VULN_CISCO_MANIFEST.name, 'add-device');
                        }}
                        onSelect={() => {
                          setSelectedGeneratedConfigId(null);
                          setSelectedPluginName(VULN_CISCO_MANIFEST.name);
                          setSelectedPluginNodeId('cisco');
                          setSelectedPluginViewId(view.id);
                          onSelectPlugin?.(VULN_CISCO_MANIFEST.name, 'cisco');
                        }}
                      >
                        {viewVulnDevices.map((device) => (
                          <TreeNode
                            key={device.id}
                            id={`vuln-device-${device.id}`}
                            label={device.hostname}
                            icon={<Cpu size={14} />}
                            depth={3}
                            hasChildren={!!device.lastScanAt}
                            onSelect={() => {
                              setSelectedGeneratedConfigId(null);
                              setSelectedPluginName(VULN_CISCO_MANIFEST.name);
                              setSelectedPluginNodeId(`device:${device.id}`);
                              setSelectedPluginViewId(view.id);
                              onSelectPlugin?.(VULN_CISCO_MANIFEST.name, `device:${device.id}`);
                            }}
                            onEdit={() => {
                              setSelectedGeneratedConfigId(null);
                              setSelectedPluginName(VULN_CISCO_MANIFEST.name);
                              setSelectedPluginNodeId(`edit-device:${device.id}`);
                              setSelectedPluginViewId(view.id);
                              onSelectPlugin?.(VULN_CISCO_MANIFEST.name, `edit-device:${device.id}`);
                            }}
                            onDelete={() => {
                              if (confirm(`Delete device "${device.hostname}"?`)) {
                                deleteVulnDevice(device.id);
                              }
                            }}
                            contextMenuExtras={[
                              {
                                label: 'Scan Now',
                                onClick: () => {
                                  setSelectedGeneratedConfigId(null);
                                  setSelectedPluginName(VULN_CISCO_MANIFEST.name);
                                  setSelectedPluginNodeId(`scan:${device.id}`);
                                  setSelectedPluginViewId(view.id);
                                  onSelectPlugin?.(VULN_CISCO_MANIFEST.name, `scan:${device.id}`);
                                },
                              },
                            ]}
                          >
                            {(() => {
                              const scans = vulnScanCache[device.id] ?? [];
                              if (scans.length === 0 && !device.lastScanAt) return null;
                              return (
                                <TreeNode
                                  id={`vuln-scans-${device.id}`}
                                  label="Scans"
                                  icon={<Clock size={14} />}
                                  depth={4}
                                  hasChildren={scans.length > 0}
                                  isSection
                                >
                                  {scans.map((scan) => (
                                    <TreeNode
                                      key={scan.timestamp}
                                      id={`vuln-scan-${device.id}-${scan.timestamp}`}
                                      label={formatShortDate(scan.timestamp)}
                                      icon={<FileCheck size={14} />}
                                      depth={5}
                                      hasChildren={false}
                                      onSelect={() => {
                                        setSelectedGeneratedConfigId(null);
                                        setSelectedPluginName(VULN_CISCO_MANIFEST.name);
                                        setSelectedPluginNodeId(`report:${device.ip}:${scan.timestamp}`);
                                        setSelectedPluginViewId(view.id);
                                        onSelectPlugin?.(
                                          VULN_CISCO_MANIFEST.name,
                                          `report:${device.ip}:${scan.timestamp}`,
                                        );
                                      }}
                                    />
                                  ))}
                                </TreeNode>
                              );
                            })()}
                          </TreeNode>
                        ))}
                      </TreeNode>
                    );
                  })()}
                </TreeNode>
              )}

              {/* Plugin-contributed tree nodes (vendorScoped: false) — excludes vuln-cisco */}
              {getPlugins()
                .filter((p) => p.enabled && p.manifest.name !== VULN_CISCO_MANIFEST.name)
                .flatMap((plugin) =>
                  plugin.manifest.treeNodes
                    .filter((tn) => !tn.vendorScoped)
                    .map((tn) => (
                      <TreeNode
                        key={`${plugin.manifest.name}__${tn.id}`}
                        id={`${plugin.manifest.name}__${tn.id}`}
                        label={tn.label}
                        icon={getPluginIcon(tn.icon)}
                        depth={1}
                        hasChildren={false}
                        onSelect={() => {
                          setSelectedGeneratedConfigId(null);
                          setSelectedPluginName(plugin.manifest.name);
                          setSelectedPluginNodeId(tn.id);
                          setSelectedPluginViewId(view.id);
                          if (onSelectPlugin) {
                            onSelectPlugin(plugin.manifest.name, tn.id);
                          }
                        }}
                      />
                    )),
                )}
            </TreeNode>
          ))}

          {/* Global Plugins node — Configured / Needs Setup groups (FORGE-69-B) */}
          {(() => {
            const allPlugins = getPlugins();
            const configured = allPlugins.filter((p) => isPluginConfigured(p));
            const needsSetup = allPlugins.filter((p) => !isPluginConfigured(p));

            const renderPluginNode = (plugin: (typeof allPlugins)[0], depth: number) => (
              <TreeNode
                key={plugin.manifest.name}
                id={`plugin-${plugin.manifest.name}`}
                label={plugin.manifest.displayName}
                icon={
                  <span
                    className={
                      plugin.health.status === 'active'
                        ? 'text-emerald-400'
                        : plugin.health.status === 'inactive'
                          ? 'text-red-400'
                          : 'text-slate-500'
                    }
                  >
                    {getPluginIcon(plugin.manifest.icon)}
                  </span>
                }
                depth={depth}
                hasChildren={false}
                isSelected={selectedPluginName === plugin.manifest.name}
                onSelect={() => {
                  setSelectedPluginName(plugin.manifest.name);
                  setSelectedPluginNodeId(null);
                  if (onSelectPlugin) {
                    onSelectPlugin(plugin.manifest.name, null);
                  }
                }}
                onDelete={undefined}
                contextMenuExtras={
                  isPluginConfigured(plugin)
                    ? [
                        {
                          label: plugin.enabled ? 'Disable' : 'Enable',
                          onClick: () => setPluginEnabled(plugin.manifest.name, !plugin.enabled),
                        },
                      ]
                    : [
                        {
                          label: 'Configure',
                          onClick: () => {
                            setSelectedPluginName(plugin.manifest.name);
                            setSelectedPluginNodeId(null);
                            if (onSelectPlugin) onSelectPlugin(plugin.manifest.name, null);
                          },
                        },
                      ]
                }
              />
            );

            return (
              <TreeNode
                id="__plugins"
                label="Plugins"
                icon={<Puzzle size={14} />}
                depth={0}
                hasChildren={allPlugins.length > 0}
                isSection
              >
                {configured.length > 0 && (
                  <TreeNode
                    id="__plugins-configured"
                    label="Configured"
                    icon={<Puzzle size={14} className="text-emerald-400" />}
                    depth={1}
                    hasChildren
                  >
                    {configured.map((p) => renderPluginNode(p, 2))}
                  </TreeNode>
                )}
                {needsSetup.length > 0 && (
                  <TreeNode
                    id="__plugins-needs-setup"
                    label={
                      <>
                        Needs Setup{' '}
                        <span className="ml-1 text-[10px] font-medium text-forge-amber bg-forge-amber/15 px-1.5 py-0.5 rounded-full">
                          {needsSetup.length}
                        </span>
                      </>
                    }
                    icon={<Puzzle size={14} className="text-slate-500" />}
                    depth={1}
                    hasChildren
                  >
                    {needsSetup.map((p) => renderPluginNode(p, 2))}
                  </TreeNode>
                )}
              </TreeNode>
            );
          })()}
        </div>

        {/* Footer: Add View button — sticky at bottom */}
        {tree.views.length > 0 && (
          <div className="shrink-0 px-3 py-3 border-t border-forge-graphite">
            <button
              onClick={() => {
                openCreate('view');
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[13px] font-semibold bg-forge-amber text-forge-obsidian rounded-md hover:bg-forge-amber-bright transition-colors"
            >
              + Add View
            </button>
          </div>
        )}
      </aside>

      {/* Create modal */}
      <CreateNodeModal
        open={modalContext !== null}
        nodeType={modalContext?.type ?? 'view'}
        onClose={() => {
          setModalContext(null);
        }}
        onSubmit={handleCreate}
      />

      {/* Edit modal (reuses CreateNodeModal) */}
      <CreateNodeModal
        open={editContext !== null}
        nodeType={editContext?.type ?? 'view'}
        onClose={() => {
          setEditContext(null);
        }}
        onSubmit={handleEditSubmit}
      />
    </>
  );
}
