import { describe, expect, test, beforeEach, vi } from 'vitest';

// Web Crypto API is available in Node 20+ via globalThis.crypto
const hasCrypto = typeof globalThis.crypto.subtle !== 'undefined';

// Mock localStorage for the credential-store module (Node doesn't provide .clear())
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
const { encryptCredential, decryptCredential, isEncrypted, getSensitiveSettingsKeys } =
  await import('../lib/credential-store.ts');

// Clear storage + module cache between tests
beforeEach(() => {
  mockStorage.clear();
});

// --- encryptCredential / decryptCredential ---

describe('credential encryption', () => {
  test.skipIf(!hasCrypto)('round-trip: encrypt then decrypt returns original value', async () => {
    const secret = 'super-secret-api-key-12345';

    const encrypted = await encryptCredential(secret);
    const decrypted = await decryptCredential(encrypted);

    expect(decrypted).toBe(secret);
  });

  test.skipIf(!hasCrypto)('encrypted output starts with $ENC: prefix', async () => {
    const encrypted = await encryptCredential('my-key');

    expect(encrypted.startsWith('$ENC:')).toBe(true);
  });

  test.skipIf(!hasCrypto)('encrypted output does not contain plaintext', async () => {
    const secret = 'plaintext-credential-value';
    const encrypted = await encryptCredential(secret);

    // The encrypted string should not contain the raw secret
    expect(encrypted).not.toContain(secret);
  });

  test.skipIf(!hasCrypto)('each encryption produces different ciphertext (unique IV)', async () => {
    const secret = 'same-value-twice';

    const enc1 = await encryptCredential(secret);
    const enc2 = await encryptCredential(secret);

    // Both should decrypt to the same value
    expect(await decryptCredential(enc1)).toBe(secret);
    expect(await decryptCredential(enc2)).toBe(secret);

    // But the ciphertext should differ (different IV each time)
    expect(enc1).not.toBe(enc2);
  });

  test.skipIf(!hasCrypto)('empty string passes through without encryption', async () => {
    const result = await encryptCredential('');
    expect(result).toBe('');
  });

  test.skipIf(!hasCrypto)('decrypting plaintext (no prefix) returns it as-is', async () => {
    const plaintext = 'not-encrypted-value';
    const result = await decryptCredential(plaintext);

    expect(result).toBe(plaintext);
  });

  test.skipIf(!hasCrypto)('decrypting empty string returns empty', async () => {
    const result = await decryptCredential('');
    expect(result).toBe('');
  });

  test.skipIf(!hasCrypto)('corrupted envelope returns empty string', async () => {
    const result = await decryptCredential('$ENC:not-valid-json');
    expect(result).toBe('');
  });

  test.skipIf(!hasCrypto)('handles unicode secrets', async () => {
    const secret = 'p@$$w0rd-with-émojis-🔑';

    const encrypted = await encryptCredential(secret);
    const decrypted = await decryptCredential(encrypted);

    expect(decrypted).toBe(secret);
  });

  test.skipIf(!hasCrypto)('handles long secrets', async () => {
    const secret = 'x'.repeat(10000);

    const encrypted = await encryptCredential(secret);
    const decrypted = await decryptCredential(encrypted);

    expect(decrypted).toBe(secret);
  });
});

// --- isEncrypted ---

describe('isEncrypted', () => {
  test('returns true for $ENC: prefixed strings', () => {
    expect(isEncrypted('$ENC:{"iv":"...","data":"..."}')).toBe(true);
  });

  test('returns false for plaintext strings', () => {
    expect(isEncrypted('plain-api-key')).toBe(false);
  });

  test('returns false for empty string', () => {
    expect(isEncrypted('')).toBe(false);
  });
});

// --- getSensitiveSettingsKeys ---

describe('getSensitiveSettingsKeys', () => {
  test('returns keys for password-type fields', () => {
    const schema = {
      endpoint: { type: 'string', label: 'URL' },
      clientId: { type: 'string', label: 'Client ID' },
      clientSecret: { type: 'password', label: 'Client Secret' },
      apiToken: { type: 'password', label: 'API Token' },
    };

    const keys = getSensitiveSettingsKeys(schema);
    expect(keys.sort()).toEqual(['apiToken', 'clientSecret']);
  });

  test('returns empty array when no password fields exist', () => {
    const schema = {
      name: { type: 'string', label: 'Name' },
      count: { type: 'number', label: 'Count' },
    };

    expect(getSensitiveSettingsKeys(schema)).toEqual([]);
  });

  test('returns empty array for undefined schema', () => {
    expect(getSensitiveSettingsKeys(undefined)).toEqual([]);
  });
});
