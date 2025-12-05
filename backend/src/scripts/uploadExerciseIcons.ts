import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from root
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const prisma = new PrismaClient();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const BUCKET_NAME = 'exercise-icons';

// Mapping of Russian filenames to exercise_key
const EXERCISE_MAPPING: Record<string, string> = {
    'мостик': 'bridge', // Corrected from 'bridges'
    'отжимания': 'pushups',
    'отжимания в стойке на руках': 'handstand', // Corrected from 'handstand_pushups'
    'подтягивания': 'pullups',
    'подъемы ног': 'leg_raises',
    'приседания': 'squats'
};

async function main() {
    console.log('Starting exercise icons upload...');

    const iconsFolder = path.resolve(process.cwd(), '../упражнения');

    if (!fs.existsSync(iconsFolder)) {
        console.error(`Icons folder not found: ${iconsFolder}`);
        process.exit(1);
    }

    // Ensure bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
        console.error('Error listing buckets:', listError.message);
    } else {
        const bucketExists = buckets.find(b => b.name === BUCKET_NAME);
        if (!bucketExists) {
            console.log(`Bucket ${BUCKET_NAME} not found. Creating...`);
            const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
                public: true,
                fileSizeLimit: 10485760, // 10MB for high-res icons
                allowedMimeTypes: ['image/png', 'image/webp', 'image/jpeg']
            });
            if (createError) {
                console.error('Error creating bucket:', createError.message);
            } else {
                console.log('Bucket created successfully.');
            }
        } else {
            console.log(`Bucket ${BUCKET_NAME} exists.`);
        }
    }

    // Read all files in the icons folder
    const files = fs.readdirSync(iconsFolder).filter(f => f.endsWith('.png'));
    console.log(`Found ${files.length} icon files.`);

    // Group files by exercise name
    const exerciseIcons: Record<string, { static?: string; hover?: string }> = {};

    for (const file of files) {
        // Parse filename: "мостик 1.png" or "мостик 2.png"
        const match = file.match(/^(.+)\s+(\d)\.png$/);
        if (!match) {
            console.warn(`Skipping unrecognized file: ${file}`);
            continue;
        }

        const [, exerciseName, imageNum] = match;
        // Normalize: lowercase, trim, and normalize Unicode
        const normalizedName = exerciseName.toLowerCase().trim().normalize('NFC');

        // Try to find a matching key (also normalized)
        let exerciseKey: string | undefined;
        for (const [mapName, mapKey] of Object.entries(EXERCISE_MAPPING)) {
            const normalizedMapName = mapName.toLowerCase().trim().normalize('NFC');
            if (normalizedName === normalizedMapName) {
                exerciseKey = mapKey;
                break;
            }
        }

        if (!exerciseKey) {
            console.warn(`No mapping found for: "${exerciseName}" (normalized: "${normalizedName}")`);
            // Debug: show char codes
            console.warn(`  Char codes: ${[...normalizedName].map(c => c.charCodeAt(0)).join(',')}`);
            continue;
        }

        if (!exerciseIcons[exerciseKey]) {
            exerciseIcons[exerciseKey] = {};
        }

        if (imageNum === '1') {
            exerciseIcons[exerciseKey].static = file;
        } else if (imageNum === '2') {
            exerciseIcons[exerciseKey].hover = file;
        }
    }

    console.log('Exercise icons mapping:', exerciseIcons);

    let successCount = 0;
    let errorCount = 0;

    for (const [exerciseKey, icons] of Object.entries(exerciseIcons)) {
        console.log(`\nProcessing ${exerciseKey}...`);

        const updates: { icon_url?: string; icon_url_hover?: string } = {};

        // Upload static icon (1.png)
        if (icons.static) {
            const filePath = path.join(iconsFolder, icons.static);
            const buffer = fs.readFileSync(filePath);
            const storagePath = `${exerciseKey}/icon.png`;

            const { error } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(storagePath, buffer, {
                    contentType: 'image/png',
                    upsert: true
                });

            if (error) {
                console.error(`  Error uploading static icon:`, error.message);
                errorCount++;
            } else {
                const { data: publicUrlData } = supabase.storage
                    .from(BUCKET_NAME)
                    .getPublicUrl(storagePath);
                updates.icon_url = publicUrlData.publicUrl;
                console.log(`  Static icon uploaded: ${updates.icon_url}`);
            }
        }

        // Upload hover icon (2.png)
        if (icons.hover) {
            const filePath = path.join(iconsFolder, icons.hover);
            const buffer = fs.readFileSync(filePath);
            const storagePath = `${exerciseKey}/icon_hover.png`;

            const { error } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(storagePath, buffer, {
                    contentType: 'image/png',
                    upsert: true
                });

            if (error) {
                console.error(`  Error uploading hover icon:`, error.message);
                errorCount++;
            } else {
                const { data: publicUrlData } = supabase.storage
                    .from(BUCKET_NAME)
                    .getPublicUrl(storagePath);
                updates.icon_url_hover = publicUrlData.publicUrl;
                console.log(`  Hover icon uploaded: ${updates.icon_url_hover}`);
            }
        }

        // Update database
        if (Object.keys(updates).length > 0) {
            try {
                // Use raw SQL since icon columns are new
                await prisma.$executeRaw`
                    UPDATE exercises 
                    SET icon_url = ${updates.icon_url || null}, 
                        icon_url_hover = ${updates.icon_url_hover || null}
                    WHERE exercise_key = ${exerciseKey}
                `;
                console.log(`  Database updated for ${exerciseKey}`);
                successCount++;
            } catch (err: any) {
                console.error(`  Failed to update DB for ${exerciseKey}:`, err.message);
                errorCount++;
            }
        }
    }

    console.log('\n=== Upload Complete ===');
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
