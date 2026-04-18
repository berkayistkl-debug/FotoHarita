import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { DarkColors, LightColors } from '@constants/theme';
import { useColorScheme } from 'react-native';

const storageGet = (key: string) => SecureStore.getItemAsync(key);
const storageSet = (key: string, value: string) => SecureStore.setItemAsync(key, value);

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeCtx {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  isDark: boolean;
  colors: typeof DarkColors;
  ready: boolean;
}

const ThemeContext = createContext<ThemeCtx>({
  mode: 'dark',
  setMode: () => {},
  isDark: true,
  colors: DarkColors,
  ready: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    storageGet('theme_mode').then((v) => {
      if (v === 'dark' || v === 'light' || v === 'system') {
        setModeState(v);
      }
      setReady(true);
    });
  }, []);

  const setMode = async (m: ThemeMode) => {
    setModeState(m);
    await storageSet('theme_mode', m);
  };

  const isDark =
    mode === 'dark' ||
    (mode === 'system' && (systemScheme === 'dark' || systemScheme === null));

  const colors = isDark ? DarkColors : LightColors;

  return (
    <ThemeContext.Provider value={{ mode, setMode, isDark, colors, ready }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
