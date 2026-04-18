import { supabase } from './supabase';

export const COIN_REWARDS = {
  FIRST_UPLOAD: 10,       // GPS doğrulamalı ilk yükleme
  SAME_LOCATION: 5,       // Aynı yere tekrar yükleme
  STREAK_BONUS: 15,       // 7 gün içinde 3. yükleme
  LIKE_MILESTONE: 5,      // 10 beğeni
  FEATURED: 20,           // Keşfet feed'e öne çıkarıldı
} as const;

export const COIN_COSTS = {
  FEATURE_PIN_24H: 50,    // Keşfet feed'de 24 saat öne çıkar
  BADGE_FRAME: 30,        // Profil rozet çerçevesi
  SPECIAL_PIN: 40,        // Haritada özel pin ikonu
} as const;

type CoinReason =
  | 'upload_first'
  | 'upload_same_location'
  | 'upload_streak'
  | 'like_milestone'
  | 'featured'
  | 'feature_pin'
  | 'badge_frame'
  | 'special_pin';

/**
 * Kullanıcıya coin ekle — SECURITY DEFINER RPC üzerinden
 */
export async function awardCoins(
  userId: string,
  amount: number,
  reason: CoinReason,
  pinId?: string
): Promise<void> {
  const { error } = await supabase.rpc('award_coins', {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_pin_id: pinId ?? null,
  });
  if (error) throw error;
}

/**
 * Kullanıcıdan coin harca — atomik RPC ile race condition önlenir
 */
export async function spendCoins(
  userId: string,
  cost: number,
  reason: CoinReason,
  pinId?: string
): Promise<void> {
  const { error } = await supabase.rpc('spend_coins', {
    p_user_id: userId,
    p_amount: cost,
    p_reason: reason,
    p_pin_id: pinId ?? null,
  });
  if (error) {
    if (error.message?.includes('insufficient_coins')) {
      throw new Error(`Yetersiz coin. Gerekli: ${cost}`);
    }
    throw error;
  }
}

/**
 * Yükleme sonrası uygun coin ödülünü belirle ve ver
 */
export async function processUploadCoins(
  userId: string,
  locationId: string,
  pinId: string,
  gpsVerified: boolean
): Promise<{ coinsEarned: number; reason: string }> {
  if (!gpsVerified) {
    return { coinsEarned: 0, reason: 'GPS doğrulaması olmadan coin kazanılamaz.' };
  }

  // Aynı yere daha önce yükleme yaptı mı? (yeni eklenen pin hariç)
  const { data: existingPins } = await supabase
    .from('pins')
    .select('id, created_at')
    .eq('user_id', userId)
    .eq('location_id', locationId)
    .neq('id', pinId)
    .order('created_at', { ascending: false })
    .limit(5);

  const isFirstUpload = !existingPins || existingPins.length === 0;

  if (isFirstUpload) {
    await awardCoins(userId, COIN_REWARDS.FIRST_UPLOAD, 'upload_first', pinId);
    return { coinsEarned: COIN_REWARDS.FIRST_UPLOAD, reason: 'Yeni yer keşfettin!' };
  }

  // 7 gün içinde 3. yükleme streak kontrolü
  const { data: recentPins } = await supabase
    .from('pins')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(10);

  if (recentPins && recentPins.length === 2) {
    await awardCoins(userId, COIN_REWARDS.STREAK_BONUS, 'upload_streak', pinId);
    return { coinsEarned: COIN_REWARDS.STREAK_BONUS, reason: '7 günlük streak bonusu!' };
  }

  await awardCoins(userId, COIN_REWARDS.SAME_LOCATION, 'upload_same_location', pinId);
  return { coinsEarned: COIN_REWARDS.SAME_LOCATION, reason: 'Yükleme tamamlandı!' };
}

/**
 * Pin 10 beğeniye ulaştığında çağrılır
 */
export async function checkLikeMilestone(pinId: string, likeCount: number): Promise<void> {
  if (likeCount !== 10) return;

  const { data: pin } = await supabase
    .from('pins')
    .select('user_id')
    .eq('id', pinId)
    .single();

  if (pin) {
    await awardCoins(pin.user_id, COIN_REWARDS.LIKE_MILESTONE, 'like_milestone', pinId);
  }
}

/**
 * Rozet kontrolü — pin sayısına göre
 */
export async function checkAndAwardBadges(userId: string): Promise<string[]> {
  const newBadges: string[] = [];

  // Kullanıcının pin sayısı
  const { count: pinCount } = await supabase
    .from('pins')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('moderation_status', 'approved');

  // Mevcut rozetler
  const { data: existingBadges } = await supabase
    .from('user_badges')
    .select('badge_key')
    .eq('user_id', userId);

  const hasBadge = (key: string) =>
    existingBadges?.some((b) => b.badge_key === key) ?? false;

  const awardBadge = async (key: string) => {
    if (!hasBadge(key)) {
      await supabase.from('user_badges').insert({ user_id: userId, badge_key: key });
      newBadges.push(key);
    }
  };

  if ((pinCount ?? 0) >= 1) await awardBadge('first_step');
  if ((pinCount ?? 0) >= 50) await awardBadge('local_guide');

  return newBadges;
}
