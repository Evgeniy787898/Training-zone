/**
 * Theme Engine (DS-V01)
 * 
 * GPT Atlas-style customizable themes:
 * - 10+ preset palettes (Ocean, Forest, Sunset, etc.)
 * - HSL-based color picker
 * - Gradient backgrounds support
 */

import { ref, computed, onMounted } from 'vue';

// Theme preset definition
export interface ThemePreset {
    id: string;
    name: string;
    description: string;
    colors: {
        accent: string;        // Primary accent (HSL)
        accentHover: string;   // Accent hover state
        background: string;    // Main background
        surface: string;       // Card/surface background
        text: string;          // Primary text
        textMuted: string;     // Secondary text
        border: string;        // Borders
    };
    gradientBg?: string;     // Optional gradient background
    isDark: boolean;
}

// 10+ Theme presets
export const THEME_PRESETS: ThemePreset[] = [
    {
        id: 'default',
        name: 'Стандартная',
        description: 'Нейтральная современная тема',
        colors: {
            accent: 'hsl(262, 83%, 58%)',
            accentHover: 'hsl(262, 83%, 48%)',
            background: 'hsl(0, 0%, 100%)',
            surface: 'hsl(220, 14%, 96%)',
            text: 'hsl(224, 71%, 4%)',
            textMuted: 'hsl(220, 9%, 46%)',
            border: 'hsl(220, 13%, 91%)',
        },
        isDark: false,
    },
    {
        id: 'ocean',
        name: 'Океан',
        description: 'Успокаивающие синие тона',
        colors: {
            accent: 'hsl(199, 89%, 48%)',
            accentHover: 'hsl(199, 89%, 38%)',
            background: 'hsl(200, 50%, 98%)',
            surface: 'hsl(200, 40%, 94%)',
            text: 'hsl(200, 80%, 10%)',
            textMuted: 'hsl(200, 30%, 40%)',
            border: 'hsl(200, 30%, 85%)',
        },
        gradientBg: 'linear-gradient(135deg, hsl(200, 50%, 95%) 0%, hsl(190, 60%, 90%) 100%)',
        isDark: false,
    },
    {
        id: 'forest',
        name: 'Лес',
        description: 'Природные зелёные оттенки',
        colors: {
            accent: 'hsl(142, 72%, 35%)',
            accentHover: 'hsl(142, 72%, 28%)',
            background: 'hsl(140, 30%, 98%)',
            surface: 'hsl(140, 25%, 94%)',
            text: 'hsl(140, 60%, 8%)',
            textMuted: 'hsl(140, 20%, 40%)',
            border: 'hsl(140, 20%, 85%)',
        },
        gradientBg: 'linear-gradient(135deg, hsl(140, 30%, 96%) 0%, hsl(120, 25%, 92%) 100%)',
        isDark: false,
    },
    {
        id: 'sunset',
        name: 'Закат',
        description: 'Тёплые оранжевые тона',
        colors: {
            accent: 'hsl(24, 95%, 53%)',
            accentHover: 'hsl(24, 95%, 43%)',
            background: 'hsl(30, 50%, 98%)',
            surface: 'hsl(30, 40%, 95%)',
            text: 'hsl(30, 60%, 10%)',
            textMuted: 'hsl(30, 25%, 45%)',
            border: 'hsl(30, 25%, 88%)',
        },
        gradientBg: 'linear-gradient(135deg, hsl(30, 50%, 95%) 0%, hsl(15, 60%, 90%) 100%)',
        isDark: false,
    },
    {
        id: 'neon',
        name: 'Неон',
        description: 'Яркий киберпанк стиль',
        colors: {
            accent: 'hsl(280, 100%, 60%)',
            accentHover: 'hsl(280, 100%, 50%)',
            background: 'hsl(260, 20%, 8%)',
            surface: 'hsl(260, 20%, 12%)',
            text: 'hsl(0, 0%, 95%)',
            textMuted: 'hsl(260, 15%, 60%)',
            border: 'hsl(260, 25%, 20%)',
        },
        gradientBg: 'linear-gradient(135deg, hsl(260, 25%, 10%) 0%, hsl(280, 30%, 8%) 100%)',
        isDark: true,
    },
    {
        id: 'midnight',
        name: 'Полночь',
        description: 'Глубокая тёмная тема',
        colors: {
            accent: 'hsl(217, 91%, 60%)',
            accentHover: 'hsl(217, 91%, 50%)',
            background: 'hsl(222, 47%, 11%)',
            surface: 'hsl(217, 33%, 17%)',
            text: 'hsl(210, 40%, 98%)',
            textMuted: 'hsl(215, 20%, 65%)',
            border: 'hsl(215, 28%, 25%)',
        },
        isDark: true,
    },
    {
        id: 'rose',
        name: 'Роза',
        description: 'Нежные розовые оттенки',
        colors: {
            accent: 'hsl(346, 77%, 50%)',
            accentHover: 'hsl(346, 77%, 40%)',
            background: 'hsl(350, 40%, 98%)',
            surface: 'hsl(350, 35%, 95%)',
            text: 'hsl(350, 50%, 10%)',
            textMuted: 'hsl(350, 20%, 45%)',
            border: 'hsl(350, 25%, 88%)',
        },
        gradientBg: 'linear-gradient(135deg, hsl(350, 40%, 97%) 0%, hsl(330, 45%, 94%) 100%)',
        isDark: false,
    },
    {
        id: 'monochrome',
        name: 'Монохром',
        description: 'Минималистичный чёрно-белый',
        colors: {
            accent: 'hsl(0, 0%, 15%)',
            accentHover: 'hsl(0, 0%, 25%)',
            background: 'hsl(0, 0%, 100%)',
            surface: 'hsl(0, 0%, 96%)',
            text: 'hsl(0, 0%, 9%)',
            textMuted: 'hsl(0, 0%, 45%)',
            border: 'hsl(0, 0%, 90%)',
        },
        isDark: false,
    },
    {
        id: 'lavender',
        name: 'Лаванда',
        description: 'Спокойные фиолетовые тона',
        colors: {
            accent: 'hsl(270, 70%, 55%)',
            accentHover: 'hsl(270, 70%, 45%)',
            background: 'hsl(270, 30%, 98%)',
            surface: 'hsl(270, 25%, 95%)',
            text: 'hsl(270, 50%, 12%)',
            textMuted: 'hsl(270, 20%, 50%)',
            border: 'hsl(270, 20%, 88%)',
        },
        gradientBg: 'linear-gradient(135deg, hsl(270, 30%, 96%) 0%, hsl(280, 35%, 93%) 100%)',
        isDark: false,
    },
    {
        id: 'slate',
        name: 'Сланец',
        description: 'Современная серо-синяя',
        colors: {
            accent: 'hsl(215, 20%, 45%)',
            accentHover: 'hsl(215, 20%, 35%)',
            background: 'hsl(215, 15%, 96%)',
            surface: 'hsl(215, 12%, 92%)',
            text: 'hsl(215, 25%, 15%)',
            textMuted: 'hsl(215, 12%, 50%)',
            border: 'hsl(215, 15%, 85%)',
        },
        isDark: false,
    },
];

