/**
 * GridPixelateWipe — React Native versiyonu
 * Ekranı siyah piksel grid'iyle kaplar; `playing=true` olunca
 * wave/diagonal pattern'e göre her hücre dalgalı şekilde solar.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

type Pattern = 'wave' | 'diagonal';

interface GridPixelateWipeProps {
  /** true: animasyon başlatılır (grid → şeffaf), false: grid tamamen opak */
  playing: boolean;
  cols?: number;
  rows?: number;
  pattern?: Pattern;
  /** Toplam animasyon süresi (ms) */
  duration?: number;
  /** Her hücrenin fade süresi (ms) */
  cellFadeDuration?: number;
  /** Grid rengi */
  color?: string;
  onComplete?: () => void;
}

function computeDelays(
  cols: number,
  rows: number,
  pattern: Pattern,
  spanMs: number,
): number[] {
  const raw: number[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      raw.push(
        pattern === 'wave'
          ? Math.hypot(x - (cols - 1) / 2, y - (rows - 1) / 2)
          : x + y,
      );
    }
  }
  const min = Math.min(...raw);
  const max = Math.max(...raw);
  const range = max - min || 1;
  return raw.map((v) => ((v - min) / range) * spanMs);
}

export function GridPixelateWipe({
  playing,
  cols = 9,
  rows = 16,
  pattern = 'wave',
  duration = 900,
  cellFadeDuration = 150,
  color = '#0e1f28',
  onComplete,
}: GridPixelateWipeProps) {
  const total = cols * rows;
  const animValues = useRef<Animated.Value[]>(
    Array.from({ length: total }, () => new Animated.Value(1)),
  ).current;

  const cellW = Math.ceil(W / cols);
  const cellH = Math.ceil(H / rows);

  useEffect(() => {
    if (!playing) {
      animValues.forEach((v) => v.setValue(1));
      return;
    }

    const span = duration - cellFadeDuration;
    const delays = computeDelays(cols, rows, pattern, span);

    const animations = animValues.map((v, i) =>
      Animated.timing(v, {
        toValue: 0,
        duration: cellFadeDuration,
        delay: delays[i],
        useNativeDriver: true,
      }),
    );

    Animated.parallel(animations).start(({ finished }) => {
      if (finished) onComplete?.();
    });
  }, [playing]);

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.container]} pointerEvents="none">
      {animValues.map((opacity, i) => (
        <Animated.View
          key={i}
          style={{
            width: cellW,
            height: cellH,
            backgroundColor: color,
            opacity,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
  },
});
