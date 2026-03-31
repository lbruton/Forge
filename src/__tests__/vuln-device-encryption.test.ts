import { describe, it, expect, beforeEach, vi } from 'vitest';

// Web Crypto API is available in Node 20+ via globalThis.crypto
const hasCrypto = typeof globalThis.crypto?.subtle !== 'undefined';

// Mock localStorage — Node doesn't provide it natively
const mockStorage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    mockStorage.set(key, value);
  },
  removeItem: (key: string) => {
    mockStorage.delete(key);
  },
  clear: () => {
    mockStorage.clear();
  },
  get length() {
    return mockStorage.size;
  },
  key: (index: number) => [...mockStorage.keys()][index] ?? null,
};

vi.stubGlobal('localStorage', localStorageMock);

// Import AFTER localStorage is stubbed
const { encryptVulnDeviceSecrets, decryptVulnDeviceSecrets } = await import('../store/index.ts');
const { isEncrypted } = await import('../lib/credential-store.ts');
import type { VulnDevice } from '../plugins/vuln-cisco/types.ts';

// Clear storage between tests so each gets a fresh encryption key
beforeEach(() => {
  mockStorage.clear();
});

// Helper to create a minimal VulnDevice
function makeDevice(overrides: Partial<VulnDevice> = {}): VulnDevice {
  return {
    id: crypto.randomUUID(),
    viewId: 'test-view',
    hostname: 'test-device',
    ip: '192.168.1.1',
    ...overrides,
  };
}

describe('VulnDevice credential encryption', () => {
  it.skipIf(!hasCrypto)('round-trips snmpCommunity through encrypt then decrypt', async () => {
    const device = makeDevice({ snmpCommunity: 'mySecret' });

    const [encrypted] = await encryptVulnDeviceSecrets([device]);
    expect(isEncrypted(encrypted.snmpCommunity!)).toBe(true);
    expect(encrypted.snmpCommunity).not.toBe('mySecret');

    const [decrypted] = await decryptVulnDeviceSecrets([encrypted]);
    expect(decrypted.snmpCommunity).toBe('mySecret');
  });

  it('passes through devices with snmpSecretKey and no snmpCommunity unchanged', async () => {
    const device = makeDevice({ snmpSecretKey: 'FORGE_SNMP_CORE' });

    const [encrypted] = await encryptVulnDeviceSecrets([device]);
    expect(encrypted.snmpSecretKey).toBe('FORGE_SNMP_CORE');
    expect(encrypted.snmpCommunity).toBeUndefined();

    const [decrypted] = await decryptVulnDeviceSecrets([encrypted]);
    expect(decrypted.snmpSecretKey).toBe('FORGE_SNMP_CORE');
    expect(decrypted.snmpCommunity).toBeUndefined();
  });

  it('passes plaintext snmpCommunity through decrypt as-is (backward compat)', async () => {
    const device = makeDevice({ snmpCommunity: 'public' });

    // Decrypt without prior encryption — should return plaintext unchanged
    const [decrypted] = await decryptVulnDeviceSecrets([device]);
    expect(decrypted.snmpCommunity).toBe('public');
  });

  it('handles undefined and empty snmpCommunity without error', async () => {
    const undefinedDevice = makeDevice({ snmpCommunity: undefined });
    const emptyDevice = makeDevice({ snmpCommunity: '' });

    const encryptedResults = await encryptVulnDeviceSecrets([undefinedDevice, emptyDevice]);
    expect(encryptedResults[0].snmpCommunity).toBeUndefined();
    expect(encryptedResults[1].snmpCommunity).toBe('');

    const decryptedResults = await decryptVulnDeviceSecrets([undefinedDevice, emptyDevice]);
    expect(decryptedResults[0].snmpCommunity).toBeUndefined();
    expect(decryptedResults[1].snmpCommunity).toBe('');
  });

  it.skipIf(!hasCrypto)('handles a mixed array of devices correctly', async () => {
    const devices = [
      makeDevice({ snmpCommunity: 'secret1' }),
      makeDevice({ snmpSecretKey: 'KEY' }),
      makeDevice({ snmpCommunity: undefined }),
    ];

    const encrypted = await encryptVulnDeviceSecrets(devices);
    expect(isEncrypted(encrypted[0].snmpCommunity!)).toBe(true);
    expect(encrypted[1].snmpSecretKey).toBe('KEY');
    expect(encrypted[1].snmpCommunity).toBeUndefined();
    expect(encrypted[2].snmpCommunity).toBeUndefined();

    const decrypted = await decryptVulnDeviceSecrets(encrypted);
    expect(decrypted[0].snmpCommunity).toBe('secret1');
    expect(decrypted[1].snmpSecretKey).toBe('KEY');
    expect(decrypted[1].snmpCommunity).toBeUndefined();
    expect(decrypted[2].snmpCommunity).toBeUndefined();
  });

  it.skipIf(!hasCrypto)('does not double-encrypt when run twice (idempotency)', async () => {
    const device = makeDevice({ snmpCommunity: 'secret' });

    const [firstPass] = await encryptVulnDeviceSecrets([device]);
    const firstCipher = firstPass.snmpCommunity!;
    expect(isEncrypted(firstCipher)).toBe(true);

    const [secondPass] = await encryptVulnDeviceSecrets([firstPass]);
    // Should be the same ciphertext — encryptCredential skips already-encrypted values
    expect(secondPass.snmpCommunity).toBe(firstCipher);

    // Still decrypts correctly
    const [decrypted] = await decryptVulnDeviceSecrets([secondPass]);
    expect(decrypted.snmpCommunity).toBe('secret');
  });
});
