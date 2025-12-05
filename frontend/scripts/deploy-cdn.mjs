import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { lookup as lookupMime } from 'mime-types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

async function assertDistDirectory() {
    try {
        const stats = await fs.stat(distDir);
        if (!stats.isDirectory()) {
            throw new Error('dist exists but is not a directory');
        }
    } catch (error) {
        throw new Error(`dist directory is missing - run "npm run build" first (${error})`);
    }
}

function resolveEnv(key, fallbackKeys = []) {
    if (process.env[key]) {
        return process.env[key];
    }
    for (const fallbackKey of fallbackKeys) {
        if (process.env[fallbackKey]) {
            return process.env[fallbackKey];
        }
    }
    return undefined;
}

function collectRequiredEnv() {
    const bucket = resolveEnv('CDN_BUCKET');
    const region = resolveEnv('CDN_REGION', ['AWS_REGION']);
    const accessKeyId = resolveEnv('CDN_ACCESS_KEY_ID', ['AWS_ACCESS_KEY_ID']);
    const secretAccessKey = resolveEnv('CDN_SECRET_ACCESS_KEY', ['AWS_SECRET_ACCESS_KEY']);
    const sessionToken = resolveEnv('CDN_SESSION_TOKEN', ['AWS_SESSION_TOKEN']);

    const missing = [];
    if (!bucket) missing.push('CDN_BUCKET');
    if (!region) missing.push('CDN_REGION');
    if (!accessKeyId) missing.push('CDN_ACCESS_KEY_ID');
    if (!secretAccessKey) missing.push('CDN_SECRET_ACCESS_KEY');

    if (missing.length > 0) {
        throw new Error(`Missing required env variables: ${missing.join(', ')}`);
    }

    return {
        bucket,
        region,
        credentials: {
            accessKeyId,
            secretAccessKey,
            sessionToken,
        },
    };
}

async function collectFiles(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        if (entry.name.startsWith('.')) {
            continue;
        }
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            const nested = await collectFiles(absolute);
            files.push(...nested);
        } else if (entry.isFile()) {
            files.push(absolute);
        }
    }

    return files;
}

async function readCdnManifest() {
    const manifestPath = path.join(distDir, 'cdn-manifest.json');
    try {
        const raw = await fs.readFile(manifestPath, 'utf-8');
        return JSON.parse(raw);
    } catch (error) {
        console.warn('[deploy-cdn] cdn-manifest.json not found or invalid, proceeding with defaults', error);
        return null;
    }
}

function normalisePathForS3(filePath) {
    return filePath.split(path.sep).join('/');
}

function buildHeaderLookup(manifest) {
    const lookup = new Map();
    if (!manifest?.groups) {
        return { lookup, defaultHeaders: [] };
    }

    const entries = Object.entries(manifest.groups);
    for (const [groupName, group] of entries) {
        if (!group || typeof group !== 'object') continue;
        if (Array.isArray(group.paths)) {
            for (const manifestPath of group.paths) {
                lookup.set(manifestPath, Array.isArray(group.headers) ? group.headers : []);
            }
        }
    }

    const defaultHeaders = Array.isArray(manifest.groups.default?.headers)
        ? manifest.groups.default.headers
        : [];

    return { lookup, defaultHeaders };
}

function extractHeaderValue(headers, targetHeader) {
    const headerLine = headers.find((line) => line.toLowerCase().startsWith(`${targetHeader.toLowerCase()}:`));
    if (!headerLine) {
        return undefined;
    }
    return headerLine.slice(headerLine.indexOf(':') + 1).trim();
}

function buildMetadata(headers) {
    const metadata = {};
    const cdnCacheControl = extractHeaderValue(headers, 'CDN-Cache-Control');
    if (cdnCacheControl) {
        metadata['cdn-cache-control'] = cdnCacheControl;
    }
    const edgeCacheTag = extractHeaderValue(headers, 'Edge-Cache-Tag');
    if (edgeCacheTag) {
        metadata['edge-cache-tag'] = edgeCacheTag;
    }
    return Object.keys(metadata).length > 0 ? metadata : undefined;
}

async function uploadFiles(config) {
    const { bucket, region, credentials } = config;
    const prefix = (process.env.CDN_PREFIX || '').replace(/^\/+|\/+$/g, '');
    const dryRun = process.env.CDN_DRY_RUN === 'true';

    const manifest = await readCdnManifest();
    const { lookup: headerLookup, defaultHeaders } = buildHeaderLookup(manifest);

    const files = await collectFiles(distDir);
    const s3 = new S3Client({ region, credentials });

    let uploaded = 0;
    for (const absolutePath of files) {
        const relativePath = path.relative(distDir, absolutePath);
        const posixPath = normalisePathForS3(relativePath);
        const manifestKey = `/${posixPath}`;
        const headers = headerLookup.get(manifestKey) || defaultHeaders;
        const cacheControl = extractHeaderValue(headers, 'Cache-Control')
            || process.env.CDN_FALLBACK_CACHE_CONTROL
            || 'public, max-age=60, stale-while-revalidate=600';
        const metadata = buildMetadata(headers);
        const contentType = lookupMime(posixPath) || 'application/octet-stream';

        const key = prefix ? `${prefix}/${posixPath}` : posixPath;

        if (dryRun) {
            console.log(`[deploy-cdn] DRY RUN ${key} (${contentType}, cache-control: ${cacheControl})`);
            uploaded += 1;
            continue;
        }

        const body = await fs.readFile(absolutePath);
        await s3.send(new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
            CacheControl: cacheControl,
            Metadata: metadata,
        }));
        uploaded += 1;
        console.log(`[deploy-cdn] Uploaded ${key}`);
    }

    console.log(`[deploy-cdn] Uploaded ${uploaded} file(s) to s3://${bucket}${prefix ? `/${prefix}` : ''}`);

    return manifest;
}

async function invalidateCdn(manifest, credentials) {
    const distributionId = resolveEnv('CDN_DISTRIBUTION_ID', ['CLOUDFRONT_DISTRIBUTION_ID']);
    if (!distributionId) {
        console.log('[deploy-cdn] CDN_DISTRIBUTION_ID not provided, skipping invalidation');
        return;
    }

    const dryRun = process.env.CDN_DRY_RUN === 'true';
    const region = process.env.CDN_CLOUDFRONT_REGION || 'us-east-1';
    const invalidateAll = process.env.CDN_INVALIDATE_ALL === 'true';

    const paths = new Set(['/index.html']);
    if (invalidateAll) {
        paths.add('/*');
    } else if (manifest?.groups?.revalidate?.paths) {
        manifest.groups.revalidate.paths.forEach((item) => paths.add(item));
    }

    const items = Array.from(paths);
    if (dryRun) {
        console.log(`[deploy-cdn] DRY RUN invalidate ${items.join(', ')} for distribution ${distributionId}`);
        return;
    }

    const cloudfront = new CloudFrontClient({ region, credentials });
    await cloudfront.send(new CreateInvalidationCommand({
        DistributionId: distributionId,
        InvalidationBatch: {
            CallerReference: `deploy-${Date.now()}`,
            Paths: {
                Quantity: items.length,
                Items: items,
            },
        },
    }));

    console.log(`[deploy-cdn] Requested CloudFront invalidation for ${items.length} path(s)`);
}

async function main() {
    await assertDistDirectory();
    const env = collectRequiredEnv();
    const manifest = await uploadFiles(env);
    await invalidateCdn(manifest, env.credentials);
}

main().catch((error) => {
    console.error('[deploy-cdn] Deployment failed', error);
    process.exit(1);
});
