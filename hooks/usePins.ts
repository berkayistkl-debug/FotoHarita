import { useState, useCallback } from 'react';
import { getPinsInBounds } from '@lib/supabase';
import { MapPin } from '@/types/database';

interface BoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export function usePins(currentUserId?: string) {
  const [pins, setPins] = useState<MapPin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPins = useCallback(
    async (bounds: BoundingBox, zoomLevel: number) => {
      setLoading(true);
      setError(null);

      try {
        const data = await getPinsInBounds(
          bounds.minLat,
          bounds.minLng,
          bounds.maxLat,
          bounds.maxLng,
          zoomLevel
        );

        const mapped: MapPin[] = (data ?? []).map((row: any) => ({
          id: row.pin_id,
          lat: row.lat,
          lng: row.lng,
          photo_url: row.photo_url,
          location_id: row.location_id,
          location_name: row.location_name,
          like_count: row.like_count,
          is_popular: row.is_popular,
          is_own: row.user_id === currentUserId,
        }));

        setPins(mapped);
      } catch (err: any) {
        setError(err.message ?? 'Pinler yüklenemedi.');
      } finally {
        setLoading(false);
      }
    },
    [currentUserId]
  );

  return { pins, loading, error, loadPins };
}
