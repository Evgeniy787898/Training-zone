import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { config as loadEnv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(backendRoot, '..');
const docsDir = path.join(repoRoot, 'docs');
const reportPath = path.join(docsDir, 'database-size-report.md');

loadEnv({ path: path.join(repoRoot, '.env'), override: false });
loadEnv({ path: path.join(backendRoot, '.env'), override: false });

type SizeRow = {
    name: string;
    total_bytes: number;
    table_bytes: number;
    index_bytes: number;
    toast_bytes: number;
    live_rows: number;
    dead_rows: number;
};

type DatabaseSizeRow = {
    total_bytes: number;
};

const REDACTED = '[redacted]';

function redactConnection(connectionString: string) {
    try {
        const url = new URL(connectionString);
        url.username = url.username ? REDACTED : '';
        url.password = url.password ? REDACTED : '';
        return url.toString();
    } catch {
        return '[invalid connection string]';
    }
}

function formatBytes(bytes: number) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }
    return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function formatRow(row: SizeRow) {
    return {
        name: row.name,
        total: formatBytes(row.total_bytes),
        table: formatBytes(row.table_bytes),
        indexes: formatBytes(row.index_bytes),
        toast: formatBytes(row.toast_bytes),
        liveRows: row.live_rows,
        deadRows: row.dead_rows,
    };
}

async function main() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is required to audit database size');
    }

    const client = new Client({ connectionString });
    await client.connect();

    try {
        const [{ total_bytes }] = (
            await client.query<DatabaseSizeRow>(
                `SELECT pg_database_size(current_database())::bigint AS total_bytes`,
            )
        ).rows;

        const largestTables = (
            await client.query<SizeRow>(
                `
                SELECT
                    quote_ident(schemaname) || '.' || quote_ident(relname) AS name,
                    pg_total_relation_size(relid)::bigint AS total_bytes,
                    pg_relation_size(relid)::bigint AS table_bytes,
                    pg_indexes_size(relid)::bigint AS index_bytes,
                    GREATEST(pg_total_relation_size(reltoastrelid), 0)::bigint AS toast_bytes,
                    n_live_tup AS live_rows,
                    n_dead_tup AS dead_rows
                FROM pg_catalog.pg_statio_user_tables
                ORDER BY pg_total_relation_size(relid) DESC
                LIMIT 25;
                `,
            )
        ).rows;

        const topIndexes = (
            await client.query<{ name: string; index_bytes: number; table: string }>(
                `
                SELECT
                    quote_ident(n.nspname) || '.' || quote_ident(c.relname) AS name,
                    pg_relation_size(c.oid)::bigint AS index_bytes,
                    quote_ident(tn.nspname) || '.' || quote_ident(t.relname) AS table
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                JOIN pg_index i ON i.indexrelid = c.oid
                JOIN pg_class t ON t.oid = i.indrelid
                JOIN pg_namespace tn ON tn.oid = t.relnamespace
                WHERE c.relkind = 'i'
                ORDER BY pg_relation_size(c.oid) DESC
                LIMIT 20;
                `,
            )
        ).rows;

        await fs.mkdir(docsDir, { recursive: true });

        const output: string[] = [];
        output.push('# Database Size Report');
        output.push('');
        output.push(`_Generated at ${new Date().toISOString()} using ${redactConnection(connectionString)}_`);
        output.push('');
        output.push('## Summary');
        output.push('');
        output.push(`- Total database size: **${formatBytes(total_bytes)}**`);
        output.push('');

        output.push('## Largest tables');
        output.push('');
        if (largestTables.length === 0) {
            output.push('✅ No tables found.');
        } else {
            output.push('| Table | Total | Table | Indexes | TOAST | Live rows | Dead rows |');
            output.push('| --- | --- | --- | --- | --- | --- | --- |');
            for (const row of largestTables.map(formatRow)) {
                output.push(
                    `| ${row.name} | ${row.total} | ${row.table} | ${row.indexes} | ${row.toast} | ${row.liveRows} | ${row.deadRows} |`,
                );
            }
        }
        output.push('');

        output.push('## Largest indexes');
        output.push('');
        if (topIndexes.length === 0) {
            output.push('✅ No indexes found.');
        } else {
            output.push('| Index | Size | Table |');
            output.push('| --- | --- | --- |');
            for (const row of topIndexes) {
                output.push(`| ${row.name} | ${formatBytes(row.index_bytes)} | ${row.table} |`);
            }
        }
        output.push('');

        output.push('---');
        output.push('');
        output.push('> Run via `npm run audit:db-size --prefix backend`.');

        await fs.writeFile(reportPath, output.join('\n'));
        console.log(`Database size audit complete: ${path.relative(repoRoot, reportPath)}`);
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error('Database size audit failed');
    console.error(error);
    process.exit(1);
});
