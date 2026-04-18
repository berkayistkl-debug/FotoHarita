import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@constants/theme';
import { Button } from '@components/ui/Button';
import { TURKISH_CITIES } from '@lib/gps';

type PermissionStatus = 'idle' | 'granted' | 'denied';

interface PermissionItem {
  key: string;
  icon: string;
  title: string;
  description: string;
  required: boolean;
  status: PermissionStatus;
}

export default function PermissionsScreen() {
  const router = useRouter();
  const [showCityFallback, setShowCityFallback] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const [permissions, setPermissions] = useState<PermissionItem[]>([
    {
      key: 'location',
      icon: '📍',
      title: 'Konum',
      description: 'Yakınındaki fotoğraf noktalarını görmek için konumuna ihtiyacımız var. Sadece uygulama açıkken kullanılır.',
      required: true,
      status: 'idle',
    },
    {
      key: 'camera',
      icon: '📷',
      title: 'Kamera',
      description: 'Doğrudan uygulama içinden fotoğraf çekebilmek için.',
      required: false,
      status: 'idle',
    },
    {
      key: 'gallery',
      icon: '🖼️',
      title: 'Galeri',
      description: 'Telefonundaki fotoğrafları yükleyebilmek için.',
      required: false,
      status: 'idle',
    },
    {
      key: 'notifications',
      icon: '🔔',
      title: 'Bildirimler',
      description: 'Yakınında yeni çekim noktası eklendiğinde ve coin kazandığında haber verelim.',
      required: false,
      status: 'idle',
    },
  ]);

  const updateStatus = (key: string, status: PermissionStatus) => {
    setPermissions((prev) => prev.map((p) => (p.key === key ? { ...p, status } : p)));
  };

  const requestPermission = async (key: string) => {
    if (key === 'location') {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        updateStatus('location', 'granted');
      } else {
        updateStatus('location', 'denied');
        setShowCityFallback(true);
      }
    } else if (key === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      updateStatus('camera', status === 'granted' ? 'granted' : 'denied');
    } else if (key === 'gallery') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      updateStatus('gallery', status === 'granted' ? 'granted' : 'denied');
    } else if (key === 'notifications') {
      const { status } = await Notifications.requestPermissionsAsync();
      updateStatus('notifications', status === 'granted' ? 'granted' : 'denied');
    }
  };

  const handleContinue = async () => {
    await SecureStore.setItemAsync('onboarding_done', 'true');
    if (selectedCity) await SecureStore.setItemAsync('selected_city', selectedCity);
    router.replace('/(auth)/login');
  };

  const allRequiredHandled = permissions
    .filter((p) => p.required)
    .every((p) => p.status !== 'idle');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headSection}>
        <Text style={styles.title}>İzinler</Text>
        <Text style={styles.subtitle}>
          Daha iyi bir deneyim için birkaç izne ihtiyacımız var.
        </Text>
      </View>

      {permissions.map((perm) => (
        <View key={perm.key} style={styles.permCard}>
          <View style={styles.permHeader}>
            <View style={styles.permIconWrap}>
              <Text style={styles.permIcon}>{perm.icon}</Text>
            </View>
            <View style={styles.permInfo}>
              <View style={styles.permTitleRow}>
                <Text style={styles.permTitle}>{perm.title}</Text>
                {perm.required && (
                  <View style={styles.requiredBadge}>
                    <Text style={styles.requiredText}>Zorunlu</Text>
                  </View>
                )}
              </View>
              <Text style={styles.permDesc}>{perm.description}</Text>
            </View>
          </View>

          {perm.status === 'idle' && (
            <Button
              title="İzin Ver"
              onPress={() => requestPermission(perm.key)}
              variant="secondary"
              size="sm"
              style={styles.permBtn}
            />
          )}
          {perm.status === 'granted' && (
            <View style={styles.grantedBadge}>
              <Text style={styles.grantedText}>✓ Verildi</Text>
            </View>
          )}
          {perm.status === 'denied' && (
            <View style={styles.deniedBadge}>
              <Text style={styles.deniedText}>Reddedildi</Text>
            </View>
          )}
        </View>
      ))}

      {showCityFallback && (
        <View style={styles.cityCard}>
          <Text style={styles.cityTitle}>Şehir Seç</Text>
          <Text style={styles.citySubtitle}>
            Konum izni olmadan şehir bazlı içerik gösterebiliriz.
          </Text>
          <View style={styles.cityList}>
            {TURKISH_CITIES.map((city) => (
              <TouchableOpacity
                key={city.name}
                onPress={() => setSelectedCity(city.name)}
                activeOpacity={0.8}
                style={[
                  styles.cityBtn,
                  selectedCity === city.name && styles.cityBtnActive,
                ]}
              >
                <Text style={[styles.cityName, selectedCity === city.name && styles.cityNameActive]}>
                  {city.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <Button
        title="Devam Et"
        onPress={handleContinue}
        size="lg"
        disabled={!allRequiredHandled && !showCityFallback}
        style={styles.continueBtn}
      />

      <TouchableOpacity onPress={handleContinue} style={styles.skipBtn}>
        <Text style={styles.skipText}>Şimdilik Atla</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: 72, paddingBottom: Spacing.xxl, gap: Spacing.md },

  headSection: { gap: 6, marginBottom: Spacing.sm },
  title: { ...Typography.h1 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22 },

  permCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  permHeader: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  permIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  permIcon: { fontSize: 22 },
  permInfo: { flex: 1, gap: 4 },
  permTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  permTitle: { fontSize: 16, fontWeight: '600', color: Colors.text },
  permDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  requiredBadge: {
    backgroundColor: Colors.primary + '18',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  requiredText: { fontSize: 10, color: Colors.primary, fontWeight: '700', letterSpacing: 0.5 },
  permBtn: { alignSelf: 'flex-end' },
  grantedBadge: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.success + '18',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  grantedText: { fontSize: 13, color: Colors.success, fontWeight: '600' },
  deniedBadge: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.error + '18',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  deniedText: { fontSize: 13, color: Colors.error, fontWeight: '600' },

  cityCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cityTitle: { ...Typography.h3 },
  citySubtitle: { fontSize: 13, color: Colors.textSecondary },
  cityList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  cityBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  cityBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  cityName: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  cityNameActive: { color: Colors.background, fontWeight: '700' },

  continueBtn: { marginTop: Spacing.md },
  skipBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  skipText: { color: Colors.textMuted, fontSize: 14 },
});
