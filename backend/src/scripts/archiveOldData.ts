import { Prisma, PrismaClient } from '@prisma/client';
export { };
import { archiveDefaults } from '../config/constants.js';

const prisma = new PrismaClient();

type OperationLogRow = {
  id: string;
  profile_id: string | null;
  action: string;
  status: string;
  payload_hash: string | null;
  error_code: string | null;
  created_at: Date;
};

type ObservabilityEventRow = {
  id: string;
  profile_id: string | null;
  category: string;
  severity: string;
  payload: Prisma.JsonValue;
  trace_id: string | null;
  recorded_at: Date;
  handled: boolean;
};

const ARCHIVE_DAY_MS = 86_400_000;

const getOldDate = (days: number) => new Date(Date.now() - days * ARCHIVE_DAY_MS);

async function archiveOperationLogBatch(cutoff: Date): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const rows = (await tx.$queryRaw<OperationLogRow[]>`
        SELECT id, profile_id, action, status, payload_hash, error_code, created_at
        FROM operation_log
        WHERE created_at < ${cutoff}
        ORDER BY created_at
        LIMIT ${archiveDefaults.batchSize}
        FOR UPDATE SKIP LOCKED
      `);

    if (!rows.length) {
      return 0;
    }

    if (!archiveDefaults.dryRun) {
      const values = Prisma.join(
        rows.map((row) =>
          Prisma.sql`(${row.id}::uuid, ${row.profile_id}::uuid, ${row.action}, ${row.status}, ${row.payload_hash}, ${row.error_code}, ${row.created_at}, now())`,
        ),
      );

      await tx.$executeRawUnsafe(
        `INSERT INTO operation_log_archive (id, profile_id, action, status, payload_hash, error_code, created_at, archived_at) VALUES ${values.toString()}`,
      );
      await tx.$executeRaw`DELETE FROM operation_log WHERE id IN (${Prisma.join(rows.map((row) => row.id))})`;
    }

    return rows.length;
  });
}

async function archiveObservabilityBatch(cutoff: Date): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const rows = (await tx.$queryRaw<ObservabilityEventRow[]>`
        SELECT id, profile_id, category, severity, payload, trace_id, recorded_at, handled
        FROM observability_events
        WHERE recorded_at < ${cutoff}
        ORDER BY recorded_at
        LIMIT ${archiveDefaults.batchSize}
        FOR UPDATE SKIP LOCKED
      `);

    if (!rows.length) {
      return 0;
    }

    if (!archiveDefaults.dryRun) {
      const values = Prisma.join(
        rows.map((row) =>
          Prisma.sql`(${row.id}::uuid, ${row.profile_id}::uuid, ${row.category}, ${row.severity}, ${row.payload}::jsonb, ${row.trace_id}, ${row.recorded_at}, ${row.handled}, now())`,
        ),
      );

      await tx.$executeRawUnsafe(
        `INSERT INTO observability_events_archive (id, profile_id, category, severity, payload, trace_id, recorded_at, handled, archived_at) VALUES ${values.toString()}`,
      );
      await tx.$executeRaw`DELETE FROM observability_events WHERE id IN (${Prisma.join(rows.map((row) => row.id))})`;
    }

    return rows.length;
  });
}

async function archiveOperationLogs(): Promise<number> {
  const cutoff = new Date(Date.now() - archiveDefaults.operationLogRetentionDays * ARCHIVE_DAY_MS);
  let total = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const moved = await archiveOperationLogBatch(cutoff);
    if (moved === 0) {
      break;
    }
    total += moved;
  }

  return total;
}

async function archiveObservabilityEvents(): Promise<number> {
  const cutoff = new Date(Date.now() - archiveDefaults.observabilityRetentionDays * ARCHIVE_DAY_MS);
  let total = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const moved = await archiveObservabilityBatch(cutoff);
    if (moved === 0) {
      break;
    }
    total += moved;
  }

  return total;
}

async function main() {
  const [operationCount, observabilityCount] = await Promise.all([
    archiveOperationLogs(),
    archiveObservabilityEvents(),
  ]);

  const message = archiveDefaults.dryRun
    ? 'Completed dry-run archive scan'
    : 'Archived records successfully';

  console.log(
    `${message}: operation_log=${operationCount}, observability_events=${observabilityCount}, batchSize=${archiveDefaults.batchSize}`,
  );
}

main()
  .catch((error) => {
    console.error('[archive-old-data] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
