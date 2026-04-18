import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@lib/supabase';
import { translateAuthError } from '@lib/auth-utils';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@constants/theme';
import { Button } from '@components/ui/Button';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleEmailLogin = async () => {
    if (!email || !password) {
      Alert.alert('Hata', 'E-posta ve şifre gereklidir.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);

    if (error) {
      Alert.alert('Giriş hatası', translateAuthError(error.message));
    } else {
      router.replace('/(tabs)');
    }
  };

  const inputStyle = (field: string) => [
    styles.input,
    focusedField === field && styles.inputFocused,
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoGlow}>
            <Text style={styles.logoEmoji}>📍</Text>
          </View>
          <Text style={styles.logoTitle}>FotoHarita</Text>
          <Text style={styles.logoSubtitle}>Çekim noktalarını keşfet</Text>
        </View>

        {/* Kart */}
        <View style={styles.card}>
          {/* Google — devre dışı */}
          <View style={styles.googleDisabled}>
            <Text style={styles.socialIcon}>🔵</Text>
            <Text style={styles.googleText}>Google ile Devam Et</Text>
            <View style={styles.soonBadge}>
              <Text style={styles.soonText}>Yakında</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>veya e-posta ile</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>E-POSTA</Text>
            <TextInput
              style={inputStyle('email')}
              placeholder="ornek@email.com"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ŞİFRE</Text>
            <View style={inputStyle('password')}>
              <TextInput
                style={styles.passwordInner}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Button
            title="Giriş Yap"
            onPress={handleEmailLogin}
            loading={loading}
            size="lg"
            style={styles.loginBtn}
          />
        </View>

        <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.registerLink}>
          <Text style={styles.registerText}>
            Hesabın yok mu?{'  '}
            <Text style={styles.registerLinkText}>Kayıt Ol →</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    padding: Spacing.lg,
    paddingTop: 72,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },

  // Logo
  logoSection: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  logoGlow: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.primary,
    shadowOpacity: 0.2,
  },
  logoEmoji: { fontSize: 44 },
  logoTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  logoSubtitle: { fontSize: 14, color: Colors.textSecondary },

  // Kart
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.md,
  },

  // Google butonu (devre dışı)
  googleDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    opacity: 0.45,
  },
  socialIcon: { fontSize: 18 },
  googleText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  soonBadge: {
    backgroundColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  soonText: { fontSize: 10, color: Colors.textSecondary, fontWeight: '700', letterSpacing: 0.5 },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 12, color: Colors.textMuted, letterSpacing: 0.3 },

  // Form
  fieldGroup: { gap: 6 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.2,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.text,
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '0a',
  },
  passwordInner: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 13,
  },
  eyeBtn: { paddingHorizontal: 4 },
  eyeText: { fontSize: 17 },

  loginBtn: { marginTop: Spacing.xs },

  // Alt link
  registerLink: { alignItems: 'center', paddingVertical: Spacing.sm },
  registerText: { fontSize: 14, color: Colors.textSecondary },
  registerLinkText: { color: Colors.primary, fontWeight: '700' },
});
