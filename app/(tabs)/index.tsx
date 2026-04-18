import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker, Region } from 'react-native-maps';
import { Spacing } from '@constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useLocation } from '@hooks/useLocation';
import { usePins } from '@hooks/usePins';
import { PinMarker } from '@components/map/PinMarker';
import { ClusterMarker } from '@components/map/ClusterMarker';
import { MapControls } from '@components/map/MapControls';
import { SearchOverlay } from '@components/ui/SearchOverlay';
import { MapPin } from '@/types/database';
import Supercluster from 'supercluster';

const DEFAULT_CENTER = { lat: 41.0082, lng: 28.9784 };
const ANIMATE_DURATION_MS = 800;

export default function MapScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const mapRef = useRef<MapView>(null);
  const { lat, lng, permissionGranted } = useLocation();
  const { pins, loading, loadPins } = usePins();

  const [zoom, setZoom] = useState(13);
  const [activeLayer, setActiveLayer] = useState<'all' | 'nearby' | 'following'>('all');
  const [clusters, setClusters] = useState<any[]>([]);

  const clusterIndex = useRef<Supercluster | null>(null);
  const hasAnimatedToUser = useRef(false);
  const regionDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Pinleri supercluster'a yükle
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
  }, [pins]);

  const handleRegionChange = useCallback(
    (region: Region) => {
      if (regionDebounce.current) clearTimeout(regionDebounce.current);
      regionDebounce.current = setTimeout(async () => {
        const latDelta = region.latitudeDelta;
        const zoomEst = Math.round(Math.log(360 / latDelta) / Math.LN2);
        setZoom(zoomEst);

        await loadPins(
          {
            minLat: region.latitude - region.latitudeDelta / 2,
            minLng: region.longitude - region.longitudeDelta / 2,
            maxLat: region.latitude + region.latitudeDelta / 2,
            maxLng: region.longitude + region.longitudeDelta / 2,
          },
          zoomEst
        );

        if (clusterIndex.current) {
          const bbox: [number, number, number, number] = [
            region.longitude - region.longitudeDelta / 2,
            region.latitude - region.latitudeDelta / 2,
            region.longitude + region.longitudeDelta / 2,
            region.latitude + region.latitudeDelta / 2,
          ];
          setClusters(clusterIndex.current.getClusters(bbox, zoomEst));
        }
      }, 350);
    },
    [loadPins]
  );

  const handleRecenter = () => {
    if (lat && lng) {
      mapRef.current?.animateToRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
  };

  const handleLayerChange = (layer: 'all' | 'nearby' | 'following') => {
    setActiveLayer(layer);

    if (layer === 'nearby') {
      if (lat && lng) {
        mapRef.current?.animateToRegion({
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } else {
        Alert.alert('Konum Gerekli', 'Yakın filtresini kullanmak için konum iznine ihtiyaç var.');
      }
    } else if (layer === 'following') {
      Alert.alert('Yakında', 'Takip ettiğin kullanıcıların pinlerini gösterme özelliği geliyor.');
      setActiveLayer('all');
    }
  };

  const handlePinPress = (pin: MapPin) => {
    router.navigate({
      pathname: '/(tabs)/discover',
      params: {
        origin_pin_id: pin.id,
        origin_lat: String(pin.lat),
        origin_lng: String(pin.lng),
      },
    } as any);
  };

  const centerLat = lat ?? DEFAULT_CENTER.lat;
  const centerLng = lng ?? DEFAULT_CENTER.lng;

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
            latitude: placeLat,
            longitude: placeLng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 600);
        }}
      />

      <MapView
        ref={mapRef}
        style={s.map}
        initialRegion={{
          latitude: centerLat,
          longitude: centerLng,
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
                      latitude: fLat,
                      longitude: fLng,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
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
    </View>
  );
}

// Koyu harita stili
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

// Açık harita stili
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
  });
}
