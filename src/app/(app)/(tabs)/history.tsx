import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Metric } from '@/components/ui/metric';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiGet, errorMessage } from '@/lib/api';
import {
  formatMonth,
  formatTime,
  formatWorkDate,
  monthRange,
  shiftLabel,
} from '@/lib/format';
import {
  attendanceStatusLabel,
  attendanceStatusTone,
} from '@/lib/labels';
import type { AttendanceRecord, Paginated } from '@/lib/types';

export default function HistoryScreen() {
  const theme = useTheme();
  const [month, setMonth] = useState(() => {
    const current = new Date();
    return new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1));
  });
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      try {
        const { from, to } = monthRange(month);
        const result = await apiGet<Paginated<AttendanceRecord>>(
          `/attendance/me?from=${from}&to=${to}&limit=100`,
        );
        setRecords(result.data);
      } catch (loadError) {
        setError(errorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [month],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const changeMonth = (offset: number) => {
    setMonth(
      (current) =>
        new Date(
          Date.UTC(
            current.getUTCFullYear(),
            current.getUTCMonth() + offset,
            1,
          ),
        ),
    );
  };

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => void load('refresh')}>
      <View style={styles.header}>
        <Button
          title="‹"
          variant="secondary"
          onPress={() => changeMonth(-1)}
          style={styles.navButton}
        />
        <ThemedText type="smallBold">{formatMonth(month)}</ThemedText>
        <Button
          title="›"
          variant="secondary"
          onPress={() => changeMonth(1)}
          style={styles.navButton}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={theme.primary} />
      ) : error ? (
        <Card>
          <ThemedText type="small" style={{ color: theme.danger }}>
            {error}
          </ThemedText>
          <Button
            title="Coba Lagi"
            variant="secondary"
            onPress={() => void load()}
          />
        </Card>
      ) : records.length === 0 ? (
        <EmptyState
          title="Belum ada riwayat"
          description="Tidak ada absensi pada bulan ini."
        />
      ) : (
        records.map((record) => (
          <Card key={record.id}>
            <View style={styles.rowBetween}>
              <ThemedText type="smallBold">
                {formatWorkDate(record.workDate)}
              </ThemedText>
              <Badge
                label={attendanceStatusLabel(record.status)}
                tone={attendanceStatusTone(record.status)}
              />
            </View>

            <ThemedText type="small" themeColor="textSecondary">
              {record.shift.name} · {shiftLabel(record.shift)}
            </ThemedText>

            <View style={styles.metrics}>
              <Metric
                label="Masuk"
                value={formatTime(record.clockIn.at)}
              />
              <Metric
                label="Keluar"
                value={
                  record.clockOut ? formatTime(record.clockOut.at) : '—'
                }
              />
              <Metric
                label="Terlambat"
                value={
                  record.lateMinutes > 0 ? `${record.lateMinutes} mnt` : '—'
                }
              />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  navButton: {
    minHeight: 40,
    paddingHorizontal: Spacing.three,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.one,
  },
});
