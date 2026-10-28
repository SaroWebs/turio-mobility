import { Platform, useColorScheme } from 'react-native';
import { usePreferences } from '../store/preferences';

const shared = {
    brand: '#0F766E',
    brandStrong: '#115E59',
    brandSoft: '#DDF4EF',
    accent: '#E59A18',
    accentSoft: '#FFF4D6',
    success: '#16865A',
    warning: '#B76A0B',
    error: '#C2413B',
    // Inspiration Palette Additions
    luxuryBlack: '#09090B',
    luxuryDark: '#121215',
    luxuryCard: '#18181B',
    travelBlue: '#2563EB',
    travelBlueSoft: '#EFF6FF',
    travelBlueDark: '#1D4ED8',
    taxiYellow: '#F59E0B',
    taxiYellowSoft: '#FEF3C7',
    taxiYellowStrong: '#D97706',
};

export const Colors = {
    light: {
        ...shared,
        background: '#F8FAFC',
        surface: '#FFFFFF',
        surfaceMuted: '#F1F5F9',
        card: '#FFFFFF',
        text: '#0F172A',
        textSecondary: '#475569',
        textMuted: '#94A3B8',
        border: '#E2E8F0',
        borderSubtle: '#F1F5F9',
        overlay: 'rgba(15, 23, 42, 0.45)',
        badgeBg: '#F1F5F9',
        starGold: '#F59E0B',
        tabActiveBg: '#09090B',
        tabActiveText: '#FFFFFF',
    },
    dark: {
        ...shared,
        brand: '#52C7B6',
        brandStrong: '#85DDD0',
        brandSoft: '#173A35',
        accent: '#F2B84B',
        accentSoft: '#403015',
        background: '#09090B',
        surface: '#121215',
        surfaceMuted: '#18181B',
        card: '#18181B',
        text: '#F8FAFC',
        textSecondary: '#94A3B8',
        textMuted: '#64748B',
        border: '#27272A',
        borderSubtle: '#1E293B',
        overlay: 'rgba(0, 0, 0, 0.65)',
        badgeBg: '#27272A',
        starGold: '#FBBF24',
        tabActiveBg: '#F8FAFC',
        tabActiveText: '#09090B',
        success: '#5ED39D',
        warning: '#F2B84B',
        error: '#FF8B84',
    },
};

export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const Radius = { xs: 6, sm: 10, md: 16, lg: 20, card: 20, sheet: 28, pill: 999, full: 999 } as const;
export const Typography = {
    display: { fontSize: 28, lineHeight: 34, fontWeight: '800' as const },
    title: { fontSize: 22, lineHeight: 28, fontWeight: '800' as const },
    heading: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const },
    subheading: { fontSize: 15, lineHeight: 20, fontWeight: '600' as const },
    body: { fontSize: 14, lineHeight: 21, fontWeight: '400' as const },
    caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
    label: { fontSize: 12, lineHeight: 16, fontWeight: '700' as const },
};
export const CardShadow = Platform.select({
    ios: { shadowColor: '#09090B', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
    android: { elevation: 3 },
    default: {},
});
export const FloatingShadow = Platform.select({
    ios: { shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 6 },
    default: {},
});

export const useTheme = () => {
    const scheme = useColorScheme();
    const appearance = usePreferences(state => state.appearance);
    const isDark = (appearance === 'system' ? scheme : appearance) === 'dark';
    return { colors: isDark ? Colors.dark : Colors.light, isDark };
};
