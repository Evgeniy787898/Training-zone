import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(backendRoot, '..');

loadEnv({ path: path.join(repoRoot, '.env'), override: false });
loadEnv({ path: path.join(backendRoot, '.env'), override: false });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('DATABASE_URL is required to run a backup');
    process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const defaultDir = path.join(repoRoot, '.backups');
const outputDir = process.env.BACKUP_OUTPUT_DIR ? path.resolve(process.env.BACKUP_OUTPUT_DIR) : defaultDir;
const outputPath = path.join(outputDir, `backup-${timestamp}.sql`);

async function main() {
    await fs.mkdir(outputDir, { recursive: true });

    const pgDump = spawn('pg_dump', ['--no-owner', '--format=plain', '--file', outputPath as string, connectionString as string], {
        stdio: 'inherit',
    });

    pgDump.on('exit', (code) => {
        if (code === 0) {
            console.log(`Backup complete: ${outputPath}`);
        } else {
            console.error(`pg_dump exited with code ${code ?? 'unknown'}`);
            process.exit(code ?? 1);
        }
    });
}

main().catch((error) => {
    console.error('Backup failed');
    console.error(error);
    process.exit(1);
});
