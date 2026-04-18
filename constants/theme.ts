// Fütüristik Siyah/Beyaz Tema
export const LightColors = {
  background: '#ffffff',
  surface: '#f7f7f7',
  surfaceElevated: '#eeeeee',
  border: 'rgba(0,0,0,0.09)',

  primary: '#0a0a0a',
  primaryDark: '#000000',
  primaryLight: '#2a2a2a',

  accent: '#1a1a1a',
  accentTeal: '#444444',
  accentPink: '#666666',
  accentGreen: '#444444',
  accentBlue: '#666666',

  text: '#0a0a0a',
  textSecondary: '#4a4a4a',
  textMuted: '#aaaaaa',

  mapBackground: '#f0f0f0',

  coin: '#6b5c00',
  coinDark: '#4a4000',

  success: '#1a7a1a',
  warning: '#8a6a00',
  error: '#cc1a1a',

  tabBar: '#ffffff',
  tabBarBorder: 'rgba(0,0,0,0.07)',
};

export const DarkColors = {
  background: '#080808',
  surface: '#111111',
  surfaceElevated: '#1a1a1a',
  border: 'rgba(255,255,255,0.08)',

  primary: '#f0f0f0',
  primaryDark: '#cccccc',
  primaryLight: '#ffffff',

  accent: '#e0e0e0',
  accentTeal: '#c0c0c0',
  accentPink: '#d0c8c8',
  accentGreen: '#c0c0c0',
  accentBlue: '#d0c8c8',

  text: '#f5f5f5',
  textSecondary: '#888888',
  textMuted: '#444444',

  mapBackground: '#050505',

  coin: '#d4c070',
  coinDark: '#b0a050',

  success: '#50c050',
  warning: '#c8a840',
  error: '#e04040',

  tabBar: '#080808',
  tabBarBorder: 'rgba(255,255,255,0.06)',
};

// Aktif tema
export const Colors = DarkColors;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, color: Colors.text, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const, color: Colors.text, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '600' as const, color: Colors.text },
  body: { fontSize: 15, fontWeight: '400' as const, color: Colors.text },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, color: Colors.textSecondary },
  caption: { fontSize: 11, fontWeight: '400' as const, color: Colors.textMuted },
  label: { fontSize: 12, fontWeight: '600' as const, color: Colors.textSecondary, letterSpacing: 0.3 },
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primary: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
};
