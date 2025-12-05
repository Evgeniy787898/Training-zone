import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { recordMonitoringEvent } from '../modules/infrastructure/monitoring.js';
import type { MonitoringSeverity } from '../types/monitoring.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');

loadEnv({ path: path.join(repoRoot, '.env'), override: false });
loadEnv({ path: path.join(backendRoot, '.env'), override: false });

const normalizeStatus = (status: string | undefined) => {
    if (!status) return 'success';
    const normalized = status.trim().toLowerCase();
    if (normalized === 'success' || normalized === 'warning' || normalized === 'failed' || normalized === 'failure') {
        return normalized;
    }
    return 'warning';
};

const status = normalizeStatus(process.env.DEPLOY_STATUS || process.env.DEPLOYMENT_STATUS);
const severity: MonitoringSeverity = status === 'success' ? 'info' : status === 'warning' ? 'warning' : 'critical';
const environment = (process.env.DEPLOY_ENVIRONMENT || process.env.ENVIRONMENT || 'production').trim();
const version =
    process.env.IMAGE_TAG ||
    process.env.DEPLOY_VERSION ||
    process.env.GITHUB_SHA ||
    process.env.DEPLOY_COMMIT ||
    'unknown';
const targetHost = process.env.DEPLOY_TARGET || process.env.DEPLOY_HOST;
const workflow = process.env.GITHUB_WORKFLOW;
const runId = process.env.GITHUB_RUN_ID;
const repository = process.env.GITHUB_REPOSITORY;

const hasWebhook = Boolean(process.env.MONITORING_WEBHOOK_URL);
const hasTelegram = Boolean(process.env.MONITORING_TELEGRAM_BOT_TOKEN && process.env.MONITORING_TELEGRAM_CHAT_ID);

async function main() {
    if (!hasWebhook && !hasTelegram) {
        console.warn('[deploy-monitoring] No monitoring endpoints configured; skipping deploy event dispatch');
        return;
    }

    await recordMonitoringEvent(undefined, {
        category: 'deployment',
        severity,
        message: `Deployment ${status} for ${environment}`,
        resource: environment,
        metadata: {
            status,
            version,
            targetHost,
            workflow,
            runId,
            repository,
        },
    });

    console.log('[deploy-monitoring] Dispatch finished', { status, environment, version, targetHost });
}

main().catch((error) => {
    console.error('[deploy-monitoring] Failed to dispatch deployment event', error);
    process.exit(1);
});
