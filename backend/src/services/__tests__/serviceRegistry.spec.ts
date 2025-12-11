import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceRegistry } from '../serviceRegistry';

const { cacheSetMock, cacheGetMock, cacheDelMock } = vi.hoisted(() => ({
    cacheSetMock: vi.fn(),
    cacheGetMock: vi.fn(),
    cacheDelMock: vi.fn(),
}));

vi.mock('../../modules/infrastructure/cache', () => ({
    cacheSet: cacheSetMock,
    cacheGet: cacheGetMock,
    cacheDel: cacheDelMock,
    getCacheNamespace: () => 'test',
}));

describe('ServiceRegistry', () => {
    let registry: ServiceRegistry;

    beforeEach(() => {
        vi.clearAllMocks();
        registry = new ServiceRegistry();
    });

    it('should register a service', async () => {
        await registry.register('test-service', 'http://localhost:3000', '1.0.0');
        expect(cacheSetMock).toHaveBeenCalledWith(
            'service:test-service',
            expect.objectContaining({
                name: 'test-service',
                url: 'http://localhost:3000',
                version: '1.0.0',
            }),
            60
        );
    });

    it('should get service url', async () => {
        cacheGetMock.mockResolvedValue({
            name: 'test-service',
            url: 'http://localhost:3000',
            version: '1.0.0',
            lastHeartbeat: Date.now(),
        });

        const url = await registry.getServiceUrl('test-service');
        expect(url).toBe('http://localhost:3000');
        expect(cacheGetMock).toHaveBeenCalledWith('service:test-service');
    });

    it('should return null if service not found', async () => {
        cacheGetMock.mockResolvedValue(null);
        const url = await registry.getServiceUrl('unknown');
        expect(url).toBeNull();
    });

    it('should deregister a service', async () => {
        await registry.deregister('test-service');
        expect(cacheDelMock).toHaveBeenCalledWith('service:test-service');
    });
});
