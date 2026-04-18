import { useState, useEffect } from 'react';
import { supabase } from '@lib/supabase';

export function useCoins(userId: string | null) {
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;

    setLoading(true);

    // İlk yükleme
    supabase
      .from('users')
      .select('coin_balance')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data) setBalance(data.coin_balance);
        setLoading(false);
      });

    // Realtime: coin_balance değişikliklerini dinle
    const channel = supabase
      .channel(`user-coins-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new.coin_balance !== undefined) {
            setBalance(payload.new.coin_balance);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { balance, loading };
}
