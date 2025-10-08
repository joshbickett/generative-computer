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

type ApiRequestError = Error & {
  status?: number;
  statusText?: string;
  url?: string;
  responseText?: string;
};

async function attemptRequest(
  url: string,
  init: RequestInit,
): Promise<{ data: unknown; response: Response }> {
  const response = await fetch(url, init);
  const text = await response.text();

  if (!response.ok) {
    const error = new Error(
      `Request to ${url} failed with ${response.status} ${response.statusText}: ${text.slice(0, 120)}`,
    ) as ApiRequestError;
    error.status = response.status;
    error.statusText = response.statusText;
    error.url = url;
    error.responseText = text;
    throw error;
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
      const requestError: ApiRequestError =
        error instanceof Error
          ? (error as ApiRequestError)
          : new Error(String(error));

      lastError = requestError;

      const status = requestError.status;
      const canTryNextBase = allowRetry || (status === 404 && base === '');

      if (!canTryNextBase) {
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
