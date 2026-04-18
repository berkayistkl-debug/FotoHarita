import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { supabase, getUserPins, getUserBadges } from '@lib/supabase';
import { useTheme } from '../../context/ThemeContext';
import { DarkColors, Spacing, BorderRadius, Shadows } from '@constants/theme';
import { BadgeShelf } from '@components/ui/BadgeShelf';
import { User, Pin } from '@/types/database';

type C = typeof DarkColors;

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [profile, setProfile] = useState<User | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [badges, setBadges] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);

    const { data: prof } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (prof) {
      setProfile(prof);
      const [userPins, userBadges] = await Promise.all([
        getUserPins(prof.id),
        getUserBadges(prof.id),
      ]);
      setPins(userPins ?? []);
      setBadges((userBadges ?? []).map((b: any) => b.badge_key));
    }

    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading || !profile) {
    return (
      <View style={s.center}>
        <Text style={s.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  const totalLikes = pins.reduce((sum, p) => sum + (p.like_count ?? 0), 0);

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Geri butonu */}
      <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
        <Feather name="arrow-left" size={20} color={colors.primary} />
        <Text style={s.backText}>Geri</Text>
      </TouchableOpacity>

      {/* Profil başlığı */}
      <View style={s.headerCard}>
        <View style={s.avatarWrap}>
          <View style={[s.avatarRing, { borderColor: colors.primary }]}>
            <View style={[s.avatarCircle, { backgroundColor: colors.primary + '30' }]}>
              <Text style={[s.avatarText, { color: colors.primary }]}>
                {profile.username[0].toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <Text style={s.username}>@{profile.username}</Text>
        {profile.bio ? (
          <Text style={s.bio}>{profile.bio}</Text>
        ) : (
          <Text style={s.bioEmpty}>Henüz biyografi yok</Text>
        )}

        <View style={s.statsRow}>
          <StatItem label="Pin" value={pins.length} colors={colors} />
          <View style={s.statDivider} />
          <StatItem label="Beğeni" value={totalLikes} colors={colors} />
          <View style={s.statDivider} />
          <StatItem label="Rozet" value={badges.length} colors={colors} />
        </View>
      </View>

      {/* Rozetler */}
      {badges.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Rozetler</Text>
          <BadgeShelf earnedKeys={badges} />
        </View>
      )}

      {/* Pin grid */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Pinler ({pins.length})</Text>
        {pins.length === 0 ? (
          <View style={s.emptyPins}>
            <Feather name="camera-off" size={36} color={colors.textMuted} />
            <Text style={s.emptyText}>Henüz pin yok</Text>
          </View>
        ) : (
          <View style={s.pinGrid}>
            {pins.map((pin) => (
              <TouchableOpacity
                key={pin.id}
                style={s.pinGridItem}
                onPress={() => router.push(`/pin/${pin.id}`)}
                activeOpacity={0.85}
              >
                <Image source={{ uri: pin.photo_url }} style={s.pinGridImage} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={{ height: Spacing.xl }} />
    </ScrollView>
  );
}

function StatItem({ label, value, colors }: { label: string; value: number; colors: C }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.5 }}>
        {value.toLocaleString('tr-TR')}
      </Text>
      <Text style={{ fontSize: 11, color: colors.textMuted, letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
}

const GRID_GAP = 2;
const GRID_COLS = 3;

function makeStyles(c: C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
    loadingText: { color: c.textSecondary },

    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.lg,
      paddingTop: 56,
      paddingBottom: Spacing.sm,
    },
    backText: { fontSize: 15, fontWeight: '600', color: c.primary },

    headerCard: {
      backgroundColor: c.surface,
      borderBottomLeftRadius: BorderRadius.xl,
      borderBottomRightRadius: BorderRadius.xl,
      paddingBottom: Spacing.xl,
      paddingTop: Spacing.md,
      alignItems: 'center',
      gap: Spacing.sm,
      borderBottomWidth: 1,
      borderColor: c.border,
      ...Shadows.md,
      shadowColor: c.background,
      shadowOffset: { width: 0, height: 6 },
    },

    avatarWrap: { marginBottom: 4 },
    avatarRing: {
      padding: 3,
      borderRadius: 44,
      borderWidth: 2,
      ...Shadows.primary,
      shadowColor: c.primary,
      shadowOpacity: 0.3,
    },
    avatarCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 30, fontWeight: '700' },

    username: { fontSize: 18, fontWeight: '700', color: c.text, letterSpacing: -0.3 },
    bio: { fontSize: 13, color: c.textSecondary, textAlign: 'center', paddingHorizontal: Spacing.xl },
    bioEmpty: { fontSize: 13, color: c.textMuted, fontStyle: 'italic' },

    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.sm,
      paddingHorizontal: Spacing.xl,
    },
    statDivider: { width: 1, height: 32, backgroundColor: c.border },

    section: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.md },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: c.text, letterSpacing: -0.3 },

    emptyPins: {
      alignItems: 'center',
      paddingVertical: Spacing.xl,
      gap: Spacing.sm,
      backgroundColor: c.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: c.border,
    },
    emptyText: { fontSize: 14, color: c.textSecondary },

    pinGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
    pinGridItem: {
      width: `${(100 - (GRID_COLS - 1) * GRID_GAP / 3.5) / GRID_COLS}%` as any,
      aspectRatio: 1,
      borderRadius: BorderRadius.sm,
      overflow: 'hidden',
      backgroundColor: c.surface,
    },
    pinGridImage: { width: '100%', height: '100%' },
  });
}
