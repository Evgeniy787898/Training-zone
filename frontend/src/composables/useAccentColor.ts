/**
 * Composable for managing accent color presets.
 * DS-001: Расширение цветовой палитры акцентов
 */
import { ref } from 'vue';

export type AccentColorKey = 'emerald' | 'violet' | 'amber' | 'rose' | 'cyan';

export interface AccentColorPreset {
    key: AccentColorKey;
    name: string;
    primary: string;
    hover: string;
    subtle: string;
}

export const ACCENT_PRESETS: Record<AccentColorKey, AccentColorPreset> = {
    emerald: {
        key: 'emerald',
        name: 'Изумруд',
        primary: '#10a37f',
        hover: '#1a7f64',
        subtle: 'rgba(16, 163, 127, 0.1)',
    },
    violet: {
        key: 'violet',
        name: 'Фиолетовый',
        primary: '#8b5cf6',
        hover: '#7c3aed',
        subtle: 'rgba(139, 92, 246, 0.1)',
    },
    amber: {
        key: 'amber',
        name: 'Янтарь',
        primary: '#f59e0b',
        hover: '#d97706',
        subtle: 'rgba(245, 158, 11, 0.1)',
    },
    rose: {
        key: 'rose',
        name: 'Роза',
        primary: '#f43f5e',
        hover: '#e11d48',
        subtle: 'rgba(244, 63, 94, 0.1)',
    },
    cyan: {
        key: 'cyan',
        name: 'Бирюза',
        primary: '#06b6d4',
        hover: '#0891b2',
        subtle: 'rgba(6, 182, 212, 0.1)',
    },
};

// THEME-F02: Full color scheme presets
export type ThemePresetKey = 'default' | 'ocean' | 'forest' | 'sunset';

export interface ThemePreset {
    key: ThemePresetKey;
    name: string;
    emoji: string;
    colors: {
        bg: string;
        bgSecondary: string;
        bgElevated: string;
        textPrimary: string;
        textSecondary: string;
        accent: string;
        accentHover: string;
        border: string;
    };
}

export const THEME_PRESETS: Record<ThemePresetKey, ThemePreset> = {
    default: {
        key: 'default',
        name: 'Стандартная',
        emoji: '⚙️',
        colors: {
            bg: '#343541',
            bgSecondary: '#202123',
            bgElevated: '#2A2B32',
            textPrimary: '#ececf1',
            textSecondary: '#c5c5d2',
            accent: '#10a37f',
            accentHover: '#1a7f64',
            border: '#4d4d4f',
        },
    },
    ocean: {
        key: 'ocean',
        name: 'Океан',
        emoji: '🌊',
        colors: {
            bg: '#0f172a',
            bgSecondary: '#1e293b',
            bgElevated: '#334155',
            textPrimary: '#e2e8f0',
            textSecondary: '#94a3b8',
            accent: '#0ea5e9',
            accentHover: '#0284c7',
            border: '#475569',
        },
    },
    forest: {
        key: 'forest',
        name: 'Лес',
        emoji: '🌲',
        colors: {
            bg: '#14201a',
            bgSecondary: '#1a2e24',
            bgElevated: '#234034',
            textPrimary: '#d1e7dd',
            textSecondary: '#8fbfa5',
            accent: '#22c55e',
            accentHover: '#16a34a',
            border: '#3d5a4c',
        },
    },
    sunset: {
        key: 'sunset',
        name: 'Закат',
        emoji: '🌅',
        colors: {
            bg: '#1c1317',
            bgSecondary: '#2d1f24',
            bgElevated: '#3d2b32',
            textPrimary: '#fce7f3',
            textSecondary: '#f9a8d4',
            accent: '#f97316',
            accentHover: '#ea580c',
            border: '#5a3f47',
        },
    },
};

const STORAGE_KEY = 'tzona-accent-color';
const THEME_STORAGE_KEY = 'tzona-theme-preset'; // THEME-F02
const DEFAULT_ACCENT: AccentColorKey = 'emerald';
const DEFAULT_THEME: ThemePresetKey = 'default'; // THEME-F02

const currentAccent = ref<AccentColorKey>(DEFAULT_ACCENT);
const currentThemePreset = ref<ThemePresetKey>(DEFAULT_THEME); // THEME-F02

function applyAccentToDOM(accent: AccentColorKey): void {
    const preset = ACCENT_PRESETS[accent];
    if (!preset) return;

    const root = document.documentElement;
    root.style.setProperty('--color-accent', preset.primary);
    root.style.setProperty('--color-accent-hover', preset.hover);
    root.style.setProperty('--color-accent-subtle', preset.subtle);
    // Also update success color to match accent
    root.style.setProperty('--color-success', preset.primary);
}

// THEME-F02: Apply full theme preset
function applyThemePresetToDOM(themeKey: ThemePresetKey): void {
    const theme = THEME_PRESETS[themeKey];
    if (!theme) return;

    const root = document.documentElement;
    const c = theme.colors;

    root.style.setProperty('--color-bg', c.bg);
    root.style.setProperty('--color-bg-secondary', c.bgSecondary);
    root.style.setProperty('--color-bg-elevated', c.bgElevated);
    root.style.setProperty('--color-bg-modal', c.bgSecondary);
    root.style.setProperty('--color-text-primary', c.textPrimary);
    root.style.setProperty('--color-text-secondary', c.textSecondary);
    root.style.setProperty('--color-accent', c.accent);
    root.style.setProperty('--color-accent-hover', c.accentHover);
    root.style.setProperty('--color-success', c.accent);
    root.style.setProperty('--color-border', c.border);
}

function saveToStorage(accent: AccentColorKey): void {
    try {
        localStorage.setItem(STORAGE_KEY, accent);
    } catch {
        // Ignore storage errors
    }
}

function saveThemeToStorage(theme: ThemePresetKey): void {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
        // Ignore storage errors
    }
}

export function useAccentColor() {
    const setAccent = (accent: AccentColorKey) => {
        if (!(accent in ACCENT_PRESETS)) return;
        currentAccent.value = accent;
        applyAccentToDOM(accent);
        saveToStorage(accent);
    };

    // THEME-F02: Set full theme preset
    const setThemePreset = (theme: ThemePresetKey) => {
        if (!(theme in THEME_PRESETS)) return;
        currentThemePreset.value = theme;
        applyThemePresetToDOM(theme);
        saveThemeToStorage(theme);
    };

    // NOTE: Theme management is now handled by app.ts store
    // This composable is kept for backwards compatibility with ProgressPhotoUpload.vue

    return {
        currentAccent,
        setAccent,
        presets: ACCENT_PRESETS,
        presetList: Object.values(ACCENT_PRESETS),
        // THEME-F02 exports
        currentThemePreset,
        setThemePreset,
        themePresets: THEME_PRESETS,
        themePresetList: Object.values(THEME_PRESETS),
    };
}

// DISABLED: This auto-initialization conflicts with app.ts accent management
// The app.ts store is now the single source of truth for accent colors.
// Do not apply accent on module import - let app.ts handle it.
// 
// if (typeof window !== 'undefined') {
//     const stored = loadFromStorage();
//     currentAccent.value = stored;
//     if (document.readyState === 'loading') {
//         document.addEventListener('DOMContentLoaded', () => applyAccentToDOM(stored));
//     } else {
//         applyAccentToDOM(stored);
//     }
// }
