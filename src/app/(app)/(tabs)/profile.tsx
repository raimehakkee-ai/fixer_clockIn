import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/contexts/session';
import { useTheme } from '@/hooks/use-theme';
import { apiGet, errorMessage } from '@/lib/api';
import { shiftLabel } from '@/lib/format';
import type { MyDevice, Office, Shift } from '@/lib/types';

export default function ProfileScreen() {
  const theme = useTheme();
  const { session, signOut, refreshUser } = useSession();

  const [devices, setDevices] = useState<MyDevice[]>([]);
  const [office, setOffice] = useState<Office | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    setError(null);

    try {
      const [deviceResponse, officeResponse, shiftResponse] = await Promise.all([
        apiGet<{ devices: MyDevice[] }>('/devices/me'),
        apiGet<{ data: Office[] }>('/office-locations'),
        apiGet<{ data: Shift[] }>('/shifts'),
      ]);

      setDevices(deviceResponse.devices);
      setOffice(
        officeResponse.data.find((item) => item.isActive) ??
          officeResponse.data[0] ??
          null,
      );
      setShifts(shiftResponse.data);
      await refreshUser();
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }, [refreshUser]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const employee = session?.user.employee;

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <Screen>
      <Card>
        <ThemedText type="smallBold">
          {employee?.fullName ?? session?.user.email ?? 'Pengguna'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {session?.user.email}
        </ThemedText>

        <View style={styles.infoGrid}>
          <Info label="Nomor karyawan" value={employee?.number ?? '—'} />
          <Info label="Departemen" value={employee?.department ?? '—'} />
          <Info label="Jabatan" value={employee?.position ?? '—'} />
        </View>
      </Card>

      <Card>
        <ThemedText type="smallBold">Kantor</ThemedText>
        {office ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              {office.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Radius {office.radiusMeters} m · {office.timezone}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {office.latitude.toFixed(5)}, {office.longitude.toFixed(5)}
            </ThemedText>
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Belum ada lokasi kantor aktif.
          </ThemedText>
        )}
      </Card>

      <Card>
        <ThemedText type="smallBold">Perangkat terverifikasi</ThemedText>
        {devices.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Belum ada perangkat terdaftar.
          </ThemedText>
        ) : (
          devices.map((device) => (
            <View key={device.id} style={styles.deviceRow}>
              <View style={styles.deviceInfo}>
                <ThemedText type="small">
                  {device.deviceName ?? device.platform}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {device.platform}
                </ThemedText>
              </View>
              <Badge
                label={device.status === 'ACTIVE' ? 'Aktif' : 'Dicabut'}
                tone={device.status === 'ACTIVE' ? 'success' : 'neutral'}
              />
            </View>
          ))
        )}
      </Card>

      <Card>
        <ThemedText type="smallBold">Shift tersedia</ThemedText>
        {shifts.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Belum ada shift aktif.
          </ThemedText>
        ) : (
          shifts.map((shift) => (
            <View key={shift.id} style={styles.deviceRow}>
              <ThemedText type="small">{shift.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {shiftLabel(shift)}
              </ThemedText>
            </View>
          ))
        )}
      </Card>

      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}

      <Button
        title="Keluar"
        variant="danger"
        onPress={() => void handleSignOut()}
        loading={signingOut}
      />
    </Screen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.one,
    gap: Spacing.three,
  },
  infoItem: {
    minWidth: 120,
    gap: 2,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  deviceInfo: {
    flex: 1,
    gap: 2,
  },
});
