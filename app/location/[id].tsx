import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase, getPinsByLocation } from '@lib/supabase';
import { Colors, Spacing, BorderRadius, Typography } from '@constants/theme';
import { getCategoryByKey } from '@constants/categories';
import { Pin } from '@/types/database';

export default function LocationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [location, setLocation] = useState<any>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [locResult, pinsData] = await Promise.all([
        supabase.from('locations').select('*').eq('id', id).single(),
        getPinsByLocation(id, 'popular'),
      ]);
      setLocation(locResult.data);
      setPins(pinsData ?? []);
      setLoading(false);
    })();
  }, [id]);

  if (loading || !location) return null;

  const category = getCategoryByKey(location.category);

  return (
    <View style={styles.container}>
      {/* Başlık */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <View style={[styles.categoryChip, { backgroundColor: category.color + '22', borderColor: category.color }]}>
          <Text>{category.emoji}</Text>
          <Text style={[styles.categoryLabel, { color: category.color }]}>{category.label}</Text>
        </View>
      </View>

      <View style={styles.locationInfo}>
        <Text style={styles.name}>{location.name}</Text>
        {location.address && <Text style={styles.address}>{location.address}</Text>}

        <TouchableOpacity
          onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`)}
          style={styles.navigateBtn}
        >
          <Text style={styles.navigateText}>🗺️ Yol Tarifi Al</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.pinCount}>{pins.length} fotoğraf</Text>

      <FlatList
        data={pins}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push(`/pin/${item.id}`)}
          >
            <Image source={{ uri: item.photo_url }} style={styles.gridImage} resizeMode="cover" />
            <View style={styles.likeOverlay}>
              <Text style={styles.likeText}>❤️ {item.like_count}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.md,
  },
  backBtn: {},
  backText: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  categoryLabel: { fontSize: 12, fontWeight: '600' },
  locationInfo: { paddingHorizontal: Spacing.lg, gap: Spacing.xs, marginBottom: Spacing.md },
  name: { fontSize: 24, fontWeight: '700', color: Colors.text },
  address: { fontSize: 14, color: Colors.textSecondary },
  navigateBtn: {
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  navigateText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  pinCount: { paddingHorizontal: Spacing.lg, fontSize: 13, color: Colors.textMuted, marginBottom: Spacing.sm },
  grid: { paddingHorizontal: Spacing.lg, gap: Spacing.xs },
  gridRow: { gap: Spacing.xs },
  gridItem: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  gridImage: { width: '100%', height: '100%' },
  likeOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  likeText: { fontSize: 11, color: Colors.text, fontWeight: '600' },
});
