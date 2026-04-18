import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Image,
} from 'react-native';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { Spacing, BorderRadius } from '@constants/theme';
import { getCategoryByKey } from '@constants/categories';
import { Pin } from '@/types/database';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface DiscoverCardProps {
  pin: Pin;
  isLiked: boolean;
  isSaved: boolean;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  onNavigate: () => void;
  onUserPress: () => void;
  onPress: () => void;
}

export function DiscoverCard({
  pin,
  isLiked,
  isSaved,
  onLike,
  onSave,
  onShare,
  onNavigate,
  onUserPress,
  onPress,
}: DiscoverCardProps) {
  const category = getCategoryByKey(pin.location?.category ?? 'other');
  const photos = pin.photo_urls?.length > 0 ? pin.photo_urls : [pin.photo_url];
  const [photoIndex, setPhotoIndex] = useState(0);

  const onPhotoScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (idx !== photoIndex) setPhotoIndex(idx);
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.97}>
      {/* Fotoğraf carousel */}
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onPhotoScroll}
        keyExtractor={(_, i) => String(i)}
        getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
        style={styles.image}
        renderItem={({ item }) => (
          <Image source={{ uri: item }} style={{ width: SCREEN_W, height: SCREEN_H }} resizeMode="cover" />
        )}
      />

      {/* Gradient overlay */}
      <View style={styles.gradient} />

      {/* Üst bar: kategori + fotoğraf sayacı */}
      <View style={styles.header}>
        <View style={[styles.categoryChip, { backgroundColor: category.color + '33', borderColor: category.color }]}>
          <Text style={styles.categoryEmoji}>{category.emoji}</Text>
          <Text style={[styles.categoryLabel, { color: category.color }]}>{category.label}</Text>
        </View>
        {photos.length > 1 && (
          <View style={styles.photoCounter}>
            <Feather name="layers" size={11} color="#fff" />
            <Text style={styles.photoCounterText}>{photoIndex + 1}/{photos.length}</Text>
          </View>
        )}
      </View>

      {/* Dot göstergesi — çoklu fotoğrafta */}
      {photos.length > 1 && photos.length <= 10 && (
        <View style={styles.dots}>
          {photos.map((_, i) => (
            <View key={i} style={[styles.dot, i === photoIndex ? styles.dotActive : styles.dotInactive]} />
          ))}
        </View>
      )}

      {/* Sağ kenar aksiyonlar */}
      <View style={styles.actions}>
        <HeartButton
          count={pin.like_count}
          isLiked={isLiked}
          onPress={onLike}
        />
        <ActionButton
          icon="message-circle"
          label={(pin as any).comment_count?.toString() ?? '0'}
          onPress={onPress}
        />
        <ActionButton
          icon="bookmark"
          label="Kaydet"
          onPress={onSave}
          active={isSaved}
          activeColor="#f0f0f0"
        />
        <ActionButton icon="share-2" label="Paylaş" onPress={onShare} />
        <ActionButton icon="navigation" label="Git" onPress={onNavigate} />
      </View>

      {/* Alt bilgi */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.userRow} onPress={onUserPress}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {pin.user?.username?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text style={styles.username}>@{pin.user?.username}</Text>
        </TouchableOpacity>

        <Text style={styles.locationName} numberOfLines={1}>
          {pin.location?.name}
        </Text>
        {pin.location?.address && (
          <Text style={styles.address} numberOfLines={1}>
            {pin.location.address}
          </Text>
        )}
        {pin.caption && (
          <Text style={styles.caption} numberOfLines={2}>
            {pin.caption}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function HeartButton({ count, isLiked, onPress }: { count: number; isLiked: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.7}>
      <FontAwesome
        name={isLiked ? 'heart' : 'heart-o'}
        size={26}
        color={isLiked ? '#e04040' : 'rgba(255,255,255,0.9)'}
      />
      <Text style={[styles.actionLabel, isLiked && { color: '#e04040' }]}>{count}</Text>
    </TouchableOpacity>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  active,
  activeColor = '#ffffff',
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  active?: boolean;
  activeColor?: string;
}) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.7}>
      <Feather name={icon} size={26} color={active ? activeColor : 'rgba(255,255,255,0.9)'} />
      <Text style={[styles.actionLabel, active && { color: activeColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: '#000',
  },
  image: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_H * 0.55,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  header: {
    position: 'absolute',
    top: 60,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoCounterText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  dots: {
    position: 'absolute',
    bottom: 148,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  dot: { height: 5, borderRadius: 2.5 },
  dotActive: { width: 16, backgroundColor: '#fff' },
  dotInactive: { width: 5, backgroundColor: 'rgba(255,255,255,0.4)' },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  categoryEmoji: { fontSize: 13 },
  categoryLabel: { fontSize: 12, fontWeight: '600' },
  actions: {
    position: 'absolute',
    right: Spacing.md,
    bottom: 140,
    alignItems: 'center',
    gap: Spacing.lg,
  },
  actionBtn: { alignItems: 'center', gap: 4 },
  actionLabel: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  footer: {
    position: 'absolute',
    bottom: 100,
    left: Spacing.md,
    right: 80,
    gap: Spacing.xs,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  username: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
  locationName: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  address: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  caption: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
});
