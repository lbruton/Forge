import type { SecretsProvider, SecretProject, SecretEntry } from '../../types/secrets-provider.ts';
import { InfisicalClient } from './api.ts';

export class InfisicalProvider implements SecretsProvider {
  name = 'forge-infisical';
  displayName = 'Infisical Secrets';
  private client: InfisicalClient;
  private connected = false;
  private canWrite = false;

  constructor(endpoint: string, clientId: string, clientSecret: string) {
    this.client = new InfisicalClient(endpoint, clientId, clientSecret);
  }

  async connect(): Promise<{ connected: boolean; canWrite: boolean; error?: string }> {
    const result = await this.client.testConnection();
    this.connected = result.connected;
    this.canWrite = result.canWrite;
    return result;
  }

  isConnected(): boolean {
    return this.connected;
  }

  capabilities(): { read: boolean; write: boolean } {
    return { read: this.connected, write: this.canWrite };
  }

  listProjects(): Promise<SecretProject[]> {
    return this.client.listProjects();
  }

  listSecrets(projectId: string, environment: string, path?: string): Promise<SecretEntry[]> {
    return this.client.listSecrets(projectId, environment, path);
  }

  getSecret(projectId: string, environment: string, key: string): Promise<string> {
    return this.client.getSecretValue(projectId, environment, key);
  }

  async setSecret(projectId: string, environment: string, key: string, value: string): Promise<void> {
    if (!this.canWrite) throw new Error('Infisical connection is read-only');
    try {
      await this.client.updateSecret(projectId, environment, key, value);
    } catch {
      await this.client.createSecret(projectId, environment, key, value);
    }
  }
}
