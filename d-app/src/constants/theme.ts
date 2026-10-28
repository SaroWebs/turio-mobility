import { Platform, useColorScheme } from 'react-native';

const shared = {
  brand: '#0F766E',
  brandStrong: '#115E59',
  brandSoft: '#DDF4EF',
  accent: '#E59A18',
  accentSoft: '#FFF4D6',
  success: '#16865A',
  warning: '#B76A0B',
  error: '#C2413B',
};

export const Colors = {
  light: {
    ...shared,
    background: '#F6F7F2',
    surface: '#FFFFFF',
    surfaceMuted: '#EEF1EB',
    text: '#172321',
    textSecondary: '#5F6F6B',
    textMuted: '#8A9793',
    border: '#DDE4DF',
    overlay: 'rgba(16, 42, 39, 0.46)',
  },
  dark: {
    ...shared,
    brand: '#52C7B6',
    brandStrong: '#85DDD0',
    brandSoft: '#173A35',
    accent: '#F2B84B',
    accentSoft: '#403015',
    background: '#0D1715',
    surface: '#15221F',
    surfaceMuted: '#1C2C28',
    text: '#F3F7F5',
    textSecondary: '#B3C0BC',
    textMuted: '#7F918C',
    border: '#29403A',
    overlay: 'rgba(0, 0, 0, 0.58)',
    success: '#5ED39D',
    warning: '#F2B84B',
    error: '#FF8B84',
  },
};

export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const Radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;
export const Typography = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800' as const },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800' as const },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const },
  body: { fontSize: 14, lineHeight: 21, fontWeight: '400' as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '700' as const },
};
export const CardShadow = Platform.select({
  ios: { shadowColor: '#102A27', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  android: { elevation: 3 },
  default: {},
});

export const useTheme = () => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { colors: isDark ? Colors.dark : Colors.light, isDark };
};
