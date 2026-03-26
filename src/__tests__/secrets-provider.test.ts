import { describe, it, expect, beforeEach } from 'vitest';
import { useForgeStore } from '../store/index.ts';
import type { SecretsProvider } from '../types/secrets-provider.ts';

// --- Helpers ---

function mockProvider(overrides?: Partial<SecretsProvider>): SecretsProvider {
  return {
    name: 'test-provider',
    displayName: 'Test Provider',
    isConnected: () => true,
    capabilities: () => ({ read: true, write: false }),
    listProjects: async () => [],
    listSecrets: async () => [],
    getSecret: async () => 'test-value',
    ...overrides,
  };
}

// --- Reset store between tests ---

beforeEach(() => {
  useForgeStore.getState().resetAll();
});

// --- Registry tests ---

describe('registerSecretsProvider', () => {
  it('adds provider to registry', () => {
    const provider = mockProvider();
    useForgeStore.getState().registerSecretsProvider(provider);

    const result = useForgeStore.getState().getSecretsProvider('test-provider');
    expect(result).toBeDefined();
    expect(result!.displayName).toBe('Test Provider');
  });
});

describe('getSecretsProvider', () => {
  it('returns registered provider by name', () => {
    useForgeStore.getState().registerSecretsProvider(mockProvider());

    const result = useForgeStore.getState().getSecretsProvider('test-provider');
    expect(result).toBeDefined();
    expect(result!.name).toBe('test-provider');
  });

  it('returns undefined for unknown name', () => {
    const result = useForgeStore.getState().getSecretsProvider('nonexistent');
    expect(result).toBeUndefined();
  });
});

describe('getSecretsProviders', () => {
  it('returns all registered providers', () => {
    useForgeStore.getState().registerSecretsProvider(mockProvider({ name: 'p1', displayName: 'P1' }));
    useForgeStore.getState().registerSecretsProvider(mockProvider({ name: 'p2', displayName: 'P2' }));

    const providers = useForgeStore.getState().getSecretsProviders();
    expect(providers).toHaveLength(2);

    const names = providers.map((p) => p.name).sort();
    expect(names).toEqual(['p1', 'p2']);
  });

  it('returns empty array when no providers registered', () => {
    const providers = useForgeStore.getState().getSecretsProviders();
    expect(providers).toEqual([]);
  });
});

describe('unregisterSecretsProvider', () => {
  it('removes provider from registry', () => {
    useForgeStore.getState().registerSecretsProvider(mockProvider());
    expect(useForgeStore.getState().getSecretsProvider('test-provider')).toBeDefined();

    useForgeStore.getState().unregisterSecretsProvider('test-provider');
    expect(useForgeStore.getState().getSecretsProvider('test-provider')).toBeUndefined();
  });

  it('does nothing when removing unknown provider', () => {
    useForgeStore.getState().registerSecretsProvider(mockProvider());
    useForgeStore.getState().unregisterSecretsProvider('nonexistent');

    expect(useForgeStore.getState().getSecretsProviders()).toHaveLength(1);
  });
});

describe('multiple providers coexist', () => {
  it('registers and retrieves multiple independent providers', () => {
    const infisical = mockProvider({ name: 'infisical', displayName: 'Infisical' });
    const vault = mockProvider({ name: 'vault', displayName: 'HashiCorp Vault' });

    useForgeStore.getState().registerSecretsProvider(infisical);
    useForgeStore.getState().registerSecretsProvider(vault);

    expect(useForgeStore.getState().getSecretsProvider('infisical')!.displayName).toBe('Infisical');
    expect(useForgeStore.getState().getSecretsProvider('vault')!.displayName).toBe('HashiCorp Vault');
    expect(useForgeStore.getState().getSecretsProviders()).toHaveLength(2);
  });

  it('unregistering one does not affect others', () => {
    useForgeStore.getState().registerSecretsProvider(mockProvider({ name: 'a', displayName: 'A' }));
    useForgeStore.getState().registerSecretsProvider(mockProvider({ name: 'b', displayName: 'B' }));

    useForgeStore.getState().unregisterSecretsProvider('a');

    expect(useForgeStore.getState().getSecretsProvider('a')).toBeUndefined();
    expect(useForgeStore.getState().getSecretsProvider('b')).toBeDefined();
    expect(useForgeStore.getState().getSecretsProviders()).toHaveLength(1);
  });

  it('re-registering replaces existing provider', () => {
    useForgeStore.getState().registerSecretsProvider(mockProvider({ name: 'x', displayName: 'Original' }));
    useForgeStore.getState().registerSecretsProvider(mockProvider({ name: 'x', displayName: 'Updated' }));

    expect(useForgeStore.getState().getSecretsProvider('x')!.displayName).toBe('Updated');
    expect(useForgeStore.getState().getSecretsProviders()).toHaveLength(1);
  });
});
