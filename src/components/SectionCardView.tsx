import { FileCode2, Cpu, Server, FileCheck, Clock, Hash } from 'lucide-react';
import { useForgeStore } from '../store/index.ts';
import type { View, Vendor, Model, GeneratedConfig } from '../types/index.ts';

export type SectionNodeType = 'configurations' | 'vendor' | 'model' | 'templates' | 'generated';

export interface SectionSelection {
  type: SectionNodeType;
  viewId: string;
  vendorId?: string;
  modelId?: string;
}

interface SectionCardViewProps {
  selection: SectionSelection;
  onNavigateVariant: (_variantId: string) => void;
  onNavigateGeneratedConfig: (_configId: string) => void;
  onNavigateSection: (_sel: SectionSelection) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Card({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-forge-charcoal border border-forge-steel rounded-lg p-5 transition-all duration-150 ${
        onClick ? 'cursor-pointer hover:border-forge-amber/50 hover:bg-forge-graphite' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

function StatBadge({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500">
      {icon}
      <span>{label}:</span>
      <span className="text-slate-300 font-medium">{value}</span>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-slate-200">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function ConfigurationsView({
  view,
  onNavigateSection,
}: {
  view: View;
  onNavigateSection: (sel: SectionSelection) => void;
}) {
  return (
    <>
      <SectionHeader
        title="Configurations"
        subtitle={`${view.name} — ${view.vendors.length} vendor${view.vendors.length !== 1 ? 's' : ''}`}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {view.vendors.map((vendor) => {
          const templateCount = vendor.models.reduce((sum, m) => sum + m.variants.length, 0);
          return (
            <Card
              key={vendor.id}
              onClick={() => { onNavigateSection({ type: 'vendor', viewId: view.id, vendorId: vendor.id }); }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-forge-graphite rounded-md">
                  <Server size={18} className="text-forge-amber" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">{vendor.name}</h3>
                  <span className="text-xs text-slate-500 uppercase tracking-wider">{vendor.configFormat}</span>
                </div>
              </div>
              <div className="flex gap-4">
                <StatBadge icon={<Cpu size={12} />} label="Models" value={vendor.models.length} />
                <StatBadge icon={<FileCode2 size={12} />} label="Templates" value={templateCount} />
              </div>
            </Card>
          );
        })}
        {view.vendors.length === 0 && (
          <p className="text-sm text-slate-500 col-span-full">No vendors yet. Add one from the sidebar.</p>
        )}
      </div>
    </>
  );
}

function VendorView({
  vendor,
  viewId,
  getGeneratedConfigs,
  onNavigateSection,
}: {
  vendor: Vendor;
  viewId: string;
  getGeneratedConfigs: (_modelId: string) => GeneratedConfig[];
  onNavigateSection: (sel: SectionSelection) => void;
}) {
  return (
    <>
      <SectionHeader
        title={vendor.name}
        subtitle={`${vendor.models.length} model${vendor.models.length !== 1 ? 's' : ''} — ${vendor.configFormat.toUpperCase()} format`}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {vendor.models.map((model) => {
          const genCount = getGeneratedConfigs(model.id).length;
          return (
            <Card
              key={model.id}
              onClick={() => { onNavigateSection({ type: 'model', viewId, vendorId: vendor.id, modelId: model.id }); }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-forge-graphite rounded-md">
                  <Cpu size={18} className="text-forge-amber" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">{model.name}</h3>
                  {model.description && (
                    <p className="text-xs text-slate-500 truncate max-w-[180px]">{model.description}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-4">
                <StatBadge icon={<FileCode2 size={12} />} label="Templates" value={model.variants.length} />
                {genCount > 0 && <StatBadge icon={<FileCheck size={12} />} label="Generated" value={genCount} />}
              </div>
              <div className="mt-2">
                <StatBadge icon={<Clock size={12} />} label="Updated" value={formatDate(model.updatedAt)} />
              </div>
            </Card>
          );
        })}
        {vendor.models.length === 0 && (
          <p className="text-sm text-slate-500 col-span-full">No models yet. Add one from the sidebar.</p>
        )}
      </div>
    </>
  );
}

function ModelView({
  model,
  getTemplate,
  getGeneratedConfigs,
  onNavigateVariant,
  onNavigateGeneratedConfig,
}: {
  model: Model;
  getTemplate: (_id: string) => { sections: { id: string }[]; updatedAt: string } | undefined;
  getGeneratedConfigs: (_modelId: string) => GeneratedConfig[];
  onNavigateVariant: (variantId: string) => void;
  onNavigateGeneratedConfig: (configId: string) => void;
}) {
  const generatedConfigs = getGeneratedConfigs(model.id);

  return (
    <>
      <SectionHeader
        title={model.name}
        subtitle={model.description || `${model.variants.length} template${model.variants.length !== 1 ? 's' : ''}`}
      />

      {model.variants.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Templates</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {model.variants.map((variant) => {
              const tmpl = getTemplate(variant.templateId);
              return (
                <Card key={variant.id} onClick={() => { onNavigateVariant(variant.id); }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-forge-graphite rounded-md">
                      <FileCode2 size={18} className="text-forge-amber" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-200">{variant.name}</h3>
                  </div>
                  <div className="flex gap-4">
                    {tmpl && <StatBadge icon={<Hash size={12} />} label="Sections" value={tmpl.sections.length} />}
                    <StatBadge icon={<Clock size={12} />} label="Updated" value={formatDate(variant.updatedAt)} />
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {generatedConfigs.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Generated Configs</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...generatedConfigs].sort((a, b) => a.name.localeCompare(b.name)).map((gc) => (
              <Card key={gc.id} onClick={() => { onNavigateGeneratedConfig(gc.id); }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-forge-graphite rounded-md">
                    <FileCheck size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">{gc.name}</h3>
                    {gc.notes && <p className="text-xs text-slate-500 truncate max-w-[180px]">{gc.notes}</p>}
                  </div>
                </div>
                <StatBadge icon={<Clock size={12} />} label="Created" value={formatDate(gc.createdAt)} />
              </Card>
            ))}
          </div>
        </>
      )}

      {model.variants.length === 0 && generatedConfigs.length === 0 && (
        <p className="text-sm text-slate-500">No templates or generated configs yet.</p>
      )}
    </>
  );
}

function TemplatesView({
  model,
  getTemplate,
  onNavigateVariant,
}: {
  model: Model;
  getTemplate: (_id: string) => { sections: { id: string }[]; updatedAt: string } | undefined;
  onNavigateVariant: (variantId: string) => void;
}) {
  return (
    <>
      <SectionHeader
        title="Templates"
        subtitle={`${model.name} — ${model.variants.length} template${model.variants.length !== 1 ? 's' : ''}`}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {model.variants.map((variant) => {
          const tmpl = getTemplate(variant.templateId);
          return (
            <Card key={variant.id} onClick={() => { onNavigateVariant(variant.id); }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-forge-graphite rounded-md">
                  <FileCode2 size={18} className="text-forge-amber" />
                </div>
                <h3 className="text-sm font-semibold text-slate-200">{variant.name}</h3>
              </div>
              <div className="flex gap-4">
                {tmpl && <StatBadge icon={<Hash size={12} />} label="Sections" value={tmpl.sections.length} />}
                <StatBadge icon={<Clock size={12} />} label="Updated" value={formatDate(variant.updatedAt)} />
              </div>
            </Card>
          );
        })}
        {model.variants.length === 0 && (
          <p className="text-sm text-slate-500 col-span-full">No templates yet. Add one from the sidebar.</p>
        )}
      </div>
    </>
  );
}

function GeneratedView({
  model,
  getGeneratedConfigs,
  onNavigateGeneratedConfig,
}: {
  model: Model;
  getGeneratedConfigs: (_modelId: string) => GeneratedConfig[];
  onNavigateGeneratedConfig: (configId: string) => void;
}) {
  const configs = getGeneratedConfigs(model.id);
  return (
    <>
      <SectionHeader
        title="Generated Configs"
        subtitle={`${model.name} — ${configs.length} config${configs.length !== 1 ? 's' : ''}`}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {configs.map((gc) => (
          <Card key={gc.id} onClick={() => { onNavigateGeneratedConfig(gc.id); }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-forge-graphite rounded-md">
                <FileCheck size={18} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-200">{gc.name}</h3>
                {gc.notes && <p className="text-xs text-slate-500 truncate max-w-[180px]">{gc.notes}</p>}
              </div>
            </div>
            <StatBadge icon={<Clock size={12} />} label="Created" value={formatDate(gc.createdAt)} />
          </Card>
        ))}
        {configs.length === 0 && <p className="text-sm text-slate-500 col-span-full">No generated configs yet.</p>}
      </div>
    </>
  );
}

export function SectionCardView({
  selection,
  onNavigateVariant,
  onNavigateGeneratedConfig,
  onNavigateSection,
}: SectionCardViewProps) {
  const { tree, getTemplate, getGeneratedConfigs } = useForgeStore();

  const view = tree.views.find((v) => v.id === selection.viewId);
  if (!view) return <div className="flex-1 flex items-center justify-center text-slate-500">View not found.</div>;

  const vendor = selection.vendorId ? view.vendors.find((v) => v.id === selection.vendorId) : undefined;
  const model = selection.modelId ? vendor?.models.find((m) => m.id === selection.modelId) : undefined;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {selection.type === 'configurations' && <ConfigurationsView view={view} onNavigateSection={onNavigateSection} />}
      {selection.type === 'vendor' && vendor && (
        <VendorView
          vendor={vendor}
          viewId={view.id}
          getGeneratedConfigs={getGeneratedConfigs}
          onNavigateSection={onNavigateSection}
        />
      )}
      {selection.type === 'model' && model && (
        <ModelView
          model={model}
          getTemplate={getTemplate}
          getGeneratedConfigs={getGeneratedConfigs}
          onNavigateVariant={onNavigateVariant}
          onNavigateGeneratedConfig={onNavigateGeneratedConfig}
        />
      )}
      {selection.type === 'templates' && model && (
        <TemplatesView model={model} getTemplate={getTemplate} onNavigateVariant={onNavigateVariant} />
      )}
      {selection.type === 'generated' && model && (
        <GeneratedView
          model={model}
          getGeneratedConfigs={getGeneratedConfigs}
          onNavigateGeneratedConfig={onNavigateGeneratedConfig}
        />
      )}
    </div>
  );
}
