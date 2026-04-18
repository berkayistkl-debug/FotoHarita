import * as Location from 'expo-location';

/**
 * İki koordinat arasındaki mesafeyi metre cinsinden hesaplar (Haversine formülü)
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Dünya yarıçapı metre
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface LocationVerifyResult {
  verified: boolean;
  userLat: number;
  userLng: number;
  distanceMeters?: number;
}

/**
 * Kullanıcının anlık GPS konumunu işaretlenen pin lokasyonuyla karşılaştırır.
 * Max tolerans: 1 km. Galeri fotoğrafları için EXIF yoksa doğrulanamaz.
 *
 * @param pinLat   Kullanıcının haritada işaretlediği pin'in enlemi
 * @param pinLng   Kullanıcının haritada işaretlediği pin'in boylamı
 * @param source   'camera' → anlık çekim (her zaman doğrulanır) | 'gallery' → galeri
 */
export async function verifyLocation(
  pinLat: number,
  pinLng: number,
  source: 'camera' | 'gallery' = 'camera',
  toleranceMeters = 1000
): Promise<LocationVerifyResult> {
  let currentPosition: Location.LocationObject;

  try {
    currentPosition = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  } catch {
    throw new Error('Konum alınamadı. Lütfen konum iznini kontrol edin.');
  }

  const { latitude: userLat, longitude: userLng } = currentPosition.coords;
  const distance = haversineDistance(userLat, userLng, pinLat, pinLng);

  // Kamerayla yeni çekilmiş fotoğraf: kullanıcı zaten orada
  if (source === 'camera') {
    return {
      verified: distance <= toleranceMeters,
      userLat,
      userLng,
      distanceMeters: Math.round(distance),
    };
  }

  // Galeri fotoğrafı: kullanıcı hâlâ işaretlenen konumun 1km içinde olmalı
  return {
    verified: distance <= toleranceMeters,
    userLat,
    userLng,
    distanceMeters: Math.round(distance),
  };
}

/**
 * @deprecated verifyLocation kullan
 */
export async function verifyLocationLegacy(
  photoExifLat: number | null,
  photoExifLng: number | null,
  toleranceMeters = 1000
): Promise<LocationVerifyResult> {
  return verifyLocation(
    photoExifLat ?? 0,
    photoExifLng ?? 0,
    'gallery',
    toleranceMeters
  );
}

/**
 * Kullanıcının mevcut konumunu döndürür
 */
export async function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Konum izni reddedildi');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };
}

/**
 * Harita viewport'unun bounding box'ını hesaplar
 */
export function getBoundingBox(
  centerLat: number,
  centerLng: number,
  radiusKm: number
): { minLat: number; minLng: number; maxLat: number; maxLng: number } {
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos((centerLat * Math.PI) / 180));

  return {
    minLat: centerLat - latDelta,
    minLng: centerLng - lngDelta,
    maxLat: centerLat + latDelta,
    maxLng: centerLng + lngDelta,
  };
}

// Türkiye'deki büyük şehirler (konum izni reddedilirse fallback)
export const TURKISH_CITIES = [
  { name: 'İstanbul', lat: 41.0082, lng: 28.9784 },
  { name: 'Ankara', lat: 39.9334, lng: 32.8597 },
  { name: 'İzmir', lat: 38.4237, lng: 27.1428 },
  { name: 'Bursa', lat: 40.1885, lng: 29.0610 },
  { name: 'Antalya', lat: 36.8969, lng: 30.7133 },
];
