import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  Share,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker, Region } from 'react-native-maps';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { Spacing, BorderRadius } from '@constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useLocation } from '@hooks/useLocation';
import { usePins } from '@hooks/usePins';
import { PinMarker } from '@components/map/PinMarker';
import { ClusterMarker } from '@components/map/ClusterMarker';
import { MapControls } from '@components/map/MapControls';
import { SearchOverlay } from '@components/ui/SearchOverlay';
import { supabase, getPinsByLocation, togglePinLike, toggleSavePin } from '@lib/supabase';
import { MapPin, Pin } from '@/types/database';
import Supercluster from 'supercluster';

const DEFAULT_CENTER = { lat: 41.0082, lng: 28.9784 };
const ANIMATE_DURATION_MS = 800;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function MapScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const mapRef = useRef<MapView>(null);
  const { lat, lng, permissionGranted } = useLocation();
  const { pins, loading, loadPins } = usePins();

  const [activeLayer, setActiveLayer] = useState<'all' | 'nearby' | 'following'>('all');
  const [clusters, setClusters] = useState<any[]>([]);

  // Bottom sheet state
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetPins, setSheetPins] = useState<Pin[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetLocationName, setSheetLocationName] = useState('');
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [profileId, setProfileId] = useState<string | null>(null);

  const clusterIndex = useRef<Supercluster | null>(null);
  const hasAnimatedToUser = useRef(false);
  const regionDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRegion = useRef<Region | null>(null);

  // Profil ID
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: prof } = await supabase
        .from('users').select('id').eq('auth_id', data.user.id).single();
      if (prof) setProfileId(prof.id);
    });
  }, []);

  // Kullanıcı konumu ilk kez gelince haritayı oraya taşı
  useEffect(() => {
    if (lat && lng && !hasAnimatedToUser.current) {
      hasAnimatedToUser.current = true;
      mapRef.current?.animateToRegion(
        { latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        ANIMATE_DURATION_MS
      );
    }
  }, [lat, lng]);

  // Pinler güncellenince cluster index'i yeniden yükle + mevcut region için cluster'ları güncelle
  useEffect(() => {
    if (pins.length === 0) return;
    const index = new Supercluster({ radius: 60, maxZoom: 16 });
    index.load(
      pins.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { pin: p },
      }))
    );
    clusterIndex.current = index;

    // Mevcut region için hemen cluster'ları güncelle
    if (currentRegion.current) {
      const r = currentRegion.current;
      const zoomEst = Math.round(Math.log(360 / r.latitudeDelta) / Math.LN2);
      const bbox: [number, number, number, number] = [
        r.longitude - r.longitudeDelta / 2,
        r.latitude - r.latitudeDelta / 2,
        r.longitude + r.longitudeDelta / 2,
        r.latitude + r.latitudeDelta / 2,
      ];
      setClusters(index.getClusters(bbox, zoomEst));
    }
  }, [pins]);

  const handleRegionChange = useCallback(
    (region: Region) => {
      currentRegion.current = region;
      const zoomEst = Math.round(Math.log(360 / region.latitudeDelta) / Math.LN2);

      // Hemen mevcut veriden cluster güncelle (titreme yok)
      if (clusterIndex.current) {
        const bbox: [number, number, number, number] = [
          region.longitude - region.longitudeDelta / 2,
          region.latitude - region.latitudeDelta / 2,
          region.longitude + region.longitudeDelta / 2,
          region.latitude + region.latitudeDelta / 2,
        ];
        setClusters(clusterIndex.current.getClusters(bbox, zoomEst));
      }

      // DB fetch'i debounce et
      if (regionDebounce.current) clearTimeout(regionDebounce.current);
      regionDebounce.current = setTimeout(() => {
        loadPins(
          {
            minLat: region.latitude - region.latitudeDelta / 2,
            minLng: region.longitude - region.longitudeDelta / 2,
            maxLat: region.latitude + region.latitudeDelta / 2,
            maxLng: region.longitude + region.longitudeDelta / 2,
          },
          zoomEst
        );
      }, 500);
    },
    [loadPins]
  );

  const handleRecenter = () => {
    if (lat && lng) {
      mapRef.current?.animateToRegion({
        latitude: lat, longitude: lng,
        latitudeDelta: 0.02, longitudeDelta: 0.02,
      });
    }
  };

  const handleLayerChange = (layer: 'all' | 'nearby' | 'following') => {
    setActiveLayer(layer);
    if (layer === 'nearby') {
      if (lat && lng) {
        mapRef.current?.animateToRegion({
          latitude: lat, longitude: lng,
          latitudeDelta: 0.01, longitudeDelta: 0.01,
        });
      } else {
        Alert.alert('Konum Gerekli', 'Yakın filtresini kullanmak için konum iznine ihtiyaç var.');
      }
    } else if (layer === 'following') {
      Alert.alert('Yakında', 'Takip ettiğin kullanıcıların pinlerini gösterme özelliği geliyor.');
      setActiveLayer('all');
    }
  };

  const handlePinPress = async (pin: MapPin) => {
    setSheetLocationName(pin.location_name ?? '');
    setSheetVisible(true);
    setSheetLoading(true);
    try {
      const data = await getPinsByLocation(pin.location_id);
      setSheetPins((data ?? []) as Pin[]);
    } catch {
      setSheetPins([]);
    } finally {
      setSheetLoading(false);
    }
  };

  const handleLike = async (pin: Pin) => {
    if (!profileId) return;
    const isLiked = likedIds.has(pin.id);
    setLikedIds(prev => {
      const next = new Set(prev);
      isLiked ? next.delete(pin.id) : next.add(pin.id);
      return next;
    });
    await togglePinLike(pin.id, profileId, !isLiked);
  };

  const handleSave = async (pin: Pin) => {
    if (!profileId) return;
    const isSaved = savedIds.has(pin.id);
    setSavedIds(prev => {
      const next = new Set(prev);
      isSaved ? next.delete(pin.id) : next.add(pin.id);
      return next;
    });
    await toggleSavePin(pin.id, profileId, !isSaved);
  };

  const s = makeStyles(colors);

  return (
    <View style={s.container}>
      {/* Arama çubuğu */}
      <SearchOverlay
        colors={colors}
        placeholder="Kullanıcı veya mekan ara..."
        style={s.searchBar}
        onSelectUser={(userId) => router.push(`/user/${userId}` as any)}
        onSelectPlace={(_placeId, _name, placeLat, placeLng) => {
          mapRef.current?.animateToRegion({
            latitude: placeLat, longitude: placeLng,
            latitudeDelta: 0.01, longitudeDelta: 0.01,
          }, 600);
        }}
      />

      <MapView
        ref={mapRef}
        style={s.map}
        initialRegion={{
          latitude: lat ?? DEFAULT_CENTER.lat,
          longitude: lng ?? DEFAULT_CENTER.lng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onRegionChangeComplete={handleRegionChange}
        showsUserLocation={permissionGranted === true}
        customMapStyle={isDark ? darkMapStyle : lightMapStyle}
      >
        {clusters.map((feature) => {
          const [fLng, fLat] = feature.geometry.coordinates;
          const isCluster = feature.properties.cluster;

          if (isCluster) {
            return (
              <Marker
                key={`cluster-${feature.properties.cluster_id}`}
                coordinate={{ latitude: fLat, longitude: fLng }}
              >
                <ClusterMarker
                  count={feature.properties.point_count}
                  photos={[]}
                  onPress={() => {
                    mapRef.current?.animateToRegion({
                      latitude: fLat, longitude: fLng,
                      latitudeDelta: 0.01, longitudeDelta: 0.01,
                    });
                  }}
                />
              </Marker>
            );
          }

          const pin: MapPin = feature.properties.pin;
          return (
            <Marker
              key={pin.id}
              coordinate={{ latitude: fLat, longitude: fLng }}
              tracksViewChanges={false}
            >
              <PinMarker pin={pin} onPress={handlePinPress} />
            </Marker>
          );
        })}
      </MapView>

      <MapControls
        colors={colors}
        onRecenter={handleRecenter}
        activeLayer={activeLayer}
        onLayerChange={handleLayerChange}
      />

      {loading && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator color={colors.primary} size="small" />
        </View>
      )}

      {/* Pin Bottom Sheet */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetVisible(false)}
      >
        <TouchableOpacity
          style={s.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setSheetVisible(false)}
        />
        <View style={[s.sheet, { backgroundColor: colors.surface }]}>
          {/* Handle */}
          <View style={[s.sheetHandle, { backgroundColor: colors.border }]} />

          {/* Başlık */}
          <View style={s.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[s.sheetTitle, { color: colors.text }]} numberOfLines={1}>
                {sheetLocationName || 'Çekim Noktası'}
              </Text>
              {sheetPins.length > 0 && (
                <Text style={[s.sheetCount, { color: colors.textMuted }]}>
                  {sheetPins.length} fotoğraf
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={() => setSheetVisible(false)} style={s.sheetClose}>
              <Feather name="x" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* İçerik */}
          {sheetLoading ? (
            <View style={s.sheetCenter}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : sheetPins.length === 0 ? (
            <View style={s.sheetCenter}>
              <Text style={{ color: colors.textMuted }}>Fotoğraf bulunamadı</Text>
            </View>
          ) : (
            <FlatList
              data={sheetPins}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={s.sheetList}
              snapToInterval={CARD_W + 12}
              decelerationRate="fast"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.card, { backgroundColor: colors.background }]}
                  activeOpacity={0.95}
                  onPress={() => {
                    setSheetVisible(false);
                    router.push(`/pin/${item.id}` as any);
                  }}
                >
                  <Image
                    source={{ uri: item.photo_url }}
                    style={s.cardImage}
                    resizeMode="cover"
                  />
                  {/* Kullanıcı + aksiyonlar */}
                  <View style={s.cardInfo}>
                    <TouchableOpacity
                      style={s.cardUser}
                      onPress={() => {
                        setSheetVisible(false);
                        if (item.user?.id) router.push(`/user/${item.user.id}` as any);
                      }}
                    >
                      <View style={[s.cardAvatar, { backgroundColor: colors.primary + '25' }]}>
                        <Text style={[s.cardAvatarText, { color: colors.primary }]}>
                          {item.user?.username?.[0]?.toUpperCase() ?? '?'}
                        </Text>
                      </View>
                      <Text style={[s.cardUsername, { color: colors.text }]}>
                        @{item.user?.username}
                      </Text>
                    </TouchableOpacity>
                    {item.caption ? (
                      <Text style={[s.cardCaption, { color: colors.textMuted }]} numberOfLines={2}>
                        {item.caption}
                      </Text>
                    ) : null}
                    <View style={s.cardActions}>
                      <TouchableOpacity style={s.cardAction} onPress={() => handleLike(item)}>
                        <FontAwesome
                          name={likedIds.has(item.id) ? 'heart' : 'heart-o'}
                          size={16}
                          color={likedIds.has(item.id) ? '#e04040' : colors.textMuted}
                        />
                        <Text style={[s.cardActionLabel, { color: colors.textMuted }]}>
                          {item.like_count ?? 0}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.cardAction} onPress={() => handleSave(item)}>
                        <Feather
                          name="bookmark"
                          size={16}
                          color={savedIds.has(item.id) ? colors.primary : colors.textMuted}
                        />
                        <Text style={[s.cardActionLabel, { color: colors.textMuted }]}>Kaydet</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.cardAction} onPress={() => {
                        const lat = item.location?.lat;
                        const lng = item.location?.lng;
                        if (lat && lng) Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
                      }}>
                        <Feather name="navigation" size={16} color={colors.textMuted} />
                        <Text style={[s.cardActionLabel, { color: colors.textMuted }]}>Git</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.cardAction} onPress={() => {
                        Share.share({ message: `FotoHarita'da bu yeri keşfettim: ${item.location?.name}\nhttps://fotohrita.com/pin/${item.id}` });
                      }}>
                        <Feather name="share-2" size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const CARD_W = SCREEN_W * 0.72;

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0A0A0A' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0A0A' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#888888' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#222222' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#050505' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0d0d0d' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const lightMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#555555' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d0d8e0' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e8f0e8' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    map: { flex: 1 },
    searchBar: {
      position: 'absolute',
      top: 52,
      left: Spacing.md,
      right: Spacing.md,
      zIndex: 10,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    loadingOverlay: {
      position: 'absolute',
      bottom: 90,
      left: Spacing.md,
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },

    // Bottom sheet
    sheetBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.3)',
    },
    sheet: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 32,
      maxHeight: SCREEN_H * 0.55,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 4,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    sheetTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
    sheetCount: { fontSize: 12, marginTop: 2 },
    sheetClose: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetCenter: {
      height: 140,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetList: {
      paddingHorizontal: Spacing.md,
      gap: 12,
      paddingBottom: 8,
    },

    // Pin kartı
    card: {
      width: CARD_W,
      borderRadius: BorderRadius.lg,
      overflow: 'hidden',
      elevation: 4,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    cardImage: {
      width: '100%',
      height: 180,
    },
    cardInfo: {
      padding: Spacing.md,
      gap: 6,
    },
    cardUser: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    cardAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardAvatarText: { fontSize: 11, fontWeight: '700' },
    cardUsername: { fontSize: 13, fontWeight: '600' },
    cardCaption: { fontSize: 12, lineHeight: 17 },
    cardActions: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: 2,
    },
    cardAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    cardActionLabel: { fontSize: 12 },
  });
}
