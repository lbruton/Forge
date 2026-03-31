// Secrets provider interface for integration plugins (e.g., Infisical)

/** SecretsProvider — abstraction over external secrets managers */
export interface SecretsProvider {
  name: string;
  displayName: string;
  isConnected(): boolean;
  capabilities(): { read: boolean; write: boolean };
  listProjects(): Promise<SecretProject[]>;
  listSecrets(_projectId: string, _environment: string, _path?: string): Promise<SecretEntry[]>;
  getSecret(_projectId: string, _environment: string, _key: string): Promise<string>;
  setSecret?(_projectId: string, _environment: string, _key: string, _value: string): Promise<void>;
}

/** SecretProject — a project in the secrets manager */
export interface SecretProject {
  id: string;
  name: string;
  environments: { name: string; slug: string }[];
}

/** SecretEntry — a single secret entry (value not included, must be fetched) */
export interface SecretEntry {
  id: string;
  key: string;
  masked: boolean;
  comment?: string;
  updatedAt: string;
  tags: string[];
}
