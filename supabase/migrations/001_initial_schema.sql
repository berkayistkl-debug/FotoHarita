-- PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- USERS
-- =====================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  avatar_url text,
  bio text CHECK (char_length(bio) <= 80),
  coin_balance integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all profiles" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = auth_id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = auth_id);

-- =====================
-- LOCATIONS
-- =====================
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  google_place_id text,
  name text NOT NULL,
  address text,
  coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
  lat float NOT NULL,
  lng float NOT NULL,
  category text NOT NULL DEFAULT 'other',
  photo_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read locations" ON locations FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert locations" ON locations FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Spatial index
CREATE INDEX IF NOT EXISTS locations_coordinates_idx ON locations USING GIST (coordinates);

-- =====================
-- PINS
-- =====================
CREATE TABLE IF NOT EXISTS pins (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  caption text CHECK (char_length(caption) <= 150),
  gps_verified boolean NOT NULL DEFAULT false,
  upload_lat float,
  upload_lng float,
  moderation_status text NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'review')),
  like_count integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  phash text, -- perceptual hash for duplicate detection
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read approved pins" ON pins FOR SELECT
  USING (moderation_status = 'approved' OR auth.uid() IN (
    SELECT auth_id FROM users WHERE id = user_id
  ));
CREATE POLICY "Authenticated users can insert pins" ON pins FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT auth_id FROM users WHERE id = user_id));
CREATE POLICY "Users can update own pins" ON pins FOR UPDATE
  USING (auth.uid() IN (SELECT auth_id FROM users WHERE id = user_id));

CREATE INDEX IF NOT EXISTS pins_location_idx ON pins (location_id);
CREATE INDEX IF NOT EXISTS pins_user_idx ON pins (user_id);
CREATE INDEX IF NOT EXISTS pins_moderation_idx ON pins (moderation_status);
CREATE INDEX IF NOT EXISTS pins_created_idx ON pins (created_at DESC);

-- =====================
-- PIN LIKES
-- =====================
CREATE TABLE IF NOT EXISTS pin_likes (
  pin_id uuid NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pin_id, user_id)
);

ALTER TABLE pin_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read likes" ON pin_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like" ON pin_likes FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT auth_id FROM users WHERE id = user_id));
CREATE POLICY "Users can unlike" ON pin_likes FOR DELETE
  USING (auth.uid() IN (SELECT auth_id FROM users WHERE id = user_id));

-- Trigger: like_count güncelle
CREATE OR REPLACE FUNCTION update_pin_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE pins SET like_count = like_count + 1 WHERE id = NEW.pin_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE pins SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.pin_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pin_like_count_trigger
AFTER INSERT OR DELETE ON pin_likes
FOR EACH ROW EXECUTE FUNCTION update_pin_like_count();

-- =====================
-- COIN TRANSACTIONS
-- =====================
CREATE TABLE IF NOT EXISTS coin_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount integer NOT NULL, -- pozitif: kazanım, negatif: harcama
  reason text NOT NULL,    -- 'upload', 'like_milestone', 'feature_pin', vb.
  pin_id uuid REFERENCES pins(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions" ON coin_transactions FOR SELECT
  USING (auth.uid() IN (SELECT auth_id FROM users WHERE id = user_id));
CREATE POLICY "System can insert transactions" ON coin_transactions FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT auth_id FROM users WHERE id = user_id));

-- Trigger: coin_balance güncelle
CREATE OR REPLACE FUNCTION update_coin_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users SET coin_balance = coin_balance + NEW.amount WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER coin_balance_trigger
AFTER INSERT ON coin_transactions
FOR EACH ROW EXECUTE FUNCTION update_coin_balance();

-- =====================
-- USER BADGES
-- =====================
CREATE TABLE IF NOT EXISTS user_badges (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_key text NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_key)
);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read badges" ON user_badges FOR SELECT USING (true);
CREATE POLICY "System can award badges" ON user_badges FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT auth_id FROM users WHERE id = user_id));

