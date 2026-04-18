import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, BorderRadius } from '@constants/theme';
import { MapPin } from '@/types/database';

interface PinMarkerProps {
  pin: MapPin;
  onPress: (pin: MapPin) => void;
}

export function PinMarker({ pin, onPress }: PinMarkerProps) {
  const borderColor = pin.is_own
    ? Colors.accentGreen
    : pin.is_popular
    ? Colors.primary
    : Colors.text;

  return (
    <TouchableOpacity onPress={() => onPress(pin)} activeOpacity={0.85}>
      <View style={[styles.container, { borderColor }]}>
        <Image
          source={{ uri: pin.photo_url }}
          style={styles.image}
          resizeMode="cover"
        />
        {pin.is_popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularEmoji}>🔥</Text>
          </View>
        )}
      </View>
      {/* Pin kuyruk oku */}
      <View style={[styles.tail, { borderTopColor: borderColor }]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.full,
    borderWidth: 2.5,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  popularBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popularEmoji: { fontSize: 10 },
  tail: {
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
});
