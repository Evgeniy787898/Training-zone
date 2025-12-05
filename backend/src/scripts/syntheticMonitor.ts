import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { config as loadEnv } from 'dotenv';
import { recordMonitoringEvent } from '../modules/infrastructure/monitoring.js';
import type { MonitoringSeverity } from '../types/monitoring.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');

loadEnv({ path: path.join(repoRoot, '.env'), override: false });
loadEnv({ path: path.join(backendRoot, '.env'), override: false });

type TargetType = 'api' | 'cdn';

type MonitorTarget = {
  name: string;
  url: string;
  method: string;
  type: TargetType;
  expectedStatuses: number[];
  timeoutMs: number;
  severity: MonitoringSeverity;
  headers: Record<string, string>;
};

type TargetDescriptor =
  | string
  | {
    name?: string;
    url?: string;
    method?: string;
    type?: string;
    expectedStatuses?: number[] | number | string;
    timeoutMs?: number;
    severity?: MonitoringSeverity;
    headers?: Record<string, string>;
  };

const parseDefaultHeaders = (raw?: string | null) => {
  if (!raw) {
    return {} as Record<string, string>;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>)
          .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
          .map(([key, value]) => [key, value as string]),
      );
    }
  } catch {
    console.warn('[synthetic-monitor] Failed to parse SYNTHETIC_MONITOR_DEFAULT_HEADERS JSON; ignoring');
  }
  return {} as Record<string, string>;
};

const normalizeStatusList = (value: unknown, fallback: number[]): number[] => {
  if (Array.isArray(value)) {
    const list = value
      .map((entry) => Number(entry))
      .filter((num) => Number.isFinite(num))
      .map((num) => Math.round(num));
    return list.length ? list : fallback;
  }
  if (typeof value === 'number') {
    const normalized = Math.round(value);
    return Number.isFinite(normalized) ? [normalized] : fallback;
  }
  if (typeof value === 'string') {
    const list = value
      .split(/[,\s]+/)
      .map((entry) => Number(entry.trim()))
      .filter((num) => Number.isFinite(num))
      .map((num) => Math.round(num));
    return list.length ? list : fallback;
  }
  return fallback;
};

const defaultTimeout = Number(process.env.SYNTHETIC_MONITOR_DEFAULT_TIMEOUT_MS) || 5000;
const defaultHeaders = parseDefaultHeaders(process.env.SYNTHETIC_MONITOR_DEFAULT_HEADERS);

const parseTargetLine = (line: string, index: number): TargetDescriptor => {
  const [name, url, type, method, statuses, timeout] = line.split('|').map((part) => part.trim());
  return {
    name: name || `target-${index + 1}`,
    url,
    type,
    method,
    expectedStatuses: statuses,
    timeoutMs: timeout ? Number(timeout) : undefined,
  } satisfies TargetDescriptor;
};

const toMonitorTarget = (descriptor: TargetDescriptor, index: number): MonitorTarget | null => {
  if (typeof descriptor === 'string') {
    return toMonitorTarget(parseTargetLine(descriptor, index), index);
  }
  const url = descriptor.url?.trim();
  if (!url) {
    console.warn('[synthetic-monitor] Skipping target without URL', descriptor);
    return null;
  }
  const type: TargetType = descriptor.type === 'cdn' ? 'cdn' : 'api';
  const name = descriptor.name?.trim() || `target-${index + 1}`;
  const defaultStatuses = type === 'cdn' ? [200, 204] : [200];
  const expectedStatuses = normalizeStatusList(descriptor.expectedStatuses, defaultStatuses);
  const timeoutMs = Number(descriptor.timeoutMs) || defaultTimeout;
  const method = descriptor.method?.toUpperCase() || (type === 'cdn' ? 'HEAD' : 'GET');
  const severity: MonitoringSeverity = descriptor.severity
    ? descriptor.severity
    : type === 'cdn'
      ? 'warning'
      : 'critical';
  const headers = {
    ...defaultHeaders,
    ...(descriptor.headers ?? {}),
  };
  return {
    name,
    url,
    method,
    type,
    expectedStatuses,
    timeoutMs,
    severity,
    headers,
  } satisfies MonitorTarget;
};

const parseTargets = (): MonitorTarget[] => {
  const raw = process.env.SYNTHETIC_MONITOR_TARGETS;
  if (!raw) {
    return [];
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry, index) => toMonitorTarget(entry as TargetDescriptor, index))
        .filter((entry): entry is MonitorTarget => Boolean(entry));
    }
  } catch {
    // fall back to line-based parsing
  }
  const segments = trimmed
    .split(/\n|,/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  return segments
    .map((segment, index) => toMonitorTarget(parseTargetLine(segment, index), index))
    .filter((entry): entry is MonitorTarget => Boolean(entry));
};

type MonitorResult = {
  target: MonitorTarget;
  ok: boolean;
  status?: number;
  latencyMs: number;
  error?: unknown;
};

const monitorTarget = async (target: MonitorTarget): Promise<MonitorResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), target.timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(target.url, {
      method: target.method,
      headers: target.headers,
      signal: controller.signal,
    });
    const latencyMs = Math.round(performance.now() - started);
    const ok = target.expectedStatuses.includes(response.status);
    if (!ok) {
      const body = await response
        .text()
        .then((text) => text.slice(0, 512))
        .catch(() => undefined);
      return {
        target,
        ok: false,
        status: response.status,
        latencyMs,
        error: body || `Unexpected status ${response.status}`,
      } satisfies MonitorResult;
    }
    return { target, ok: true, status: response.status, latencyMs } satisfies MonitorResult;
  } catch (error) {
    return {
      target,
      ok: false,
      latencyMs: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : error,
    } satisfies MonitorResult;
  } finally {
    clearTimeout(timeout);
  }
};

const formatResult = (result: MonitorResult) => ({
  target: result.target.name,
  url: result.target.url,
  ok: result.ok,
  latencyMs: result.latencyMs,
  status: result.status,
  error: result.error,
});

async function main() {
  const targets = parseTargets();
  if (!targets.length) {
    console.warn('[synthetic-monitor] No targets configured; set SYNTHETIC_MONITOR_TARGETS to enable synthetic monitoring');
    return;
  }

  console.log(`[synthetic-monitor] Running ${targets.length} checks`);
  const results: MonitorResult[] = [];
  for (const target of targets) {
    const result = await monitorTarget(target);
    results.push(result);
    console.log('[synthetic-monitor] result', formatResult(result));
    if (!result.ok) {
      await recordMonitoringEvent(undefined, {
        category: 'synthetic-monitor',
        severity: target.severity,
        message: `${target.name} failed synthetic check`,
        resource: target.url,
        metadata: {
          method: target.method,
          status: result.status,
          latencyMs: result.latencyMs,
        },
        error: result.error,
      });
    }
  }

  const failed = results.filter((result) => !result.ok);
  if (failed.length) {
    console.error(`[synthetic-monitor] ${failed.length} target(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('[synthetic-monitor] All targets are healthy');
  }
}

main().catch((error) => {
  console.error('[synthetic-monitor] Unhandled error', error);
  process.exit(1);
});
