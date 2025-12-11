/**
 * Script to create evolution-360 bucket in Supabase Storage
 * Run with: node scripts/create-evolution-bucket.js
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
});

const BUCKET_NAME = 'evolution-360';

async function createBucket() {
    console.log(`🔄 Creating bucket "${BUCKET_NAME}"...`);

    // Check if bucket already exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
        console.error('❌ Failed to list buckets:', listError.message);
        process.exit(1);
    }

    const exists = buckets.some(b => b.name === BUCKET_NAME);

    if (exists) {
        console.log(`✅ Bucket "${BUCKET_NAME}" already exists!`);
        return;
    }

    // Create bucket with public access
    const { data, error } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        fileSizeLimit: 10 * 1024 * 1024, // 10MB per file
    });

    if (error) {
        console.error('❌ Failed to create bucket:', error.message);
        process.exit(1);
    }

    console.log(`✅ Bucket "${BUCKET_NAME}" created successfully!`);
    console.log('   - Public access: enabled');
    console.log('   - Allowed types: jpeg, png, webp, gif');
    console.log('   - Max file size: 10MB');
}

createBucket().catch(err => {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
});
