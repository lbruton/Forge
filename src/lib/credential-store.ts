/**
 * Credential encryption at rest for localStorage.
 *
 * Uses AES-256-GCM to encrypt sensitive plugin fields (apiKey, password-type
 * settings) before they hit localStorage. The encryption key is generated once
 * and stored alongside the ciphertext — this is intentional obfuscation, NOT
 * a security boundary. It prevents:
 *   - Plaintext credential grep of browser profile on disk
 *   - Casual viewing of raw secrets in DevTools localStorage panel
 *   - Accidental inclusion in screenshots or error reports
 *
 * It does NOT protect against an attacker with full browser-profile access
 * (they can extract the key and decrypt). That threat is accepted for a
 * homelab alpha where browser-profile access implies LAN access anyway.
 *
 * @see FORGE-64 — Security hardening baseline
 */

const CREDENTIAL_KEY_STORAGE = 'forge_credential_key';

// ---------------------------------------------------------------------------
// Key management
// ---------------------------------------------------------------------------

let cachedKey: CryptoKey | null = null;

async function getOrCreateKey(): Promise<CryptoKey> {
  // Validate cache: if the key was evicted from localStorage (e.g., resetAll()),
  // the in-memory cache is stale and must be discarded to avoid encrypting with
  // a key that won't survive a page reload. (T1)
  if (cachedKey && !localStorage.getItem(CREDENTIAL_KEY_STORAGE)) {
    cachedKey = null;
  }
  if (cachedKey) return cachedKey;

  // Try to load existing key from localStorage
  const stored = localStorage.getItem(CREDENTIAL_KEY_STORAGE);
  if (stored) {
    try {
      const jwk = JSON.parse(stored) as JsonWebKey;
      cachedKey = await crypto.subtle.importKey('jwk', jwk, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
      return cachedKey;
    } catch {
      // Corrupt key — regenerate
      localStorage.removeItem(CREDENTIAL_KEY_STORAGE);
    }
  }

  // Generate a new 256-bit AES-GCM key
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

  // Export and store as JWK
  const jwk = await crypto.subtle.exportKey('jwk', key);
  localStorage.setItem(CREDENTIAL_KEY_STORAGE, JSON.stringify(jwk));

  cachedKey = key;
  return key;
}

// ---------------------------------------------------------------------------
// Shared codec instances (stateless — safe to reuse)
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ---------------------------------------------------------------------------
// Helpers (matching vault-engine.ts style)
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

// ---------------------------------------------------------------------------
// Encrypted value envelope
// ---------------------------------------------------------------------------

/** Marker prefix so we can distinguish encrypted values from plaintext on rehydration */
const ENCRYPTED_PREFIX = '$ENC:';

interface EncryptedEnvelope {
  iv: string; // base64
  data: string; // base64
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encrypt a plaintext credential value for localStorage storage.
 * Returns a string prefixed with `$ENC:` followed by the JSON envelope.
 */
export async function encryptCredential(plaintext: string): Promise<string> {
  if (!plaintext) return plaintext;
  // Idempotency: don't double-encrypt a value that's already encrypted (T4)
  if (isEncrypted(plaintext)) return plaintext;

  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    encoder.encode(plaintext) as BufferSource,
  );

  const envelope: EncryptedEnvelope = {
    iv: arrayToBase64(iv),
    data: arrayToBase64(new Uint8Array(ciphertext)),
  };

  return ENCRYPTED_PREFIX + JSON.stringify(envelope);
}

/**
 * Decrypt a credential value from localStorage.
 * If the value is not encrypted (no `$ENC:` prefix), returns it as-is
 * for backwards compatibility with pre-encryption data.
 */
export async function decryptCredential(stored: string): Promise<string> {
  if (!stored || !stored.startsWith(ENCRYPTED_PREFIX)) return stored;

  const key = await getOrCreateKey();
  const json = stored.slice(ENCRYPTED_PREFIX.length);

  let envelope: EncryptedEnvelope;
  try {
    envelope = JSON.parse(json) as EncryptedEnvelope;
  } catch {
    // Corrupted — return empty rather than leaking garbled data
    return '';
  }

  const iv = base64ToArray(envelope.iv);
  const ciphertext = base64ToArray(envelope.data);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
    return decoder.decode(decrypted);
  } catch {
    // Key mismatch or corruption — return empty
    return '';
  }
}

/**
 * Check whether a stored value is already encrypted.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Identifies which fields in a plugin's settings are sensitive
 * based on the manifest's settingsSchema.
 */
export function getSensitiveSettingsKeys(schema: Record<string, { type: string }> | undefined): string[] {
  if (!schema) return [];
  return Object.entries(schema)
    .filter(([, field]) => field.type === 'password')
    .map(([key]) => key);
}
