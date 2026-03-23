const QUOTA_LIMIT = 5 * 1024 * 1024; // 5MB
const QUOTA_THRESHOLD = 0.8;

export class StorageService {
  private prefix = 'forge_';

  getItem<T>(key: string, defaultValue: T): T {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw) as T;
    } catch {
      // Corrupt data — return default rather than throwing
      return defaultValue;
    }
  }

  setItem(key: string, value: unknown): boolean {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
      return true;
    } catch {
      // Quota exceeded or other write failure
      return false;
    }
  }

  removeItem(key: string): void {
    localStorage.removeItem(this.prefix + key);
  }

  getAllKeys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        keys.push(key.slice(this.prefix.length));
      }
    }
    return keys;
  }

  getUsage(): number {
    let bytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        const value = localStorage.getItem(key) ?? '';
        // Each char is 2 bytes in UTF-16
        bytes += (key.length + value.length) * 2;
      }
    }
    return bytes;
  }

  isNearQuota(): boolean {
    return this.getUsage() >= QUOTA_LIMIT * QUOTA_THRESHOLD;
  }

  clear(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  }
}

export const storage = new StorageService();
