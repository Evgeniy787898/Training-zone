/// <reference types="vite/client" />

export {};

declare global {
    const __CDN_ORIGIN__: string;
    interface Window {
        Telegram?: {
            WebApp?: {
                ready: () => void;
                expand: () => void;
                initData?: string;
                initDataUnsafe?: {
                    user?: {
                        id: number;
                        first_name: string;
                        last_name?: string;
                        username?: string;
                    };
                };
            };
        };
        __PINIA_INITIAL_STATE__?: Record<string, any>;
    }
}
