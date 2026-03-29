import { describe, it, expect, beforeEach } from 'vitest';
import { useForgeStore } from '../store/index.ts';
import { VULN_CISCO_MANIFEST } from '../plugins/vuln-cisco/manifest.ts';
import { validateManifest } from '../lib/plugin-service.ts';
import type { VulnDevice, SeveritySummary, ScanEntry, ScanStatus, DeviceSummary } from '../plugins/vuln-cisco/types.ts';
import { initBundledPlugins } from '../plugins/init.ts';

// --- Reset store between tests ---

beforeEach(() => {
  useForgeStore.getState().resetAll();
});

// --- Manifest validation ---

describe('VULN_CISCO_MANIFEST', () => {
  it('has name forge-vuln-cisco', () => {
    expect(VULN_CISCO_MANIFEST.name).toBe('forge-vuln-cisco');
  });

  it('has type sidecar', () => {
    expect(VULN_CISCO_MANIFEST.type).toBe('sidecar');
  });

  it('vendors contains cisco', () => {
    expect(VULN_CISCO_MANIFEST.vendors).toContain('cisco');
  });

  it('has exactly 1 treeNode with id vulnerabilities', () => {
    expect(VULN_CISCO_MANIFEST.treeNodes).toHaveLength(1);
    expect(VULN_CISCO_MANIFEST.treeNodes[0].id).toBe('vulnerabilities');
  });

  it('has icon shield-alert', () => {
    expect(VULN_CISCO_MANIFEST.icon).toBe('shield-alert');
  });

  it('has a valid semver version string', () => {
    expect(VULN_CISCO_MANIFEST.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('passes validateManifest without errors', () => {
    expect(() => validateManifest(VULN_CISCO_MANIFEST)).not.toThrow();
    const result = validateManifest(VULN_CISCO_MANIFEST);
    expect(result.name).toBe('forge-vuln-cisco');
    expect(result.type).toBe('sidecar');
  });
});

// --- Type structure validation ---

describe('vuln-cisco type shapes', () => {
  it('VulnDevice has all required fields', () => {
    const device: VulnDevice = {
      id: 'dev-001',
      viewId: 'view-001',
      hostname: 'core-sw-01',
      ip: '192.168.1.10',
    };
    expect(device.id).toBe('dev-001');
    expect(device.hostname).toBe('core-sw-01');
    expect(device.ip).toBe('192.168.1.10');
    expect(device.snmpCommunity).toBeUndefined();
    expect(device.lastScanAt).toBeUndefined();
    expect(device.lastSeverity).toBeUndefined();
  });

  it('SeveritySummary has all 5 severity levels', () => {
    const summary: SeveritySummary = {
      critical: 1,
      high: 3,
      medium: 5,
      low: 10,
      info: 20,
    };
    expect(summary).toHaveProperty('critical');
    expect(summary).toHaveProperty('high');
    expect(summary).toHaveProperty('medium');
    expect(summary).toHaveProperty('low');
    expect(summary).toHaveProperty('info');
    expect(Object.keys(summary)).toHaveLength(5);
  });

  it('ScanEntry has valid status and required fields', () => {
    const entry: ScanEntry = {
      timestamp: '2026-03-27T12:00:00Z',
      status: 'complete',
      severity: { critical: 0, high: 1, medium: 2, low: 3, info: 4 },
      totalFindings: 10,
    };
    expect(entry.status).toBe('complete');
    expect(entry.timestamp).toBeTruthy();
    expect(entry.severity).toBeDefined();
    expect(entry.totalFindings).toBe(10);

    const failed: ScanEntry = { ...entry, status: 'failed' };
    expect(['complete', 'failed']).toContain(failed.status);
  });

  it('ScanStatus accepts all 4 valid status values', () => {
    const base: Omit<ScanStatus, 'status'> = {
      scanId: 'scan-001',
      device: '192.168.1.10',
    };

    const statuses: ScanStatus['status'][] = ['queued', 'running', 'complete', 'failed'];
    for (const status of statuses) {
      const scanStatus: ScanStatus = { ...base, status };
      expect(['queued', 'running', 'complete', 'failed']).toContain(scanStatus.status);
    }
  });

  it('DeviceSummary scanCount is a number', () => {
    const summary: DeviceSummary = {
      device: '192.168.1.10',
      scanCount: 5,
    };
    expect(typeof summary.scanCount).toBe('number');
    expect(summary.device).toBe('192.168.1.10');
    expect(summary.hostname).toBeUndefined();
    expect(summary.lastScan).toBeUndefined();
    expect(summary.severity).toBeUndefined();
  });
});

// --- Plugin registration ---

describe('vuln-cisco plugin registration', () => {
  it('is present in getPlugins after initBundledPlugins', () => {
    const { getPlugin, registerPlugin, setPluginHealth } = useForgeStore.getState();
    initBundledPlugins(getPlugin, registerPlugin, setPluginHealth);

    const plugins = useForgeStore.getState().getPlugins();
    const vulnPlugin = plugins.find((p) => p.manifest.name === 'forge-vuln-cisco');
    expect(vulnPlugin).toBeDefined();
  });

  it('is registered with enabled: true', () => {
    const { getPlugin, registerPlugin, setPluginHealth } = useForgeStore.getState();
    initBundledPlugins(getPlugin, registerPlugin, setPluginHealth);

    const plugin = useForgeStore.getState().getPlugin('forge-vuln-cisco');
    expect(plugin).toBeDefined();
    expect(plugin!.enabled).toBe(true);
  });
});
