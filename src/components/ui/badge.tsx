import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'primary';

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
};

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const theme = useTheme();

  const background =
    tone === 'success'
      ? theme.successSoft
      : tone === 'warning'
        ? theme.warningSoft
        : tone === 'danger'
          ? theme.dangerSoft
          : theme.backgroundSelected;

  const color =
    tone === 'success'
      ? theme.success
      : tone === 'warning'
        ? theme.warning
        : tone === 'danger'
          ? theme.danger
          : tone === 'primary'
            ? theme.primary
            : theme.textSecondary;

  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <ThemedText style={[styles.label, { color }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
