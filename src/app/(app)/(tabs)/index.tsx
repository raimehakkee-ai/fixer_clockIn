import {
  CameraView,
  useCameraPermissions,
  type CameraCapturedPicture,
} from 'expo-camera';
import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/contexts/session';
import { useCurrentLocation } from '@/hooks/use-current-location';
import { useServerClock } from '@/hooks/use-server-clock';
import { useTheme } from '@/hooks/use-theme';
import { apiGet, apiRequest, errorMessage } from '@/lib/api';
import { formatDateTime, formatTime } from '@/lib/format';
import { haversineMeters } from '@/lib/geo';
import {
  attendanceStatusLabel,
  attendanceStatusTone,
} from '@/lib/labels';
import {
  addDaysToDateString,
  isShiftActiveNow,
  isWithinShiftWindow,
  officeDateString,
} from '@/lib/shift';
import type {
  AttendanceRecord,
  Office,
  Paginated,
  Shift,
} from '@/lib/types';
import { appendFile } from '@/lib/upload';

export default function AttendanceScreen() {
  const theme = useTheme();
  const { session, serverTimeOffset } = useSession();
  const now = useServerClock(serverTimeOffset);
  const isFocused = useIsFocused();
  const location = useCurrentLocation();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [office, setOffice] = useState<Office | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [captured, setCaptured] = useState<CameraCapturedPicture | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setLoadError(null);

      try {
        const [officeResponse, shiftResponse] = await Promise.all([
          apiGet<{ data: Office[] }>('/office-locations'),
          apiGet<{ data: Shift[] }>('/shifts'),
        ]);

        const activeOffice =
          officeResponse.data.find((item) => item.isActive) ??
          officeResponse.data[0] ??
          null;

        setOffice(activeOffice);
        setShifts(shiftResponse.data);

        if (activeOffice) {
          const serverNow = new Date(Date.now() + serverTimeOffset);
          const today = officeDateString(serverNow, activeOffice.timezone);
          const from = addDaysToDateString(today, -1);

          const history = await apiGet<Paginated<AttendanceRecord>>(
            `/attendance/me?from=${from}&to=${today}&limit=50`,
          );
          setRecords(history.data);

          setSelectedShiftId((current) => {
            if (current && shiftResponse.data.some((shift) => shift.id === current)) {
              return current;
            }

            const activeShift = shiftResponse.data.find((shift) =>
              isShiftActiveNow(serverNow, shift, activeOffice.timezone),
            );

            return activeShift?.id ?? shiftResponse.data[0]?.id ?? null;
          });
        }
      } catch (error) {
        setLoadError(errorMessage(error));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [serverTimeOffset],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadData]);

  const { refresh: refreshLocation } = location;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isFocused) {
        void refreshLocation();
      } else {
        setCaptured(null);
        setCameraReady(false);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [isFocused, refreshLocation]);

  const selectedShift = useMemo(
    () => shifts.find((shift) => shift.id === selectedShiftId) ?? null,
    [selectedShiftId, shifts],
  );

  const record = useMemo(
    () => records.find((item) => item.shift.id === selectedShiftId) ?? null,
    [records, selectedShiftId],
  );

  const distance =
    office && location.coords
      ? haversineMeters(location.coords, {
          latitude: office.latitude,
          longitude: office.longitude,
        })
      : null;

  const accuracyOk = location.accuracy !== null && location.accuracy <= 100;
  const withinRadius =
    office !== null && distance !== null && distance <= office.radiusMeters;
  const withinWindow =
    office !== null && selectedShift !== null
      ? isWithinShiftWindow(now, selectedShift, office.timezone)
      : false;
  const completed = Boolean(record?.clockOut);
  const isClockOut = Boolean(record) && !completed;

  const blockingReason = (() => {
    if (!office) return 'Lokasi kantor aktif belum dikonfigurasi.';
    if (location.status === 'denied') {
      return location.error ?? 'Izin lokasi diperlukan.';
    }
    if (location.status === 'idle' || location.status === 'loading') {
      return 'Mengambil lokasi...';
    }
    if (location.status === 'error') {
      return location.error ?? 'Lokasi tidak tersedia.';
    }
    if (!location.coords) return 'Lokasi belum tersedia.';
    if (location.mocked) {
      return 'Mock location terdeteksi. Nonaktifkan aplikasi Fake GPS.';
    }
    if (!accuracyOk) {
      return `Akurasi GPS ${location.accuracy ? Math.round(location.accuracy) : '-'} m, maksimal 100 m.`;
    }
    if (!withinRadius) {
      return `Anda ${distance ? Math.round(distance) : '-'} m dari kantor (maks ${office.radiusMeters} m).`;
    }
    if (!selectedShift) return 'Pilih shift terlebih dahulu.';
    if (!withinWindow) return 'Di luar jendela shift yang dipilih.';
    if (completed) return 'Absensi shift ini sudah lengkap.';
    return null;
  })();

  const canSubmit = blockingReason === null && !submitting;

  const takePicture = async () => {
    if (!canSubmit || !cameraReady) return;
    setActionError(null);

    try {
      const picture = await cameraRef.current?.takePictureAsync({
        quality: 0.6,
        exif: false,
      });

      if (picture) {
        setCaptured(picture);
      }
    } catch {
      setActionError('Gagal mengambil foto. Coba lagi.');
    }
  };

  const submit = async () => {
    if (!captured || !selectedShift || !location.coords) return;

    setSubmitting(true);
    setActionError(null);
    setSuccess(null);

    try {
      const form = new FormData();

      await appendFile(form, 'photo', {
        uri: captured.uri,
        mimeType: 'image/jpeg',
        fileName: `selfie-${Date.now()}.jpg`,
      });

      form.append('latitude', String(location.coords.latitude));
      form.append('longitude', String(location.coords.longitude));
      form.append('accuracy', String(location.accuracy ?? 0));
      form.append('mocked', String(location.mocked));
      form.append('shiftId', selectedShift.id);

      const path = isClockOut
        ? '/attendance/clock-out'
        : '/attendance/clock-in';

      const result = await apiRequest<{
        attendance: AttendanceRecord;
        distanceMeters: number;
        serverTime: string;
      }>(path, { method: 'POST', form });

      if (isClockOut) {
        setSuccess(
          `Absen keluar tercatat pukul ${formatTime(
            result.attendance.clockOut?.at ?? result.serverTime,
            office?.timezone,
          )}.`,
        );
      } else {
        const late =
          result.attendance.status === 'LATE'
            ? ` Terlambat ${result.attendance.lateMinutes} menit.`
            : '';
        setSuccess(
          `Absen masuk tercatat pukul ${formatTime(
            result.attendance.clockIn.at,
            office?.timezone,
          )}.${late}`,
        );
      }

      setCaptured(null);
      await loadData('refresh');
      await location.refresh();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Screen scroll={false}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.primary} />
          <ThemedText type="small" themeColor="textSecondary">
            Memuat data absensi...
          </ThemedText>
        </View>
      </Screen>
    );
  }

  const employeeName = session?.user.employee?.fullName ?? session?.user.email;

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => void loadData('refresh')}>
      <View style={styles.hero}>
        <ThemedText type="small" themeColor="textSecondary">
          Waktu server
        </ThemedText>
        <ThemedText style={styles.clock}>
          {formatTime(now.toISOString(), office?.timezone)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDateTime(now.toISOString(), office?.timezone)}
        </ThemedText>
        <ThemedText type="smallBold">{employeeName}</ThemedText>
      </View>

      {loadError ? (
        <Card>
          <ThemedText type="small" style={{ color: theme.danger }}>
            {loadError}
          </ThemedText>
          <Button
            title="Coba Lagi"
            variant="secondary"
            onPress={() => void loadData()}
          />
        </Card>
      ) : null}

      {success ? (
        <View
          style={[styles.notice, { backgroundColor: theme.successSoft }]}>
          <ThemedText type="small" style={{ color: theme.success }}>
            {success}
          </ThemedText>
        </View>
      ) : null}

      {actionError ? (
        <View style={[styles.notice, { backgroundColor: theme.dangerSoft }]}>
          <ThemedText type="small" style={{ color: theme.danger }}>
            {actionError}
          </ThemedText>
        </View>
      ) : null}

      {location.mocked ? (
        <View style={[styles.notice, { backgroundColor: theme.dangerSoft }]}>
          <ThemedText type="smallBold" style={{ color: theme.danger }}>
            Mock location terdeteksi. Absensi diblokir sampai Fake GPS
            dinonaktifkan.
          </ThemedText>
        </View>
      ) : null}

      <Card>
        <View style={styles.rowBetween}>
          <ThemedText type="smallBold">Shift</ThemedText>
          {record ? (
            <Badge
              label={attendanceStatusLabel(record.status)}
              tone={attendanceStatusTone(record.status)}
            />
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}>
          {shifts.map((shift) => (
            <Chip
              key={shift.id}
              label={`${shift.name} · ${shift.startTime}–${shift.endTime}`}
              selected={shift.id === selectedShiftId}
              onPress={() => {
                setSelectedShiftId(shift.id);
                setCaptured(null);
                setSuccess(null);
                setActionError(null);
              }}
            />
          ))}
        </ScrollView>

        {shifts.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Belum ada shift aktif. Hubungi Admin.
          </ThemedText>
        ) : null}

        {selectedShift ? (
          <ThemedText type="small" themeColor="textSecondary">
            Toleransi {selectedShift.toleranceMinutes} menit · Clock-In lebih
            awal {selectedShift.earlyWindowMinutes} menit
          </ThemedText>
        ) : null}

        {record ? (
          <ThemedText type="small" themeColor="textSecondary">
            Masuk {formatTime(record.clockIn.at, office?.timezone)}
            {record.clockOut
              ? ` · Keluar ${formatTime(record.clockOut.at, office?.timezone)}`
              : ' · Belum keluar'}
          </ThemedText>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Belum ada absensi untuk shift ini.
          </ThemedText>
        )}
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <ThemedText type="smallBold">Lokasi</ThemedText>
          <Button
            title="Perbarui"
            variant="ghost"
            onPress={() => void location.refresh()}
            loading={location.status === 'loading'}
            style={styles.smallButton}
          />
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          {office
            ? `${office.name} · radius ${office.radiusMeters} m`
            : 'Kantor belum dikonfigurasi'}
        </ThemedText>

        <View style={styles.metrics}>
          <View style={styles.metric}>
            <ThemedText type="small" themeColor="textSecondary">
              Jarak
            </ThemedText>
            <ThemedText type="smallBold">
              {distance !== null ? `${Math.round(distance)} m` : '—'}
            </ThemedText>
          </View>
          <View style={styles.metric}>
            <ThemedText type="small" themeColor="textSecondary">
              Akurasi GPS
            </ThemedText>
            <ThemedText type="smallBold">
              {location.accuracy !== null
                ? `${Math.round(location.accuracy)} m`
                : '—'}
            </ThemedText>
          </View>
          <View style={styles.metric}>
            <ThemedText type="small" themeColor="textSecondary">
              Radius
            </ThemedText>
            <ThemedText type="smallBold">
              {withinRadius ? 'Di dalam' : 'Di luar'}
            </ThemedText>
          </View>
        </View>

        {location.error ? (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {location.error}
          </ThemedText>
        ) : null}
      </Card>

      <Card>
        <ThemedText type="smallBold">Foto selfie</ThemedText>

        {!cameraPermission ? (
          <ActivityIndicator color={theme.primary} />
        ) : !cameraPermission.granted ? (
          <View style={styles.centered}>
            <ThemedText type="small" themeColor="textSecondary">
              ClockIn memerlukan kamera untuk foto selfie absensi.
            </ThemedText>
            <Button
              title="Izinkan Kamera"
              onPress={() => void requestCameraPermission()}
            />
          </View>
        ) : captured ? (
          <View style={styles.previewWrap}>
            <Image
              source={{ uri: captured.uri }}
              style={styles.preview}
              contentFit="cover"
            />
            <View style={styles.rowGap}>
              <Button
                title="Ambil Ulang"
                variant="secondary"
                onPress={() => setCaptured(null)}
                style={styles.flex}
              />
              <Button
                title={isClockOut ? 'Kirim Absen Keluar' : 'Kirim Absen Masuk'}
                onPress={() => void submit()}
                loading={submitting}
                disabled={!canSubmit}
                style={styles.flex}
              />
            </View>
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraPanel
              isFocused={isFocused}
              cameraRef={cameraRef}
              onReady={() => setCameraReady(true)}
              onError={() => setActionError('Kamera tidak dapat dimulai.')}
            />
            <ThemedText
              type="small"
              style={[
                styles.captureHint,
                { color: blockingReason ? theme.danger : theme.textSecondary },
              ]}>
              {blockingReason ??
                'Posisikan wajah Anda di kamera, lalu ambil selfie.'}
            </ThemedText>
            <Button
              title="Ambil Selfie"
              onPress={() => void takePicture()}
              disabled={!canSubmit || !cameraReady}
            />
          </View>
        )}
      </Card>

      {!record && blockingReason === null ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={styles.center}>
          Tombol akan mencatat absensi masuk untuk shift terpilih.
        </ThemedText>
      ) : null}

      {records.length === 0 ? (
        <EmptyState
          title="Belum ada riwayat hari ini"
          description="Absensi yang Anda kirim akan muncul di sini dan di tab Riwayat."
        />
      ) : null}
    </Screen>
  );
}

type CameraPanelProps = {
  isFocused: boolean;
  cameraRef: RefObject<CameraView | null>;
  onReady: () => void;
  onError: () => void;
};

function CameraPanel({
  isFocused,
  cameraRef,
  onReady,
  onError,
}: CameraPanelProps) {
  if (!isFocused) {
    return <View style={[styles.camera, styles.cameraPlaceholder]} />;
  }

  return (
    <CameraView
      ref={cameraRef}
      style={styles.camera}
      facing="front"
      mirror
      onCameraReady={onReady}
      onMountError={onError}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.two,
  },
  clock: {
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  notice: {
    borderRadius: 12,
    padding: Spacing.three,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rowGap: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  chipRow: {
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  metrics: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  metric: {
    minWidth: 90,
    gap: 2,
  },
  smallButton: {
    minHeight: 32,
    paddingHorizontal: Spacing.two,
  },
  cameraWrap: {
    gap: Spacing.two,
  },
  camera: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cameraPlaceholder: {
    backgroundColor: '#000000',
  },
  captureHint: {
    textAlign: 'center',
  },
  previewWrap: {
    gap: Spacing.two,
  },
  preview: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
  },
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
});
