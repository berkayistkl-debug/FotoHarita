export interface ScoredPin {
  user_id: string;
  like_count: number;
  comment_count: number;
  view_count: number;
  created_at: string;
  distance_km: number;
}

const DISTANCE_WEIGHT = 0.6;
const ENGAGEMENT_WEIGHT = 0.4;
const DISTANCE_HALF_LIFE_KM = 5;

export function calculateFeedScore(pin: ScoredPin): number {
  const distanceScore = Math.exp(-pin.distance_km / DISTANCE_HALF_LIFE_KM);

  const rawEngagement =
    pin.like_count * 3 +
    pin.comment_count * 5 +
    pin.view_count * 0.5;
  const engagementScore = Math.log1p(rawEngagement) / 10;

  const hoursOld = (Date.now() - new Date(pin.created_at).getTime()) / 3_600_000;
  const freshnessScore =
    hoursOld < 24 ? 1.3 :
    hoursOld < 72 ? 1.1 :
    hoursOld < 168 ? 1.0 : 0.8;

  const newPhotoBonus = hoursOld < 2 ? 0.3 : 0;

  const base =
    (distanceScore * DISTANCE_WEIGHT + engagementScore * ENGAGEMENT_WEIGHT) *
    freshnessScore;

  return base + newPhotoBonus;
}

export function applyDiversityFilter<T extends { user_id: string }>(
  photos: T[],
  maxPerUser = 2
): T[] {
  const counts: Record<string, number> = {};
  return photos.filter((p) => {
    const c = counts[p.user_id] ?? 0;
    if (c < maxPerUser) {
      counts[p.user_id] = c + 1;
      return true;
    }
    return false;
  });
}
