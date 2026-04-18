import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@lib/supabase';

export default function SplashRouter() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      // Kısa bekleme (splash animasyon süresi)
      await new Promise((res) => setTimeout(res, 300));

      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        router.replace('/(tabs)');
      } else {
        const onboardingDone = await SecureStore.getItemAsync('onboarding_done');
        if (onboardingDone === 'true') {
          router.replace('/(auth)/login');
        } else {
          router.replace('/(onboarding)/welcome');
        }
      }
    })();
  }, []);

  return null;
}
