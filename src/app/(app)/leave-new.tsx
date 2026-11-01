import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { DateField } from '@/components/ui/date-field';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiRequest, errorMessage } from '@/lib/api';
import type { LeaveType } from '@/lib/types';
import { appendFile } from '@/lib/upload';

type PickedAttachment = {
  uri: string;
  name: string;
  mimeType: string;
  size: number | null;
};

const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: 'SICK', label: 'Sakit' },
  { value: 'ANNUAL', label: 'Cuti' },
  { value: 'PERMISSION', label: 'Izin' },
  { value: 'OTHER', label: 'Lainnya' },
];

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function todayString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function isValidDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
  );
}

export default function NewLeaveScreen() {
  const theme = useTheme();
  const today = todayString();

  const [type, setType] = useState<LeaveType>('SICK');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState('');
  const [attachment, setAttachment] = useState<PickedAttachment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickAttachment = async () => {
    setError(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) return;

      if (asset.size && asset.size > MAX_ATTACHMENT_BYTES) {
        setError('Ukuran lampiran maksimal 5 MB.');
        return;
      }

      setAttachment({
        uri: asset.uri,
        name: asset.name || 'lampiran',
        mimeType: asset.mimeType ?? 'application/octet-stream',
        size: asset.size ?? null,
      });
    } catch {
      setError('Gagal memilih lampiran.');
    }
  };

  const submit = async () => {
    setError(null);

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      setError('Tanggal harus berformat YYYY-MM-DD.');
      return;
    }

    if (endDate < startDate) {
      setError('Tanggal selesai harus sama atau setelah tanggal mulai.');
      return;
    }

    if (reason.trim().length < 10) {
      setError('Alasan minimal 10 karakter.');
      return;
    }

    setSubmitting(true);

    try {
      const form = new FormData();
      form.append('type', type);
      form.append('startDate', startDate);
      form.append('endDate', endDate);
      form.append('reason', reason.trim());

      if (attachment) {
        await appendFile(form, 'attachment', {
          uri: attachment.uri,
          mimeType: attachment.mimeType,
          fileName: attachment.name,
        });
      }

      await apiRequest('/leave-requests', { method: 'POST', form });
      router.back();
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll>
      <Card>
        <ThemedText type="smallBold">Jenis pengajuan</ThemedText>
        <View style={styles.chipRow}>
          {LEAVE_TYPES.map((item) => (
            <Chip
              key={item.value}
              label={item.label}
              selected={type === item.value}
              onPress={() => setType(item.value)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <DateField
          label="Tanggal mulai"
          value={startDate}
          onChange={setStartDate}
        />
        <DateField
          label="Tanggal selesai"
          value={endDate}
          onChange={setEndDate}
        />
        <TextField
          label="Alasan"
          value={reason}
          onChangeText={setReason}
          placeholder="Jelaskan alasan pengajuan (minimal 10 karakter)"
          multiline
          numberOfLines={5}
          style={styles.reasonInput}
        />
      </Card>

      <Card>
        <ThemedText type="smallBold">Lampiran (opsional)</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Surat dokter atau dokumen pendukung. Format JPEG, PNG, atau PDF,
          maksimal 5 MB.
        </ThemedText>

        {attachment ? (
          <View style={styles.attachmentRow}>
            <View style={styles.attachmentInfo}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {attachment.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {attachment.mimeType}
              </ThemedText>
            </View>
            <Button
              title="Hapus"
              variant="secondary"
              onPress={() => setAttachment(null)}
            />
          </View>
        ) : (
          <Button
            title="Pilih Lampiran"
            variant="secondary"
            onPress={() => void pickAttachment()}
          />
        )}
      </Card>

      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}

      <Button
        title="Kirim Pengajuan"
        onPress={() => void submit()}
        loading={submitting}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  reasonInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  attachmentInfo: {
    flex: 1,
  },
});
