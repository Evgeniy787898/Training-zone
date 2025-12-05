import { z } from 'zod';

const envSchema = z.object({
    VITE_API_BASE_URL: z
        .string()
        .trim()
        .min(1, { message: 'VITE_API_BASE_URL is required (e.g. https://api.example.com)' }),
    VITE_STATIC_CDN_BASE: z.string().trim().optional(),
    VITE_ASSET_BASE: z.string().trim().optional(),
    BASE_URL: z.string().trim().default('/'),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Environment validation failed', parsed.error.format());
    throw new Error('Invalid Vite environment configuration');
}

export const env = parsed.data;
