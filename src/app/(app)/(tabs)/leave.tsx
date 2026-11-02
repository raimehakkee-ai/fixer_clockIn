import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiGet, apiRequest, errorMessage } from '@/lib/api';
import { formatWorkDate } from '@/lib/format';
import {
  leaveStatusLabel,
  leaveStatusTone,
  leaveTypeLabel,
} from '@/lib/labels';
import type { LeaveRecord, Paginated } from '@/lib/types';

export default function LeaveScreen() {
  const theme = useTheme();
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      const result = await apiGet<Paginated<LeaveRecord>>(
        '/leave-requests/me?limit=50',
      );
      setLeaves(result.data);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const cancelLeave = async (id: string) => {
    const message = 'Batalkan pengajuan ini? Tindakan tidak dapat dibatalkan.';
    const confirmed =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.confirm(message)
        : await new Promise<boolean>((resolve) => {
            Alert.alert('Batalkan pengajuan', message, [
              {
                text: 'Tidak',
                style: 'cancel',
                onPress: () => resolve(false),
              },
              {
                text: 'Ya, batalkan',
                style: 'destructive',
                onPress: () => resolve(true),
              },
            ], {
              cancelable: true,
              onDismiss: () => resolve(false),
            });
          });

    if (!confirmed) return;

    setCancellingId(id);
    setActionError(null);

    try {
      await apiRequest(`/leave-requests/${id}/cancel`, { method: 'POST' });
      await load('refresh');
    } catch (cancelError) {
      setActionError(errorMessage(cancelError));
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => void load('refresh')}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <ThemedText type="smallBold">Izin & Cuti</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ajukan dan pantau status pengajuan Anda.
          </ThemedText>
        </View>
        <Button
          title="Ajukan"
          onPress={() => router.push('/leave-new')}
          style={styles.applyButton}
        />
      </View>

      {actionError ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {actionError}
        </ThemedText>
      ) : null}

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
      ) : leaves.length === 0 ? (
        <EmptyState
          title="Belum ada pengajuan"
          description="Pengajuan izin, cuti, atau sakit akan tampil di sini."
        />
      ) : (
        leaves.map((leave) => (
          <Card key={leave.id}>
            <View style={styles.rowBetween}>
              <ThemedText type="smallBold">
                {leaveTypeLabel(leave.type)}
              </ThemedText>
              <Badge
                label={leaveStatusLabel(leave.status)}
                tone={leaveStatusTone(leave.status)}
              />
            </View>

            <ThemedText type="small" themeColor="textSecondary">
              {formatWorkDate(leave.startDate)} – {formatWorkDate(leave.endDate)}{' '}
              · {leave.days} hari
            </ThemedText>

            <ThemedText type="small" numberOfLines={2}>
              {leave.reason}
            </ThemedText>

            {leave.attachmentAvailable ? (
              <ThemedText type="small" themeColor="textSecondary">
                Lampiran: {leave.attachmentMime ?? 'tersedia'}
              </ThemedText>
            ) : null}

            {leave.reviewNote ? (
              <ThemedText type="small" themeColor="textSecondary">
                Catatan reviewer: {leave.reviewNote}
              </ThemedText>
            ) : null}

            {leave.status === 'PENDING' ? (
              <Button
                title="Batalkan Pengajuan"
                variant="secondary"
                loading={cancellingId === leave.id}
                disabled={cancellingId !== null}
                onPress={() => void cancelLeave(leave.id)}
              />
            ) : null}
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
  headerText: {
    flex: 1,
    gap: 2,
  },
  applyButton: {
    paddingHorizontal: Spacing.three,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
