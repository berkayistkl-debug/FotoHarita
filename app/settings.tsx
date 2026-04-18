import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Animated,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@lib/supabase';
import { useTheme, ThemeMode } from '../context/ThemeContext';
import { validateUsername, getPasswordStrength } from '@lib/auth-utils';
import { Colors, DarkColors, LightColors, Spacing, BorderRadius, Shadows } from '@constants/theme';

// Ayarlar ekranı kendi renklerini ThemeContext'ten alıyor (live preview destekli)
export default function SettingsScreen() {
  const router = useRouter();
  const { mode, setMode, isDark, colors } = useTheme();

  const [userId, setUserId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [privateProfile, setPrivateProfile] = useState(false);
  const [savingPrivate, setSavingPrivate] = useState(false);

  // Şifre değiştir form
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: prof } = await supabase
      .from('users')
      .select('id, username, bio, is_private')
      .eq('auth_id', user.id)
      .single();

    if (prof) {
      setProfileId(prof.id);
      setUsername(prof.username ?? '');
      setBio(prof.bio ?? '');
      setPrivateProfile(prof.is_private ?? false);
      setProfileLoaded(true);
    }
  };

  const handleSaveProfile = async () => {
    const err = validateUsername(username);
    if (err) { Alert.alert('Hata', err); return; }

    setSavingProfile(true);
    const { error } = await supabase
      .from('users')
      .update({ username: username.trim().toLowerCase(), bio: bio.trim() })
      .eq('id', profileId);
    setSavingProfile(false);

    if (error) {
      Alert.alert('Hata', 'Profil kaydedilemedi. Kullanıcı adı zaten alınmış olabilir.');
    } else {
      Alert.alert('Başarılı', 'Profil güncellendi.');
    }
  };

  const handleSignOut = () => {
    Alert.alert('Çıkış Yap', 'Hesabından çıkmak istediğine emin misin?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkış Yap', style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Hesabı Sil',
      'Bu işlem geri alınamaz. Tüm pinlerin ve verilerini silinecek.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Hesabımı Sil', style: 'destructive',
          onPress: async () => {
            if (!profileId) return;
            try {
              await supabase
                .from('users')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', profileId);
              await supabase.auth.signOut();
              router.replace('/(auth)/login');
            } catch {
              Alert.alert('Hata', 'Hesap silinemedi. Lütfen tekrar dene.');
            }
          },
        },
      ],
    );
  };

  const handlePrivateToggle = async (val: boolean) => {
    setPrivateProfile(val);
    if (!profileId) return;
    setSavingPrivate(true);
    await supabase.from('users').update({ is_private: val }).eq('id', profileId);
    setSavingPrivate(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      Alert.alert('Hata', 'Şifre en az 8 karakter olmalıdır.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Hata', 'Şifreler eşleşmiyor.');
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      Alert.alert('Hata', 'Şifre değiştirilemedi. Lütfen tekrar giriş yapıp dene.');
    } else {
      Alert.alert('Başarılı', 'Şifreni başarıyla değiştirdin.');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    }
  };

  // Dinamik renkler (ThemeContext'ten)
  const c = colors;

  return (
    <ScrollView
      style={[s.container, { backgroundColor: c.background }]}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Başlık */}
      <View style={s.pageHeader}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={[s.backText, { color: c.primary }]}>← Geri</Text>
        </TouchableOpacity>
        <Text style={[s.pageTitle, { color: c.text }]}>Ayarlar</Text>
      </View>

      {/* ─── PROFİL ─── */}
      <SectionCard colors={c} title="Profil">
        {!profileLoaded ? (
          <ActivityIndicator color={c.primary} />
        ) : (
          <>
            {/* Avatar */}
            <View style={s.avatarRow}>
              <View style={[s.avatarCircle, { backgroundColor: c.primary + '25', borderColor: c.primary }]}>
                <Text style={[s.avatarText, { color: c.primary }]}>
                  {username[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.fieldLabel, { color: c.textMuted }]}>KULLANICI ADI</Text>
                <TextInput
                  style={[s.input, { backgroundColor: c.surfaceElevated, color: c.text, borderColor: c.border }]}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  maxLength={20}
                  placeholderTextColor={c.textMuted}
                />
              </View>
            </View>

            <View>
              <Text style={[s.fieldLabel, { color: c.textMuted }]}>BİYOGRAFİ</Text>
              <TextInput
                style={[s.input, s.bioInput, { backgroundColor: c.surfaceElevated, color: c.text, borderColor: c.border }]}
                value={bio}
                onChangeText={(t) => setBio(t.slice(0, 120))}
                placeholder="Kendini tanıt..."
                placeholderTextColor={c.textMuted}
                multiline
                numberOfLines={3}
              />
              <Text style={[s.charCount, { color: c.textMuted }]}>{bio.length}/120</Text>
            </View>

            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: c.primary, ...(Shadows.primary as any) }]}
              onPress={handleSaveProfile}
              disabled={savingProfile}
              activeOpacity={0.8}
            >
              {savingProfile
                ? <ActivityIndicator color={c.background} size="small" />
                : <Text style={[s.saveBtnText, { color: c.background }]}>Kaydet</Text>
              }
            </TouchableOpacity>
          </>
        )}
      </SectionCard>

      {/* ─── GÖRÜNÜM ─── */}
      <SectionCard colors={c} title="Görünüm">
        {/* Hızlı koyu/açık toggle */}
        <ThemeSwitch
          isDark={isDark}
          onToggle={() => setMode(isDark ? 'light' : 'dark')}
          colors={c}
        />

        {/* 3 seçenek */}
        <View style={s.themeOptions}>
          {([
            { value: 'dark' as ThemeMode, icon: 'moon' as const, label: 'Koyu' },
            { value: 'light' as ThemeMode, icon: 'sun' as const, label: 'Açık' },
            { value: 'system' as ThemeMode, icon: 'smartphone' as const, label: 'Sistem' },
          ]).map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                s.themeOption,
                { backgroundColor: c.surfaceElevated, borderColor: c.border },
                mode === opt.value && { backgroundColor: c.primary + '18', borderColor: c.primary },
              ]}
              onPress={() => setMode(opt.value)}
              activeOpacity={0.8}
            >
              <Feather
                name={opt.icon}
                size={20}
                color={mode === opt.value ? c.primary : c.textMuted}
              />
              <Text style={[s.themeLabel, { color: mode === opt.value ? c.primary : c.textSecondary }]}>
                {opt.label}
              </Text>
              {mode === opt.value && (
                <View style={[s.themeCheck, { backgroundColor: c.primary }]}>
                  <Feather name="check" size={9} color={c.background} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Renk önizleme */}
        <View style={[s.previewBox, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[s.previewLabel, { color: c.textMuted }]}>ÖNİZLEME</Text>
          <View style={s.previewRow}>
            <View style={[s.previewDot, { backgroundColor: c.primary }]} />
            <View style={[s.previewDot, { backgroundColor: c.accent }]} />
            <View style={[s.previewDot, { backgroundColor: c.accentPink }]} />
            <View style={[s.previewDot, { backgroundColor: c.error }]} />
          </View>
          <Text style={[s.previewText, { color: c.text }]}>FotoHarita</Text>
          <Text style={[s.previewSubtext, { color: c.textSecondary }]}>
            {isDark ? 'Koyu tema aktif' : 'Açık tema aktif'}
          </Text>
        </View>
      </SectionCard>

      {/* ─── BİLDİRİMLER ─── */}
      <SectionCard colors={c} title="Bildirimler">
        <ToggleRow
          label="Push Bildirimleri"
          description="Yeni pin ve coin bildirimleri"
          value={notificationsEnabled}
          onChange={setNotificationsEnabled}
          colors={c}
        />
      </SectionCard>

      {/* ─── GİZLİLİK ─── */}
      <SectionCard colors={c} title="Gizlilik">
        <ToggleRow
          label="Profili Gizle"
          description="Diğer kullanıcılar profilini göremez"
          value={privateProfile}
          onChange={handlePrivateToggle}
          loading={savingPrivate}
          colors={c}
        />
      </SectionCard>

      {/* ─── HAKKINDA ─── */}
      <SectionCard colors={c} title="Hakkında">
        <InfoRow label="Versiyon" value="1.0.0" colors={c} />
        <InfoRow label="Platform" value="Expo / React Native" colors={c} />
        <TouchableRow label="Gizlilik Politikası" colors={c} onPress={() => Linking.openURL('https://fotohrita.com/gizlilik')} />
        <TouchableRow label="Kullanım Koşulları" colors={c} onPress={() => Linking.openURL('https://fotohrita.com/kosullar')} />
        <TouchableRow label="Destek" colors={c} onPress={() => Linking.openURL('mailto:destek@fotohrita.com')} />
      </SectionCard>

      {/* ─── HESAP ─── */}
      <SectionCard colors={c} title="Hesap">
        {/* Şifre değiştir */}
        <TouchableRow
          label="Şifre Değiştir"
          colors={c}
          onPress={() => setShowPasswordForm((v) => !v)}
        />
        {showPasswordForm && (
          <View style={[s.passwordForm, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
            <Text style={[s.fieldLabel, { color: c.textMuted }]}>YENİ ŞİFRE</Text>
            <TextInput
              style={[s.input, { backgroundColor: c.surface, color: c.text, borderColor: c.border }]}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="En az 8 karakter"
              placeholderTextColor={c.textMuted}
            />
            {newPassword.length > 0 && (
              <View style={s.strengthBarTrack}>
                <View style={[s.strengthBarFill, { width: getPasswordStrength(newPassword).width as any, backgroundColor: getPasswordStrength(newPassword).color }]} />
              </View>
            )}
            <Text style={[s.fieldLabel, { color: c.textMuted, marginTop: Spacing.xs }]}>YENİ ŞİFRE (TEKRAR)</Text>
            <TextInput
              style={[s.input, {
                backgroundColor: c.surface, color: c.text,
                borderColor: confirmPassword && confirmPassword !== newPassword ? c.error : c.border,
              }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="Şifreni tekrarla"
              placeholderTextColor={c.textMuted}
            />
            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: c.primary, marginTop: Spacing.sm }]}
              onPress={handleChangePassword}
              disabled={savingPassword}
              activeOpacity={0.8}
            >
              {savingPassword
                ? <ActivityIndicator color={c.background} size="small" />
                : <Text style={[s.saveBtnText, { color: c.background }]}>Şifreyi Güncelle</Text>
              }
            </TouchableOpacity>
          </View>
        )}
        <TouchableRow
          label="Çıkış Yap"
          colors={c}
          onPress={handleSignOut}
          danger
        />
        <TouchableRow
          label="Hesabı Sil"
          colors={c}
          onPress={handleDeleteAccount}
          danger
        />
      </SectionCard>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Alt bileşenler ───

type ColorsType = typeof DarkColors;

function ThemeSwitch({
  isDark,
  onToggle,
  colors: c,
}: {
  isDark: boolean;
  onToggle: () => void;
  colors: ColorsType;
}) {
  const anim = React.useRef(new Animated.Value(isDark ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.spring(anim, {
      toValue: isDark ? 1 : 0,
      useNativeDriver: false,
      tension: 80,
      friction: 8,
    }).start();
  }, [isDark]);

  const trackBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [c.surfaceElevated, c.primary + '30'],
  });
  const thumbX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 51],
  });

  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.85} style={s.switchWrap}>
      <Feather name="sun" size={15} color={!isDark ? c.primary : c.textMuted} />
      <Animated.View style={[s.switchTrack, { backgroundColor: trackBg, borderColor: c.border }]}>
        <Animated.View style={[s.switchThumb, { backgroundColor: c.primary, transform: [{ translateX: thumbX }] }]}>
          <Feather name={isDark ? 'moon' : 'sun'} size={12} color={c.background} />
        </Animated.View>
      </Animated.View>
      <Feather name="moon" size={15} color={isDark ? c.primary : c.textMuted} />
      <Text style={[s.switchLabel, { color: c.textSecondary }]}>
        {isDark ? 'Koyu' : 'Açık'}
      </Text>
    </TouchableOpacity>
  );
}

