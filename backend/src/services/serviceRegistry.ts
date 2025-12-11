import {
    cacheSet,
    cacheGet,
    cacheDel,
    getCacheNamespace,
} from '../modules/infrastructure/cache';

export interface ServiceDefinition {
    name: string;
    url: string;
    version: string;
    lastHeartbeat: number;
}

const REGISTRY_TTL_SECONDS = 60;
const SERVICE_PREFIX = 'service:';

export class ServiceRegistry {
    /**
     * Registers a service or updates its heartbeat
     */
    async register(name: string, url: string, version: string): Promise<void> {
        const key = `${SERVICE_PREFIX}${name}`;
        const service: ServiceDefinition = {
            name,
            url,
            version,
            lastHeartbeat: Date.now(),
        };

        // Cache the service definition
        await cacheSet(key, service, REGISTRY_TTL_SECONDS);
        console.log(`[ServiceRegistry] Registered ${name} at ${url}`);
    }

    /**
     * Gets the URL for a registered service
     */
    async getServiceUrl(name: string): Promise<string | null> {
        const key = `${SERVICE_PREFIX}${name}`;
        const service = await cacheGet<ServiceDefinition>(key);
        return service ? service.url : null;
    }

    /**
     * Deregisters a service gracefully
     */
    async deregister(name: string): Promise<void> {
        const key = `${SERVICE_PREFIX}${name}`;
        await cacheDel(key);
        console.log(`[ServiceRegistry] Deregistered ${name}`);
    }
}

export const serviceRegistry = new ServiceRegistry();
