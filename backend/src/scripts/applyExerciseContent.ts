import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { createSafeFileAccess, PathTraversalError } from '../services/pathSecurity.js';

const prisma = new PrismaClient();

const scriptDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)));
const projectRoot = path.resolve(scriptDir, '../../..');
const migrations = createSafeFileAccess(path.join(projectRoot, 'migrations'));

const MIGRATIONS_IN_ORDER = [
    '20241203999999_initialize_exercises.sql',
    '20241204000000_add_descriptions.sql',
    '20241204000001_add_pushups_descriptions.sql',
    '20241204000002_add_squats_descriptions.sql',
    '20241204000003_add_pullups_descriptions.sql',
    '20241204000004_add_legraises_descriptions.sql',
    '20241204000005_add_bridges_descriptions.sql',
    '20241204000006_add_handstand_pushups_descriptions.sql',
    '20241204000007_add_exercise_images.sql',
    '20241204000008_load_pushups_images.sql',
    '20241204000009_add_image3_column.sql',
    '20241205000000_add_training_programs.sql',
    '20241205000001_add_training_disciplines.sql',
    '20241205000001_add_training_directions.sql',
    '20241205000002_add_direction_to_exercises.sql',
    '20241205000003_link_exercises_to_program.sql',
    '20241205000002_add_program_cover.sql',
    '20241206000000_add_program_id_to_exercises.sql',
    '20241206000001_add_discipline_id_to_exercise_levels.sql',
    '20241206000002_populate_exercise_levels_sets_reps.sql',
    '20241206000003_add_performance_indexes.sql',
];

function splitSqlStatements(sql: string): string[] {
    const statements: string[] = [];
    let buffer = '';
    let inDoBlock = false;

    for (const line of sql.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!inDoBlock && trimmed.startsWith('DO $$')) {
            inDoBlock = true;
        }

        buffer += `${line}\n`;

        if (inDoBlock) {
            if (trimmed.endsWith('$$;')) {
                statements.push(buffer.trim());
                buffer = '';
                inDoBlock = false;
            }
            continue;
        }

        if (trimmed.endsWith(';')) {
            const statement = buffer.trim();
            if (statement) {
                statements.push(statement);
            }
            buffer = '';
        }
    }

    const trailing = buffer.trim();
    if (trailing) {
        statements.push(trailing);
    }

    return statements.filter(stmt => stmt.length > 0);
}

async function applySqlFile(fileName: string) {
    let sql: string;
    try {
        const filePath = migrations.resolve(fileName);
        sql = readFileSync(filePath, 'utf-8');
    } catch (error) {
        if (error instanceof PathTraversalError) {
            console.error('[security] Blocked attempt to read SQL file outside migrations directory', {
                fileName,
                baseDir: migrations.root,
            });
        }
        throw error;
    }
    console.log(`\n➡️  Applying ${fileName}...`);
    const statements = splitSqlStatements(sql);
    if (!statements.length) {
        console.warn(`   ⚠️  ${fileName} is empty, nothing to run.`);
        return;
    }

    let applied = 0;
    await prisma.$transaction(async (tx) => {
        for (const statement of statements) {
            try {
                await tx.$executeRawUnsafe(statement);
                applied += 1;
            } catch (error: any) {
                const alreadyDone =
                    error?.code === 'P2010' &&
                    (error?.meta?.code === '42701' || /already exists/i.test(error?.meta?.message || error.message));
                if (alreadyDone) {
                    console.warn(`   ⚠️  Skipped statement (already applied): ${statement.split('\n')[0]}`);
                    continue;
                }
                throw error;
            }
        }
    });
    console.log(`✅  ${fileName} applied (${applied}/${statements.length} statements)`);
}

async function main() {
    try {
        for (const file of MIGRATIONS_IN_ORDER) {
            await applySqlFile(file);
        }
        console.log('\n🎯 All requested migrations applied.');
    } catch (error) {
        console.error('❌  Failed to apply exercise content migrations:', error);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

void main();
