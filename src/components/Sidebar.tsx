import { useState, useCallback } from 'react';
import { FolderOpen, Server, Cpu, FileCode2 } from 'lucide-react';
import { useForgeStore } from '../store/index.ts';
import { TreeNode } from './TreeNode.tsx';
import { CreateNodeModal, type CreateNodeType, type CreateNodeData } from './CreateNodeModal.tsx';

interface ModalContext {
  type: CreateNodeType;
  viewId?: string;
  vendorId?: string;
  modelId?: string;
}

interface SidebarProps {
  onSwitchToEditor?: () => void;
}

export function Sidebar({ onSwitchToEditor }: SidebarProps) {
  const {
    tree,
    selectedVariantId,
    addView,
    addVendor,
    addModel,
    addVariant,
    saveTemplate,
    setSelectedVariant,
    deleteNode,
    updateNode,
    toggleExpandedNode,
  } = useForgeStore();

  const [modalContext, setModalContext] = useState<ModalContext | null>(null);
  const [editContext, setEditContext] = useState<{ type: CreateNodeType; path: Record<string, string>; currentName: string } | null>(null);

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
    [modalContext, addView, addVendor, addModel, addVariant, saveTemplate, setSelectedVariant, toggleExpandedNode, onSwitchToEditor],
  );

  const handleEdit = useCallback(
    (type: CreateNodeType, path: Record<string, string>, currentName: string) => {
      setEditContext({ type, path, currentName });
    },
    [],
  );

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

  return (
    <>
      <aside className="flex flex-col bg-forge-charcoal border-r border-forge-graphite overflow-hidden">
        {/* Tree */}
        <div className="flex-1 overflow-y-auto py-3">
          {tree.views.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-500">No templates yet</p>
              <button
                onClick={() => openCreate('view')}
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
              hasChildren={view.vendors.length > 0}
              onAdd={() => openCreate('vendor', view.id)}
              onEdit={() => handleEdit('view', { viewId: view.id }, view.name)}
              onDelete={() => handleDelete('view', { viewId: view.id })}
            >
              {view.vendors.map((vendor) => (
                <TreeNode
                  key={vendor.id}
                  id={vendor.id}
                  label={vendor.name}
                  icon={<Server size={14} />}
                  depth={1}
                  hasChildren={vendor.models.length > 0}
                  onAdd={() => openCreate('model', view.id, vendor.id)}
                  onEdit={() => handleEdit('vendor', { viewId: view.id, vendorId: vendor.id }, vendor.name)}
                  onDelete={() => handleDelete('vendor', { viewId: view.id, vendorId: vendor.id })}
                >
                  {vendor.models.map((model) => (
                    <TreeNode
                      key={model.id}
                      id={model.id}
                      label={model.name}
                      icon={<Cpu size={14} />}
                      depth={2}
                      hasChildren={model.variants.length > 0}
                      onAdd={() => openCreate('variant', view.id, vendor.id, model.id)}
                      onEdit={() => handleEdit('model', { viewId: view.id, vendorId: vendor.id, modelId: model.id }, model.name)}
                      onDelete={() => handleDelete('model', { viewId: view.id, vendorId: vendor.id, modelId: model.id })}
                    >
                      {model.variants.map((variant) => (
                        <TreeNode
                          key={variant.id}
                          id={variant.id}
                          label={variant.name}
                          icon={<FileCode2 size={14} />}
                          depth={3}
                          hasChildren={false}
                          isSelected={selectedVariantId === variant.id}
                          onSelect={() => setSelectedVariant(variant.id)}
                          onEdit={() => handleEdit('variant', { viewId: view.id, vendorId: vendor.id, modelId: model.id, variantId: variant.id }, variant.name)}
                          onDelete={() => handleDelete('variant', { viewId: view.id, vendorId: vendor.id, modelId: model.id, variantId: variant.id })}
                        />
                      ))}
                    </TreeNode>
                  ))}
                </TreeNode>
              ))}
            </TreeNode>
          ))}
        </div>

        {/* Footer: Add View button */}
        {tree.views.length > 0 && (
          <div className="px-3 py-3 border-t border-forge-graphite">
            <button
              onClick={() => openCreate('view')}
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
        onClose={() => setModalContext(null)}
        onSubmit={handleCreate}
      />

      {/* Edit modal (reuses CreateNodeModal) */}
      <CreateNodeModal
        open={editContext !== null}
        nodeType={editContext?.type ?? 'view'}
        onClose={() => setEditContext(null)}
        onSubmit={handleEditSubmit}
      />
    </>
  );
}
