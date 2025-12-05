import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { config as loadEnv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(backendRoot, '..');
const docsDir = path.join(repoRoot, 'docs');
const reportPath = path.join(docsDir, 'connection-pool-report.md');

loadEnv({ path: path.join(repoRoot, '.env'), override: false });
loadEnv({ path: path.join(backendRoot, '.env'), override: false });

interface ActivityRow {
    application_name: string | null;
    state: string | null;
    wait_event_type: string | null;
    wait_event: string | null;
    count: number;
}

interface ConnectionSettings {
    max_connections: number;
    superuser_reserved_connections: number;
}

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

function summarizeApplications(activity: ActivityRow[]) {
    const grouped: Record<string, { total: number; idle: number; active: number }> = {};
    for (const row of activity) {
        const app = row.application_name?.trim() || 'unknown';
        if (!grouped[app]) {
            grouped[app] = { total: 0, idle: 0, active: 0 };
        }
        grouped[app].total += row.count;
        if ((row.state || '').toLowerCase().includes('idle')) {
            grouped[app].idle += row.count;
        } else {
            grouped[app].active += row.count;
        }
    }
    return grouped;
}

async function main() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is required to audit connection pooling');
    }

    const client = new Client({ connectionString });
    await client.connect();

    try {
        const { rows: settingsRows } = await client.query<ConnectionSettings>(`
            SELECT
                current_setting('max_connections')::int AS max_connections,
                current_setting('superuser_reserved_connections')::int AS superuser_reserved_connections
        `);
        const settings = settingsRows[0];

        const { rows: activityRows } = await client.query<ActivityRow>(`
            SELECT
                application_name,
                state,
                wait_event_type,
                wait_event,
                COUNT(*) AS count
            FROM pg_stat_activity
            WHERE pid <> pg_backend_pid()
              AND usename IS NOT NULL
            GROUP BY application_name, state, wait_event_type, wait_event
            ORDER BY count DESC;
        `);

        const { rows: dbRows } = await client.query<{ state: string | null; count: number }>(
            `SELECT state, COUNT(*) AS count FROM pg_stat_activity WHERE pid <> pg_backend_pid() GROUP BY state;`,
        );

        const groupedApps = summarizeApplications(activityRows);
        const reserved = settings.superuser_reserved_connections;
        const total = settings.max_connections;
        const inUse = activityRows.reduce((acc, row) => acc + row.count, 0);
        const availableForApp = Math.max(total - reserved - inUse, 0);

        await fs.mkdir(docsDir, { recursive: true });

        const output: string[] = [];
        output.push('# Connection Pool Audit');
        output.push('');
        output.push(`_Generated at ${new Date().toISOString()} using ${redactConnection(connectionString)}_`);
        output.push('');
        output.push('## Summary');
        output.push('');
        output.push(`- max_connections: **${total}**`);
        output.push(`- superuser_reserved_connections: **${reserved}**`);
        output.push(`- Active connections (all apps): **${inUse}**`);
        output.push(`- Estimated headroom for this app: **${availableForApp}**`);
        output.push('');
        output.push('### Recommendations');
        output.push('');
        output.push('- Prefer PgBouncer/transaction pooling in production where available.');
        output.push('- Set Prisma pool sizes to a fraction of `max_connections` to avoid exhausting the database.');
        output.push('- Investigate long-running or waiting connections called out below.');
        output.push('');

        output.push('## Connections by application');
        output.push('');
        if (activityRows.length === 0) {
            output.push('✅ No other active connections detected.');
        } else {
            output.push('| Application | Total | Active | Idle |');
            output.push('| --- | --- | --- | --- |');
            for (const [app, stats] of Object.entries(groupedApps)) {
                output.push(`| ${app} | ${stats.total} | ${stats.active} | ${stats.idle} |`);
            }
        }
        output.push('');

        output.push('## Connection states');
        output.push('');
        if (dbRows.length === 0) {
            output.push('✅ No connections recorded.');
        } else {
            output.push('| State | Count |');
            output.push('| --- | --- |');
            for (const row of dbRows) {
                output.push(`| ${row.state || 'unknown'} | ${row.count} |`);
            }
        }
        output.push('');

        const waiting = activityRows.filter((row) => row.wait_event || row.wait_event_type);
        output.push('## Waiting connections');
        output.push('');
        if (waiting.length === 0) {
            output.push('✅ No waiting connections detected.');
        } else {
            output.push('| Application | Wait type | Wait event | State | Count |');
            output.push('| --- | --- | --- | --- | --- |');
            for (const row of waiting) {
                output.push(
                    `| ${row.application_name || 'unknown'} | ${row.wait_event_type || 'n/a'} | ${row.wait_event || 'n/a'} | ${
                        row.state || 'unknown'
                    } | ${row.count} |`,
                );
            }
        }
        output.push('');

        output.push('---');
        output.push('');
        output.push(
            '> Run via `npm run audit:pool --prefix backend`. The audit uses pg_stat_activity and SHOW settings to suggest safe pool headroom.',
        );
        output.push('');

        await fs.writeFile(reportPath, output.join('\n'));
        console.log(`Connection pool audit complete: ${path.relative(repoRoot, reportPath)}`);
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error('Connection pool audit failed');
    console.error(error);
    process.exit(1);
});
