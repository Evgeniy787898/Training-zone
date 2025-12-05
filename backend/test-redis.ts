import { Redis } from 'ioredis';

const url = process.env.CACHE_REDIS_URL || 'redis://localhost:6379';
console.log(`Testing connection to: ${url}`);

const redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    connectTimeout: 5000,
});

redis.on('connect', () => {
    console.log('✅ Connected to Redis successfully!');
    redis.quit();
    process.exit(0);
});

redis.on('error', (err) => {
    console.error('❌ Redis connection error:', err);
    redis.quit();
    process.exit(1);
});
