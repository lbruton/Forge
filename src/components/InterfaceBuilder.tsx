import { useState, useCallback, useEffect } from 'react';

interface InterfaceBuilderProps {
  value: string;
  onChange: (value: string) => void;
}

const INTERFACE_TYPES = [
  { label: 'GigabitEthernet', prefix: 'Gi' },
  { label: 'TenGigabitEthernet', prefix: 'Te' },
  { label: 'FastEthernet', prefix: 'Fa' },
  { label: 'TwentyFiveGigE', prefix: 'Twe' },
] as const;

type InterfacePrefix = (typeof INTERFACE_TYPES)[number]['prefix'];

/** Pattern to detect variable names that should offer the interface builder. */
export function isInterfaceRangeVariable(variableName: string): boolean {
  const lower = variableName.toLowerCase();
  return (
    lower === 'accessportrange' ||
    lower === 'port_range' ||
    lower === 'interface_range' ||
    lower.includes('portrange') ||
    lower.includes('intrange')
  );
}

/** Try to parse an existing range string back into builder fields. */
function parseRangeString(value: string) {
  for (const { prefix } of INTERFACE_TYPES) {
    if (value.startsWith(prefix)) {
      const rest = value.slice(prefix.length);
      const match = rest.match(/^(\d+)\/(\d+)\/(\d+)-(\d+)$/);
      if (match) {
        return {
          prefix,
          slot: Number(match[1]),
          subSlot: Number(match[2]),
          startPort: Number(match[3]),
          endPort: Number(match[4]),
        };
      }
    }
  }
  return null;
}

export default function InterfaceBuilder({ value, onChange }: InterfaceBuilderProps) {
  const [mode, setMode] = useState<'text' | 'builder'>('builder');

  // Initialise from existing value if parseable
  const parsed = parseRangeString(value);

  const [interfaceType, setInterfaceType] = useState<InterfacePrefix>(parsed?.prefix ?? 'Gi');
  const [slot, setSlot] = useState(parsed?.slot ?? 1);
  const [subSlot, setSubSlot] = useState(parsed?.subSlot ?? 0);
  const [startPort, setStartPort] = useState(parsed?.startPort ?? 1);
  const [endPort, setEndPort] = useState(parsed?.endPort ?? 24);

  const buildRange = useCallback(
    () => `${interfaceType}${slot}/${subSlot}/${startPort}-${endPort}`,
    [interfaceType, slot, subSlot, startPort, endPort],
  );

  // Push changes upstream whenever builder fields change (only in builder mode)
  useEffect(() => {
    if (mode !== 'builder') return;
    const generated = buildRange();
    if (generated !== value) {
      onChange(generated);
    }
  }, [interfaceType, slot, subSlot, startPort, endPort, mode, buildRange, onChange, value]);

  const currentType = INTERFACE_TYPES.find((t) => t.prefix === interfaceType) ?? INTERFACE_TYPES[0];

  if (mode === 'text') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 bg-forge-obsidian border border-forge-steel rounded px-2.5 py-1.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-forge-amber transition-colors"
          />
          <button
            onClick={() => setMode('builder')}
            className="shrink-0 px-2.5 py-1.5 text-xs font-medium rounded border border-forge-steel text-slate-400 hover:text-forge-amber hover:border-forge-amber transition-colors"
          >
            Builder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-forge-charcoal border border-forge-steel rounded-lg p-3 space-y-3">
      {/* Header row with mode toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          Interface Builder
        </span>
        <button
          onClick={() => setMode('text')}
          className="px-2.5 py-1 text-xs font-medium rounded border border-forge-steel text-slate-400 hover:text-forge-amber hover:border-forge-amber transition-colors"
        >
          Text Input
        </button>
      </div>

      {/* Builder fields */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {/* Interface Type */}
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-[11px] text-slate-500 mb-1">Type</label>
          <select
            value={interfaceType}
            onChange={(e) => setInterfaceType(e.target.value as InterfacePrefix)}
            className="w-full bg-forge-obsidian border border-forge-steel rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-forge-amber transition-colors"
          >
            {INTERFACE_TYPES.map((t) => (
              <option key={t.prefix} value={t.prefix}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Slot */}
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">Slot</label>
          <input
            type="number"
            min={0}
            value={slot}
            onChange={(e) => setSlot(Math.max(0, Number(e.target.value)))}
            className="w-full bg-forge-obsidian border border-forge-steel rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-forge-amber transition-colors"
          />
        </div>

        {/* Sub-slot */}
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">Sub-slot</label>
          <input
            type="number"
            min={0}
            value={subSlot}
            onChange={(e) => setSubSlot(Math.max(0, Number(e.target.value)))}
            className="w-full bg-forge-obsidian border border-forge-steel rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-forge-amber transition-colors"
          />
        </div>

        {/* Start Port */}
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">Start</label>
          <input
            type="number"
            min={0}
            value={startPort}
            onChange={(e) => setStartPort(Math.max(0, Number(e.target.value)))}
            className="w-full bg-forge-obsidian border border-forge-steel rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-forge-amber transition-colors"
          />
        </div>

        {/* End Port */}
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">End</label>
          <input
            type="number"
            min={0}
            value={endPort}
            onChange={(e) => setEndPort(Math.max(0, Number(e.target.value)))}
            className="w-full bg-forge-obsidian border border-forge-steel rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-forge-amber transition-colors"
          />
        </div>
      </div>

      {/* Preview */}
      <div className="flex items-center gap-2 pt-1">
        <span className="text-[11px] text-slate-500 uppercase tracking-wider">Preview</span>
        <code className="font-mono text-sm text-forge-amber bg-forge-obsidian border border-forge-steel rounded px-2.5 py-1">
          {currentType.prefix}{slot}/{subSlot}/{startPort}-{endPort}
        </code>
      </div>
    </div>
  );
}
