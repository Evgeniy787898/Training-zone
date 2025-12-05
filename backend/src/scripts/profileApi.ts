import autocannon, { type Instance } from 'autocannon';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatProfileResult, profileAsync } from '../services/profiler.js';

interface LoadOptions {
  url: string;
  durationSeconds: number;
  connections: number;
  method: string;
  title: string;
  outputDir: string;
}

async function runLoad({ url, durationSeconds, connections, method, title, outputDir }: LoadOptions) {
  const profileLabel = title.replace(/[^a-zA-Z0-9_-]/g, '_');
  const { profile } = await profileAsync(
    () =>
      new Promise<autocannon.Result>((resolve, reject) => {
        const instance: Instance = autocannon(
          {
            url,
            duration: durationSeconds,
            connections,
            method: method as any,
            title,
          },
          (err, res) => {
            if (err) return reject(err);
            return resolve(res);
          }
        );

        autocannon.track(instance, { renderProgressBar: true });
      }),
    { label: profileLabel, outputDir }
  );

  console.info(formatProfileResult(profile));
}

async function main() {
  const baseUrl = process.env.PROFILE_TARGET_URL ?? 'http://localhost:3000';
  const targetPath = process.env.PROFILE_TARGET_PATH ?? '/api/health';
  const url = new URL(targetPath, baseUrl).toString();

  const durationSeconds = Number(process.env.PROFILE_DURATION_SECONDS ?? 15);
  const connections = Number(process.env.PROFILE_CONNECTIONS ?? 20);
  const method = process.env.PROFILE_METHOD ?? 'GET';
  const outputDir = process.env.PROFILE_OUTPUT_DIR ?? path.resolve(process.cwd(), '.profiles');

  console.info(`Profiling ${url} for ${durationSeconds}s (${connections} connections, method ${method})...`);
  await runLoad({ url, durationSeconds, connections, method, title: 'api-load', outputDir });
}

const isMain = fileURLToPath(import.meta.url) === path.resolve(process.cwd(), process.argv[1] ?? '');

if (isMain) {
  main().catch((error) => {
    console.error('Profiling failed:', error);
    process.exitCode = 1;
  });
}
