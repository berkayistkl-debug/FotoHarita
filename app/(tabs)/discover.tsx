import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Dimensions,
  Text,
  TouchableOpacity,
  Share,
  Linking,
  RefreshControl,
  ViewToken,
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  supabase,
  getDiscoverFeed,
  getPinById,
  togglePinLike,
  toggleSavePin,
  getNearbyPins,
  NearbyPin,
} from '@lib/supabase';
import { calculateFeedScore, applyDiversityFilter } from '@lib/feedScore';
import { useLocation } from '@hooks/useLocation';
import { DiscoverCard } from '@components/discover/DiscoverCard';
import { SearchOverlay } from '@components/ui/SearchOverlay';
import { CATEGORIES } from '@constants/categories';
import { Colors, Spacing, BorderRadius, Shadows } from '@constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { Pin } from '@/types/database';

const { height: SCREEN_H } = Dimensions.get('window');
const PAGE_SIZE = 20;

type DiscoverTab = 'kesfet' | 'takip';

function nearbyToPin(n: NearbyPin): Pin {
  return {
    id: n.id,
    user_id: n.user_id,
    location_id: n.location_id,
    photo_url: n.photo_url,
    photo_urls: n.photo_urls?.length > 0 ? n.photo_urls : [n.photo_url],
    caption: n.caption,
    location_name: n.location_name,
    gps_verified: false,
    upload_lat: null,
    upload_lng: null,
    moderation_status: 'approved',
    aspect_ratio: (n.aspect_ratio as '4:3' | '16:9') ?? '4:3',
    like_count: n.like_count,
    comment_count: n.comment_count,
    view_count: n.view_count ?? 0,
    created_at: n.created_at,
    user: {
      id: n.user_id,
      username: n.username,
      avatar_url: n.avatar_url,
      bio: null,
      coin_balance: 0,
      created_at: n.created_at,
    },
    location: {
      id: n.location_id,
      google_place_id: null,
      name: n.location_name,
      address: null,
      lat: n.lat,
      lng: n.lng,
      category: n.category,
      created_at: n.created_at,
    },
  };
}

