const RAW_BASE = import.meta.env.VITE_API_URL ?? '';

export const API_BASE_URL = `${RAW_BASE.replace(/\/+$/, '')}/api/v1`;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type ApiTokens = {
  accessToken: string;
  refreshToken: string;
};

type Configuration = {
  getTokens: () => ApiTokens | null;
  onTokens: (tokens: ApiTokens) => void;
  onUnauthorized: () => void;
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
};

type ErrorPayload = {
  error?: { code?: string; message?: string; details?: unknown };
};

let configuration: Configuration | null = null;
let refreshInFlight: Promise<ApiTokens | null> | null = null;

export function configureApi(next: Configuration | null): void {
  configuration = next;
}

async function throwFromResponse(response: Response): Promise<never> {
  let payload: ErrorPayload | null = null;

  try {
    payload = (await response.json()) as ErrorPayload;
  } catch {
    payload = null;
  }

  throw new ApiError(
    response.status,
    payload?.error?.code ?? 'UNKNOWN',
    payload?.error?.message ?? 'Terjadi kesalahan pada server.',
    payload?.error?.details,
  );
}

async function refreshTokens(): Promise<ApiTokens | null> {
  if (!configuration) return null;

  const current = configuration.getTokens();
  if (!current?.refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });

        if (!response.ok) return null;

        const data = (await response.json()) as ApiTokens;
        const next = {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        };

        configuration?.onTokens(next);
        return next;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}

async function authorizedFetch(
  path: string,
  init: RequestInit,
  useAuth: boolean,
): Promise<Response> {
  const buildInit = (token: string | null): RequestInit => ({
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const initialToken = useAuth
    ? configuration?.getTokens()?.accessToken ?? null
    : null;

  let response = await fetch(`${API_BASE_URL}${path}`, buildInit(initialToken));

  if (useAuth && response.status === 401) {
    const refreshed = await refreshTokens();

    if (refreshed) {
      response = await fetch(
        `${API_BASE_URL}${path}`,
        buildInit(refreshed.accessToken),
      );
    } else {
      configuration?.onUnauthorized();
    }
  }

  return response;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await authorizedFetch(
    path,
    {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      ...(options.body !== undefined
        ? {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(options.body),
          }
        : {}),
    },
    options.auth ?? true,
  );

  if (!response.ok) {
    await throwFromResponse(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' });
}

export async function fetchBlob(path: string): Promise<Blob> {
  const response = await authorizedFetch(path, { method: 'GET' }, true);

  if (!response.ok) {
    await throwFromResponse(response);
  }

  return response.blob();
}

export async function openProtectedFile(path: string): Promise<void> {
  const blob = await fetchBlob(path);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadFile(
  path: string,
  filename: string,
): Promise<void> {
  const blob = await fetchBlob(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Terjadi kesalahan. Silakan coba lagi.';
}
