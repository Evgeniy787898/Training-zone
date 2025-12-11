/**
 * Bot Commands Unit Tests
 * TEST-005: Тесты для Telegram Bot handlers
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Telegraf context
const createMockContext = (overrides: Partial<any> = {}) => ({
    from: { id: 123456, first_name: 'TestUser' },
    chat: { id: 123456, type: 'private' },
    message: { message_id: 1 },
    state: { profileId: 'test-profile-id' },
    replyWithHTML: vi.fn().mockResolvedValue({ message_id: 2 }),
    reply: vi.fn().mockResolvedValue({ message_id: 3 }),
    telegram: {
        editMessageText: vi.fn().mockResolvedValue(true),
    },
    ...overrides,
});

// Mock DatabaseService
const createMockDb = () => ({
    getRecentCompletionStats: vi.fn().mockResolvedValue({
        completed: 5,
        streak: 3,
    }),
    getUserPreferences: vi.fn().mockResolvedValue({
        notificationsEnabled: true,
    }),
    getActiveProgram: vi.fn().mockResolvedValue({
        id: 'program-1',
        name: 'Test Program',
    }),
});

describe('Bot Commands', () => {
    let mockCtx: ReturnType<typeof createMockContext>;
    let mockDb: ReturnType<typeof createMockDb>;

    beforeEach(() => {
        mockCtx = createMockContext();
        mockDb = createMockDb();
        vi.clearAllMocks();
    });

    describe('startCommand', () => {
        it('should reply with welcome message', async () => {
            // Import dynamically to allow mocking
            const { startCommand } = await import('../commands/start.js');

            await startCommand(mockCtx as any, { db: mockDb as any, webAppUrl: 'https://example.com' });

            expect(mockCtx.replyWithHTML).toHaveBeenCalled();
        });

        it('should handle user without profile', async () => {
            const ctxWithoutProfile = createMockContext({
                state: {},
            });

            const { startCommand } = await import('../commands/start.js');

            await startCommand(ctxWithoutProfile as any, { db: mockDb as any, webAppUrl: 'https://example.com' });

            expect(ctxWithoutProfile.replyWithHTML).toHaveBeenCalled();
        });
    });

    describe('helpCommand', () => {
        it('should reply with help text', async () => {
            const { helpCommand } = await import('../commands/help.js');

            await helpCommand(mockCtx as any);

            expect(mockCtx.replyWithHTML).toHaveBeenCalled();
        });
    });

    describe('todayCommand', () => {
        it('should show today workout info', async () => {
            const { todayCommand } = await import('../commands/today.js');

            await todayCommand(mockCtx as any, {
                db: mockDb as any,
                webAppUrl: 'https://example.com',
            });

            expect(mockCtx.replyWithHTML).toHaveBeenCalled();
        });

        it('should handle missing webAppUrl', async () => {
            const { todayCommand } = await import('../commands/today.js');

            await todayCommand(mockCtx as any, {
                db: mockDb as any,
                webAppUrl: undefined,
            });

            expect(mockCtx.replyWithHTML).toHaveBeenCalled();
        });
    });

    describe('statsCommand', () => {
        it('should show user statistics', async () => {
            const { statsCommand } = await import('../commands/stats.js');

            await statsCommand(mockCtx as any, {
                db: mockDb as any,
                webAppUrl: 'https://example.com',
            });

            expect(mockCtx.replyWithHTML).toHaveBeenCalled();
        });
    });

    describe('settingsCommand', () => {
        it('should show settings menu', async () => {
            const { settingsCommand } = await import('../commands/settings.js');

            await settingsCommand(mockCtx as any, {
                webAppUrl: 'https://example.com',
            });

            expect(mockCtx.replyWithHTML).toHaveBeenCalled();
        });
    });
});
