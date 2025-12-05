import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import inspector from 'node:inspector';
import { performance } from 'node:perf_hooks';

export interface CpuProfileHandle {
  label: string;
  session: inspector.Session;
  filePath: string;
  startedAt: number;
}

export interface CpuProfileResult {
  label: string;
  filePath: string;
  durationMs: number;
  sizeBytes: number;
}

export interface ProfileAsyncOptions {
  label?: string;
  outputDir?: string;
}

async function ensureOutputDir(dir: string): Promise<string> {
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function startCpuProfile(
  label = 'profile',
  outputDir = path.resolve(process.cwd(), '.profiles')
): Promise<CpuProfileHandle> {
  const normalizedLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${normalizedLabel}-${timestamp}-${process.pid}.cpuprofile`;
  const filePath = path.join(await ensureOutputDir(outputDir), fileName);

  const session = new inspector.Session();
  session.connect();
  await session.post('Profiler.enable');
  await session.post('Profiler.start', { includeSamples: true });

  return {
    label: normalizedLabel,
    session,
    filePath,
    startedAt: performance.now(),
  };
}

export async function stopCpuProfile(handle: CpuProfileHandle): Promise<CpuProfileResult> {
  const { session, filePath, startedAt, label } = handle;
  const durationMs = performance.now() - startedAt;

  const profile = await new Promise<inspector.Profiler.Profile>((resolve, reject) => {
    session.post('Profiler.stop', (err, params) => {
      if (err) return reject(err);
      if (!params || !('profile' in params)) return reject(new Error('Profiler.stop returned no profile'));
      resolve((params as { profile: inspector.Profiler.Profile }).profile);
    });
  });

  await fs.writeFile(filePath, JSON.stringify(profile));
  session.disconnect();

  const stats = await fs.stat(filePath);
  return {
    label,
    filePath,
    durationMs,
    sizeBytes: stats.size,
  };
}

export async function profileAsync<T>(
  run: () => Promise<T> | T,
  options: ProfileAsyncOptions = {}
): Promise<{ result: T; profile: CpuProfileResult }> {
  const handle = await startCpuProfile(options.label, options.outputDir);
  try {
    const result = await run();
    const profile = await stopCpuProfile(handle);
    return { result, profile };
  } catch (error) {
    await stopCpuProfile(handle);
    throw error;
  }
}

export function formatProfileResult(result: CpuProfileResult): string {
  const { label, filePath, durationMs, sizeBytes } = result;
  const sizeKb = (sizeBytes / 1024).toFixed(1);
  const duration = durationMs.toFixed(0);
  return `CPU profile '${label}' saved to ${filePath} (duration: ${duration}ms, size: ${sizeKb}KB, host: ${os.hostname()})`;
}
