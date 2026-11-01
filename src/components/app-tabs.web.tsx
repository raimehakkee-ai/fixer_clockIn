import { Tabs, TabList, TabSlot, TabTrigger } from 'expo-router/ui';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const theme = useTheme();

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList
        style={[
          styles.tabList,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
          },
        ]}>
        <ThemedText type="smallBold" style={styles.brand}>
          ClockIn
        </ThemedText>
        <TabTrigger name="index" href="/" style={styles.tab}>
          <ThemedText type="small">Absen</ThemedText>
        </TabTrigger>
        <TabTrigger name="history" href="/history" style={styles.tab}>
          <ThemedText type="small">Riwayat</ThemedText>
        </TabTrigger>
        <TabTrigger name="leave" href="/leave" style={styles.tab}>
          <ThemedText type="small">Izin</ThemedText>
        </TabTrigger>
        <TabTrigger name="profile" href="/profile" style={styles.tab}>
          <ThemedText type="small">Profil</ThemedText>
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabList: {
    position: 'absolute',
    bottom: Spacing.three,
    alignSelf: 'center',
    width: '92%',
    maxWidth: MaxContentWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.five,
    borderWidth: 1,
  },
  brand: {
    marginRight: 'auto',
  },
  tab: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
});
