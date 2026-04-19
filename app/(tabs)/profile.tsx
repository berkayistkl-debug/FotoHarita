import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { supabase, getUserPins, getSavedPins } from '@lib/supabase';
import { useCoins } from '@hooks/useCoins';
import { spendCoins, COIN_COSTS } from '@lib/coins';
import { useTheme } from '../../context/ThemeContext';
import { DarkColors, Spacing, BorderRadius } from '@constants/theme';
import { User, Pin } from '@/types/database';

type C = typeof DarkColors;
type Tab = 'posts' | 'saved';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_SIZE = (SCREEN_W - 2) / 3; // 1px gaps, 3 cols

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [profile, setProfile] = useState<User | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [savedPins, setSavedPins] = useState<Pin[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('posts');
  const [refreshing, setRefreshing] = useState(false);
  const { balance } = useCoins(profile?.id ?? null);

  // Her sekmeye gelişte yenile (mount dahil)
  useFocusEffect(useCallback(() => { loadProfile(); }, []));

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prof } = await supabase
      .from('users').select('*').eq('auth_id', user.id).single();

    if (prof) {
      setProfile(prof);
      const [userPins, saved] = await Promise.all([
        getUserPins(prof.id),
        getSavedPins(prof.id),
      ]);
      setPins(userPins ?? []);
      setSavedPins(saved ?? []);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const handleSpendCoins = async (type: 'feature' | 'frame' | 'special') => {
    if (!profile) return;
    const costs = { feature: COIN_COSTS.FEATURE_PIN_24H, frame: COIN_COSTS.BADGE_FRAME, special: COIN_COSTS.SPECIAL_PIN };
    const labels = { feature: 'Öne Çıkar', frame: 'Rozet Çerçevesi', special: 'Özel Pin' };
    const cost = costs[type];
    Alert.alert(`${labels[type]} — ${cost} Coin`,
      `Bu özellik için ${cost} coin harcanacak. Devam etmek istiyor musun?`,
      [{ text: 'İptal', style: 'cancel' },
       { text: 'Onayla', onPress: async () => {
         try {
           await spendCoins(profile.id, cost, type === 'feature' ? 'feature_pin' : type === 'frame' ? 'badge_frame' : 'special_pin');
           Alert.alert('Başarılı!', `${labels[type]} aktif edildi.`);
         } catch (err: any) { Alert.alert('Hata', err.message); }
       }}]
    );
  };

  if (!profile) return null;

  const totalLikes = pins.reduce((sum, p) => sum + (p.like_count ?? 0), 0);
  const displayPins = activeTab === 'posts' ? pins : savedPins;

  const s = makeStyles(colors);

  return (
    <View style={s.root}>
      {/* Instagram-style top bar */}
      <View style={s.topBar}>
        <View style={{ width: 36 }} />
        <Text style={s.topUsername}>@{profile.username}</Text>
        <TouchableOpacity onPress={() => router.push('/settings')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="menu" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        stickyHeaderIndices={[1]}
      >
        {/* ── Profil bilgi bloğu ── */}
        <View style={s.profileBlock}>
          {/* Avatar + istatistikler — Instagram satırı */}
          <View style={s.statsRow}>
            <View style={[s.avatarRing, { borderColor: colors.primary + '60' }]}>
              <View style={[s.avatarCircle, { backgroundColor: colors.primary + '25' }]}>
                <Text style={[s.avatarInitial, { color: colors.primary }]}>
                  {profile.username[0].toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={s.statsNumbers}>
              <StatItem value={pins.length} label="Gönderi" colors={colors} />
              <StatItem value={totalLikes} label="Beğeni" colors={colors} />
              <StatItem value={balance} label="Coin" colors={colors} coin />
            </View>
          </View>

          {/* Ad + bio */}
          <View style={s.bioBlock}>
            <Text style={s.displayName}>{profile.username}</Text>
            {profile.bio ? (
              <Text style={s.bioText}>{profile.bio}</Text>
            ) : null}
          </View>

          {/* Butonlar */}
          <View style={s.actionRow}>
            <TouchableOpacity
              style={[s.editBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push('/settings')}
            >
              <Text style={[s.editBtnText, { color: colors.text }]}>Profili Düzenle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.coinBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => handleSpendCoins('feature')}
            >
              <Feather name="zap" size={15} color={colors.primary} />
              <Text style={[s.coinBtnText, { color: colors.text }]}>Harca</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Tab bar ── */}
        <View style={[s.tabBar, { backgroundColor: colors.background, borderTopColor: colors.border, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={[s.tab, activeTab === 'posts' && [s.tabActive, { borderBottomColor: colors.text }]]}
            onPress={() => setActiveTab('posts')}
          >
            <Feather name="grid" size={16} color={activeTab === 'posts' ? colors.text : colors.textMuted} />
            <Text style={[s.tabLabel, { color: activeTab === 'posts' ? colors.text : colors.textMuted }]}>
              Gönderiler
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, activeTab === 'saved' && [s.tabActive, { borderBottomColor: colors.text }]]}
            onPress={() => setActiveTab('saved')}
          >
            <Feather name="bookmark" size={16} color={activeTab === 'saved' ? colors.text : colors.textMuted} />
            <Text style={[s.tabLabel, { color: activeTab === 'saved' ? colors.text : colors.textMuted }]}>
              Kaydedilenler
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Fotoğraf ızgarası ── */}
        {displayPins.length === 0 ? (
          <View style={s.emptyState}>
            <Feather
              name={activeTab === 'posts' ? 'camera' : 'bookmark'}
              size={42}
              color={colors.border}
            />
            <Text style={[s.emptyTitle, { color: colors.text }]}>
              {activeTab === 'posts' ? 'Henüz gönderi yok' : 'Henüz kaydedilen gönderi yok'}
            </Text>
            <Text style={[s.emptySubtitle, { color: colors.textMuted }]}>
              {activeTab === 'posts'
                ? 'Kamerana sarıl ve ilk fotoğrafını paylaş.'
                : 'Beğendiğin gönderileri kaydet, burada görünsün.'}
            </Text>
          </View>
        ) : (
          <View style={s.grid}>
            {displayPins.map((pin, i) => (
              <TouchableOpacity
                key={pin.id}
                style={s.gridItem}
                onPress={() => router.push(`/pin/${pin.id}` as any)}
                activeOpacity={0.9}
              >
                <Image
                  source={{ uri: pin.photo_url }}
                  style={s.gridImage}
                  resizeMode="cover"
                />
                {/* Çoklu fotoğraf ikonu */}
                {pin.photo_urls?.length > 1 && (
                  <View style={s.multiIcon}>
                    <Feather name="layers" size={12} color="#fff" />
                  </View>
                )}
                {/* İncelemede overlay */}
                {pin.moderation_status === 'pending' && (
                  <View style={s.pendingOverlay}>
                    <Feather name="clock" size={14} color="#f59e0b" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

function StatItem({ value, label, colors, coin }: { value: number; label: string; colors: C; coin?: boolean }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, letterSpacing: -0.4 }}>
        {coin ? value.toLocaleString('tr-TR') : value >= 1000 ? `${(value / 1000).toFixed(1)}B` : value}
      </Text>
      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function makeStyles(c: C) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },

    // Top bar
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 56,
      paddingBottom: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      backgroundColor: c.background,
    },
    topUsername: { fontSize: 16, fontWeight: '700', color: c.text, letterSpacing: -0.3 },

    // Profil bloğu
    profileBlock: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
      gap: Spacing.md,
    },

    // Avatar + stats satırı
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.lg,
    },
    avatarRing: {
      padding: 2,
      borderRadius: 45,
      borderWidth: 2,
    },
    avatarCircle: {
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: { fontSize: 32, fontWeight: '700' },

    statsNumbers: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-around',
    },

    // Bio
    bioBlock: { gap: 3 },
    displayName: { fontSize: 14, fontWeight: '700', color: c.text },
    bioText: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },

    // Aksiyon butonları
    actionRow: { flexDirection: 'row', gap: Spacing.sm },
    editBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editBtnText: { fontSize: 13, fontWeight: '600' },
    coinBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
    },
    coinBtnText: { fontSize: 13, fontWeight: '600' },

    // Highlights (rozetler)
    highlights: {
      borderTopWidth: 0.5,
      borderTopColor: c.border,
      paddingVertical: Spacing.md,
    },
    highlightsContent: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
    highlight: { alignItems: 'center', gap: 6, width: 66 },
    highlightRing: { padding: 2, borderRadius: 36, borderWidth: 1.5 },
    highlightCircle: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
    },
    highlightEmoji: { fontSize: 24 },
    highlightLabel: { fontSize: 11, textAlign: 'center' },

    // Tab bar
    tabBar: {
      flexDirection: 'row',
      width: '100%',
      borderTopWidth: 0.5,
      borderBottomWidth: 0.5,
    },
    tab: {
      width: '50%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      gap: 6,
      borderBottomWidth: 1.5,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomWidth: 1.5,
    },
    tabLabel: {
      fontSize: 13,
      fontWeight: '600',
    },

    // Grid
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 1,
    },
    gridItem: {
      width: GRID_SIZE,
      height: GRID_SIZE,
      backgroundColor: c.surface,
    },
    gridImage: { width: '100%', height: '100%' },
    multiIcon: {
      position: 'absolute',
      top: 6,
      right: 6,
    },
    pendingOverlay: {
      position: 'absolute',
      bottom: 6,
      right: 6,
    },

    // Boş durum
    emptyState: {
      alignItems: 'center',
      paddingVertical: 60,
      paddingHorizontal: Spacing.xl,
      gap: Spacing.md,
    },
    emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
    emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  });
}
