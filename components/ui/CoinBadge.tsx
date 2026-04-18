import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, BorderRadius, Spacing } from '@constants/theme';

interface CoinBadgeProps {
  balance: number;
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
}

export function CoinBadge({ balance, size = 'md', animate = false }: CoinBadgeProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevBalance = useRef(balance);

  useEffect(() => {
    if (animate && balance !== prevBalance.current) {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.3, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
      prevBalance.current = balance;
    }
  }, [balance, animate, scaleAnim]);

  return (
    <Animated.View style={[styles.container, styles[size], { transform: [{ scale: scaleAnim }] }]}>
      <Text style={[styles.emoji, styles[`emoji_${size}`]]}>🪙</Text>
      <Text style={[styles.text, styles[`text_${size}`]]}>{balance.toLocaleString('tr-TR')}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    gap: 4,
  },
  sm: { paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  md: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  lg: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  emoji: {},
  emoji_sm: { fontSize: 12 },
  emoji_md: { fontSize: 14 },
  emoji_lg: { fontSize: 18 },
  text: { fontWeight: '700', color: Colors.coin },
  text_sm: { fontSize: 12 },
  text_md: { fontSize: 14 },
  text_lg: { fontSize: 18 },
});
