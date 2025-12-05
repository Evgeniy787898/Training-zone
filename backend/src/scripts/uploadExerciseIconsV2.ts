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
    'мостик': 'bridge',
    'отжимания': 'pushups',
    'отжимания в стойке на руках': 'handstand',
    'подтягивания': 'pullups',
    'подъемы ног': 'leg_raises',
    'приседания': 'squats'
};

async function main() {
    console.log('🚀 Starting exercise icons V2 upload...');
    console.log('   Source: упражнения/версия 2/');
    console.log('   Target: Supabase storage bucket "exercise-icons"');
    console.log('');

    const iconsFolder = path.resolve(process.cwd(), '../упражнения/версия 2');

    if (!fs.existsSync(iconsFolder)) {
        console.error(`❌ Icons folder not found: ${iconsFolder}`);
        process.exit(1);
    }

    // Read all files in the icons folder
    const files = fs.readdirSync(iconsFolder).filter(f => f.endsWith('.png'));
    console.log(`📁 Found ${files.length} icon files in version 2 folder.`);

    // Group files by exercise name
    // Files format: "мостик 1-Photoroom.png" or "мостик 2-Photoroom.png"
    const exerciseIcons: Record<string, { static?: string; hover?: string }> = {};

    for (const file of files) {
        // Parse filename: "мостик 1-Photoroom.png" or "мостик 2-Photoroom.png"
        const match = file.match(/^(.+)\s+(\d)-Photoroom\.png$/);
        if (!match) {
            console.warn(`⚠️  Skipping unrecognized file: ${file}`);
            continue;
        }

        const [, exerciseName, imageNum] = match;
        const normalizedName = exerciseName.toLowerCase().trim().normalize('NFC');

        // Find matching exercise key
        let exerciseKey: string | undefined;
        for (const [mapName, mapKey] of Object.entries(EXERCISE_MAPPING)) {
            const normalizedMapName = mapName.toLowerCase().trim().normalize('NFC');
            if (normalizedName === normalizedMapName) {
                exerciseKey = mapKey;
                break;
            }
        }

        if (!exerciseKey) {
            console.warn(`⚠️  No mapping found for: "${exerciseName}"`);
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

    console.log('\n📋 Exercise icons mapping:');
    for (const [key, icons] of Object.entries(exerciseIcons)) {
        console.log(`   ${key}: static=${icons.static ? '✓' : '✗'}, hover=${icons.hover ? '✓' : '✗'}`);
    }

    let successCount = 0;
    let errorCount = 0;

    for (const [exerciseKey, icons] of Object.entries(exerciseIcons)) {
        console.log(`\n🔄 Processing ${exerciseKey}...`);

        const updates: { icon_url?: string; icon_url_hover?: string } = {};

        // Upload static icon (1.png)
        if (icons.static) {
            const filePath = path.join(iconsFolder, icons.static);
            const buffer = fs.readFileSync(filePath);
            const storagePath = `${exerciseKey}/icon.png`;

            console.log(`   📤 Uploading static icon (${(buffer.length / 1024).toFixed(1)} KB)...`);

            const { error } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(storagePath, buffer, {
                    contentType: 'image/png',
                    upsert: true // Replace existing file
                });

            if (error) {
                console.error(`   ❌ Error uploading static icon:`, error.message);
                errorCount++;
            } else {
                const { data: publicUrlData } = supabase.storage
                    .from(BUCKET_NAME)
                    .getPublicUrl(storagePath);
                updates.icon_url = publicUrlData.publicUrl;
                console.log(`   ✅ Static icon uploaded`);
            }
        }

        // Upload hover icon (2.png)
        if (icons.hover) {
            const filePath = path.join(iconsFolder, icons.hover);
            const buffer = fs.readFileSync(filePath);
            const storagePath = `${exerciseKey}/icon_hover.png`;

            console.log(`   📤 Uploading hover icon (${(buffer.length / 1024).toFixed(1)} KB)...`);

            const { error } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(storagePath, buffer, {
                    contentType: 'image/png',
                    upsert: true // Replace existing file
                });

            if (error) {
                console.error(`   ❌ Error uploading hover icon:`, error.message);
                errorCount++;
            } else {
                const { data: publicUrlData } = supabase.storage
                    .from(BUCKET_NAME)
                    .getPublicUrl(storagePath);
                updates.icon_url_hover = publicUrlData.publicUrl;
                console.log(`   ✅ Hover icon uploaded`);
            }
        }

        // Update database
        if (Object.keys(updates).length > 0) {
            try {
                await prisma.$executeRaw`
                    UPDATE exercises 
                    SET icon_url = ${updates.icon_url || null}, 
                        icon_url_hover = ${updates.icon_url_hover || null},
                        updated_at = NOW()
                    WHERE exercise_key = ${exerciseKey}
                `;
                console.log(`   ✅ Database updated`);
                successCount++;
            } catch (err: any) {
                console.error(`   ❌ Failed to update DB:`, err.message);
                errorCount++;
            }
        }
    }

    console.log('\n═══════════════════════════════════════');
    console.log('📊 Upload Complete!');
    console.log(`   ✅ Success: ${successCount} exercises`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('═══════════════════════════════════════');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
