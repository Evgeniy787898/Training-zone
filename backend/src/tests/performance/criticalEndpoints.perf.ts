import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import autocannon, { type Options as AutocannonOptions, type Result as AutocannonResult } from 'autocannon';
import { Prisma, PrismaClient } from '@prisma/client';

import { closeCache } from '../../modules/infrastructure/cache.js';
import {
  applyTestMigrations,
  createFullStackTestApp,
  createTestPrismaClient,
  ensureFullStackTestEnvironment,
} from '../utils/fullStackTestHarness.js';
import { TrainingSessionStatus } from '../../types/sessions.js';

ensureFullStackTestEnvironment();

const defaultDatabaseUrl = 'postgresql://postgres:postgres@127.0.0.1:5432/tzona_performance';
const performanceDatabaseUrl = process.env.PERF_DATABASE_URL ?? defaultDatabaseUrl;
process.env.PERF_DATABASE_URL = performanceDatabaseUrl;
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = performanceDatabaseUrl;
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = performanceDatabaseUrl;
}
if (!process.env.SHADOW_DATABASE_URL) {
  process.env.SHADOW_DATABASE_URL = performanceDatabaseUrl;
}

const runAutocannon = (options: AutocannonOptions) => {
  return new Promise<AutocannonResult>((resolve, reject) => {
    autocannon(options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });
  });
};

type Scenario = {
  name: string;
  method?: 'GET' | 'POST' | 'DELETE';
  path: string;
  durationSeconds?: number;
  connections?: number;
  setup?: () => Promise<void>;
};

type ScenarioReport = {
  name: string;
  method: string;
  path: string;
  rps: number;
  latencyAvg: number;
  latencyP99: number;
  throughputKb: number;
  connections: number;
  duration: number;
};

const formatNumber = (value: number, fractionDigits = 2) => {
  return Number(value.toFixed(fractionDigits));
};

const seedProfileData = async (prisma: PrismaClient) => {
  const profileId = randomUUID();
  const profile = await prisma.profile.create({
    data: {
      id: profileId,
      telegramId: BigInt(Date.now()),
      firstName: 'Performance',
      timezone: 'UTC',
    },
  });

  const startOfWeek = new Date();
  startOfWeek.setUTCHours(0, 0, 0, 0);

  const sessions = Array.from({ length: 14 }).map((_, index) => ({
    id: randomUUID(),
    profileId: profile.id,
    plannedAt: new Date(startOfWeek.getTime() - index * 24 * 60 * 60 * 1000),
    status: index % 3 === 0 ? TrainingSessionStatus.done : TrainingSessionStatus.planned,
    notes: index % 2 === 0 ? `Session ${index}` : undefined,
  }));

  await prisma.trainingSession.createMany({ data: sessions });
  await prisma.trainingSessionExercise.createMany({
    data: sessions.flatMap((session) =>
      Array.from({ length: 3 }).map((_, idx) => ({
        id: randomUUID(),
        sessionId: session.id,
        profileId: profile.id,
        exerciseKey: `ex-${idx + 1}`,
        plannedSets: 3,
        plannedReps: 12,
        orderIndex: idx,
        structuredNotes: { emphasis: 'tempo', cue: 'keep core tight' } as Prisma.JsonObject,
      }))
    ),
  });

  await prisma.achievement.createMany({
    data: Array.from({ length: 10 }).map((_, index) => ({
      id: randomUUID(),
      profileId: profile.id,
      title: `Achievement ${index + 1}`,
      description: 'Performance benchmark achievement',
      awardedAt: new Date(Date.now() - index * 60 * 60 * 1000),
    })),
  });

  await prisma.metric.create({
    data: {
      id: randomUUID(),
      profileId: profile.id,
      metricType: 'weight',
      value: new Prisma.Decimal(80 + Math.random()),
      recordedAt: new Date(),
    },
  });

  return profile;
};

const writeReport = async (reports: ScenarioReport[], durationSeconds: number) => {
  const docsPath = path.resolve(process.cwd(), 'docs');
  const reportPath = path.join(docsPath, 'performance-report.md');
  const lines = [
    '# Performance Benchmark Report',
    '',
    `_Last updated: ${new Date().toISOString()}_`,
    '',
    `> Each scenario ran for ${durationSeconds} seconds unless stated otherwise.`,
    '',
    '| Scenario | Method | Path | RPS (avg) | Avg latency (ms) | P99 latency (ms) | Throughput (KB/s) | Connections | Duration (s) |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...reports.map(
      (report) =>
        `| ${report.name} | ${report.method} | ${report.path} | ${report.rps} | ${report.latencyAvg} | ${report.latencyP99} | ${report.throughputKb} | ${report.connections} | ${report.duration} |`
    ),
    '',
    'Use `npm run test:performance --prefix backend` to regenerate this file after infrastructure or query changes.',
  ];
  await fs.writeFile(reportPath, `${lines.join('\n')}\n`, 'utf8');
};

const main = async () => {
  console.log('⚙️  Applying database schema for performance tests...');
  applyTestMigrations(performanceDatabaseUrl);

  const prisma = await createTestPrismaClient(performanceDatabaseUrl);
  const profile = await seedProfileData(prisma);

  const app = createFullStackTestApp(prisma);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const defaultHeaders = { 'x-profile-id': profile.id };
  const weekDate = new Date().toISOString();

  const scenarios: Scenario[] = [
    { name: 'Profile summary', path: '/api/profile/summary' },
    { name: 'Weekly sessions', path: `/api/sessions/week?date=${encodeURIComponent(weekDate)}` },
    { name: 'Achievements feed', path: '/api/achievements?page=1&page_size=5&fields=title,awardedAt' },
  ];

  const reports: ScenarioReport[] = [];
  for (const scenario of scenarios) {
    if (scenario.setup) {
      await scenario.setup();
    }
    const connections = scenario.connections ?? 10;
    const durationSeconds = scenario.durationSeconds ?? 15;
    const method = scenario.method ?? 'GET';

    console.log(`\n🚀 Running ${scenario.name} (${method} ${scenario.path}) for ${durationSeconds}s with ${connections} connections...`);
    const result = await runAutocannon({
      url: `${baseUrl}${scenario.path}`,
      method,
      duration: durationSeconds,
      connections,
      headers: defaultHeaders,
    });

    reports.push({
      name: scenario.name,
      method,
      path: scenario.path,
      rps: formatNumber(result.requests.average),
      latencyAvg: formatNumber(result.latency.average),
      latencyP99: formatNumber(result.latency.p99),
      throughputKb: formatNumber(result.throughput.average / 1024),
      connections,
      duration: durationSeconds,
    });
  }

  await writeReport(reports, scenarios[0]?.durationSeconds ?? 15);
  await new Promise<void>((resolve, reject) =>
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    })
  );
  await prisma.$disconnect();
  await closeCache();

  console.log('\n📄 Performance report generated at docs/performance-report.md');
};

main().catch((error) => {
  console.error('❌ Performance test failed:', error);
  process.exitCode = 1;
});
