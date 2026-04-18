import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { supabase } from '@lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Colors } from '@constants/theme';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { GridPixelateWipe } from '@components/ui/GridPixelateWipe';

SplashScreen.preventAutoHideAsync();

function AppNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [appReady, setAppReady] = useState(false);
  const [wipeComplete, setWipeComplete] = useState(false);
  const { isDark } = useTheme();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAppReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (appReady) SplashScreen.hideAsync();
  }, [appReady]);

  if (!appReady) return null;

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="pin/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="location/[id]" />
      </Stack>

      {/* Açılış geçiş animasyonu */}
      {!wipeComplete && (
        <GridPixelateWipe
          playing={appReady}
          pattern="wave"
          duration={1000}
          cellFadeDuration={160}
          color={Colors.background}
          onComplete={() => setWipeComplete(true)}
        />
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <AppNavigator />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