-- =====================
-- SAVED PINS
-- =====================
CREATE TABLE IF NOT EXISTS saved_pins (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pin_id uuid NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, pin_id)
);

ALTER TABLE saved_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own saves" ON saved_pins FOR SELECT
  USING (auth.uid() IN (SELECT auth_id FROM users WHERE id = user_id));
CREATE POLICY "Users can save pins" ON saved_pins FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT auth_id FROM users WHERE id = user_id));
CREATE POLICY "Users can unsave pins" ON saved_pins FOR DELETE
  USING (auth.uid() IN (SELECT auth_id FROM users WHERE id = user_id));

-- =====================
-- REPORTS
-- =====================
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pin_id uuid NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can submit reports" ON reports FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT auth_id FROM users WHERE id = reporter_id));
CREATE POLICY "Users can read own reports" ON reports FOR SELECT
  USING (auth.uid() IN (SELECT auth_id FROM users WHERE id = reporter_id));

-- Otomatik gizle: 5 rapor gelince
CREATE OR REPLACE FUNCTION auto_hide_reported_pin()
RETURNS TRIGGER AS $$
DECLARE
  report_count integer;
BEGIN
  SELECT COUNT(*) INTO report_count FROM reports
  WHERE pin_id = NEW.pin_id AND status = 'open';

  IF report_count >= 5 THEN
    UPDATE pins SET moderation_status = 'review' WHERE id = NEW.pin_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_hide_trigger
AFTER INSERT ON reports
FOR EACH ROW EXECUTE FUNCTION auto_hide_reported_pin();

-- =====================
-- NOTIFICATIONS
-- =====================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'nearby_pin', 'coin_earned', 'badge_awarded', 'like_milestone'
  title text NOT NULL,
  body text NOT NULL,
  data jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications" ON notifications FOR SELECT
  USING (auth.uid() IN (SELECT auth_id FROM users WHERE id = user_id));
CREATE POLICY "Users can mark as read" ON notifications FOR UPDATE
  USING (auth.uid() IN (SELECT auth_id FROM users WHERE id = user_id));

-- =====================
-- HELPER FUNCTIONS
-- =====================

-- Yakın pinleri getir (bounding box + PostGIS)
CREATE OR REPLACE FUNCTION get_pins_in_bounds(
  min_lat float,
  min_lng float,
  max_lat float,
  max_lng float,
  zoom_level int DEFAULT 14
)
RETURNS TABLE (
  pin_id uuid,
  location_id uuid,
  location_name text,
  lat float,
  lng float,
  photo_url text,
  like_count int,
  is_popular boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    l.id,
    l.name,
    l.lat,
    l.lng,
    p.photo_url,
    p.like_count,
    (p.like_count >= 20 AND p.created_at > now() - interval '7 days') as is_popular
  FROM pins p
  JOIN locations l ON p.location_id = l.id
  WHERE
    l.lat BETWEEN min_lat AND max_lat AND
    l.lng BETWEEN min_lng AND max_lng AND
    p.moderation_status = 'approved'
  ORDER BY p.created_at DESC
  LIMIT CASE WHEN zoom_level < 12 THEN 100 ELSE 500 END;
END;
$$ LANGUAGE plpgsql;

-- Location auto-group (50m yarıçap)
CREATE OR REPLACE FUNCTION find_or_create_location(
  p_lat float,
  p_lng float,
  p_name text,
  p_address text,
  p_category text,
  p_google_place_id text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  existing_id uuid;
  new_id uuid;
BEGIN
  -- 50m içinde mevcut location var mı?
  SELECT id INTO existing_id
  FROM locations
  WHERE ST_DWithin(
    coordinates,
    ST_Point(p_lng, p_lat)::geography,
    50
  )
  ORDER BY ST_Distance(coordinates, ST_Point(p_lng, p_lat)::geography)
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  -- Yeni location oluştur
  INSERT INTO locations (name, address, coordinates, lat, lng, category, google_place_id)
  VALUES (
    p_name,
    p_address,
    ST_Point(p_lng, p_lat)::geography,
    p_lat,
    p_lng,
    p_category,
    p_google_place_id
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql;
