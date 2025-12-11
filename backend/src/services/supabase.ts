import { createClient } from '@supabase/supabase-js';
import config from '../config/env.js';

if (!config.supabase.url || !config.supabase.serviceKey) {
    throw new Error('Missing Supabase configuration');
}

// Create a single instance of the Supabase client
// We use the service key because the backend operates with full privileges
export const supabase = createClient(config.supabase.url, config.supabase.serviceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
