// Infisical API client with token lifecycle management
// Pure service module — no React imports

import type { SecretProject, SecretEntry } from '../../types/secrets-provider.ts';

interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

interface InfisicalWorkspace {
  id: string;
  name: string;
  environments: { name: string; slug: string }[];
}

interface InfisicalSecret {
  id: string;
  secretKey: string;
  secretValue?: string;
  secretComment?: string;
  updatedAt: string;
  tags: { name: string }[];
}

export class InfisicalClient {
  private endpoint: string;
  private clientId: string;
  private clientSecret: string;
  private token: string | null = null;
  private tokenExpiry: number = 0;

  constructor(endpoint: string, clientId: string, clientSecret: string) {
    // Strip trailing slash for consistent URL building
    this.endpoint = endpoint.replace(/\/+$/, '');
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * Authenticate via universal auth login.
   * Caches the token with a 30-second safety buffer before expiry.
   */
  async authenticate(): Promise<void> {
    const url = `${this.endpoint}/api/v1/auth/universal-auth/login`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Infisical auth failed (${res.status}): ${body || res.statusText}`);
    }

    const data: AuthResponse = await res.json();
    this.token = data.accessToken;
    // Expire 30 seconds early to avoid edge-case rejections
    this.tokenExpiry = Date.now() + data.expiresIn * 1000 - 30_000;
  }

  /**
   * Ensure we have a valid, non-expired token before making API calls.
   */
  private async ensureAuth(): Promise<string> {
    if (!this.token || Date.now() >= this.tokenExpiry) {
      await this.authenticate();
    }
    // After authenticate(), token is guaranteed non-null
    return this.token!;
  }

  /**
   * List projects (workspaces) the authenticated identity has access to.
   */
  async listProjects(): Promise<SecretProject[]> {
    const token = await this.ensureAuth();
    const url = `${this.endpoint}/api/v1/workspace`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Failed to list projects (${res.status}): ${body || res.statusText}`);
    }

    const data = await res.json();
    const workspaces: InfisicalWorkspace[] = data.workspaces ?? data ?? [];

    return workspaces.map((ws) => ({
      id: ws.id,
      name: ws.name,
      environments: (ws.environments ?? []).map((env) => ({
        name: env.name,
        slug: env.slug,
      })),
    }));
  }

  /**
   * List secrets in a project environment (values are not included).
   */
  async listSecrets(projectId: string, environment: string, path: string = '/'): Promise<SecretEntry[]> {
    const token = await this.ensureAuth();
    const params = new URLSearchParams({
      projectId,
      environment,
      secretPath: path,
    });
    const url = `${this.endpoint}/api/v4/secrets?${params.toString()}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Failed to list secrets (${res.status}): ${body || res.statusText}`);
    }

    const data = await res.json();
    const secrets: InfisicalSecret[] = data.secrets ?? data ?? [];

    return secrets.map((s) => ({
      id: s.id,
      key: s.secretKey,
      masked: true,
      comment: s.secretComment || undefined,
      updatedAt: s.updatedAt,
      tags: (s.tags ?? []).map((t) => t.name),
    }));
  }

  /**
   * Fetch a single secret's plaintext value.
   * Lists secrets at the root path and filters client-side by key.
   */
  async getSecretValue(projectId: string, environment: string, key: string): Promise<string> {
    const token = await this.ensureAuth();
    const params = new URLSearchParams({
      projectId,
      environment,
      secretPath: '/',
    });
    const url = `${this.endpoint}/api/v4/secrets?${params.toString()}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Failed to get secret (${res.status}): ${body || res.statusText}`);
    }

    const data = await res.json();
    const secrets: InfisicalSecret[] = data.secrets ?? data ?? [];
    const match = secrets.find((s) => s.secretKey === key);

    if (!match) {
      throw new Error(`Secret "${key}" not found`);
    }

    return match.secretValue ?? '';
  }

  /**
   * Create a new secret.
   */
  async createSecret(projectId: string, environment: string, key: string, value: string): Promise<void> {
    const token = await this.ensureAuth();
    const url = `${this.endpoint}/api/v4/secrets/${encodeURIComponent(key)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        projectId,
        environment,
        secretPath: '/',
        secretValue: value,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Failed to create secret (${res.status}): ${body || res.statusText}`);
    }
  }

  /**
   * Update an existing secret's value.
   */
  async updateSecret(projectId: string, environment: string, key: string, value: string): Promise<void> {
    const token = await this.ensureAuth();
    const url = `${this.endpoint}/api/v4/secrets/${encodeURIComponent(key)}`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        projectId,
        environment,
        secretPath: '/',
        secretValue: value,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Failed to update secret (${res.status}): ${body || res.statusText}`);
    }
  }

  /**
   * Test the connection: authenticate, list projects, assume write capability.
   * Does NOT write a test secret — consumer code handles 403 gracefully.
   */
  async testConnection(): Promise<{
    connected: boolean;
    canWrite: boolean;
    error?: string;
  }> {
    try {
      await this.authenticate();
    } catch (err) {
      return {
        connected: false,
        canWrite: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    try {
      await this.listProjects();
    } catch (err) {
      return {
        connected: true,
        canWrite: false,
        error: `Cannot list projects: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    return { connected: true, canWrite: true };
  }
}
