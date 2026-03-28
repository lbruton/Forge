import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InfisicalClient } from '../plugins/infisical/api.ts';

// --- Mock fetch globally ---

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

// --- Helpers ---

function mockAuthResponse(overrides?: { expiresIn?: number }) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () =>
      Promise.resolve({
        accessToken: 'test-jwt',
        expiresIn: overrides?.expiresIn ?? 7200,
        tokenType: 'Bearer',
      }),
  });
}

function mockAuthFailure(status = 401) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Unauthorized',
    text: () => Promise.resolve('invalid credentials'),
  });
}

function mockJsonResponse(body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

function mockErrorResponse(status: number, body = '') {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Error',
    text: () => Promise.resolve(body),
  });
}

function createClient() {
  return new InfisicalClient('https://infisical.example.com', 'cid', 'csecret');
}

// --- Auth tests ---

describe('InfisicalClient.authenticate', () => {
  it('sends correct payload to /api/v1/auth/universal-auth/login', async () => {
    mockAuthResponse();
    const client = createClient();

    await client.authenticate();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://infisical.example.com/api/v1/auth/universal-auth/login');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({
      clientId: 'cid',
      clientSecret: 'csecret',
    });
  });

  it('stores token so subsequent calls use cached token', async () => {
    mockAuthResponse();
    mockJsonResponse({ workspaces: [] });
    const client = createClient();

    await client.authenticate();
    // Second call should NOT trigger another auth — just use cached token
    await client.listProjects();

    // 1 auth + 1 listProjects = 2 fetch calls total
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('re-authenticates when token is expired', async () => {
    // First auth with a very short expiry (will be expired immediately with 30s buffer)
    mockAuthResponse({ expiresIn: 0 });
    const client = createClient();
    await client.authenticate();

    // Now calling listProjects should trigger re-auth because token is expired
    mockAuthResponse();
    mockJsonResponse({ workspaces: [] });
    await client.listProjects();

    // 1 initial auth + 1 re-auth + 1 listProjects = 3 total
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('throws on 401 response', async () => {
    mockAuthFailure(401);
    const client = createClient();

    await expect(client.authenticate()).rejects.toThrow('Infisical auth failed (401)');
  });

  it('strips trailing slash from endpoint', async () => {
    mockAuthResponse();
    const client = new InfisicalClient('https://infisical.example.com/', 'cid', 'csecret');

    await client.authenticate();

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://infisical.example.com/api/v1/auth/universal-auth/login');
  });
});

// --- API tests ---

describe('InfisicalClient.listProjects', () => {
  it('calls ensureAuth then GET /api/v1/workspace, maps to SecretProject[]', async () => {
    mockAuthResponse();
    mockJsonResponse({
      workspaces: [
        {
          id: 'ws-1',
          name: 'My Project',
          environments: [{ name: 'Development', slug: 'dev' }],
        },
      ],
    });
    const client = createClient();

    const projects = await client.listProjects();

    expect(projects).toEqual([
      {
        id: 'ws-1',
        name: 'My Project',
        environments: [{ name: 'Development', slug: 'dev' }],
      },
    ]);

    const [, listUrl] = mockFetch.mock.calls.map((c) => c[0]);
    expect(listUrl).toBe('https://infisical.example.com/api/v1/workspace');
  });
});

describe('InfisicalClient.listSecrets', () => {
  it('calls GET /api/v4/secrets with correct query params', async () => {
    mockAuthResponse();
    mockJsonResponse({
      secrets: [
        {
          id: 's-1',
          secretKey: 'DB_HOST',
          secretComment: 'The DB host',
          updatedAt: '2026-01-01T00:00:00Z',
          tags: [{ name: 'db' }],
        },
      ],
    });
    const client = createClient();

    const secrets = await client.listSecrets('proj-1', 'dev', '/app');

    expect(secrets).toEqual([
      {
        id: 's-1',
        key: 'DB_HOST',
        masked: true,
        comment: 'The DB host',
        updatedAt: '2026-01-01T00:00:00Z',
        tags: ['db'],
      },
    ]);

    const listUrl = mockFetch.mock.calls[1][0] as string;
    expect(listUrl).toContain('/api/v4/secrets?');
    expect(listUrl).toContain('projectId=proj-1');
    expect(listUrl).toContain('environment=dev');
    expect(listUrl).toContain('secretPath=%2Fapp');
  });
});

describe('InfisicalClient.getSecretValue', () => {
  it('returns the secretValue for matching key', async () => {
    mockAuthResponse();
    mockJsonResponse({
      secrets: [
        { id: 's-1', secretKey: 'DB_HOST', secretValue: 'localhost', updatedAt: '', tags: [] },
        { id: 's-2', secretKey: 'DB_PORT', secretValue: '5432', updatedAt: '', tags: [] },
      ],
    });
    const client = createClient();

    const value = await client.getSecretValue('proj-1', 'dev', 'DB_PORT');
    expect(value).toBe('5432');
  });

  it('throws when key not found', async () => {
    mockAuthResponse();
    mockJsonResponse({ secrets: [] });
    const client = createClient();

    await expect(client.getSecretValue('proj-1', 'dev', 'MISSING')).rejects.toThrow('Secret "MISSING" not found');
  });

  it('returns empty string when secretValue is undefined', async () => {
    mockAuthResponse();
    mockJsonResponse({
      secrets: [{ id: 's-1', secretKey: 'EMPTY', updatedAt: '', tags: [] }],
    });
    const client = createClient();

    const value = await client.getSecretValue('proj-1', 'dev', 'EMPTY');
    expect(value).toBe('');
  });
});

describe('InfisicalClient.createSecret', () => {
  it('calls POST /api/v4/secrets/{key}', async () => {
    mockAuthResponse();
    mockJsonResponse({});
    const client = createClient();

    await client.createSecret('proj-1', 'dev', 'NEW_KEY', 'new-value');

    const [url, opts] = mockFetch.mock.calls[1];
    expect(url).toBe('https://infisical.example.com/api/v4/secrets/NEW_KEY');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({
      projectId: 'proj-1',
      environment: 'dev',
      secretPath: '/',
      secretValue: 'new-value',
    });
  });

  it('throws on error response', async () => {
    mockAuthResponse();
    mockErrorResponse(409, 'already exists');
    const client = createClient();

    await expect(client.createSecret('proj-1', 'dev', 'DUP', 'val')).rejects.toThrow('Failed to create secret (409)');
  });
});

describe('InfisicalClient.updateSecret', () => {
  it('calls PATCH /api/v4/secrets/{key}', async () => {
    mockAuthResponse();
    mockJsonResponse({});
    const client = createClient();

    await client.updateSecret('proj-1', 'dev', 'EXISTING', 'updated');

    const [url, opts] = mockFetch.mock.calls[1];
    expect(url).toBe('https://infisical.example.com/api/v4/secrets/EXISTING');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body)).toEqual({
      projectId: 'proj-1',
      environment: 'dev',
      secretPath: '/',
      secretValue: 'updated',
    });
  });

  it('throws on error response', async () => {
    mockAuthResponse();
    mockErrorResponse(404, 'not found');
    const client = createClient();

    await expect(client.updateSecret('proj-1', 'dev', 'MISSING', 'val')).rejects.toThrow(
      'Failed to update secret (404)',
    );
  });
});

// --- testConnection tests ---

describe('InfisicalClient.testConnection', () => {
  it('returns connected:true, canWrite:true on success', async () => {
    mockAuthResponse();
    mockJsonResponse({ workspaces: [{ id: 'ws-1', name: 'P1', environments: [] }] });
    const client = createClient();

    const result = await client.testConnection();

    expect(result).toEqual({ connected: true, canWrite: true });
  });

  it('returns connected:false, canWrite:false on auth failure', async () => {
    mockAuthFailure(401);
    const client = createClient();

    const result = await client.testConnection();

    expect(result.connected).toBe(false);
    expect(result.canWrite).toBe(false);
    expect(result.error).toContain('Infisical auth failed');
  });

  it('returns connected:true, canWrite:false on project list failure', async () => {
    mockAuthResponse();
    mockErrorResponse(403, 'forbidden');
    const client = createClient();

    const result = await client.testConnection();

    expect(result.connected).toBe(true);
    expect(result.canWrite).toBe(false);
    expect(result.error).toContain('Cannot list projects');
  });
});
