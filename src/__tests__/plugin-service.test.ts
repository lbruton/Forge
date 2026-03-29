import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateManifest, fetchManifest, healthCheck, pluginFetch } from '../lib/plugin-service.ts';
import type { PluginManifest } from '../types/plugin.ts';

// --- Helpers ---

function validManifestData(): PluginManifest {
  return {
    name: 'forge-vuln-cisco',
    displayName: 'Cisco PSIRT/Nuclei Scan',
    version: '1.0.0',
    icon: 'shield-alert',
    type: 'sidecar',
    vendors: ['cisco'],
    treeNodes: [{ id: 'vulnerabilities', label: 'Vulnerabilities', icon: 'shield-alert', vendorScoped: true }],
  };
}

// --- Fetch mocking ---

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// --- validateManifest ---

describe('validateManifest', () => {
  it('returns typed manifest for valid input with all required fields', () => {
    const data = validManifestData();
    const result = validateManifest(data);
    expect(result.name).toBe('forge-vuln-cisco');
    expect(result.type).toBe('sidecar');
    expect(result.vendors).toEqual(['cisco']);
    expect(result.treeNodes).toHaveLength(1);
  });

  it('throws for missing name field', () => {
    const data = validManifestData();
    delete (data as unknown as Record<string, unknown>).name;
    expect(() => validateManifest(data)).toThrow("missing required field 'name'");
  });

  it('throws for missing type field', () => {
    const data = validManifestData();
    delete (data as unknown as Record<string, unknown>).type;
    expect(() => validateManifest(data)).toThrow("field 'type' must be 'bundled' or 'sidecar'");
  });

  it('throws for invalid type value', () => {
    const data = { ...validManifestData(), type: 'external' };
    expect(() => validateManifest(data)).toThrow("field 'type' must be 'bundled' or 'sidecar'");
  });

  it('throws for missing vendors', () => {
    const data = validManifestData();
    delete (data as unknown as Record<string, unknown>).vendors;
    expect(() => validateManifest(data)).toThrow("missing required field 'vendors'");
  });

  it('throws for missing treeNodes', () => {
    const data = validManifestData();
    delete (data as unknown as Record<string, unknown>).treeNodes;
    expect(() => validateManifest(data)).toThrow("missing required field 'treeNodes'");
  });

  it('returns successfully with optional settingsSchema', () => {
    const data = {
      ...validManifestData(),
      settingsSchema: {
        apiUrl: { type: 'string' as const, label: 'API URL', required: true },
      },
    };
    const result = validateManifest(data);
    expect(result.settingsSchema).toBeDefined();
    expect(result.settingsSchema!.apiUrl.label).toBe('API URL');
  });
});

// --- fetchManifest ---

describe('fetchManifest', () => {
  it('returns parsed manifest on successful fetch', async () => {
    const data = validManifestData();
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => data,
    });

    const result = await fetchManifest('http://localhost:9001');
    expect(result.name).toBe('forge-vuln-cisco');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:9001/forge/manifest',
      expect.objectContaining({
        method: 'GET',
        credentials: 'omit',
      }),
    );
  });

  it('throws network error message when fetch rejects', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchManifest('http://localhost:9001')).rejects.toThrow(
      'Cannot connect to http://localhost:9001',
    );
  });

  it('throws authentication error on 401', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
    });

    await expect(fetchManifest('http://localhost:9001')).rejects.toThrow('Authentication failed');
  });

  it('throws status error on 500', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(fetchManifest('http://localhost:9001')).rejects.toThrow('returned status 500');
  });
});

// --- healthCheck ---

describe('healthCheck', () => {
  it('returns active status on 200 response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
    });

    const result = await healthCheck('http://localhost:9001', 'key');
    expect(result.status).toBe('active');
    expect(result.lastChecked).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.error).toBeUndefined();
  });

  it('returns inactive status with error on fetch failure', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Connection refused'));

    const result = await healthCheck('http://localhost:9001', 'key');
    expect(result.status).toBe('inactive');
    expect(result.error).toBe('Connection refused');
    expect(result.lastChecked).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('passes AbortController signal to fetch', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
    });

    await healthCheck('http://localhost:9001', 'key');

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
  });
});

// --- pluginFetch ---

describe('pluginFetch', () => {
  it('sets Authorization Bearer header', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    await pluginFetch('http://localhost:9001', 'my-secret', '/forge/data');

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1].headers.Authorization).toBe('Bearer my-secret');
  });

  it('sets credentials to omit', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    await pluginFetch('http://localhost:9001', 'key', '/forge/data');

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1].credentials).toBe('omit');
  });

  it('concatenates endpoint and path correctly', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    await pluginFetch('http://localhost:9001', 'key', '/forge/vulns');

    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:9001/forge/vulns', expect.any(Object));
  });
});
