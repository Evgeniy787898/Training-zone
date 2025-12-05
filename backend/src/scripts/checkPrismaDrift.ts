import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';

const migrationsDir = resolve(process.cwd(), 'prisma/migrations');
const schemaPath = resolve(process.cwd(), 'prisma/schema.prisma');

function runDiff() {
  console.log('🔍 Checking Prisma schema drift...');
  const args = [
    'prisma',
    'migrate',
    'diff',
    '--from-migrations',
    migrationsDir,
    '--to-schema-datamodel',
    schemaPath,
    '--exit-code'
  ];

  const result = spawnSync('npx', args, {
    cwd: process.cwd(),
    encoding: 'utf-8'
  });

  if (result.error) {
    console.error('Failed to run Prisma CLI:', result.error.message);
    process.exit(1);
  }

  const combinedOutput = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  if (result.status === 0) {
    console.log('✅ No schema drift detected between migrations and schema.prisma.');
    if (combinedOutput.length > 0) {
      console.log(combinedOutput);
    }
    return;
  }

  console.error('❌ Prisma schema drift detected. Ensure schema.prisma and migrations are in sync.');
  if (combinedOutput.length > 0) {
    console.error(combinedOutput);
  }
  process.exit(result.status ?? 1);
}

runDiff();
