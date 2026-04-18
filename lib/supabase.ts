import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const StorageAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: StorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Kullanıcı profili
export async function getUserProfile(authId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', authId)
    .single();
  if (error) throw error;
  return data;
}

// Profil oluştur (kayıt sonrası)
export async function createUserProfile(authId: string, username: string, avatarUrl?: string) {
  const { data, error } = await supabase
    .from('users')
    .insert({ auth_id: authId, username, avatar_url: avatarUrl ?? null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Viewport içindeki pinleri getir
export async function getPinsInBounds(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number,
  zoomLevel: number = 14
) {
  const { data, error } = await supabase.rpc('get_pins_in_bounds', {
    min_lat: minLat,
    min_lng: minLng,
    max_lat: maxLat,
    max_lng: maxLng,
    zoom_level: zoomLevel,
  });
  if (error) throw error;
  return data;
}

// Pin detay
export async function getPinById(pinId: string) {
  const { data, error } = await supabase
    .from('pins')
    .select(`
      *,
      user:users!user_id(id, username, avatar_url),
      location:locations(id, name, address, lat, lng, category)
    `)
    .eq('id', pinId)
    .single();
  if (error) throw error;
  return data;
}

// Location'a ait tüm onaylı pinler
export async function getPinsByLocation(locationId: string, sortBy: 'newest' | 'popular' | 'oldest' = 'newest') {
  let query = supabase
    .from('pins')
    .select(`
      *,
      user:users!user_id(id, username, avatar_url)
    `)
    .eq('location_id', locationId)
    .eq('moderation_status', 'approved');

  if (sortBy === 'newest') query = query.order('created_at', { ascending: false });
  else if (sortBy === 'popular') query = query.order('like_count', { ascending: false });
  else query = query.order('created_at', { ascending: true });

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Keşfet feed
export async function getDiscoverFeed(
  userLat: number,
  userLng: number,
  category?: string,
  radiusKm: number = 50,
  page: number = 0,
  pageSize: number = 20
) {
  let query = supabase
    .from('pins')
    .select(`
      *,
      user:users!user_id(id, username, avatar_url),
      location:locations(id, name, address, lat, lng, category)
    `)
    .eq('moderation_status', 'approved')
    .order('like_count', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (category) query = query.eq('location.category', category);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Kullanıcının pinleri (profil)
export async function getUserPins(userId: string) {
  const { data, error } = await supabase
    .from('pins')
    .select(`*, location:locations(id, name, lat, lng)`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Pin beğen / beğeniyi geri al
export async function togglePinLike(pinId: string, userId: string, liked: boolean) {
  if (liked) {
    const { error } = await supabase
      .from('pin_likes')
      .insert({ pin_id: pinId, user_id: userId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('pin_likes')
      .delete()
      .eq('pin_id', pinId)
      .eq('user_id', userId);
    if (error) throw error;
  }
}

// Beğeni durumunu kontrol et
export async function checkPinLiked(pinId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('pin_likes')
    .select('pin_id')
    .eq('pin_id', pinId)
    .eq('user_id', userId)
    .single();
  return !!data;
}

// Pin kaydet
export async function toggleSavePin(pinId: string, userId: string, save: boolean) {
  if (save) {
    const { error } = await supabase
      .from('saved_pins')
      .insert({ pin_id: pinId, user_id: userId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('saved_pins')
      .delete()
      .eq('pin_id', pinId)
      .eq('user_id', userId);
    if (error) throw error;
  }
}

// Pin raporla
export async function reportPin(reporterId: string, pinId: string, reason: string) {
  const { error } = await supabase
    .from('reports')
    .insert({ reporter_id: reporterId, pin_id: pinId, reason });
  if (error) throw error;
}

// Kullanıcı rozetleri
export async function getUserBadges(userId: string) {
  const { data, error } = await supabase
    .from('user_badges')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

// Bildirimleri getir
export async function getNotifications(userId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

// Konuma göre yakın pinler (algoritma feed'i için)
export interface NearbyPin {
  id: string;
  photo_url: string;
  photo_urls: string[];
  caption: string | null;
  like_count: number;
  comment_count: number;
  view_count: number;
  created_at: string;
  location_id: string;
  location_name: string;
  category: string;
  lat: number;
  lng: number;
  distance_km: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  aspect_ratio: string;
}

export async function getNearbyPins(
  originLat: number,
  originLng: number,
  excludeId?: string,
  radiusKm = 50
): Promise<NearbyPin[]> {
  const { data, error } = await supabase.rpc('get_nearby_pins', {
    origin_lat: originLat,
    origin_lng: originLng,
    exclude_id: excludeId ?? null,
    radius_km: radiusKm,
  });
  if (error) throw error;
  return (data ?? []) as NearbyPin[];
}

// Pin sil
export async function deletePin(pinId: string, userId: string) {
  const { error } = await supabase
    .from('pins')
    .delete()
    .eq('id', pinId)
    .eq('user_id', userId);
  if (error) throw error;
}

// Kaydedilen pinler
export async function getSavedPins(userId: string) {
  const { data, error } = await supabase
    .from('saved_pins')
    .select('pin:pins(*, location:locations(id, name, lat, lng))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => row.pin).filter(Boolean) as any[];
}

// Yorumları getir
export async function getComments(pinId: string) {
  const { data, error } = await supabase
    .from('pin_comments')
    .select('*, user:users(id, username, avatar_url)')
    .eq('pin_id', pinId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as any[];
}

// Yorum ekle
export async function addComment(userId: string, pinId: string, content: string) {
  const { data, error } = await supabase
    .from('pin_comments')
    .insert({ pin_id: pinId, user_id: userId, content: content.trim() })
    .select('*, user:users(id, username, avatar_url)')
    .single();
  if (error) throw error;
  return data as any;
}

// Yorum sil
export async function deleteComment(commentId: string, userId: string) {
  const { error } = await supabase
    .from('pin_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId);
  if (error) throw error;
}

// Bildirimleri okundu işaretle
export async function markNotificationsRead(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw error;
}
