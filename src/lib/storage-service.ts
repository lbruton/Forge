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
}

export const storage = new StorageService();
