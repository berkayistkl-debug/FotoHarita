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
 * Kullanıcıya coin ekle
 */
export async function awardCoins(
  userId: string,
  amount: number,
  reason: CoinReason,
  pinId?: string
): Promise<void> {
  const { error } = await supabase.from('coin_transactions').insert({
    user_id: userId,
    amount,
    reason,
    pin_id: pinId ?? null,
  });
  if (error) throw error;
}

/**
 * Kullanıcıdan coin harca
 */
export async function spendCoins(
  userId: string,
  cost: number,
  reason: CoinReason,
  pinId?: string
): Promise<void> {
  // Önce bakiyeyi kontrol et
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('coin_balance')
    .eq('id', userId)
    .single();

  if (userError) throw userError;
  if (!user || user.coin_balance < cost) {
    throw new Error(`Yetersiz coin. Gerekli: ${cost}, Mevcut: ${user?.coin_balance ?? 0}`);
  }

  const { error } = await supabase.from('coin_transactions').insert({
    user_id: userId,
    amount: -cost,
    reason,
    pin_id: pinId ?? null,
  });
  if (error) throw error;
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

  // Aynı yere daha önce yükleme yaptı mı?
  const { data: existingPins } = await supabase
    .from('pins')
    .select('id, created_at')
    .eq('user_id', userId)
    .eq('location_id', locationId)
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
