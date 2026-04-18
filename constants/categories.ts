export interface Category {
  key: string;
  label: string;
  emoji: string;
  color: string;
}

export const CATEGORIES: Category[] = [
  { key: 'nature', label: 'Doğa', emoji: '🌿', color: '#00D4A0' },
  { key: 'cafes', label: 'Kafeler', emoji: '☕', color: '#C9843A' },
  { key: 'street_art', label: 'Sokak Sanatı', emoji: '🎨', color: '#FF5A5F' },
  { key: 'historical', label: 'Tarihi', emoji: '🏛️', color: '#FFD700' },
  { key: 'food', label: 'Yeme-İçme', emoji: '🍽️', color: '#FF8A5F' },
  { key: 'shopping', label: 'Alışveriş', emoji: '🛍️', color: '#C084FC' },
  { key: 'other', label: 'Diğer', emoji: '📍', color: '#4A90E2' },
];

export const getCategoryByKey = (key: string): Category =>
  CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];
