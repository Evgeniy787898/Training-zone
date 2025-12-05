import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

type QueryInput = {
  name: string;
  sql: string;
};

type Args = {
  file: string;
  output: string;
};

const DEFAULT_INPUT = path.resolve(__dirname, '../../sql/explain-queries.sql');
const DEFAULT_OUTPUT = path.resolve(__dirname, '../../docs/explain-analyze-report.md');

function parseArgs(): Args {
  const [, , ...rest] = process.argv;
  const args: Record<string, string> = {};

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg.startsWith('--')) {
      const key = arg.replace(/^--/, '');
      const value = rest[i + 1]?.startsWith('--') ? undefined : rest[i + 1];
      if (value) {
        args[key] = value;
        i += 1;
      } else {
        args[key] = 'true';
      }
    }
  }

  return {
    file: args.file ? path.resolve(args.file) : DEFAULT_INPUT,
    output: args.output ? path.resolve(args.output) : DEFAULT_OUTPUT,
  };
}

function loadQueries(filePath: string): QueryInput[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Query file not found at ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);

  const queries: QueryInput[] = [];
  let current: QueryInput | null = null;

  for (const line of lines) {
    const nameMatch = line.match(/^--\s*name:\s*(.+)$/i);
    if (nameMatch) {
      if (current) {
        queries.push(current);
      }
      current = { name: nameMatch[1].trim(), sql: '' };
      continue;
    }

    if (!current) {
      continue;
    }

    current.sql += `${line}\n`;
  }

  if (current) {
    queries.push(current);
  }

  return queries.map((query) => ({
    name: query.name,
    sql: query.sql.trim().replace(/;\s*$/, ''),
  })).filter((query) => query.sql.length > 0);
}

async function runExplain(client: Client, query: QueryInput) {
  const sql = `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON) ${query.sql}`;
  const result = await client.query(sql);
  return result.rows[0]['QUERY PLAN'];
}

function formatSection(title: string, body: string): string {
  return `\n## ${title}\n\n${body}\n`;
}

function redactConnection(url: string | undefined): string {
  if (!url) return 'Not provided';
  try {
    const parsed = new URL(url);
    if (parsed.username) parsed.username = '***';
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch (err) {
    return 'Unavailable';
  }
}

function renderReport(params: {
  connection: string;
  queries: { name: string; plan: any }[];
}): string {
  const header = '# EXPLAIN ANALYZE Report\n';
  const meta = `\n**Connection:** ${params.connection}\n\nGenerated at: ${new Date().toISOString()}\n`;

  const sections = params.queries.map(({ name, plan }) => {
    const formatted = JSON.stringify(plan, null, 2);
    return formatSection(name, ['```json', formatted, '```'].join('\n'));
  });

  if (sections.length === 0) {
    sections.push(formatSection('Notice', 'No queries were found in the input file.'));
  }

  return [header, meta, ...sections].join('\n');
}

async function main() {
  const { file, output } = parseArgs();
  const queries = loadQueries(file);
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run EXPLAIN ANALYZE.');
  }

  const client = new Client({ connectionString });
  await client.connect();

  const results = [] as { name: string; plan: any }[];

  for (const query of queries) {
    const plan = await runExplain(client, query);
    results.push({ name: query.name, plan });
    // eslint-disable-next-line no-console
    console.log(`✅ analyzed: ${query.name}`);
  }

  await client.end();

  const report = renderReport({
    connection: redactConnection(connectionString),
    queries: results,
  });

  fs.writeFileSync(output, report, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Report written to ${output}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('EXPLAIN ANALYZE failed:', err.message);
  process.exit(1);
});
