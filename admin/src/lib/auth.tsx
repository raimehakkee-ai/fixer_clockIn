import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  apiRequest,
  ApiError,
  configureApi,
  type ApiTokens,
} from './api';
import type { AdminUser, LoginResponse } from './types';

const STORAGE_KEY = 'clockin.admin.session';

export type AdminSession = {
  accessToken: string;
  refreshToken: string;
  user: AdminUser;
};

type AuthContextValue = {
  session: AdminSession | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as AdminSession;
    if (!parsed.accessToken || !parsed.refreshToken || parsed.user.role !== 'ADMIN') {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth harus dipakai di dalam AuthProvider');
  }

  return value;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSessionState] = useState<AdminSession | null>(() =>
    readStoredSession(),
  );
  const sessionRef = useRef<AdminSession | null>(session);

  const setSession = useCallback((next: AdminSession | null) => {
    sessionRef.current = next;
    setSessionState(next);

    if (next) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    configureApi({
      getTokens: () => {
        const current = sessionRef.current;
        return current
          ? {
              accessToken: current.accessToken,
              refreshToken: current.refreshToken,
            }
          : null;
      },
      onTokens: (tokens: ApiTokens) => {
        const current = sessionRef.current;
        if (!current) return;
        setSession({ ...current, ...tokens });
      },
      onUnauthorized: () => setSession(null),
    });

    return () => configureApi(null);
  }, [setSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        auth: false,
        body: {
          email: email.trim().toLowerCase(),
          password,
          platform: 'web',
        },
      });

      if (data.user.role !== 'ADMIN') {
        await apiRequest('/auth/logout', {
          method: 'POST',
          auth: false,
          body: { refreshToken: data.refreshToken },
        }).catch(() => undefined);

        throw new ApiError(
          403,
          'FORBIDDEN',
          'Akun ini bukan Admin. Gunakan aplikasi mobile karyawan.',
        );
      }

      setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });
    },
    [setSession],
  );

  const logout = useCallback(async () => {
    const current = sessionRef.current;

    if (current) {
      try {
        await apiRequest('/auth/logout', {
          method: 'POST',
          auth: false,
          body: { refreshToken: current.refreshToken },
        });
      } catch {
        // Sesi lokal tetap dibersihkan.
      }
    }

    setSession(null);
  }, [setSession]);

  return (
    <AuthContext.Provider value={{ session, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
