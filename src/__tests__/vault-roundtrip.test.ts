import { describe, it, expect, beforeEach } from 'vitest';
import { useForgeStore } from '../store/index.ts';
import type { VaultExportData } from '../types/index.ts';
import { defaultExportOptions } from '../types/index.ts';
import type { VulnDevice, ScanEntry } from '../plugins/vuln-cisco/types.ts';

// --- Helpers ---

function createView(name = 'Test View'): string {
  const view = useForgeStore.getState().addView(name);
  return view.id;
}

function makeScanEntry(overrides?: Partial<ScanEntry>): ScanEntry {
  return {
    timestamp: '2026-03-30T00:00:00.000Z',
    status: 'complete',
    severity: { critical: 1, high: 2, medium: 3, low: 4, info: 0 },
    totalFindings: 10,
    ...overrides,
  };
}

function makeVulnDevice(viewId: string, overrides?: Partial<VulnDevice>): VulnDevice {
  return {
    id: 'vd-1',
    viewId,
    hostname: 'switch01',
    ip: '10.0.0.1',
    snmpCommunity: 'secret-community',
    snmpSecretKey: 'secret-key',
    lastScanAt: '2026-03-30T00:00:00.000Z',
    lastSeverity: { critical: 0, high: 1, medium: 2, low: 3, info: 0 },
    ...overrides,
  };
}

// --- Reset store between tests ---

beforeEach(() => {
  useForgeStore.getState().resetAll();
  // resetAll doesn't clear vuln fields — reset them manually
  useForgeStore.setState({ vulnDevices: [], vulnScanCache: {} });
});

// --- Tests ---

describe('vault export/import roundtrip — new fields', () => {
  it('full roundtrip includes vulnDevices (sans secrets) and preferences (sans expandedNodes), excludes scan cache by default', () => {
    const viewId = createView('Network View');
    const store = useForgeStore.getState();

    // Populate vuln devices
    store.addVulnDevice(makeVulnDevice(viewId));

    // Populate scan cache
    store.setVulnScanCache('vd-1', [makeScanEntry()]);

    // Tweak preferences so they differ from defaults
    store.toggleSidebar();       // false → true
    store.toggleRightPanel();    // false → true
    store.toggleExpandedNode('some-node-id');

    // Export with defaults
    const exported = useForgeStore.getState().exportData();

    // vulnDevices present, but SNMP secrets stripped
    expect(exported.vulnDevices).toBeDefined();
    expect(exported.vulnDevices).toHaveLength(1);
    const device = exported.vulnDevices![0];
    expect(device.hostname).toBe('switch01');
    expect(device).not.toHaveProperty('snmpCommunity');
    expect(device).not.toHaveProperty('snmpSecretKey');

    // preferences present, but expandedNodes stripped
    expect(exported.preferences).toBeDefined();
    expect(exported.preferences!.sidebarCollapsed).toBe(true);
    expect(exported.preferences!.rightPanelCollapsed).toBe(true);
    expect(exported.preferences).not.toHaveProperty('expandedNodes');

    // vulnScanCache NOT included by default
    expect(exported.vulnScanCache).toBeUndefined();
  });

  it('includes vulnScanCache when opt-in via ExportOptions', () => {
    const viewId = createView('Network View');
    const store = useForgeStore.getState();

    store.addVulnDevice(makeVulnDevice(viewId));
    store.setVulnScanCache('vd-1', [makeScanEntry()]);

    const exported = useForgeStore.getState().exportData({
      ...defaultExportOptions,
      includeVulnScanCache: true,
    });

    expect(exported.vulnScanCache).toBeDefined();
    expect(exported.vulnScanCache!['vd-1']).toHaveLength(1);
    expect(exported.vulnScanCache!['vd-1'][0].totalFindings).toBe(10);
  });

  it('backward compat — importing vault data missing new fields does not error', () => {
    const viewId = createView('Existing View');

    // Populate store with some vuln data and preferences that should survive
    const store = useForgeStore.getState();
    store.addVulnDevice(makeVulnDevice(viewId));
    store.toggleSidebar(); // false → true

    // Old-format export: only the mandatory fields
    const legacyData: VaultExportData = {
      exportedAt: '2026-01-01T00:00:00.000Z',
      views: [],
      templates: {
        't1': {
          id: 't1',
          sections: [],
          variables: [],
          rawSource: 'hostname $HOSTNAME',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      variableValues: {},
    };

    // Should not throw
    useForgeStore.getState().importData(legacyData);

    // Existing vuln devices preserved
    const state = useForgeStore.getState();
    expect(state.vulnDevices).toHaveLength(1);
    expect(state.vulnDevices[0].hostname).toBe('switch01');

    // Existing preferences preserved
    expect(state.preferences.sidebarCollapsed).toBe(true);

    // Imported template merged
    expect(state.templates['t1']).toBeDefined();
  });

  it('orphaned viewId is reassigned to first available view on import', () => {
    const viewId = createView('Production');

    const orphanDevice: VulnDevice = {
      id: 'vd-orphan',
      viewId: 'nonexistent-view-id',
      hostname: 'orphan-switch',
      ip: '10.0.0.99',
    };

    const importData: VaultExportData = {
      exportedAt: '2026-03-30T00:00:00.000Z',
      views: [],
      templates: {},
      variableValues: {},
      vulnDevices: [orphanDevice],
    };

    useForgeStore.getState().importData(importData);

    const devices = useForgeStore.getState().vulnDevices;
    expect(devices).toHaveLength(1);
    expect(devices[0].id).toBe('vd-orphan');
    // Should be reassigned to the only existing view
    expect(devices[0].viewId).toBe(viewId);
  });

  it('selective ExportOptions excludes vulnDevices and preferences when disabled', () => {
    const viewId = createView('Network View');
    const store = useForgeStore.getState();

    store.addVulnDevice(makeVulnDevice(viewId));
    store.toggleSidebar(); // false → true

    // Export without vulnDevices
    const exportNoDevices = useForgeStore.getState().exportData({
      ...defaultExportOptions,
      includeVulnDevices: false,
    });
    expect(exportNoDevices.vulnDevices).toBeUndefined();
    // preferences still included
    expect(exportNoDevices.preferences).toBeDefined();

    // Export without preferences
    const exportNoPrefs = useForgeStore.getState().exportData({
      ...defaultExportOptions,
      includePreferences: false,
    });
    expect(exportNoPrefs.preferences).toBeUndefined();
    // vulnDevices still included
    expect(exportNoPrefs.vulnDevices).toBeDefined();
  });
});
