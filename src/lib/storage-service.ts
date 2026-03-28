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