export default function DiscoverScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { lat, lng } = useLocation();

  const params = useLocalSearchParams<{
    origin_pin_id?: string;
    origin_lat?: string;
    origin_lng?: string;
  }>();

  const originPinId = params.origin_pin_id ?? null;
  const originLat = params.origin_lat ? parseFloat(params.origin_lat) : null;
  const originLng = params.origin_lng ? parseFloat(params.origin_lng) : null;
  const isOriginMode = !!originPinId;

  const [discoverTab, setDiscoverTab] = useState<DiscoverTab>('kesfet');
  const [pins, setPins] = useState<Pin[]>([]);
  const [page, setPage] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const sortedNearby = useRef<Pin[]>([]);
  const prevOriginId = useRef<string | null>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const loadingRef = useRef(false);

  // Profil ID'sini al (auth_id değil, users.id)
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: prof } = await supabase
        .from('users').select('id').eq('auth_id', data.user.id).single();
      if (prof) setProfileId(prof.id);
    });
  }, []);

  // --- Origin modu ---
  const loadOriginFeed = useCallback(async (pinId: string, oLat: number, oLng: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const [originPin, nearby] = await Promise.all([
        getPinById(pinId),
        getNearbyPins(oLat, oLng, pinId, 50),
      ]);
      const scored = nearby
        .map((n) => ({ ...n, feedScore: calculateFeedScore(n) }))
        .sort((a, b) => b.feedScore - a.feedScore);
      const diverse = applyDiversityFilter(scored, 2);
      sortedNearby.current = diverse.map(nearbyToPin);
      const firstPage = sortedNearby.current.slice(0, PAGE_SIZE - 1);
      setPins([originPin as Pin, ...firstPage]);
      setPage(1);
    } catch (e) {
      console.warn('Origin feed hatası:', e);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  // --- Normal mod ---
  const loadNormalFeed = useCallback(async (reset = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    const currentPage = reset ? 0 : page;
    try {
      const data = await getDiscoverFeed(
        lat ?? 41.0082,
        lng ?? 28.9784,
        selectedCategory ?? undefined,
        50,
        currentPage
      );
      if (data) {
        const filtered = reset
          ? data
          : data.filter((p: Pin) => !seenIds.current.has(p.id));
        setPins((prev) => (reset ? filtered : [...prev, ...filtered]));
        setPage(currentPage + 1);
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [lat, lng, selectedCategory, page]);

  // Pull-to-refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    seenIds.current.clear();
    if (isOriginMode && originPinId && originLat && originLng) {
      await loadOriginFeed(originPinId, originLat, originLng);
    } else {
      await loadNormalFeed(true);
    }
    setRefreshing(false);
  };

  // Origin değişince yükle
  useEffect(() => {
    if (isOriginMode && originPinId && originLat && originLng) {
      if (originPinId !== prevOriginId.current) {
        prevOriginId.current = originPinId;
        sortedNearby.current = [];
        setPins([]);
        setPage(0);
        loadOriginFeed(originPinId, originLat, originLng);
      }
    } else if (!isOriginMode) {
      prevOriginId.current = null;
    }
  }, [originPinId]);

  // Normal mod kategori/tab değişince
  useEffect(() => {
    if (!isOriginMode) {
      seenIds.current.clear();
      setPins([]);
      setPage(0);
      loadNormalFeed(true);
    }
  }, [selectedCategory, discoverTab, isOriginMode]);

  // Her ekrana gelindiğinde yenile
  useFocusEffect(
    useCallback(() => {
      if (!isOriginMode) {
        seenIds.current.clear();
        loadNormalFeed(true);
      }
    }, [isOriginMode, discoverTab, selectedCategory, loadNormalFeed])
  );

  // Infinite scroll
  const handleEndReached = () => {
    if (isOriginMode) {
      const start = (page - 1) * PAGE_SIZE + (PAGE_SIZE - 1);
      const slice = sortedNearby.current.slice(start, start + PAGE_SIZE);
      if (slice.length > 0) {
        setPins((prev) => [...prev, ...slice]);
        setPage((p) => p + 1);
      }
    } else {
      loadNormalFeed(false);
    }
  };

  // Görüntülenen öğeleri "görüldü" olarak işaretle
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      viewableItems.forEach(({ item }) => {
        if (item?.id) seenIds.current.add(item.id);
      });
    }
  ).current;

  const handleLike = async (pin: Pin) => {
    if (!profileId) return;
    const isLiked = likedIds.has(pin.id);
    setLikedIds((prev) => {
      const next = new Set(prev);
      isLiked ? next.delete(pin.id) : next.add(pin.id);
      return next;
    });
    await togglePinLike(pin.id, profileId, !isLiked);
  };

  const handleSave = async (pin: Pin) => {
    if (!profileId) return;
    const isSaved = savedIds.has(pin.id);
    setSavedIds((prev) => {
      const next = new Set(prev);
      isSaved ? next.delete(pin.id) : next.add(pin.id);
      return next;
    });
    await toggleSavePin(pin.id, profileId, !isSaved);
  };

  const handleTabSwitch = (tab: DiscoverTab) => {
    if (tab === discoverTab) {
      // Aynı tab'a basılınca yenile
      seenIds.current.clear();
      setPins([]);
      setPage(0);
      loadNormalFeed(true);
      return;
    }
    setDiscoverTab(tab);
    setSelectedCategory(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Arama çubuğu — normal modda üst kısımda */}
      {!isOriginMode && (
        <SearchOverlay
          colors={colors}
          placeholder="Kullanıcı veya mekan ara..."
          style={styles.searchBar}
          onSelectUser={(userId) => router.push(`/user/${userId}` as any)}
          onSelectPlace={(_placeId, _name, placeLat, placeLng) => {
            router.navigate({
              pathname: '/(tabs)/index',
              params: { focus_lat: String(placeLat), focus_lng: String(placeLng) },
            } as any);
          }}
        />
      )}

      {/* Takip / Keşfet tab switcher — sadece normal modda */}
      {!isOriginMode && (
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              discoverTab === 'kesfet' && { borderBottomColor: colors.text, borderBottomWidth: 2 },
            ]}
            onPress={() => handleTabSwitch('kesfet')}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.tabBtnText,
              { color: discoverTab === 'kesfet' ? colors.text : colors.textMuted },
            ]}>
              Keşfet
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              discoverTab === 'takip' && { borderBottomColor: colors.text, borderBottomWidth: 2 },
            ]}
            onPress={() => handleTabSwitch('takip')}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.tabBtnText,
              { color: discoverTab === 'takip' ? colors.text : colors.textMuted },
            ]}>
              Takip
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Takip boş durumu */}
      {!isOriginMode && discoverTab === 'takip' && (
        <View style={styles.emptyTab}>
          <Text style={styles.emptyEmoji}>👥</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Takip özelliği çok yakında</Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>
            Takip ettiğin kullanıcıların fotoğrafları burada çıkacak.
          </Text>
        </View>
      )}

      {/* Filtrele butonu — Keşfet modunda */}
      {!isOriginMode && discoverTab === 'kesfet' && (
        <TouchableOpacity
          style={[styles.filterBtn, { backgroundColor: selectedCategory ? colors.primary + '20' : colors.surface, borderColor: selectedCategory ? colors.primary : colors.border }]}
          onPress={() => setShowFilterModal(true)}
          activeOpacity={0.8}
        >
          <Feather name="sliders" size={13} color={selectedCategory ? colors.primary : colors.textMuted} />
          <Text style={[styles.filterBtnText, { color: selectedCategory ? colors.primary : colors.textMuted }]}>
            {selectedCategory ? CATEGORIES.find(c => c.key === selectedCategory)?.label ?? 'Filtrele' : 'Filtrele'}
          </Text>
          {selectedCategory && (
            <TouchableOpacity onPress={() => setSelectedCategory(null)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Feather name="x" size={12} color={colors.primary} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      )}

      {/* Kategori filtre modal */}
      <Modal visible={showFilterModal} transparent animationType="slide" onRequestClose={() => setShowFilterModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowFilterModal(false)} />
        <View style={[styles.filterSheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.filterHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.filterSheetTitle, { color: colors.text }]}>Kategori Seç</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.filterSheetContent}>
            <TouchableOpacity
              style={[styles.filterRow, !selectedCategory && { backgroundColor: colors.primary + '15' }]}
              onPress={() => { setSelectedCategory(null); setShowFilterModal(false); }}
              activeOpacity={0.7}
            >
              <Text style={styles.filterRowEmoji}>✨</Text>
              <Text style={[styles.filterRowLabel, { color: !selectedCategory ? colors.primary : colors.text }]}>Tümü</Text>
              {!selectedCategory && <Feather name="check" size={16} color={colors.primary} />}
            </TouchableOpacity>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[styles.filterRow, selectedCategory === cat.key && { backgroundColor: cat.color + '15' }]}
                onPress={() => { setSelectedCategory(cat.key); setShowFilterModal(false); }}
                activeOpacity={0.7}
              >
                <Text style={styles.filterRowEmoji}>{cat.emoji}</Text>
                <Text style={[styles.filterRowLabel, { color: selectedCategory === cat.key ? cat.color : colors.text }]}>{cat.label}</Text>
                {selectedCategory === cat.key && <Feather name="check" size={16} color={cat.color} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Feed */}
      {(discoverTab === 'kesfet' || isOriginMode) && (
        <FlatList
          data={pins}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={SCREEN_H}
          decelerationRate="fast"
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item }) => (
            <DiscoverCard
              pin={item}
              isLiked={likedIds.has(item.id)}
              isSaved={savedIds.has(item.id)}
              onLike={() => handleLike(item)}
              onSave={() => handleSave(item)}
              onShare={() => {
                Share.share({
                  message: `FotoHarita'da bu yeri keşfettim: ${item.location?.name ?? 'Çekim noktası'}\nhttps://fotohrita.com/pin/${item.id}`,
                });
              }}
              onNavigate={() => {
                const pLat = item.location?.lat;
                const pLng = item.location?.lng;
                if (pLat && pLng) {
                  Linking.openURL(
                    `https://www.google.com/maps/dir/?api=1&destination=${pLat},${pLng}`
                  );
                }
              }}
              onUserPress={() => {
                if (item.user?.id) router.push(`/user/${item.user.id}` as any);
              }}
              onPress={() => router.push(`/pin/${item.id}` as any)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  searchBar: {
    position: 'absolute',
    top: 52,
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  // Tab switcher — TikTok stili, üst orta
  tabSwitcher: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 108,
    backgroundColor: 'transparent',
  },
  tabBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  // Filtrele butonu
  filterBtn: {
    position: 'absolute',
    top: 148,
    left: Spacing.md,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterBtnText: { fontSize: 12, fontWeight: '600' },

  // Filtre modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  filterSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  filterHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  filterSheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    letterSpacing: -0.3,
  },
  filterSheetContent: { paddingHorizontal: Spacing.md, paddingBottom: 16 },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: 2,
  },
  filterRowEmoji: { fontSize: 20, width: 28, textAlign: 'center' },
  filterRowLabel: { flex: 1, fontSize: 15, fontWeight: '500' },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 2,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    ...Shadows.primary,
    shadowOpacity: 0.25,
  },
  chipEmoji: { fontSize: 13 },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: Colors.background },

  // Takip boş durum
  emptyTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