function SectionCard({ colors: c, title, children }: { colors: ColorsType; title: string; children: React.ReactNode }) {
  return (
    <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[s.cardTitle, { color: c.textMuted }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function ToggleRow({
  label, description, value, onChange, loading, colors: c,
}: {
  label: string; description: string; value: boolean;
  onChange: (v: boolean) => void; loading?: boolean; colors: ColorsType;
}) {
  return (
    <View style={s.toggleRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.toggleLabel, { color: c.text }]}>{label}</Text>
        <Text style={[s.toggleDesc, { color: c.textSecondary }]}>{description}</Text>
      </View>
      {loading
        ? <ActivityIndicator size="small" color={c.primary} />
        : (
          <Switch
            value={value}
            onValueChange={onChange}
            trackColor={{ false: c.border, true: c.primary + '60' }}
            thumbColor={value ? c.primary : c.textMuted}
          />
        )
      }
    </View>
  );
}

function InfoRow({ label, value, colors: c }: { label: string; value: string; colors: ColorsType }) {
  return (
    <View style={s.infoRow}>
      <Text style={[s.infoLabel, { color: c.text }]}>{label}</Text>
      <Text style={[s.infoValue, { color: c.textSecondary }]}>{value}</Text>
    </View>
  );
}

function TouchableRow({
  label, colors: c, onPress, danger,
}: {
  label: string; colors: ColorsType; onPress: () => void; danger?: boolean;
}) {
  return (
    <TouchableOpacity style={s.touchRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={[s.touchLabel, { color: danger ? c.error : c.text }]}>{label}</Text>
      <Text style={[s.touchArrow, { color: c.textMuted }]}>›</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingTop: 60, gap: Spacing.md, paddingBottom: Spacing.xxl },

  pageHeader: { marginBottom: Spacing.sm, gap: 6 },
  backBtn: { alignSelf: 'flex-start' },
  backText: { fontSize: 15, fontWeight: '600' },
  pageTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },

  // Kart
  card: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: -Spacing.xs,
  },

  // Profil
  avatarRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  avatarText: { fontSize: 24, fontWeight: '700' },

  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    fontSize: 15,
  },
  bioInput: { minHeight: 72, textAlignVertical: 'top', paddingTop: 10 },
  charCount: { fontSize: 10, textAlign: 'right', marginTop: 2 },
  saveBtn: {
    borderRadius: BorderRadius.full,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  sectionHint: { fontSize: 12, lineHeight: 18 },

  // ThemeSwitch
  switchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  switchTrack: {
    width: 88,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Tema seçici
  themeOptions: { flexDirection: 'row', gap: Spacing.sm },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    position: 'relative',
  },
  themeEmoji: { fontSize: 24 },
  themeLabel: { fontSize: 12, fontWeight: '600' },
  themeCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeCheckText: { fontSize: 9, fontWeight: '700' },

  // Önizleme kutusu
  previewBox: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 6,
    alignItems: 'center',
  },
  previewLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  previewRow: { flexDirection: 'row', gap: 8 },
  previewDot: { width: 12, height: 12, borderRadius: 6 },
  previewText: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  previewSubtext: { fontSize: 12 },

  // Toggle satır
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  toggleLabel: { fontSize: 15, fontWeight: '600' },
  toggleDesc: { fontSize: 12 },

  // Bilgi satırı
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  infoLabel: { fontSize: 15 },
  infoValue: { fontSize: 14 },

  // Dokunabilir satır
  touchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  touchLabel: { fontSize: 15 },
  touchArrow: { fontSize: 20 },

  // Şifre formu
  passwordForm: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
    marginTop: -Spacing.xs,
  },
  strengthBarTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.2)',
    overflow: 'hidden',
    marginTop: 4,
    marginBottom: 4,
  },
  strengthBarFill: { height: '100%', borderRadius: 2 },
});
