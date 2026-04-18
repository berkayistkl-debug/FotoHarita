-- =====================
-- 1. ATOMIC spend_coins RPC
--    Race condition'ı önler: bakiye kontrolü + insert tek transaction'da
-- =====================
CREATE OR REPLACE FUNCTION spend_coins(
  p_user_id uuid,
  p_amount   integer,
  p_reason   text,
  p_pin_id   uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users
    SET coin_balance = coin_balance - p_amount
  WHERE id = p_user_id
    AND coin_balance >= p_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_coins';
  END IF;

  INSERT INTO coin_transactions (user_id, amount, reason, pin_id)
  VALUES (p_user_id, -p_amount, p_reason, p_pin_id);
END;
$$;

-- =====================
-- 2. coin_transactions INSERT RLS — doğrudan client insert'ü engelle
--    Tüm coin işlemleri artık sadece SECURITY DEFINER fonksiyonlar üzerinden
-- =====================
DROP POLICY IF EXISTS "System can insert transactions" ON coin_transactions;

CREATE POLICY "System can insert transactions" ON coin_transactions FOR INSERT
  WITH CHECK (false);

-- awardCoins hâlâ doğrudan insert kullanıyor; bunun için de bir RPC ekleyelim
CREATE OR REPLACE FUNCTION award_coins(
  p_user_id uuid,
  p_amount   integer,
  p_reason   text,
  p_pin_id   uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'award_coins: amount must be positive';
  END IF;

  INSERT INTO coin_transactions (user_id, amount, reason, pin_id)
  VALUES (p_user_id, p_amount, p_reason, p_pin_id);
END;
$$;
