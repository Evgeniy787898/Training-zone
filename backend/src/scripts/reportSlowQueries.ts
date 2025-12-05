import { promises as fs } from 'node:fs';
import path from 'node:path';
import { slowQueryDefaults } from '../config/constants.js';

interface SlowQueryLogEntry {
    timestamp: string;
    durationMs: number;
    target?: string;
    query: string;
    paramsPreview?: string;
    traceId?: string;
    stack?: string;
}

const resolvePath = (filePath: string) => (path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath));

const readLogEntries = async (filePath: string): Promise<SlowQueryLogEntry[]> => {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return content
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => JSON.parse(line));
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
};

const summarize = (entries: SlowQueryLogEntry[]) => {
    if (!entries.length) {
        return {
            total: 0,
            average: 0,
            slowest: null as SlowQueryLogEntry | null,
            targetBreakdown: [],
            recent: [] as SlowQueryLogEntry[],
        };
    }
    const totalDuration = entries.reduce((sum, entry) => sum + entry.durationMs, 0);
    const targetCounts = new Map<string, number>();
    for (const entry of entries) {
        const key = entry.target || 'default';
        targetCounts.set(key, (targetCounts.get(key) ?? 0) + 1);
    }
    const sortedTargets = [...targetCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const slowest = entries.reduce((max, entry) => (entry.durationMs > max.durationMs ? entry : max), entries[0]);
    const recent = entries.slice(-5);
    return {
        total: entries.length,
        average: totalDuration / entries.length,
        slowest,
        targetBreakdown: sortedTargets,
        recent,
    };
};

const formatEntry = (entry: SlowQueryLogEntry) => {
    const preview = entry.query.length > 160 ? `${entry.query.slice(0, 160)}…` : entry.query;
    return `- ${entry.timestamp} • ${entry.durationMs.toFixed(1)}ms • target=${entry.target ?? 'default'}\n  \`${preview}\``;
};

const main = async () => {
    const logPath =
        process.env.PRISMA_SLOW_QUERY_LOG_PATH && process.env.PRISMA_SLOW_QUERY_LOG_PATH.trim()
            ? process.env.PRISMA_SLOW_QUERY_LOG_PATH.trim()
            : slowQueryDefaults.logFilePath;
    if (!logPath) {
        console.log('Slow query logging is disabled. Set PRISMA_SLOW_QUERY_LOG_PATH to generate a report.');
        return;
    }
    const resolvedLogPath = resolvePath(logPath);
    const entries = await readLogEntries(resolvedLogPath);
    const summary = summarize(entries);
    const generatedAt = new Date().toISOString();
    const reportLines: string[] = [
        '# Prisma Slow Query Report',
        '',
        `_Last generated: ${generatedAt}_`,
        '',
        `Log source: \`${resolvedLogPath}\``,
        '',
    ];

    if (!summary.total) {
        reportLines.push(
            'No slow queries were recorded in the log file. Run the backend under load, then re-run `npm run report:slow-queries`.',
        );
    } else {
        reportLines.push(`* Total slow queries: **${summary.total}**`);
        reportLines.push(`* Average duration: **${summary.average.toFixed(1)}ms**`);
        reportLines.push(
            `* Slowest query: **${summary.slowest?.durationMs.toFixed(1)}ms** on target \`${summary.slowest?.target ?? 'default'}\``,
        );
        reportLines.push('');
        if (summary.targetBreakdown.length) {
            reportLines.push('## Top targets');
            reportLines.push('');
            reportLines.push('| Target | Slow queries |');
            reportLines.push('| --- | ---: |');
            for (const [target, count] of summary.targetBreakdown) {
                reportLines.push(`| ${target} | ${count} |`);
            }
            reportLines.push('');
        }
        if (summary.recent.length) {
            reportLines.push('## Recent slow queries');
            reportLines.push('');
            for (const entry of summary.recent) {
                reportLines.push(formatEntry(entry));
            }
            reportLines.push('');
        }
    }

    const reportPath = path.resolve(process.cwd(), '../docs/slow-query-report.md');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, reportLines.join('\n'), 'utf-8');
    console.log(`[slow-query-report] Wrote report with ${summary.total} entries to ${reportPath}`);
};

main().catch((error) => {
    console.error('[slow-query-report] Failed to generate report', error);
    process.exitCode = 1;
});

