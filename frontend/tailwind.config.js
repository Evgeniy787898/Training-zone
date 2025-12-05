/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{vue,js,ts,jsx,tsx}",
    ],
    darkMode: 'class', // Enable class-based dark mode
    theme: {
        extend: {
            colors: {
                // Background colors
                'bg-primary': 'var(--color-bg)',
                'bg-secondary': 'var(--color-bg-secondary)',
                'bg-elevated': 'var(--color-bg-elevated)',
                'bg-modal': 'var(--color-bg-modal)',

                // Text colors
                'text-primary': 'var(--color-text-primary)',
                'text-secondary': 'var(--color-text-secondary)',
                'text-muted': 'var(--color-text-muted)',
                'text-inverse': 'var(--color-text-inverse)',

                // Accent colors
                'accent': 'var(--color-accent)',
                'accent-hover': 'var(--color-accent-hover)',
                'accent-contrast': 'var(--color-accent-contrast)',
                'accent-subtle': 'var(--color-accent-subtle)',

                // Border colors
                'border': 'var(--color-border)',
                'border-subtle': 'var(--color-border-subtle)',
                'border-strong': 'var(--color-border-strong)',

                // Functional colors
                'danger': 'var(--color-danger)',
                'warning': 'var(--color-warning)',
                'success': 'var(--color-success)',
                'info': 'var(--color-info)',
            },
            boxShadow: {
                'xs': 'var(--shadow-xs)',
                'sm': 'var(--shadow-sm)',
                'md': 'var(--shadow-md)',
                'lg': 'var(--shadow-lg)',
                'xl': 'var(--shadow-xl)',
            },
            borderRadius: {
                'sm': 'var(--radius-sm)',
                'md': 'var(--radius-md)',
                'lg': 'var(--radius-lg)',
                'xl': 'var(--radius-xl)',
                'full': 'var(--radius-full)',
            },
            spacing: {
                'xs': 'var(--space-xs)',
                'sm': 'var(--space-sm)',
                'md': 'var(--space-md)',
                'lg': 'var(--space-lg)',
                'xl': 'var(--space-xl)',
            },
            fontFamily: {
                'base': 'var(--font-family-base)',
            },
            fontSize: {
                'xs': 'var(--font-size-xs)',
                'sm': 'var(--font-size-sm)',
                'base': 'var(--font-size-base)',
                'lg': 'var(--font-size-lg)',
                'xl': 'var(--font-size-xl)',
                '2xl': 'var(--font-size-2xl)',
                '3xl': 'var(--font-size-3xl)',
            },
            transitionDuration: {
                'theme': '300ms',
            },
            transitionTimingFunction: {
                'theme': 'cubic-bezier(0.4, 0, 0.2, 1)',
            },
        },
    },
    plugins: [],
}
