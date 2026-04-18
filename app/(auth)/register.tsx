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
import {
  translateAuthError,
  getPasswordStrength,
  getPasswordRules,
  validateUsername,
} from '@lib/auth-utils';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@constants/theme';
import { Button } from '@components/ui/Button';

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const strength = getPasswordStrength(password);
  const rules = getPasswordRules(password);
  const usernameError = username.length > 0 ? validateUsername(username) : null;

  const handleRegister = async () => {
    if (!email || !password || !username) {
      Alert.alert('Hata', 'Tüm alanlar zorunludur.');
      return;
    }
    const unameErr = validateUsername(username);
    if (unameErr) { Alert.alert('Hata', unameErr); return; }
    if (password.length < 8) {
      Alert.alert('Hata', 'Şifre en az 8 karakter olmalıdır.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { username: username.toLowerCase().trim() } },
    });
    setLoading(false);

    if (error) {
      Alert.alert('Kayıt hatası', translateAuthError(error.message));
      return;
    }

    if (data.session === null) {
      setEmailSent(true);
      return;
    }

    router.replace('/(tabs)');
  };

  const inputStyle = (field: string) => [
    styles.input,
    focusedField === field && styles.inputFocused,
  ];

  // E-posta onayı ekranı
  if (emailSent) {
    return (
      <View style={styles.confirmContainer}>
        <View style={styles.confirmIconWrap}>
          <Text style={styles.confirmEmoji}>📧</Text>
        </View>
        <Text style={styles.confirmTitle}>E-postanı Onayla</Text>
        <Text style={styles.confirmBody}>
          <Text style={{ color: Colors.primary, fontWeight: '600' }}>{email}</Text>
          {' '}adresine onay bağlantısı gönderdik.{'\n\n'}
          Gelen kutunu kontrol et, spam klasörüne de bakabilirsin.
        </Text>
        <TouchableOpacity
          style={styles.backToLoginBtn}
          onPress={() => router.replace('/(auth)/login')}
          activeOpacity={0.8}
        >
          <Text style={styles.backToLoginText}>Giriş sayfasına dön →</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>

        <View style={styles.headSection}>
          <Text style={styles.title}>Hesap Oluştur</Text>
          <Text style={styles.subtitle}>Çekim noktalarını keşfetmeye hazır mısın?</Text>
        </View>

        <View style={styles.card}>
          {/* Kullanıcı adı */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>KULLANICI ADI</Text>
            <TextInput
              style={[
                styles.input,
                focusedField === 'username' && styles.inputFocused,
                usernameError ? styles.inputError : null,
                !usernameError && username.length > 0 ? styles.inputSuccess : null,
              ]}
              placeholder="ornek_kullanici"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
              maxLength={20}
              onFocus={() => setFocusedField('username')}
              onBlur={() => setFocusedField(null)}
            />
            {usernameError ? (
              <Text style={styles.errorHint}>{usernameError}</Text>
            ) : username.length > 0 ? (
              <Text style={styles.successHint}>✓ Kullanıcı adı uygun</Text>
            ) : null}
          </View>

          {/* E-posta */}
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

          {/* Şifre */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ŞİFRE</Text>
            <View style={[
              styles.input,
              focusedField === 'password' && styles.inputFocused,
              { flexDirection: 'row', alignItems: 'center' },
            ]}>
              <TextInput
                style={styles.passwordInner}
                placeholder="En az 8 karakter"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                maxLength={64}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>

            {/* Güç göstergesi */}
            {password.length > 0 && (
              <>
                <View style={styles.strengthRow}>
                  <View style={styles.strengthBarTrack}>
                    <View
                      style={[
                        styles.strengthBarFill,
                        { width: strength.width as any, backgroundColor: strength.color },
                      ]}
                    />
                  </View>
                  <Text style={[styles.strengthLabel, { color: strength.color }]}>
                    {strength.label}
                  </Text>
                </View>
                {/* Kurallar */}
                <View style={styles.rulesRow}>
                  {rules.map((rule) => (
                    <View key={rule.label} style={styles.ruleItem}>
                      <Text style={[styles.ruleIcon, { color: rule.met ? Colors.success : Colors.textMuted }]}>
                        {rule.met ? '✓' : '○'}
                      </Text>
                      <Text style={[styles.ruleText, { color: rule.met ? Colors.success : Colors.textMuted }]}>
                        {rule.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>

          <Button
            title="Kayıt Ol"
            onPress={handleRegister}
            loading={loading}
            size="lg"
            style={styles.registerBtn}
          />
        </View>

        <View style={styles.spacer} />

        <TouchableOpacity onPress={() => router.back()} style={styles.loginLink}>
          <Text style={styles.loginText}>
            Zaten hesabın var mı?{'  '}
            <Text style={styles.loginLinkText}>Giriş Yap →</Text>
          </Text>
        </TouchableOpacity>

        <Text style={styles.kvkk}>
          Kayıt olarak KVKK aydınlatma metnini ve kullanım koşullarını kabul etmiş olursunuz.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    padding: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  spacer: { height: 40 },
  backBtn: { marginBottom: -Spacing.xs },
  backText: { fontSize: 15, color: Colors.primary, fontWeight: '600' },

  headSection: { gap: 6 },
  title: { ...Typography.h1 },
  subtitle: { fontSize: 15, color: Colors.textSecondary },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.md,
  },

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
  inputError: {
    borderColor: Colors.error,
    backgroundColor: Colors.error + '08',
  },
  inputSuccess: {
    borderColor: Colors.success + '60',
  },
  passwordInner: { flex: 1, fontSize: 15, color: Colors.text, paddingVertical: 13 },
  eyeBtn: { paddingHorizontal: 4 },
  eyeText: { fontSize: 17 },

  errorHint: { fontSize: 12, color: Colors.error, marginLeft: 2 },
  successHint: { fontSize: 12, color: Colors.success, marginLeft: 2 },

  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 6,
  },
  strengthBarTrack: {
    flex: 1,
    height: 3,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthBarFill: { height: '100%', borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: '700', minWidth: 40, letterSpacing: 0.3 },

  rulesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: 4,
  },
  ruleItem: { flexDirection: 'row', alignItems: 'center', gap: 3, minWidth: '45%' },
  ruleIcon: { fontSize: 11, fontWeight: '700' },
  ruleText: { fontSize: 11 },

  registerBtn: { marginTop: Spacing.xs },

  loginLink: { alignItems: 'center', paddingVertical: Spacing.xs },
  loginText: { fontSize: 14, color: Colors.textSecondary },
  loginLinkText: { color: Colors.primary, fontWeight: '700' },
  kvkk: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },

  // E-posta onay ekranı
  confirmContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  confirmIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    ...Shadows.primary,
    shadowOpacity: 0.15,
  },
  confirmEmoji: { fontSize: 52 },
  confirmTitle: { ...Typography.h1, textAlign: 'center' },
  confirmBody: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  backToLoginBtn: { marginTop: Spacing.md },
  backToLoginText: { fontSize: 15, color: Colors.primary, fontWeight: '700' },
});
