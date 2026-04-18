import React, { useRef, useState } from 'react';
import {
  View,
  Image,
  FlatList,
  StyleSheet,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Text } from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');

interface PhotoCarouselProps {
  urls: string[];
  width?: number;
  aspectRatio?: number;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
}

export function PhotoCarousel({
  urls,
  width = SCREEN_W,
  aspectRatio = 4 / 3,
  style,
  borderRadius = 0,
}: PhotoCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    if (idx !== activeIndex) setActiveIndex(idx);
  };

  const height = width / aspectRatio;
  const multi = urls.length > 1;

  return (
    <View style={[{ width, height }, style]}>
      <FlatList
        ref={listRef}
        data={urls}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        keyExtractor={(_, i) => String(i)}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={{ width, height, borderRadius }}
            resizeMode="cover"
          />
        )}
      />

      {/* Üst sağ köşe: 1/3 sayacı — sadece çoklu */}
      {multi && (
        <View style={styles.counter}>
          <Text style={styles.counterText}>{activeIndex + 1}/{urls.length}</Text>
        </View>
      )}

      {/* Alt orta nokta göstergesi — sadece çoklu, max 10 */}
      {multi && urls.length <= 10 && (
        <View style={styles.dots}>
          {urls.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  counter: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  counterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  dots: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 18,
    borderRadius: 3,
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
});
