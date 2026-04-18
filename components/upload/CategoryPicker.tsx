import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { CATEGORIES } from '@constants/categories';
import { Colors, BorderRadius, Spacing } from '@constants/theme';

interface CategoryPickerProps {
  selected: string | null;
  onSelect: (key: string) => void;
}

export function CategoryPicker({ selected, onSelect }: CategoryPickerProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      {CATEGORIES.map((cat) => (
        <TouchableOpacity
          key={cat.key}
          onPress={() => onSelect(cat.key)}
          style={[
            styles.chip,
            selected === cat.key && { backgroundColor: cat.color + '33', borderColor: cat.color },
          ]}
          activeOpacity={0.7}
        >
          <Text style={styles.emoji}>{cat.emoji}</Text>
          <Text style={[styles.label, selected === cat.key && { color: cat.color }]}>
            {cat.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
  },
  emoji: { fontSize: 16 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
});
