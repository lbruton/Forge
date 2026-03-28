import type { VaultEnvelope, VaultExportData } from '../types/index.ts';

/**
 * Vault encryption engine using Web Crypto API (AES-256-GCM + PBKDF2).
 * No third-party crypto libraries — browser-native only.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function arrayToBase64(array: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < array.length; i++) {
    binary += String.fromCharCode(array[i]);
  }
  return btoa(binary);
}

function base64ToArray(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function encryptVault(data: VaultExportData, password: string): Promise<Blob> {
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(data));

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(password, salt, 100_000);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext as BufferSource,
  );

  const envelope: VaultEnvelope = {
    version: 1,
    iv: arrayToBase64(iv),
    salt: arrayToBase64(salt),
    iterations: 100_000,
    data: arrayToBase64(new Uint8Array(ciphertext)),
  };

  return new Blob([JSON.stringify(envelope)], {
    type: 'application/octet-stream',
  });
}

export async function decryptVault(file: File, password: string): Promise<VaultExportData> {
  // 1. Read file contents
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new Error('Invalid .stvault file format');
  }

  // 2. Parse envelope JSON
  let envelope: VaultEnvelope;
  try {
    envelope = JSON.parse(text) as VaultEnvelope;
  } catch {
    throw new Error('Invalid .stvault file format');
  }

  // 3. Validate envelope structure
  if (
    typeof envelope.version !== 'number' ||
    typeof envelope.iv !== 'string' ||
    typeof envelope.salt !== 'string' ||
    typeof envelope.iterations !== 'number' ||
    typeof envelope.data !== 'string'
  ) {
    throw new Error('Invalid .stvault file format');
  }

  if (envelope.version !== 1) {
    throw new Error('Invalid .stvault file format');
  }

  // 4. Decode base64 fields
  const iv = base64ToArray(envelope.iv);
  const salt = base64ToArray(envelope.salt);
  const ciphertext = base64ToArray(envelope.data);

  // 5. Derive key
  const key = await deriveKey(password, salt, envelope.iterations);

  // 6. Decrypt
  let decrypted: ArrayBuffer;
  try {
    decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
  } catch {
    throw new Error('Incorrect password or corrupted file');
  }

  // 7. Decode and parse
  const decoder = new TextDecoder();
  let parsed: VaultExportData;
  try {
    parsed = JSON.parse(decoder.decode(decrypted)) as VaultExportData;
  } catch {
    throw new Error('Decrypted data is corrupted');
  }

  return parsed;
}
