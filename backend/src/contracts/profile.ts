import { z } from 'zod';

export const rgbSchema = z
    .object({
        r: z.number().int().min(0).max(255),
        g: z.number().int().min(0).max(255),
        b: z.number().int().min(0).max(255),
    })
    .strict();

export const themePaletteSchema = z
    .object({
        accent: rgbSchema,
        background: rgbSchema,
        textPrimary: rgbSchema,
        textSecondary: rgbSchema,
    })
    .strict();

export const preferencesSchema = z
    .object({
        notification_time: z
            .string()
            .trim()
            .regex(/^\d{2}:\d{2}$/)
            .optional(),
        timezone: z.string().trim().min(1).optional(),
        notifications_paused: z.boolean().optional(),
        theme_palette: themePaletteSchema.optional(),
    })
    .strict();

export const themePayloadSchema = z
    .object({
        palette: themePaletteSchema,
    })
    .strict();

export type ThemePalette = z.infer<typeof themePaletteSchema>;
export type PreferencesPayload = z.infer<typeof preferencesSchema>;
export type ThemePayload = z.infer<typeof themePayloadSchema>;
