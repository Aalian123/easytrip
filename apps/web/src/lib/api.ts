export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3100';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields?: { field: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Refreshes the access token using the httpOnly cookie. Concurrent callers
 * share one in-flight refresh so a burst of 401s does not rotate the token
 * several times over.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) return null;
        const data = await response.json();
        accessToken = data.accessToken;
        return accessToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  retry?: boolean;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, retry = true, headers, ...rest } = options;

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && retry) {
    const token = await refreshAccessToken();
    if (token) return api<T>(path, { ...options, retry: false });
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(
      payload.message ?? 'Something went wrong. Try again.',
      response.status,
      payload.fields,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

/** Builds a query string, dropping empty values so URLs stay readable. */
export function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function downloadUrl(path: string): string {
  return `${API_URL}${path}`;
}

/** Reports are streamed as files, so the token travels in the header, not the URL. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!response.ok) throw new ApiError('That export could not be produced.', response.status);

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
