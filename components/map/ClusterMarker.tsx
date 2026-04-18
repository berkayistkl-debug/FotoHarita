import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, BorderRadius } from '@constants/theme';

interface ClusterMarkerProps {
  count: number;
  photos: string[];
  onPress: () => void;
}

export function ClusterMarker({ count, photos, onPress }: ClusterMarkerProps) {
  const size = count > 50 ? 64 : count > 20 ? 56 : 48;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={[styles.inner, { width: size - 8, height: size - 8, borderRadius: (size - 8) / 2 }]}>
          <Text style={[styles.count, count > 99 && styles.countSmall]}>
            {count > 999 ? '999+' : count}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 90, 95, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  inner: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  countSmall: { fontSize: 11 },
});
