import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function AppLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="leave-new"
        options={{
          headerShown: true,
          presentation: 'modal',
          title: 'Ajukan Izin',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
        }}
      />
    </Stack>
  );
}
