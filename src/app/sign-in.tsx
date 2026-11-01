import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/contexts/session';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/api';

export default function SignInScreen() {
  const theme = useTheme();
  const { signIn } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      await signIn(email, password);
    } catch (signInError) {
      setError(errorMessage(signInError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={[styles.logo, { backgroundColor: theme.primary }]}>
              <ThemedText
                style={[styles.logoText, { color: theme.primaryText }]}>
                C
              </ThemedText>
            </View>
            <ThemedText type="subtitle">ClockIn</ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.center}>
              Absensi karyawan dengan validasi lokasi dan waktu server.
            </ThemedText>
          </View>

          <Card>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="nama@perusahaan.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              onSubmitEditing={() => {
                if (email && password && !submitting) {
                  void submit();
                }
              }}
            />

            {error ? (
              <ThemedText type="small" style={{ color: theme.danger }}>
                {error}
              </ThemedText>
            ) : null}

            <Button
              title="Masuk"
              onPress={() => void submit()}
              loading={submitting}
              disabled={!email.trim() || !password}
            />
          </Card>

          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.center}>
            Satu akun hanya aktif pada satu perangkat terverifikasi. Hubungi
            Admin jika Anda berganti perangkat.
          </ThemedText>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.four,
  },
  brand: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 26,
    fontWeight: '800',
  },
  center: {
    textAlign: 'center',
  },
});
