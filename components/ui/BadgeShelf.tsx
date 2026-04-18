import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors, BorderRadius, Spacing } from '@constants/theme';
import { BADGES, getBadgeByKey } from '@constants/badges';

interface BadgeShelfProps {
  earnedKeys: string[];
}

export function BadgeShelf({ earnedKeys }: BadgeShelfProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      {BADGES.map((badge) => {
        const earned = earnedKeys.includes(badge.key);
        return (
          <View key={badge.key} style={[styles.badge, !earned && styles.locked]}>
            <Text style={styles.emoji}>{badge.emoji}</Text>
            <Text style={[styles.label, !earned && styles.lockedText]}>{badge.label}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  badge: {
    alignItems: 'center',
    marginRight: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    minWidth: 72,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locked: {
    opacity: 0.35,
  },
  emoji: { fontSize: 28, marginBottom: 4 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  lockedText: { color: Colors.textMuted },
});
