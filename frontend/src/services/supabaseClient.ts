/**
 * Supabase client for direct frontend uploads
 * Uses anon key for public bucket access
 */
import { createClient } from '@supabase/supabase-js';

// Get from environment or use production values
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://buqjktrypviesnucczjr.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only create client if we have the anon key
export const supabase = SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    })
    : null;

export const EVOLUTION_BUCKET = 'evolution-360';

/**
 * Upload a file directly to Supabase Storage
 */
export async function uploadToSupabase(
    bucket: string,
    path: string,
    data: ArrayBuffer | Blob,
    contentType: string
): Promise<string> {
    if (!supabase) {
        throw new Error('Supabase client not configured. Set VITE_SUPABASE_ANON_KEY in .env');
    }

    const { data: _result, error } = await supabase.storage
        .from(bucket)
        .upload(path, data, {
            contentType,
            upsert: true,
        });

    if (error) {
        throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);

    return publicUrl;
}

/**
 * Delete files from Supabase Storage
 */
export async function deleteFromSupabase(bucket: string, paths: string[]): Promise<void> {
    if (!supabase || paths.length === 0) return;

    const { error } = await supabase.storage
        .from(bucket)
        .remove(paths);

    if (error) {
        console.warn('[Supabase] Delete failed:', error.message);
    }
}
