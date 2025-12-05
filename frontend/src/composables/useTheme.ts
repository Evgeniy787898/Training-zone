import { ref, computed } from 'vue';

type Theme = 'light' | 'dark' | 'auto';
type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'tzona-theme';

// Shared state across all components
const theme = ref<Theme>('auto');
const resolvedTheme = ref<ResolvedTheme>('dark'); // Default to dark

/**
 * Get Telegram WebApp theme if available
 */
function getTelegramTheme(): ResolvedTheme | null {
    if (typeof window === 'undefined') return null;

    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return null;

    // Telegram provides colorScheme: 'light' | 'dark'
    return tg.colorScheme === 'light' ? 'light' : 'dark';
}

/**
 * Get system theme preference
 */
function getSystemTheme(): ResolvedTheme {
    if (typeof window === 'undefined') return 'dark';

    return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
}

/**
 * Resolve theme to actual 'light' or 'dark'
 */
function resolveTheme(themeValue: Theme): ResolvedTheme {
    if (themeValue !== 'auto') {
        return themeValue;
    }

    // Priority: Telegram > System
    const telegramTheme = getTelegramTheme();
    if (telegramTheme) {
        return telegramTheme;
    }

    return getSystemTheme();
}

/**
 * Apply theme to DOM
 */
function applyTheme(resolved: ResolvedTheme) {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;

    if (resolved === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }

    resolvedTheme.value = resolved;
}

/**
 * Load theme from localStorage
 */
function loadThemeFromStorage(): Theme {
    if (typeof localStorage === 'undefined') return 'auto';

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'auto') {
        return stored;
    }

    return 'auto';
}

/**
 * Save theme to localStorage
 */
function saveThemeToStorage(themeValue: Theme) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, themeValue);
}

/**
 * Vue composable for theme management
 */
export function useTheme() {
    const isDark = computed(() => resolvedTheme.value === 'dark');

    /**
     * Set theme ('light' | 'dark' | 'auto')
     */
    function setTheme(newTheme: Theme) {
        theme.value = newTheme;
        saveThemeToStorage(newTheme);

        const resolved = resolveTheme(newTheme);
        applyTheme(resolved);
    }

    /**
     * Toggle between light and dark (sets explicit theme, not auto)
     */
    function toggleTheme() {
        const newTheme: Theme = isDark.value ? 'light' : 'dark';
        setTheme(newTheme);
    }

    /**
     * Initialize theme on mount
     */
    function initializeTheme() {
        // Load from storage
        const storedTheme = loadThemeFromStorage();
        theme.value = storedTheme;

        // Resolve and apply
        const resolved = resolveTheme(storedTheme);
        applyTheme(resolved);

        // Listen to system theme changes (only if theme is 'auto')
        if (typeof window !== 'undefined') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', () => {
                if (theme.value === 'auto') {
                    const resolved = resolveTheme('auto');
                    applyTheme(resolved);
                }
            });
        }

        // Listen to Telegram theme changes
        if (typeof window !== 'undefined') {
            const tg = (window as any).Telegram?.WebApp;
            if (tg && tg.onEvent) {
                tg.onEvent('themeChanged', () => {
                    if (theme.value === 'auto') {
                        const resolved = resolveTheme('auto');
                        applyTheme(resolved);
                    }
                });
            }
        }
    }

    // Auto-initialize removed to avoid "onMounted called without active instance" warning
    // initializeTheme() should be called explicitly in App.vue or entry-client.ts

    return {
        theme: computed(() => theme.value),
        resolvedTheme: computed(() => resolvedTheme.value),
        isDark,
        setTheme,
        toggleTheme,
        initializeTheme,
    };
}
