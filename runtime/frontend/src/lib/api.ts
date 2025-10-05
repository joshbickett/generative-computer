/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const rawEnvBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
const primaryBase = rawEnvBase ? rawEnvBase.replace(/\/$/, '') : '';
const fallbackBase = primaryBase ? null : 'http://localhost:3001';

function ensureLeadingSlash(path: string): string {
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  return path;
}

function buildUrl(base: string, path: string): string {
  const normalizedPath = ensureLeadingSlash(path);
  if (!base) {
    return normalizedPath;
  }
  return `${base}${normalizedPath}`;
}

async function attemptRequest(
  url: string,
  init: RequestInit,
): Promise<{ data: unknown; response: Response }> {
  const response = await fetch(url, init);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Request to ${url} failed with ${response.status} ${response.statusText}: ${text.slice(0, 120)}`,
    );
  }

  try {
    const parsed = text ? JSON.parse(text) : null;
    return { data: parsed, response };
  } catch {
    throw new Error(`Request to ${url} did not return valid JSON.`);
  }
}

function shouldRetry(init?: RequestInit | null): boolean {
  const method = init?.method?.toUpperCase() ?? 'GET';
  return method === 'GET';
}

function uniqueBases(): string[] {
  const bases: string[] = [];

  if (primaryBase) {
    bases.push(primaryBase);
  }

  bases.push('');

  if (fallbackBase) {
    bases.push(fallbackBase);
  }

  return bases.filter((base, index, array) => array.indexOf(base) === index);
}

export async function requestJson<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const bases = uniqueBases();
  const allowRetry = shouldRetry(init);
  let lastError: Error | null = null;

  for (const base of bases) {
    const url = buildUrl(base, path);

    try {
      const { data } = await attemptRequest(url, init);
      return data as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!allowRetry) {
        break;
      }
    }
  }

  throw (
    lastError ??
    new Error(
      `Unable to reach API for path "${path}". Tried bases: ${uniqueBases().join(', ')}`,
    )
  );
}

export function getApiBases(): string[] {
  return uniqueBases();
}
