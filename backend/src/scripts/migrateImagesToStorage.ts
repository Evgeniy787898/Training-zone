import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const prisma = new PrismaClient();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY; // Must be service role key to bypass RLS if needed

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const BUCKET_NAME = 'exercise-images';

async function main() {
    console.log('Starting image migration...');

    // 1. Fetch all backup records
    // We use raw query because _backup_exercise_images is not in Prisma schema
    const backups = await prisma.$queryRaw<any[]>`
        SELECT * FROM "_backup_exercise_images"
    `;

    console.log(`Found ${backups.length} backup records.`);

    // Ensure bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
        console.error('Error listing buckets:', listError.message);
    } else {
        const bucketExists = buckets.find(b => b.name === BUCKET_NAME);
        if (!bucketExists) {
            console.log(`Bucket ${BUCKET_NAME} not found. Creating...`);
            const { data: newBucket, error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
                public: true,
                fileSizeLimit: 5242880, // 5MB
                allowedMimeTypes: ['image/webp', 'image/png', 'image/jpeg']
            });
            if (createError) {
                console.error('Error creating bucket:', createError.message);
                // Try to continue anyway, maybe it exists but listing failed?
            } else {
                console.log('Bucket created successfully.');
            }
        } else {
            console.log(`Bucket ${BUCKET_NAME} exists.`);
        }
    }

    let successCount = 0;
    let errorCount = 0;

    for (const record of backups) {
        const { exercise_key, level, image1, image2, image3 } = record;

        if (!exercise_key || !level) {
            console.warn(`Skipping record with missing key/level: ${record.id}`);
            continue;
        }

        console.log(`Processing ${exercise_key} level ${level}...`);

        const updates: any = {};

        // Helper to upload and get URL
        const processImage = async (buffer: Buffer, slot: number) => {
            if (!buffer) return null;

            const filePath = `${exercise_key}/${level}/${slot}.webp`; // Assuming webp, or generic

            const { data, error } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(filePath, buffer, {
                    contentType: 'image/webp',
                    upsert: true
                });

            if (error) {
                console.error(`  Error uploading image ${slot}:`, error.message);
                return null;
            }

            const { data: publicUrlData } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(filePath);

            return publicUrlData.publicUrl;
        };

        if (image1) {
            const url = await processImage(image1, 1);
            if (url) updates.imageUrl = url;
        }
        if (image2) {
            const url = await processImage(image2, 2);
            if (url) updates.imageUrl2 = url;
        }
        if (image3) {
            const url = await processImage(image3, 3);
            if (url) updates.imageUrl3 = url;
        }

        if (Object.keys(updates).length > 0) {
            try {
                await prisma.exerciseLevel.update({
                    where: {
                        exerciseKey_level: {
                            exerciseKey: exercise_key,
                            level: level
                        }
                    },
                    data: updates
                });
                console.log(`  Updated ${exercise_key} ${level} with URLs.`);
                successCount++;
            } catch (err: any) {
                console.error(`  Failed to update DB for ${exercise_key} ${level}:`, err.message);
                errorCount++;
            }
        } else {
            console.log(`  No images to update for ${exercise_key} ${level}.`);
        }
    }

    console.log('Migration finished.');
    console.log(`Success: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
