export interface Badge {
  key: string;
  label: string;
  description: string;
  emoji: string;
  color: string;
}

export const BADGES: Badge[] = [
  {
    key: 'first_step',
    label: 'İlk Adım',
    description: 'İlk pin yüklendi',
    emoji: '👣',
    color: '#4A90E2',
  },
  {
    key: 'explorer',
    label: 'Kaşif',
    description: '5 farklı ilçede pin',
    emoji: '🧭',
    color: '#00D4A0',
  },
  {
    key: 'popular',
    label: 'Popüler',
    description: 'Bir pini 100 beğeni aldı',
    emoji: '⭐',
    color: '#FFD700',
  },
  {
    key: 'weekly',
    label: 'Haftalık',
    description: '7 gün üst üste yükleme',
    emoji: '🔥',
    color: '#FF5A5F',
  },
  {
    key: 'local_guide',
    label: 'Yerel Rehber',
    description: '50 pin yükledi',
    emoji: '🗺️',
    color: '#C084FC',
  },
  {
    key: 'influencer',
    label: 'Influencer',
    description: '1000 toplam beğeni',
    emoji: '💫',
    color: '#FF8A5F',
  },
];

export const getBadgeByKey = (key: string): Badge | undefined =>
  BADGES.find((b) => b.key === key);
