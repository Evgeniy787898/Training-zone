import { defineConfig, loadEnv, splitVendorChunkPlugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const assetBase = env.VITE_STATIC_CDN_BASE || env.VITE_ASSET_BASE || '/';
    const publicBase = assetBase.endsWith('/') ? assetBase : `${assetBase}/`;
    const shouldAnalyze = env.ANALYZE_BUNDLE === 'true' || env.ANALYZE_BUNDLE === '1';
    const shouldDropConsole = env.VITE_DROP_CONSOLE !== 'false';

    const plugins = [
        vue(),
        splitVendorChunkPlugin(),
        VitePWA({
            registerType: 'autoUpdate',
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.ts',
            includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'offline.html'],
            manifest: {
                name: 'TZONA Coach',
                short_name: 'TZONA',
                description: 'Персональные тренировки TZONA доступны даже офлайн.',
                theme_color: '#0f172a',
                background_color: '#020617',
                display: 'standalone',
                scope: publicBase,
                start_url: publicBase,
                lang: 'ru',
                icons: [
                    {
                        src: `${publicBase}icons/icon-192.png`,
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any maskable',
                    },
                    {
                        src: `${publicBase}icons/icon-512.png`,
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable',
                    },
                ],
            },
            devOptions: {
                enabled: false, // Disabled in dev to avoid MIME type issues with ngrok
                type: 'module',
                navigateFallback: 'index.html',
            },
            injectManifest: {
                globPatterns: ['**/*.{js,css,html,svg,png,woff2,woff,ttf,json}'],
            },
        }),
    ];

    if (shouldAnalyze) {
        plugins.push(
            visualizer({
                template: 'treemap',
                filename: 'bundle-analysis.html',
                emitFile: true,
                gzipSize: true,
                brotliSize: true,
                projectRoot: process.cwd(),
            })
        );
    }

    return {
        base: assetBase,
        plugins,
        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url)),
                '@backend-types': fileURLToPath(new URL('../backend/src/types', import.meta.url))
            }
        },
        build: {
            manifest: true,
            ssrManifest: true,
            cssCodeSplit: true,
            target: 'es2020',
            reportCompressedSize: false,
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        if (id.includes('node_modules')) {
                            if (id.includes('workbox-')) {
                                return 'vendor-workbox';
                            }
                            if (id.includes('@vueuse')) {
                                return 'vendor-vueuse';
                            }
                            if (id.includes('date-fns')) {
                                return 'vendor-date-fns';
                            }
                            if (id.includes('axios')) {
                                return 'vendor-axios';
                            }
                            if (id.includes('vue')) {
                                return 'vendor-vue';
                            }
                            if (id.includes('pinia') || id.includes('vue-router')) {
                                return 'vendor-state';
                            }
                            return 'vendor';
                        }
                        return undefined;
                    },
                },
            },
            esbuild: {
                drop: shouldDropConsole ? ['console', 'debugger'] : ['debugger'],
                legalComments: 'none',
            },
        },
        server: {
            port: 3000,
            host: '0.0.0.0', // Разрешить доступ с любого хоста
            allowedHosts: [
                '.ngrok-free.dev', // Разрешить все ngrok хосты (free план)
                '.ngrok.io', // Разрешить все ngrok.io хосты (на случай если используется другой план)
                'localhost',
                '127.0.0.1'
            ],
            headers: {
                // Disable unsupported/legacy features to avoid WebView warnings
                'Permissions-Policy': 'accelerometer=(), gyroscope=(), magnetometer=(), camera=(), microphone=()',
                // Allow fonts from same origin and CDN
                'Content-Security-Policy': "default-src 'self' https://telegram.org https://*.ngrok-free.dev https://*.ngrok.io; font-src 'self' data: https://fonts.gstatic.com https://*.ngrok-free.dev https://*.ngrok.io; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.ngrok-free.dev https://*.ngrok.io; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://telegram.org https://*.ngrok-free.dev https://*.ngrok.io; img-src 'self' data: https: blob:; connect-src 'self' https://telegram.org https://*.ngrok-free.dev https://*.ngrok.io wss://*.ngrok-free.dev wss://*.ngrok.io;"
            },
            proxy: {
                '/api': {
                    target: 'http://localhost:3001',
                    changeOrigin: true
                }
            },
            middlewareMode: false,
            fs: {
                allow: ['..']
            }
        },
        // Fix Service Worker MIME type for ngrok
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                // Fix Content-Type for Service Worker files (ngrok may change it)
                const url = req.url || '';
                if (url.includes('dev-sw.js') || url.includes('sw.js') || (url.endsWith('.js') && url.includes('sw'))) {
                    // Set correct MIME type before Vite processes the request
                    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
                }
                next();
            });
        },
        define: {
            __CDN_ORIGIN__: JSON.stringify(env.VITE_CDN_ORIGIN || assetBase || ''),
            __VUE_PROD_DEVTOOLS__: false,
        },
    };
});
