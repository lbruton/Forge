/**
 * Plugin Service — HTTP communication layer for sidecar plugins.
 *
 * All functions are pure (no side effects, no store access).
 * API keys are never logged or included in error messages.
 */

import type { PluginManifest, PluginHealthStatus } from '../types/index.ts';

/**
 * Runtime validation of a plugin manifest shape.
 * Throws a descriptive Error for missing or invalid fields.
 */
export function validateManifest(data: unknown): PluginManifest {
  if (data === null || typeof data !== 'object') {
    throw new Error('Invalid plugin manifest: expected an object');
  }

  const obj = data as Record<string, unknown>;

  const requiredStringFields = ['name', 'displayName', 'version', 'icon'] as const;
  for (const field of requiredStringFields) {
    if (typeof obj[field] !== 'string') {
      throw new Error(`Invalid plugin manifest: missing required field '${field}'`);
    }
  }

  if (obj.type !== 'bundled' && obj.type !== 'sidecar') {
    throw new Error("Invalid plugin manifest: field 'type' must be 'bundled' or 'sidecar'");
  }

  if (!Array.isArray(obj.vendors)) {
    throw new Error("Invalid plugin manifest: missing required field 'vendors'");
  }
  for (let i = 0; i < obj.vendors.length; i++) {
    if (typeof obj.vendors[i] !== 'string') {
      throw new Error(`Invalid plugin manifest: vendors[${i}] must be a string`);
    }
  }

  if (!Array.isArray(obj.treeNodes)) {
    throw new Error("Invalid plugin manifest: missing required field 'treeNodes'");
  }

  return data as PluginManifest;
}

/**
 * Fetch and validate a plugin manifest from a sidecar endpoint.
 */
export async function fetchManifest(
  endpoint: string,
  apiKey: string,
): Promise<PluginManifest> {
  let response: Response;
  try {
    response = await fetch(`${endpoint}/forge/manifest`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      credentials: 'omit',
    });
  } catch {
    throw new Error(
      `Cannot connect to ${endpoint} — check that the sidecar is running`,
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error('Authentication failed — check your API key');
  }

  if (!response.ok) {
    throw new Error(
      `Plugin at ${endpoint} returned status ${response.status}`,
    );
  }

  const json: unknown = await response.json();
  return validateManifest(json);
}

/**
 * Non-throwing health check against a sidecar endpoint.
 * Returns inactive status with an error message on any failure.
 */
export async function healthCheck(
  endpoint: string,
  apiKey: string,
): Promise<PluginHealthStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${endpoint}/forge/health`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
        credentials: 'omit',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          status: 'inactive',
          lastChecked: new Date().toISOString(),
          error: `Health check returned status ${response.status}`,
        };
      }

      return {
        status: 'active',
        lastChecked: new Date().toISOString(),
      };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  } catch (err: unknown) {
    const isAbort =
      err instanceof DOMException && err.name === 'AbortError';
    return {
      status: 'inactive',
      lastChecked: new Date().toISOString(),
      error: isAbort
        ? 'Connection timed out after 5 seconds'
        : err instanceof Error
          ? err.message
          : 'Unknown error',
    };
  }
}

/**
 * Generic authenticated fetch wrapper for plugin endpoints.
 * Prepends endpoint to path and adds Bearer auth.
 */
export async function pluginFetch(
  endpoint: string,
  apiKey: string,
  path: string,
  options?: RequestInit,
): Promise<Response> {
  return fetch(`${endpoint}${path}`, {
    ...options,
    headers: {
      ...((options?.headers as Record<string, string>) ?? {}),
      Authorization: `Bearer ${apiKey}`,
    },
    credentials: 'omit',
  });
}
