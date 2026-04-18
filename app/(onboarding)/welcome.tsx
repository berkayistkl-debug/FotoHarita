import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Shadows } from '@constants/theme';
import { Button } from '@components/ui/Button';

const { width: SCREEN_W } = Dimensions.get('window');

const SLIDES = [
  {
    key: '1',
    emoji: '🗺️',
    title: 'İstanbul\'un\nGizli Köşeleri',
    subtitle: 'Haritada binlerce çekim noktasını keşfet, fotoğraf üreticilerinin favori yerlerine ulaş.',
    color: Colors.primary,
  },
  {
    key: '2',
    emoji: '📸',
    title: '"O fotoğraf\nnerede çekildi?"',
    subtitle: 'Doğrudan haritadan soruya yanıt bul. Git, çek, paylaş — hepsi tek uygulamada.',
    color: Colors.accentPink,
  },
  {
    key: '3',
    emoji: '🪙',
    title: 'Git, Çek,\nCoin Kazan',
    subtitle: 'GPS doğrulamalı her yüklemeyle coin kazan. Pinlerini öne çıkar, profilini özelleştir.',
    color: Colors.accent,
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const slide = SLIDES[currentIndex];

  const goToIndex = (nextIndex: number) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex(nextIndex);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      goToIndex(currentIndex + 1);
    } else {
      router.push('/(onboarding)/permissions');
    }
  };

  const handleSkip = () => {
    router.push('/(onboarding)/permissions');
  };

  return (
    <View style={styles.container}>
      {/* Arka plan halesi */}
      <View style={[styles.haleBg, { backgroundColor: slide.color + '0c' }]} />

      {/* Üst çubuk - atla butonu */}
      <View style={styles.topBar}>
        {currentIndex < SLIDES.length - 1 && (
          <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
            <Text style={styles.skipText}>Atla</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Ana içerik - dikey ortalı */}
      <Animated.View style={[styles.mainContent, { opacity: fadeAnim }]}>
        <View style={[styles.emojiWrap, { shadowColor: slide.color }]}>
          <View style={[styles.emojiInner, { backgroundColor: slide.color + '18', borderColor: slide.color + '35' }]}>
            <Text style={styles.emoji}>{slide.emoji}</Text>
          </View>
        </View>

        <View style={styles.textBlock}>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.subtitle}>{slide.subtitle}</Text>
        </View>
      </Animated.View>

      {/* Alt: dot göstergesi + buton */}
      <View style={styles.bottom}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentIndex && [styles.dotActive, { backgroundColor: slide.color }],
              ]}
            />
          ))}
        </View>

        <Button
          title={currentIndex === SLIDES.length - 1 ? 'Başla' : 'İleri'}
          onPress={handleNext}
          size="lg"
          style={styles.nextBtn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  haleBg: {
    position: 'absolute',
    width: SCREEN_W * 1.6,
    height: SCREEN_W * 1.6,
    borderRadius: SCREEN_W * 0.8,
    top: -SCREEN_W * 0.5,
    left: -SCREEN_W * 0.3,
  },

  topBar: {
    paddingTop: 52,
    paddingHorizontal: Spacing.lg,
    alignItems: 'flex-end',
    minHeight: 72,
  },
  skipBtn: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  skipText: {
    color: Colors.textMuted,
    fontSize: 15,
    fontWeight: '500',
  },

  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 24,
    gap: Spacing.xl,
  },

  emojiWrap: {
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 14,
  },
  emojiInner: {
    width: 156,
    height: 156,
    borderRadius: 78,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 72 },

  textBlock: {
    gap: Spacing.md,
    alignItems: 'center',
    maxWidth: 320,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 42,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  bottom: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 48,
    gap: Spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 28,
    height: 7,
    borderRadius: 4,
  },
  nextBtn: {
    borderRadius: BorderRadius.full,
  },
});
