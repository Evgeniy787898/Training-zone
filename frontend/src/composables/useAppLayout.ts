import { ref, onMounted, onUnmounted } from 'vue';

const GRID_LAYOUT_QUERY = '(min-width: 1024px)';

export function useAppLayout() {
    const isGridLayoutActive = ref(false);
    const heroExpanded = ref(false);

    let gridLayoutMediaQuery: MediaQueryList | null = null;

    const applyGridLayoutPreference = (matches: boolean) => {
        isGridLayoutActive.value = matches;
        // On desktop grid, always expand hero. On mobile, start collapsed.
        if (matches) {
            heroExpanded.value = true;
        } else {
            heroExpanded.value = false;
        }
    };

    const handleGridLayoutChange = (e: MediaQueryListEvent) => {
        applyGridLayoutPreference(e.matches);
    };

    const setupLayoutListener = () => {
        if (typeof window === 'undefined') return;

        gridLayoutMediaQuery = window.matchMedia(GRID_LAYOUT_QUERY);
        applyGridLayoutPreference(gridLayoutMediaQuery.matches);
        gridLayoutMediaQuery.addEventListener('change', handleGridLayoutChange);
    };

    const cleanupLayoutListener = () => {
        if (gridLayoutMediaQuery) {
            gridLayoutMediaQuery.removeEventListener('change', handleGridLayoutChange);
        }
    };

    onMounted(() => {
        setupLayoutListener();
    });

    onUnmounted(() => {
        cleanupLayoutListener();
    });

    return {
        isGridLayoutActive,
        heroExpanded
    };
}
