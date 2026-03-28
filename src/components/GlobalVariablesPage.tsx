import { useState, useCallback, useRef } from 'react';
import { useForgeStore } from '../store/index.ts';
import type { VariableDefinition, VariableType } from '../types/index.ts';
import { Globe, Plus, GripVertical, Eye, EyeOff, Trash2, ArrowUp, ArrowDown, Cloud, CloudOff, Download } from 'lucide-react';
import { DropdownOptionsEditor } from './DropdownOptionsEditor.tsx';
import { ImportSecretPicker } from './ImportSecretPicker.tsx';
import { INFISICAL_MANIFEST } from '../plugins/infisical/manifest.ts';

interface GlobalVariablesPageProps {
  viewId: string;
}

const VARIABLE_TYPES: VariableType[] = ['string', 'ip', 'integer', 'dropdown'];

const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

function isValidIpv4(value: string): boolean {
  if (!IPV4_REGEX.test(value)) return false;
  return value.split('.').every((octet) => {
    const n = parseInt(octet, 10);
    return n >= 0 && n <= 255;
  });
}

export default function GlobalVariablesPage({ viewId }: GlobalVariablesPageProps) {
  const view = useForgeStore((s) => s.tree.views.find((v) => v.id === viewId));
  const addGlobalVariable = useForgeStore((s) => s.addGlobalVariable);
  const updateGlobalVariable = useForgeStore((s) => s.updateGlobalVariable);
  const deleteGlobalVariable = useForgeStore((s) => s.deleteGlobalVariable);
  const reorderGlobalVariables = useForgeStore((s) => s.reorderGlobalVariables);

  const getSecretsProviders = useForgeStore((s) => s.getSecretsProviders);
  const getPlugin = useForgeStore((s) => s.getPlugin);

  const providers = getSecretsProviders();
  const writableProvider = providers.find((p) => p.isConnected() && p.capabilities().write);
  const readableProvider = providers.find((p) => p.isConnected() && p.capabilities().read);

  const globalVariables = view?.globalVariables ?? [];

  const [showImportPicker, setShowImportPicker] = useState(false);
  const [confirmDeleteName, setConfirmDeleteName] = useState<string | null>(null);
  const [syncErrors, setSyncErrors] = useState<Record<string, string>>({});
  const [ipErrors, setIpErrors] = useState<Record<string, boolean>>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // Local editing state for variable names — committed to store on blur
  const [editingNames, setEditingNames] = useState<Record<string, string>>({});
  const editingNamesRef = useRef(editingNames);
  editingNamesRef.current = editingNames;

  const handleAdd = useCallback(() => {
    const existingNames = new Set(globalVariables.map((v) => v.name));
    let counter = globalVariables.length + 1;
    let name = `new_global_${counter}`;
    while (existingNames.has(name)) {
      counter++;
      name = `new_global_${counter}`;
    }
    const newVar: VariableDefinition = {
      name,
      label: name.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      type: 'string',
      defaultValue: '',
      options: [],
      required: false,
      description: '',
    };
    addGlobalVariable(viewId, newVar);
  }, [viewId, globalVariables, addGlobalVariable]);

  const handleUpdate = useCallback(
    (name: string, updates: Partial<VariableDefinition>) => {
      updateGlobalVariable(viewId, name, updates);
    },
    [viewId, updateGlobalVariable],
  );

  const handleImportSecret = useCallback(
    (key: string, value: string) => {
      const varName = key.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const existingNames = new Set(globalVariables.map((v) => v.name));

      const plugin = getPlugin(INFISICAL_MANIFEST.name);
      const settings = (plugin?.settings ?? {}) as Record<string, string>;
      const syncMeta = {
        provider: readableProvider!.name,
        projectId: settings.defaultProjectId || '',
        environment: settings.defaultEnvironment || 'dev',
        secretKey: key,
      };

      if (existingNames.has(varName)) {
        handleUpdate(varName, { defaultValue: value, syncToSecrets: syncMeta });
      } else {
        const newVar: VariableDefinition = {
          name: varName,
          label: varName.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          type: 'string',
          defaultValue: value,
          options: [],
          required: false,
          description: '',
        };
        addGlobalVariable(viewId, newVar);
        handleUpdate(varName, { syncToSecrets: syncMeta });
      }
      setShowImportPicker(false);
    },
    [viewId, globalVariables, addGlobalVariable, handleUpdate, getPlugin, readableProvider],
  );

  const handleDelete = useCallback(
    (name: string) => {
      deleteGlobalVariable(viewId, name);
      setConfirmDeleteName(null);
    },
    [viewId, deleteGlobalVariable],
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const names = globalVariables.map((v) => v.name);
      [names[index - 1], names[index]] = [names[index], names[index - 1]];
      reorderGlobalVariables(viewId, names);
    },
    [viewId, globalVariables, reorderGlobalVariables],
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= globalVariables.length - 1) return;
      const names = globalVariables.map((v) => v.name);
      [names[index], names[index + 1]] = [names[index + 1], names[index]];
      reorderGlobalVariables(viewId, names);
    },
    [viewId, globalVariables, reorderGlobalVariables],
  );

  const handleIpBlur = useCallback(
    (name: string, value: string) => {
      setIpErrors((prev) => ({
        ...prev,
        [name]: value.length > 0 && !isValidIpv4(value),
      }));
    },
    [],
  );

  const handleSyncToggle = useCallback(
    async (variable: VariableDefinition) => {
      if (!writableProvider) return;

      if (variable.syncToSecrets) {
        // Disable sync — just clear the metadata
        handleUpdate(variable.name, { syncToSecrets: undefined });
        setSyncErrors((prev) => {
          const next = { ...prev };
          delete next[variable.name];
          return next;
        });
        return;
      }

      // Enable sync — get defaults from the infisical plugin settings
      const plugin = getPlugin(INFISICAL_MANIFEST.name);
      const settings = (plugin?.settings ?? {}) as Record<string, string>;
      const projectId = settings.defaultProjectId || '';
      const environment = settings.defaultEnvironment || 'dev';
      const secretKey = 'FORGE_' + variable.name.toUpperCase();

      if (!projectId) {
        setSyncErrors((prev) => ({
          ...prev,
          [variable.name]: 'No default project configured in Infisical plugin settings.',
        }));
        return;
      }

      try {
        if (writableProvider.setSecret) {
          await writableProvider.setSecret(projectId, environment, secretKey, variable.defaultValue);
        }
        handleUpdate(variable.name, {
          syncToSecrets: {
            provider: writableProvider.name,
            projectId,
            environment,
            secretKey,
          },
        });
        setSyncErrors((prev) => {
          const next = { ...prev };
          delete next[variable.name];
          return next;
        });
      } catch (err) {
        setSyncErrors((prev) => ({
          ...prev,
          [variable.name]: err instanceof Error ? err.message : 'Sync failed',
        }));
      }
    },
    [writableProvider, getPlugin, handleUpdate],
  );

  const handleValueBlurSync = useCallback(
    async (variable: VariableDefinition) => {
      if (!variable.syncToSecrets || !writableProvider?.setSecret) return;
      const { projectId, environment, secretKey } = variable.syncToSecrets;
      try {
        await writableProvider.setSecret(projectId, environment, secretKey, variable.defaultValue);
        setSyncErrors((prev) => {
          const next = { ...prev };
          delete next[variable.name];
          return next;
        });
      } catch (err) {
        setSyncErrors((prev) => ({
          ...prev,
          [variable.name]: err instanceof Error ? err.message : 'Sync failed',
        }));
      }
    },
    [writableProvider],
  );

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (dragIndex !== null && dragIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [dragIndex],
  );

  const handleDragEnd = useCallback(() => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      const names = globalVariables.map((v) => v.name);
      const [moved] = names.splice(dragIndex, 1);
      names.splice(dragOverIndex, 0, moved);
      reorderGlobalVariables(viewId, names);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, dragOverIndex, globalVariables, viewId, reorderGlobalVariables]);

  const renderValueInput = (variable: VariableDefinition) => {
    const inputClasses =
      'w-full px-2.5 py-1.5 bg-slate-950 border border-green-500/30 rounded text-[13px] font-mono text-slate-200 outline-none focus:border-green-500 focus:shadow-[0_0_0_2px_rgba(34,197,94,0.15)] transition-colors';

    if (variable.type === 'dropdown') {
      return (
        <select
          value={variable.defaultValue}
          onChange={(e) => {
            handleUpdate(variable.name, { defaultValue: e.target.value });
            // Sync after dropdown change (no blur event for selects)
            if (variable.syncToSecrets) {
              void handleValueBlurSync({ ...variable, defaultValue: e.target.value });
            }
          }}
          className={`${inputClasses} cursor-pointer`}
        >
          <option value="">Select...</option>
          {variable.options.map((opt, i) => {
            const { label: optLabel, value: optValue } = typeof opt === 'string' ? { label: opt, value: opt } : { label: opt.label ?? opt.value, value: opt.value };
            return (
              <option key={`${optValue}-${i}`} value={optValue}>
                {optLabel}
              </option>
            );
          })}
        </select>
      );
    }

    if (variable.type === 'integer') {
      return (
        <input
          type={variable.masked ? 'password' : 'number'}
          value={variable.defaultValue}
          onChange={(e) => handleUpdate(variable.name, { defaultValue: e.target.value })}
          onBlur={() => void handleValueBlurSync(variable)}
          className={inputClasses}
          placeholder="0"
        />
      );
    }

    return (
      <>
        <input
          type={variable.masked ? 'password' : 'text'}
          value={variable.defaultValue}
          onChange={(e) => handleUpdate(variable.name, { defaultValue: e.target.value })}
          onBlur={() => {
            if (variable.type === 'ip') {
              handleIpBlur(variable.name, variable.defaultValue);
            }
            void handleValueBlurSync(variable);
          }}
          className={`${inputClasses} ${ipErrors[variable.name] ? '!border-red-500' : ''}`}
          placeholder={variable.type === 'ip' ? '0.0.0.0' : 'Enter value...'}
        />
        {ipErrors[variable.name] && (
          <p className="text-[11px] text-red-400 mt-0.5">Invalid IPv4 address</p>
        )}
      </>
    );
  };

  if (!view) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        <p>View not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-slate-800">
        <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2.5">
          <Globe size={20} className="text-green-500" />
          Global Variables
          {globalVariables.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-green-500/20 text-green-500 text-[11px] font-bold">
              {globalVariables.length}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {readableProvider && (
            <button
              onClick={() => setShowImportPicker(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-700 text-slate-200 text-[13px] font-semibold rounded-md hover:bg-slate-600 border border-slate-600 transition-colors"
            >
              <Download size={14} />
              Import from Infisical
            </button>
          )}
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-slate-900 text-[13px] font-semibold rounded-md hover:bg-amber-400 transition-colors"
          >
            <Plus size={14} />
            Add Variable
          </button>
        </div>
      </div>

      {/* Secrets sync hint */}
      {!writableProvider && globalVariables.length > 0 && (
        <div className="px-6 pt-3 pb-0">
          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <CloudOff size={12} className="text-slate-600" />
            Connect a secrets provider with write access to enable variable syncing.
          </p>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {globalVariables.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Globe size={48} className="mx-auto mb-4 text-slate-600" />
            <p className="text-[13px] leading-relaxed max-w-[420px] mx-auto">
              No global variables yet. Use{' '}
              <code className="font-mono text-green-500 text-xs bg-green-500/10 px-1.5 py-0.5 rounded">
                {'${variable_name}'}
              </code>{' '}
              syntax in your templates to auto-detect globals, or add one manually.
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              {readableProvider && (
                <button
                  onClick={() => setShowImportPicker(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-700 text-slate-200 text-[13px] font-semibold rounded-md hover:bg-slate-600 border border-slate-600 transition-colors"
                >
                  <Download size={14} />
                  Import from Infisical
                </button>
              )}
              <button
                onClick={handleAdd}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-slate-900 text-[13px] font-semibold rounded-md hover:bg-amber-400 transition-colors"
              >
                <Plus size={14} />
                Add Variable
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className={`grid ${writableProvider ? 'grid-cols-[28px_1fr_180px_100px_36px_36px_200px_36px]' : 'grid-cols-[28px_1fr_180px_100px_36px_200px_36px]'} gap-2.5 px-4 mb-1.5 text-[10px] font-semibold tracking-widest uppercase text-slate-500`}>
              <span />
              <span>Variable Name</span>
              <span>Value</span>
              <span>Type</span>
              <span />
              {writableProvider && <span>Sync</span>}
              <span>Description</span>
              <span />
            </div>

            {/* Variable rows */}
            <div>
              {globalVariables.map((variable, index) => (
                <div key={variable.name} className="mb-2">
                <div
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`grid ${writableProvider ? 'grid-cols-[28px_1fr_180px_100px_36px_36px_200px_36px]' : 'grid-cols-[28px_1fr_180px_100px_36px_200px_36px]'} gap-2.5 items-center px-4 py-3 bg-slate-800 border border-slate-700/50 rounded-lg transition-colors hover:border-green-500/30 ${
                    dragIndex === index ? 'opacity-50 !border-green-500' : ''
                  } ${dragOverIndex === index ? '!border-green-500 shadow-[0_0_0_2px_rgba(34,197,94,0.2)]' : ''}`}
                >
                  {/* Grip handle + reorder */}
                  <div className="flex flex-col items-center gap-0.5">
                    <GripVertical size={14} className="text-slate-500 cursor-grab" />
                    <div className="flex flex-col">
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="text-slate-600 hover:text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        <ArrowUp size={10} />
                      </button>
                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={index === globalVariables.length - 1}
                        className="text-slate-600 hover:text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        <ArrowDown size={10} />
                      </button>
                    </div>
                  </div>

                  {/* Variable name (editable — local state, committed on blur) */}
                  <div className="flex items-center gap-0 overflow-hidden">
                    <span className="text-green-600/70 font-mono text-[13px]">$</span>
                    <input
                      type="text"
                      value={editingNames[variable.name] ?? variable.name}
                      onChange={(e) => {
                        const sanitized = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                        setEditingNames((prev) => ({ ...prev, [variable.name]: sanitized }));
                      }}
                      onBlur={() => {
                        const newName = editingNames[variable.name];
                        if (newName && newName !== variable.name) {
                          handleUpdate(variable.name, { name: newName });
                        }
                        setEditingNames((prev) => {
                          const next = { ...prev };
                          delete next[variable.name];
                          return next;
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          (e.target as HTMLInputElement).blur();
                        } else if (e.key === 'Escape') {
                          setEditingNames((prev) => {
                            const next = { ...prev };
                            delete next[variable.name];
                            return next;
                          });
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="bg-transparent text-green-500 font-mono text-[13px] font-medium outline-none border-none w-full"
                    />
                  </div>

                  {/* Value input */}
                  <div>{renderValueInput(variable)}</div>

                  {/* Type selector */}
                  <select
                    value={variable.type}
                    onChange={(e) =>
                      handleUpdate(variable.name, { type: e.target.value as VariableType })
                    }
                    className="px-2.5 py-1.5 bg-slate-950 border border-slate-600 rounded text-[12px] text-slate-400 outline-none cursor-pointer appearance-none"
                  >
                    {VARIABLE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>

                  {/* Mask toggle */}
                  <button
                    onClick={() => handleUpdate(variable.name, { masked: !variable.masked })}
                    className={`inline-flex items-center justify-center w-7 h-7 rounded border-none cursor-pointer transition-colors ${
                      variable.masked
                        ? 'text-amber-500 bg-slate-700/50'
                        : 'text-slate-500 bg-transparent hover:bg-slate-700/50 hover:text-slate-400'
                    }`}
                    title={variable.masked ? 'Unmask value' : 'Mask value'}
                  >
                    {variable.masked ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>

                  {/* Sync to secrets toggle */}
                  {writableProvider && (
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => void handleSyncToggle(variable)}
                        className={`inline-flex items-center justify-center w-7 h-7 rounded border-none cursor-pointer transition-colors ${
                          variable.syncToSecrets
                            ? 'text-green-500 bg-slate-700/50'
                            : 'text-slate-500 bg-transparent hover:bg-slate-700/50 hover:text-slate-400'
                        }`}
                        title={variable.syncToSecrets ? 'Stop syncing to Infisical' : 'Sync to Infisical'}
                      >
                        {variable.syncToSecrets ? <Cloud size={14} /> : <CloudOff size={14} />}
                      </button>
                      {syncErrors[variable.name] && (
                        <p className="text-[9px] text-red-400 mt-0.5 max-w-[80px] text-center leading-tight truncate" title={syncErrors[variable.name]}>
                          {syncErrors[variable.name]}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  <input
                    type="text"
                    value={variable.description}
                    onChange={(e) =>
                      handleUpdate(variable.name, { description: e.target.value })
                    }
                    placeholder="Optional description..."
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700/50 rounded text-[12px] text-slate-400 outline-none focus:border-slate-500 placeholder:text-slate-600 transition-colors"
                  />

                  {/* Delete button */}
                  {confirmDeleteName === variable.name ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(variable.name)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        title="Confirm delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteName(variable.name)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded bg-transparent text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                      title="Delete variable"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                {variable.type === 'dropdown' && (
                  <div className="mt-1.5 ml-[40px]">
                    <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                      Options
                    </label>
                    <DropdownOptionsEditor
                      options={variable.options}
                      onChange={(newOptions) =>
                        handleUpdate(variable.name, { options: newOptions })
                      }
                    />
                  </div>
                )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Import from Infisical picker */}
      {showImportPicker && readableProvider && (() => {
        const plugin = getPlugin(INFISICAL_MANIFEST.name);
        const settings = (plugin?.settings ?? {}) as Record<string, string>;
        return (
          <ImportSecretPicker
            provider={readableProvider}
            projectId={settings.defaultProjectId || ''}
            environment={settings.defaultEnvironment || 'dev'}
            existingNames={new Set(globalVariables.map((v) => v.name))}
            onImport={handleImportSecret}
            onClose={() => setShowImportPicker(false)}
          />
        );
      })()}
    </div>
  );
}
