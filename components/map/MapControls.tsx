import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BorderRadius, Spacing, DarkColors } from '@constants/theme';

type C = typeof DarkColors;

interface MapControlsProps {
  colors: C;
  onRecenter: () => void;
  activeLayer: 'all' | 'nearby' | 'following';
  onLayerChange: (layer: 'all' | 'nearby' | 'following') => void;
}

export function MapControls({ colors, onRecenter, activeLayer, onLayerChange }: MapControlsProps) {
  const layers: { key: 'all' | 'nearby' | 'following'; label: string }[] = [
    { key: 'all', label: 'Tümü' },
    { key: 'nearby', label: 'Yakın' },
    { key: 'following', label: 'Takip' },
  ];

  const s = makeStyles(colors);

  return (
    <>
      {/* Katman toggle — üstte */}
      <View style={s.layerContainer}>
        {layers.map((layer) => (
          <TouchableOpacity
            key={layer.key}
            onPress={() => onLayerChange(layer.key)}
            style={[s.layerBtn, activeLayer === layer.key && s.layerBtnActive]}
            activeOpacity={0.8}
          >
            <Text style={[s.layerText, activeLayer === layer.key && s.layerTextActive]}>
              {layer.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Konum geri dön — sağ alt */}
      <TouchableOpacity onPress={onRecenter} style={s.recenterBtn} activeOpacity={0.8}>
        <Feather name="navigation" size={20} color={colors.primary} />
      </TouchableOpacity>
    </>
  );
}

function makeStyles(c: C) {
  return StyleSheet.create({
    layerContainer: {
      position: 'absolute',
      top: 100,
      alignSelf: 'center',
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderRadius: BorderRadius.full,
      padding: 4,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    layerBtn: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
    },
    layerBtnActive: {
      backgroundColor: c.primary,
    },
    layerText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textSecondary,
    },
    layerTextActive: {
      color: c.background,
    },
    recenterBtn: {
      position: 'absolute',
      bottom: 110,
      right: Spacing.md,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 6,
    },
  });
}
