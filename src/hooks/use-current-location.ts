import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

export type LocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'error';

export type LocationSnapshot = {
  coords: { latitude: number; longitude: number };
  accuracy: number | null;
  mocked: boolean;
};

export type CurrentLocation = {
  status: LocationStatus;
  coords: { latitude: number; longitude: number } | null;
  accuracy: number | null;
  mocked: boolean;
  error: string | null;
  refresh: () => Promise<LocationSnapshot | null>;
};

export function useCurrentLocation(): CurrentLocation {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [coords, setCoords] = useState<CurrentLocation['coords']>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [mocked, setMocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus('loading');
    setError(null);

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();

      if (!servicesEnabled) {
        setStatus('error');
        setError('Layanan lokasi (GPS) tidak aktif. Aktifkan lokasi perangkat.');
        return null;
      }

      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        setStatus('denied');
        setError(
          'Izin lokasi ditolak. ClockIn memerlukan lokasi untuk memvalidasi radius kantor.',
        );
        return null;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const snapshot: LocationSnapshot = {
        coords: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
        accuracy: position.coords.accuracy ?? null,
        mocked: position.mocked ?? false,
      };

      setCoords(snapshot.coords);
      setAccuracy(snapshot.accuracy);
      setMocked(snapshot.mocked);
      setStatus('ready');
      return snapshot;
    } catch {
      setStatus('error');
      setError('Gagal mengambil lokasi. Pastikan GPS aktif dan coba lagi.');
      return null;
    }
  }, []);

  return { status, coords, accuracy, mocked, error, refresh };
}
