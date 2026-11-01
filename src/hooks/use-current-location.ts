import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

export type LocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'error';

export type CurrentLocation = {
  status: LocationStatus;
  coords: { latitude: number; longitude: number } | null;
  accuracy: number | null;
  mocked: boolean;
  error: string | null;
  refresh: () => Promise<void>;
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
        return;
      }

      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        setStatus('denied');
        setError(
          'Izin lokasi ditolak. ClockIn memerlukan lokasi untuk memvalidasi radius kantor.',
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setCoords({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setAccuracy(position.coords.accuracy ?? null);
      setMocked(position.mocked ?? false);
      setStatus('ready');
    } catch {
      setStatus('error');
      setError('Gagal mengambil lokasi. Pastikan GPS aktif dan coba lagi.');
    }
  }, []);

  return { status, coords, accuracy, mocked, error, refresh };
}
