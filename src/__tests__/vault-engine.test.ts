import { describe, expect, test } from 'vitest';
import { encryptVault, decryptVault } from '../lib/vault-engine.ts';
import type { VaultExportData, VaultEnvelope } from '../types/index.ts';

// Web Crypto API is available in Node 20+ via globalThis.crypto
const hasCrypto = typeof globalThis.crypto?.subtle !== 'undefined';

const sampleData: VaultExportData = {
  exportedAt: '2026-03-23T00:00:00.000Z',
  views: [
    {
      id: 'v1',
      name: 'Test View',
      vendors: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  templates: {
    t1: {
      id: 't1',
      sections: [],
      variables: [],
      rawSource: 'hostname {{HOSTNAME}}',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  },
  variableValues: {
    var1: {
      variantId: 'variant1',
      values: { HOSTNAME: 'router01' },
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  },
};

const emptyData: VaultExportData = {
  exportedAt: '2026-03-23T00:00:00.000Z',
  views: [],
  templates: {},
  variableValues: {},
};

function makeFile(content: string, name = 'test.stvault'): File {
  return new File([content], name, { type: 'application/octet-stream' });
}

describe('vault-engine', () => {
  test.skipIf(!hasCrypto)('round-trip: encrypt then decrypt returns original data', async () => {
    const blob = await encryptVault(sampleData, 'my-secret-password');
    const file = new File([blob], 'test.stvault', { type: blob.type });
    const result = await decryptVault(file, 'my-secret-password');

    expect(result).toEqual(sampleData);
  });

  test.skipIf(!hasCrypto)('wrong password throws descriptive error', async () => {
    const blob = await encryptVault(sampleData, 'pass1');
    const file = new File([blob], 'test.stvault', { type: blob.type });

    await expect(decryptVault(file, 'pass2')).rejects.toThrow('Incorrect password or corrupted file');
  });

  test.skipIf(!hasCrypto)('malformed file (invalid JSON) throws format error', async () => {
    const file = makeFile('this is not json at all');

    await expect(decryptVault(file, 'password')).rejects.toThrow('Invalid .stvault file format');
  });

  test.skipIf(!hasCrypto)('malformed file (missing fields) throws format error', async () => {
    const file = makeFile(JSON.stringify({ version: 1, iv: 'abc' }));

    await expect(decryptVault(file, 'password')).rejects.toThrow('Invalid .stvault file format');
  });

  test.skipIf(!hasCrypto)('envelope structure has required fields', async () => {
    const blob = await encryptVault(sampleData, 'password');
    const text = await blob.text();
    const envelope: VaultEnvelope = JSON.parse(text);

    expect(envelope.version).toBe(1);
    expect(typeof envelope.iv).toBe('string');
    expect(typeof envelope.salt).toBe('string');
    expect(envelope.iterations).toBe(100_000);
    expect(typeof envelope.data).toBe('string');

    // iv and salt should be valid base64
    expect(() => atob(envelope.iv)).not.toThrow();
    expect(() => atob(envelope.salt)).not.toThrow();
    expect(() => atob(envelope.data)).not.toThrow();
  });

  test.skipIf(!hasCrypto)('no plaintext leak in encrypted blob', async () => {
    const blob = await encryptVault(sampleData, 'password');
    const text = await blob.text();

    // The encrypted blob should NOT contain any plaintext identifiers
    expect(text).not.toContain('router01');
    expect(text).not.toContain('HOSTNAME');
    expect(text).not.toContain('Test View');
    expect(text).not.toContain('hostname');
  });

  test.skipIf(!hasCrypto)('round-trip with empty data', async () => {
    const blob = await encryptVault(emptyData, 'password');
    const file = new File([blob], 'empty.stvault', { type: blob.type });
    const result = await decryptVault(file, 'password');

    expect(result).toEqual(emptyData);
  });

  test.skipIf(!hasCrypto)('unsupported version throws format error', async () => {
    // Encrypt normally, then tamper with the version
    const blob = await encryptVault(sampleData, 'password');
    const text = await blob.text();
    const envelope = JSON.parse(text);
    envelope.version = 2;
    const file = makeFile(JSON.stringify(envelope));

    await expect(decryptVault(file, 'password')).rejects.toThrow('Invalid .stvault file format');
  });
});
