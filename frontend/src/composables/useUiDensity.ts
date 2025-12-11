/**
 * Adaptive UI Density (FE-V04)
 * 
 * Dynamic interface density: Compact, Comfortable, Focus.
 * Changes spacing, font sizes, and element visibility.
 */

import { ref, computed, watch, onMounted } from 'vue';

// UI Density modes
export type UiDensity = 'compact' | 'comfortable' | 'focus';

// Density configuration
interface DensityConfig {
    name: string;
    description: string;
    spacing: {
        xs: string;
        sm: string;
        md: string;
        lg: string;
        xl: string;
    };
    fontSize: {
        sm: string;
        base: string;
        lg: string;
        xl: string;
    };
    borderRadius: string;
    cardPadding: string;
    showSecondaryInfo: boolean;
    showAnimations: boolean;
}

// Density presets
const DENSITY_CONFIGS: Record<UiDensity, DensityConfig> = {
    compact: {
        name: 'Компактный',
        description: 'Максимум информации на экране',
        spacing: {
            xs: '2px',
            sm: '4px',
            md: '8px',
            lg: '12px',
            xl: '16px',
        },
        fontSize: {
            sm: '11px',
            base: '13px',
            lg: '15px',
            xl: '18px',
        },
        borderRadius: '6px',
        cardPadding: '8px',
        showSecondaryInfo: true,
        showAnimations: true,
    },
    comfortable: {
        name: 'Комфортный',
        description: 'Баланс информации и удобства',
        spacing: {
            xs: '4px',
            sm: '8px',
            md: '16px',
            lg: '24px',
            xl: '32px',
        },
        fontSize: {
            sm: '12px',
            base: '14px',
            lg: '18px',
            xl: '24px',
        },
        borderRadius: '12px',
        cardPadding: '16px',
        showSecondaryInfo: true,
        showAnimations: true,
    },
    focus: {
        name: 'Фокус',
        description: 'Минимум отвлечений, максимум фокуса',
        spacing: {
            xs: '8px',
            sm: '16px',
            md: '24px',
            lg: '32px',
            xl: '48px',
        },
        fontSize: {
            sm: '14px',
            base: '18px',
            lg: '24px',
            xl: '32px',
        },
        borderRadius: '16px',
        cardPadding: '24px',
        showSecondaryInfo: false,
        showAnimations: false,
    },
};

// Storage key for persistence
const STORAGE_KEY = 'ui-density';

// Get saved density from localStorage
const getSavedDensity = (): UiDensity => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && (saved === 'compact' || saved === 'comfortable' || saved === 'focus')) {
            return saved as UiDensity;
        }
    } catch (e) {
        console.warn('[ui-density] Failed to read saved density:', e);
    }
    return 'comfortable'; // Default
};

// Save density to localStorage
const saveDensity = (density: UiDensity): void => {
    try {
        localStorage.setItem(STORAGE_KEY, density);
    } catch (e) {
        console.warn('[ui-density] Failed to save density:', e);
    }
};

// Apply density CSS variables to document
const applyDensityCss = (config: DensityConfig): void => {
    const root = document.documentElement;

    // Spacing
    root.style.setProperty('--density-spacing-xs', config.spacing.xs);
    root.style.setProperty('--density-spacing-sm', config.spacing.sm);
    root.style.setProperty('--density-spacing-md', config.spacing.md);
    root.style.setProperty('--density-spacing-lg', config.spacing.lg);
    root.style.setProperty('--density-spacing-xl', config.spacing.xl);

    // Font sizes
    root.style.setProperty('--density-font-sm', config.fontSize.sm);
    root.style.setProperty('--density-font-base', config.fontSize.base);
    root.style.setProperty('--density-font-lg', config.fontSize.lg);
    root.style.setProperty('--density-font-xl', config.fontSize.xl);

    // Other
    root.style.setProperty('--density-radius', config.borderRadius);
    root.style.setProperty('--density-card-padding', config.cardPadding);

    // Toggle classes on body
    document.body.classList.remove('density-compact', 'density-comfortable', 'density-focus');
    document.body.classList.add(`density-${saveDensity}`);

    console.log(`[ui-density] Applied: ${config.name}`);
};

// Global reactive density state
const currentDensity = ref<UiDensity>(getSavedDensity());

/**
 * Vue composable for UI density
 */
export const useUiDensity = () => {
    const density = currentDensity;

    // Current config
    const config = computed(() => DENSITY_CONFIGS[density.value]);

    // Available densities
    const densities = Object.entries(DENSITY_CONFIGS).map(([key, cfg]) => ({
        key: key as UiDensity,
        name: cfg.name,
        description: cfg.description,
    }));

    // Set density
    const setDensity = (newDensity: UiDensity) => {
        density.value = newDensity;
        saveDensity(newDensity);
        applyDensityCss(DENSITY_CONFIGS[newDensity]);
    };

    // Cycle through densities
    const cycleDensity = () => {
        const order: UiDensity[] = ['comfortable', 'compact', 'focus'];
        const currentIndex = order.indexOf(density.value);
        const nextIndex = (currentIndex + 1) % order.length;
        setDensity(order[nextIndex]);
    };

    // Apply on mount
    onMounted(() => {
        applyDensityCss(config.value);
    });

    // Watch for changes
    watch(density, (newDensity) => {
        applyDensityCss(DENSITY_CONFIGS[newDensity]);
    });

    return {
        density,
        config,
        densities,
        setDensity,
        cycleDensity,
        showSecondaryInfo: computed(() => config.value.showSecondaryInfo),
        showAnimations: computed(() => config.value.showAnimations),
    };
};

export default {
    useUiDensity,
    DENSITY_CONFIGS,
};
