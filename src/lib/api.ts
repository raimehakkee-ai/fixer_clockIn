import { getDeviceIdentifier } from './device';

const RAW_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

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

type ApiConfiguration = {
  getTokens: () => ApiTokens | null;
  onTokens: (tokens: ApiTokens) => Promise<void>;
  onUnauthorized: () => Promise<void>;
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  form?: FormData;
  auth?: boolean;
};

type ErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

let configuration: ApiConfiguration | null = null;
let refreshInFlight: Promise<ApiTokens | null> | null = null;

export function configureApi(next: ApiConfiguration | null): void {
  configuration = next;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function send<T>(
  path: string,
  options: RequestOptions,
  accessToken: string | null,
): Promise<T> {
  const headers: Record<string, string> = {};

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let body: BodyInit | undefined;

  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? (body ? 'POST' : 'GET'),
    headers,
    body,
  });

  const payload = await parseBody(response);

  if (!response.ok) {
    const errorPayload = (payload ?? {}) as ErrorPayload;
    throw new ApiError(
      response.status,
      errorPayload.error?.code ?? 'UNKNOWN',
      errorPayload.error?.message ?? 'Terjadi kesalahan pada server.',
      errorPayload.error?.details,
    );
  }

  return payload as T;
}

async function refreshTokens(): Promise<ApiTokens | null> {
  if (!configuration) {
    return null;
  }

  const current = configuration.getTokens();
  if (!current?.refreshToken) {
    return null;
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const deviceIdentifier = await getDeviceIdentifier();
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            refreshToken: current.refreshToken,
            deviceIdentifier,
          }),
        });

        if (!response.ok) {
          return null;
        }

        const data = (await response.json()) as ApiTokens;
        const next = {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        };

        await configuration?.onTokens(next);
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

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const requiresAuth = options.auth ?? true;
  const token = requiresAuth
    ? configuration?.getTokens()?.accessToken ?? null
    : null;

  try {
    return await send<T>(path, options, token);
  } catch (error) {
    if (requiresAuth && error instanceof ApiError && error.status === 401) {
      const refreshed = await refreshTokens();

      if (refreshed) {
        return send<T>(path, options, refreshed.accessToken);
      }

      await configuration?.onUnauthorized();
    }

    throw error;
  }
}

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, { method: 'POST', body });
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Terjadi kesalahan. Silakan coba lagi.';
}
