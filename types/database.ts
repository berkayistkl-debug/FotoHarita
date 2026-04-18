export interface User {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  coin_balance: number;
  created_at: string;
}

export interface Location {
  id: string;
  google_place_id: string | null;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  category: string;
  created_at: string;
}

export interface Pin {
  id: string;
  user_id: string;
  location_id: string;
  photo_url: string;
  location_name: string | null;
  caption: string | null;
  gps_verified: boolean;
  upload_lat: number | null;
  upload_lng: number | null;
  moderation_status: 'pending' | 'approved' | 'rejected' | 'review';
  photo_urls: string[];
  aspect_ratio: '4:3' | '16:9';
  like_count: number;
  comment_count: number;
  created_at: string;
  // Joined
  user?: User;
  location?: Location;
}

export interface PinComment {
  id: string;
  pin_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: User;
}

export interface PinLike {
  pin_id: string;
  user_id: string;
  created_at: string;
}

export interface CoinTransaction {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  created_at: string;
}

export interface UserBadge {
  user_id: string;
  badge_key: string;
  awarded_at: string;
}

export interface SavedPin {
  user_id: string;
  pin_id: string;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  pin_id: string;
  reason: string;
  status: 'open' | 'resolved' | 'dismissed';
  created_at: string;
}

// Harita için optimize cluster/pin tipi
export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  photo_url: string;
  location_id: string;
  location_name: string;
  like_count: number;
  is_popular: boolean;
  is_own: boolean;
}

export interface ClusterData {
  id: string;
  lat: number;
  lng: number;
  count: number;
  photos: string[]; // İlk 4 fotoğraf thumbnail
}
