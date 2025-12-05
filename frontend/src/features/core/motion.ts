const MOTION_DATA_ATTR = 'data-motion';
const MOTION_REDUCED_VALUE = 'reduced';
const MOTION_DEFAULT_VALUE = 'normal';
const REDUCED_DURATION = '0s';

const applyMotionPreference = (prefersReduced: boolean) => {
    const root = document.documentElement;
    const durationFast = prefersReduced ? REDUCED_DURATION : getComputedStyle(root).getPropertyValue('--duration-fast').trim() || '0.18s';
    const durationBase = prefersReduced ? REDUCED_DURATION : getComputedStyle(root).getPropertyValue('--duration-base').trim() || '0.32s';
    const durationSlow = prefersReduced ? REDUCED_DURATION : getComputedStyle(root).getPropertyValue('--duration-slow').trim() || '0.55s';

    root.style.setProperty('--duration-fast', durationFast);
    root.style.setProperty('--duration-base', durationBase);
    root.style.setProperty('--duration-slow', durationSlow);

    root.style.setProperty('--transition-fast', `all ${durationFast} ease`);
    root.style.setProperty('--transition-base', `all ${durationBase} ease`);
    root.style.setProperty('--transition-slow', `all ${durationSlow} ease`);

    root.setAttribute(MOTION_DATA_ATTR, prefersReduced ? MOTION_REDUCED_VALUE : MOTION_DEFAULT_VALUE);
};

export const initMotionPreferences = (): void => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    applyMotionPreference(mediaQuery.matches);

    mediaQuery.addEventListener('change', (event) => applyMotionPreference(event.matches));
};
