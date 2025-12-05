import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { config as loadEnv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(backendRoot, '..');
const docsDir = path.join(repoRoot, 'docs');
const reportPath = path.join(docsDir, 'database-index-audit.md');

loadEnv({ path: path.join(repoRoot, '.env'), override: false });
loadEnv({ path: path.join(backendRoot, '.env'), override: false });

interface IndexRow {
    schema: string;
    table_name: string;
    index_name: string;
    definition: string;
    is_unique: boolean;
    is_primary: boolean;
    idx_scan: number;
    idx_tup_read: number;
    idx_tup_fetch: number;
    index_bytes: number;
    table_seq_scan: number;
    table_inserts: number;
    table_updates: number;
    table_deletes: number;
}

interface TableWithoutIndexRow {
    schema: string;
    table_name: string;
}

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${sizes[i]}`;
};

function redactConnection(connectionString: string) {
    try {
        const url = new URL(connectionString);
        url.username = url.username ? '[redacted]' : '';
        url.password = url.password ? '[redacted]' : '';
        return url.toString();
    } catch (error) {
        console.warn('Unable to redact connection string, returning placeholder');
        return '[invalid connection string]';
    }
}

async function main() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is required to audit indexes');
    }

    const client = new Client({ connectionString });
    await client.connect();

    try {
        const { rows: indexRows } = await client.query<IndexRow>(
            `
            SELECT
                n.nspname       AS schema,
                c.relname       AS table_name,
                ic.relname      AS index_name,
                pg_get_indexdef(i.indexrelid) AS definition,
                i.indisunique   AS is_unique,
                i.indisprimary  AS is_primary,
                COALESCE(s.idx_scan, 0)      AS idx_scan,
                COALESCE(s.idx_tup_read, 0)  AS idx_tup_read,
                COALESCE(s.idx_tup_fetch, 0) AS idx_tup_fetch,
                pg_relation_size(ic.oid)      AS index_bytes,
                COALESCE(t.seq_scan, 0)       AS table_seq_scan,
                COALESCE(t.n_tup_ins, 0)      AS table_inserts,
                COALESCE(t.n_tup_upd, 0)      AS table_updates,
                COALESCE(t.n_tup_del, 0)      AS table_deletes
            FROM pg_index i
            JOIN pg_class ic ON ic.oid = i.indexrelid
            JOIN pg_class c ON c.oid = i.indrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            LEFT JOIN pg_stat_user_indexes s ON s.indexrelid = i.indexrelid
            LEFT JOIN pg_stat_user_tables t ON t.relid = c.oid
            WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
            ORDER BY COALESCE(s.idx_scan, 0) ASC, pg_relation_size(ic.oid) DESC;
        `,
        );

        const { rows: tablesWithoutIndexes } = await client.query<TableWithoutIndexRow>(
            `
            SELECT n.nspname AS schema, c.relname AS table_name
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind = 'r'
              AND n.nspname NOT IN ('pg_catalog', 'information_schema')
              AND NOT EXISTS (
                SELECT 1 FROM pg_index i WHERE i.indrelid = c.oid AND i.indisvalid
              )
            ORDER BY n.nspname, c.relname;
        `,
        );

        await fs.mkdir(docsDir, { recursive: true });
        const output: string[] = [];

        const unused = indexRows.filter((row) => row.idx_scan === 0);
        const rarelyUsed = indexRows.filter((row) => row.idx_scan > 0 && row.idx_scan <= 50);
        const largest = [...indexRows].sort((a, b) => b.index_bytes - a.index_bytes).slice(0, 15);

        output.push('# Database Index Audit');
        output.push('');
        output.push(`_Generated at ${new Date().toISOString()} with connection ${redactConnection(connectionString)}_`);
        output.push('');
        output.push('## Summary');
        output.push('');
        output.push(`- Total indexes: ${indexRows.length}`);
        output.push(`- Unused indexes (idx_scan = 0): ${unused.length}`);
        output.push(`- Rarely used indexes (1-50 scans): ${rarelyUsed.length}`);
        output.push(`- Tables without indexes: ${tablesWithoutIndexes.length}`);
        output.push('');

        const renderTable = (
            rows: IndexRow[],
            heading: string,
            predicate?: (row: IndexRow) => boolean,
        ) => {
            const filtered = predicate ? rows.filter(predicate) : rows;
            output.push(`## ${heading}`);
            output.push('');
            if (filtered.length === 0) {
                output.push('✅ None detected.');
                output.push('');
                return;
            }
            output.push('| Schema.Table | Index | Scans | Size | Definition |');
            output.push('| --- | --- | --- | --- | --- |');
            for (const row of filtered) {
                const scope = `${row.schema}.${row.table_name}`;
                const size = formatBytes(row.index_bytes);
                const def = row.definition.replace(/\n+/g, ' ');
                output.push(`| ${scope} | ${row.index_name} | ${row.idx_scan} | ${size} | \`${def}\` |`);
            }
            output.push('');
        };

        renderTable(unused, 'Unused indexes (idx_scan = 0)');
        renderTable(rarelyUsed, 'Rarely used indexes (<= 50 scans)');
        renderTable(largest, 'Largest indexes by size');

        output.push('## Tables without indexes');
        output.push('');
        if (tablesWithoutIndexes.length === 0) {
            output.push('✅ All user tables have at least one index.');
        } else {
            output.push('| Schema | Table |');
            output.push('| --- | --- |');
            for (const row of tablesWithoutIndexes) {
                output.push(`| ${row.schema} | ${row.table_name} |`);
            }
        }
        output.push('');

        output.push('---');
        output.push('');
        output.push('> Run via `npm run audit:indexes --prefix backend`. The report is derived from `pg_stat_user_indexes` and `pg_stat_user_tables`; rerun after production-like traffic to capture real usage.');
        output.push('');

        await fs.writeFile(reportPath, output.join('\n'));
        console.log(`Index audit complete: ${path.relative(repoRoot, reportPath)}`);
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error('Index audit failed');
    console.error(error);
    process.exit(1);
});
