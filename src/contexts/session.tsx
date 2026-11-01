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
  apiGet,
  apiRequest,
  configureApi,
  ApiError,
  type ApiTokens,
} from '@/lib/api';
import {
  deleteStoredItem,
  getStoredItem,
  setStoredItem,
} from '@/lib/auth-storage';
import { getDeviceIdentifier, getDeviceName, getPlatform } from '@/lib/device';
import type {
  AuthUser,
  DeviceInfo,
  LoginResponse,
  MeResponse,
} from '@/lib/types';

const SESSION_KEY = 'clockin.session';

type StoredSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  device: DeviceInfo | null;
  serverTimeOffset: number;
};

type SessionContextValue = {
  session: StoredSession | null;
  isLoading: boolean;
  serverTimeOffset: number;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);

  if (!value) {
    throw new Error('useSession harus dipakai di dalam SessionProvider');
  }

  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionRef = useRef<StoredSession | null>(null);

  const applySession = useCallback((next: StoredSession | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const persist = useCallback(async (next: StoredSession) => {
    await setStoredItem(SESSION_KEY, JSON.stringify(next));
  }, []);

  const clear = useCallback(async () => {
    applySession(null);
    await deleteStoredItem(SESSION_KEY);
  }, [applySession]);

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
      onTokens: async (tokens: ApiTokens) => {
        const current = sessionRef.current;
        if (!current) return;

        const next = { ...current, ...tokens };
        applySession(next);
        await persist(next);
      },
      onUnauthorized: clear,
    });

    return () => configureApi(null);
  }, [applySession, clear, persist]);

  useEffect(() => {
    let cancelled = false;
    let stored: StoredSession | null = null;

    (async () => {
      try {
        await getDeviceIdentifier();
        const raw = await getStoredItem(SESSION_KEY);

        if (cancelled) return;
        if (!raw) return;

        stored = JSON.parse(raw) as StoredSession;
        applySession(stored);

        const me = await apiGet<MeResponse>('/auth/me');
        if (cancelled) return;

        const next: StoredSession = {
          ...stored,
          user: me.user,
          device: me.device,
          serverTimeOffset:
            new Date(me.serverTime).getTime() - Date.now(),
        };

        applySession(next);
        await persist(next);
      } catch (error) {
        if (cancelled) return;

        const authFailure =
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403);

        if (authFailure || !stored) {
          await clear();
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applySession, clear, persist]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const deviceIdentifier = await getDeviceIdentifier();

      const data = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        auth: false,
        body: {
          email: email.trim().toLowerCase(),
          password,
          deviceIdentifier,
          deviceName: getDeviceName(),
          platform: getPlatform(),
        },
      });

      const next: StoredSession = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
        device: data.device,
        serverTimeOffset: new Date(data.serverTime).getTime() - Date.now(),
      };

      applySession(next);
      await persist(next);
    },
    [applySession, persist],
  );

  const signOut = useCallback(async () => {
    const current = sessionRef.current;

    if (current) {
      try {
        await apiRequest('/auth/logout', {
          method: 'POST',
          auth: false,
          body: { refreshToken: current.refreshToken },
        });
      } catch {
        // Logout lokal tetap dilakukan meski server tidak dapat dihubungi.
      }
    }

    await clear();
  }, [clear]);

  const refreshUser = useCallback(async () => {
    const me = await apiGet<MeResponse>('/auth/me');
    const current = sessionRef.current;

    if (!current) return;

    const next: StoredSession = {
      ...current,
      user: me.user,
      device: me.device,
      serverTimeOffset: new Date(me.serverTime).getTime() - Date.now(),
    };

    applySession(next);
    await persist(next);
  }, [applySession, persist]);

  return (
    <SessionContext.Provider
      value={{
        session,
        isLoading,
        serverTimeOffset: session?.serverTimeOffset ?? 0,
        signIn,
        signOut,
        refreshUser,
      }}>
      {children}
    </SessionContext.Provider>
  );
}
