import fs from 'node:fs';
import readline from 'node:readline';
import { loggingConfig } from '../config/constants.js';
import type { LogLevel, StructuredLogEntry } from '../types/logging.js';

const args = process.argv.slice(2);

const argMap = args.reduce<Record<string, string | true>>((acc, arg) => {
    if (arg.startsWith('--')) {
        const [key, value] = arg.replace(/^--/, '').split('=');
        acc[key] = value ?? true;
    }
    return acc;
}, {});

const minLevel = (argMap.level as string | undefined)?.toLowerCase() as LogLevel | undefined;
const searchText = typeof argMap.text === 'string' ? (argMap.text as string).toLowerCase() : undefined;
const traceFilter = typeof argMap.trace === 'string' ? (argMap.trace as string).toLowerCase() : undefined;
const limit = argMap.limit ? Math.max(1, Number(argMap.limit)) : 100;
const since = argMap.since ? Date.parse(String(argMap.since)) : null;
const asJson = argMap.json === true || argMap.json === 'true';

const levelWeights: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = minLevel ? levelWeights[minLevel] : levelWeights.debug;

const filePath = loggingConfig.filePath;
if (!filePath || !fs.existsSync(filePath)) {
    console.error(`[logs] File not found at ${filePath}. Configure LOG_FILE_PATH before running this script.`);
    process.exit(1);
}

const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
const reader = readline.createInterface({ input: stream, crlfDelay: Infinity });

const results: StructuredLogEntry[] = [];

reader.on('line', (line) => {
    if (!line.trim()) {
        return;
    }
    try {
        const entry = JSON.parse(line) as StructuredLogEntry;
        if (levelWeights[entry.level] < threshold) {
            return;
        }
        if (since && (!entry.timestamp || Date.parse(entry.timestamp) < since)) {
            return;
        }
        if (searchText) {
            const haystack = JSON.stringify(entry).toLowerCase();
            if (!haystack.includes(searchText)) {
                return;
            }
        }
        if (traceFilter && (!entry.traceId || entry.traceId.toLowerCase() !== traceFilter)) {
            return;
        }
        results.push(entry);
        if (results.length >= limit) {
            reader.close();
        }
    } catch {
        // ignore malformed lines
    }
});

reader.once('close', () => {
    if (asJson) {
        console.log(JSON.stringify(results, null, 2));
        return;
    }
    for (const entry of results) {
        console.log(`[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.message}`);
        if (entry.traceId) {
            console.log(`  trace: ${entry.traceId}`);
        }
        if (entry.resource || entry.path) {
            console.log(`  resource: ${entry.resource ?? ''} ${entry.path ?? ''}`.trim());
        }
        if (entry.metadata) {
            console.log(`  metadata: ${JSON.stringify(entry.metadata)}`);
        }
        if (entry.details) {
            console.log(`  details: ${JSON.stringify(entry.details)}`);
        }
    }
});
