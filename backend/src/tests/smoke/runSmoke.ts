import { setTimeout as delay } from 'node:timers/promises';
import { fetch, Response } from 'undici';

type Target = {
  name: string;
  url: string;
  expectStatus?: number;
  timeoutMs?: number;
  required?: boolean;
};

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';
const IMAGE_PROCESSOR_URL = process.env.SMOKE_IMAGE_PROCESSOR_URL;
const AI_ADVISOR_URL = process.env.SMOKE_AI_ADVISOR_URL;
const ANALYTICS_URL = process.env.SMOKE_ANALYTICS_URL;
const REQUEST_TIMEOUT = Number(process.env.SMOKE_TIMEOUT_MS ?? 5000);

const targets: Target[] = [
  { name: 'api health', url: `${BASE_URL}/api/health` },
  { name: 'api openapi', url: `${BASE_URL}/api/openapi.json` },
  { name: 'api cache status', url: `${BASE_URL}/api/cache/status`, required: false },
];

if (IMAGE_PROCESSOR_URL) {
  targets.push({ name: 'image-processor health', url: `${IMAGE_PROCESSOR_URL}/api/health` });
}

if (AI_ADVISOR_URL) {
  targets.push({ name: 'ai-advisor health', url: `${AI_ADVISOR_URL}/api/health` });
}

if (ANALYTICS_URL) {
  targets.push({ name: 'analytics health', url: `${ANALYTICS_URL}/api/health` });
}

async function probe(target: Target) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), target.timeoutMs ?? REQUEST_TIMEOUT);

  try {
    const response = await fetch(target.url, { signal: controller.signal });
    const ok = target.expectStatus
      ? response.status === target.expectStatus
      : response.status >= 200 && response.status < 400;

    if (!ok) {
      const body = await safeBody(response);
      throw new Error(`Unexpected status ${response.status}: ${body}`);
    }

    await safeBody(response);
    return { target: target.name, status: 'ok' as const };
  } finally {
    clearTimeout(timeout);
  }
}

async function safeBody(response: Response) {
  try {
    return await response.text();
  } catch (error) {
    return `body read failed: ${(error as Error).message}`;
  }
}

async function main() {
  const results: { target: string; status: 'ok' | 'skipped'; error?: string }[] = [];
  const failures: string[] = [];

  for (const target of targets) {
    try {
      const result = await probe(target);
      results.push(result);
    } catch (error) {
      const message = (error as Error).message;
      if (target.required === false) {
        results.push({ target: target.name, status: 'skipped', error: message });
      } else {
        failures.push(`${target.name}: ${message}`);
        results.push({ target: target.name, status: 'skipped', error: message });
      }
    }

    await delay(50);
  }

  for (const result of results) {
    if (result.status === 'ok') {
      console.log(`✔️  ${result.target}`);
    } else if (result.error) {
      console.warn(`⚠️  ${result.target}: ${result.error}`);
    }
  }

  if (failures.length) {
    console.error('\nSmoke checks failed:\n - ' + failures.join('\n - '));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Smoke runner crashed:', error);
  process.exit(1);
});
