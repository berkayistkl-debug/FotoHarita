import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors, Spacing, BorderRadius } from '@constants/theme';
import { Button } from '@components/ui/Button';

interface LocationVerifierProps {
  status: 'idle' | 'verifying' | 'verified' | 'failed' | 'manual';
  distanceMeters?: number;
  onRetry: () => void;
  onManualOverride: () => void;
}

export function LocationVerifier({
  status,
  distanceMeters,
  onRetry,
  onManualOverride,
}: LocationVerifierProps) {
  if (status === 'idle') return null;

  return (
    <View style={styles.container}>
      {status === 'verifying' && (
        <View style={styles.row}>
          <ActivityIndicator color={Colors.primary} size="small" />
          <Text style={styles.text}>Konum doğrulanıyor...</Text>
        </View>
      )}

      {status === 'verified' && (
        <View style={[styles.row, styles.success]}>
          <Text style={styles.icon}>✅</Text>
          <Text style={[styles.text, styles.successText]}>GPS doğrulandı — coin kazanacaksın!</Text>
        </View>
      )}

      {status === 'failed' && (
        <View style={styles.failBox}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={[styles.text, styles.warningText]}>
            Bu fotoğraf burada mı çekildi?{'\n'}
            {distanceMeters != null && `Fark: ~${distanceMeters}m`}
          </Text>
          <Text style={styles.subText}>
            GPS doğrulaması olmadan coin kazanamazsın, ama yine de yükleyebilirsin.
          </Text>
          <View style={styles.btnRow}>
            <Button title="Tekrar Dene" onPress={onRetry} variant="secondary" size="sm" />
            <Button title="Manuel Konum" onPress={onManualOverride} variant="ghost" size="sm" />
          </View>
        </View>
      )}

      {status === 'manual' && (
        <View style={[styles.row, styles.warning]}>
          <Text style={styles.icon}>📍</Text>
          <Text style={[styles.text, styles.warningText]}>
            Manuel konum — coin kazanılamaz
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
  },
  success: { backgroundColor: 'rgba(0, 212, 160, 0.1)', borderWidth: 1, borderColor: Colors.accentGreen },
  warning: { backgroundColor: 'rgba(255, 184, 0, 0.1)', borderWidth: 1, borderColor: Colors.warning },
  failBox: {
    padding: Spacing.md,
    backgroundColor: 'rgba(255, 184, 0, 0.1)',
    borderWidth: 1,
    borderColor: Colors.warning,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  icon: { fontSize: 18 },
  text: { fontSize: 14, color: Colors.text, fontWeight: '500', flex: 1 },
  successText: { color: Colors.accentGreen },
  warningText: { color: Colors.warning },
  subText: { fontSize: 12, color: Colors.textMuted },
  btnRow: { flexDirection: 'row', gap: Spacing.sm },
});