// Storage key
const STORAGE_KEY = 'app-theme';

// Get saved theme
const getSavedTheme = (): string => {
    try {
        return localStorage.getItem(STORAGE_KEY) || 'default';
    } catch {
        return 'default';
    }
};

// Apply theme CSS variables
const applyTheme = (preset: ThemePreset): void => {
    const root = document.documentElement;

    // Set colors
    root.style.setProperty('--color-accent', preset.colors.accent);
    root.style.setProperty('--color-accent-hover', preset.colors.accentHover);
    root.style.setProperty('--color-bg-primary', preset.colors.background);
    root.style.setProperty('--color-bg-secondary', preset.colors.surface);
    root.style.setProperty('--color-text-primary', preset.colors.text);
    root.style.setProperty('--color-text-secondary', preset.colors.textMuted);
    root.style.setProperty('--color-border', preset.colors.border);

    // Set gradient background if available
    if (preset.gradientBg) {
        root.style.setProperty('--theme-gradient-bg', preset.gradientBg);
        document.body.style.background = preset.gradientBg;
    } else {
        root.style.removeProperty('--theme-gradient-bg');
        document.body.style.background = preset.colors.background;
    }

    // Toggle dark mode class
    if (preset.isDark) {
        document.body.classList.add('dark');
    } else {
        document.body.classList.remove('dark');
    }

    console.log(`[theme] Applied: ${preset.name}`);
};

// Global theme state
const currentThemeId = ref<string>(getSavedTheme());

/**
 * Vue composable for theme engine
 */
export const useThemeEngine = () => {
    // Current preset
    const currentPreset = computed(() =>
        THEME_PRESETS.find(p => p.id === currentThemeId.value) || THEME_PRESETS[0]
    );

    // All presets
    const presets = THEME_PRESETS;

    // Set theme
    const setTheme = (themeId: string) => {
        const preset = THEME_PRESETS.find(p => p.id === themeId);
        if (preset) {
            currentThemeId.value = themeId;
            localStorage.setItem(STORAGE_KEY, themeId);
            applyTheme(preset);
        }
    };

    // Toggle dark/light
    const toggleDarkMode = () => {
        const current = currentPreset.value;
        const opposite = THEME_PRESETS.find(p => p.isDark !== current.isDark);
        if (opposite) {
            setTheme(opposite.id);
        }
    };

    // Apply on mount
    onMounted(() => {
        applyTheme(currentPreset.value);
    });

    return {
        currentThemeId,
        currentPreset,
        presets,
        setTheme,
        toggleDarkMode,
        isDark: computed(() => currentPreset.value.isDark),
    };
};

export default {
    useThemeEngine,
    THEME_PRESETS,
};
