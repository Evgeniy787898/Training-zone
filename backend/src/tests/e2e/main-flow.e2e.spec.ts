/**
 * TZONA V2 - E2E Test: Main User Flow
 * Scenario: Login → Select Program → Start Training → Complete → View Stats
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';
const TEST_TELEGRAM_ID = '999000999';
const TEST_PROFILE_ID = '99900099-9999-4999-9999-999999999999';

describe('E2E: Main User Flow', () => {
    let app: Express;
    let authToken: string;
    let profileId: string;
    let programId: string;
    let sessionId: string;

    beforeAll(async () => {
        // Note: This test assumes the backend is running and seeded
        // Run: npx prisma db seed before running tests
    });

    describe('1. Authentication (Login)', () => {
        it('should authenticate user via Telegram initData', async () => {
            // Mock Telegram initData (simplified for testing)
            const mockInitData = {
                telegramId: TEST_TELEGRAM_ID,
                firstName: 'Test',
                lastName: 'User',
                authDate: Math.floor(Date.now() / 1000),
            };

            const response = await request(BASE_URL)
                .post('/api/auth/telegram')
                .send({ initData: JSON.stringify(mockInitData) })
                .expect('Content-Type', /json/);

            // Should return 200 or 201 with profile data
            expect([200, 201]).toContain(response.status);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('profile');
            expect(response.body.data.profile).toHaveProperty('id');

            profileId = response.body.data.profile.id;

            // Store auth token if returned
            if (response.body.data.token) {
                authToken = response.body.data.token;
            }

            console.log('✓ Step 1: User authenticated, profileId:', profileId);
        });

        it('should fetch user profile', async () => {
            const response = await request(BASE_URL)
                .get('/api/profile')
                .set('Authorization', authToken ? `Bearer ${authToken}` : '')
                .expect(200)
                .expect('Content-Type', /json/);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data.profile).toHaveProperty('id');
            expect(response.body.data.profile.telegramId).toBeDefined();

            console.log('✓ Step 1b: Profile fetched successfully');
        });
    });

    describe('2. Select Training Program', () => {
        it('should list available training programs', async () => {
            const response = await request(BASE_URL)
                .get('/api/programs')
                .set('Authorization', authToken ? `Bearer ${authToken}` : '')
                .expect(200)
                .expect('Content-Type', /json/);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('programs');
            expect(Array.isArray(response.body.data.programs)).toBe(true);
            expect(response.body.data.programs.length).toBeGreaterThan(0);

            // Select first program (e.g., "Full Body Strength" from seed)
            programId = response.body.data.programs[0].id;

            console.log('✓ Step 2: Programs listed, selected programId:', programId);
        });

        it('should get program details', async () => {
            const response = await request(BASE_URL)
                .get(`/api/programs/${programId}`)
                .set('Authorization', authToken ? `Bearer ${authToken}` : '')
                .expect(200)
                .expect('Content-Type', /json/);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data.program).toHaveProperty('name');
            expect(response.body.data.program).toHaveProperty('programData');

            console.log('✓ Step 2b: Program details fetched');
        });
    });

    describe('3. Start Training Session', () => {
        it('should create a new training session', async () => {
            const plannedAt = new Date();
            plannedAt.setHours(plannedAt.getHours() + 1); // Schedule for 1 hour from now

            const response = await request(BASE_URL)
                .post('/api/sessions')
                .set('Authorization', authToken ? `Bearer ${authToken}` : '')
                .send({
                    programId,
                    plannedAt: plannedAt.toISOString(),
                    status: 'planned',
                })
                .expect('Content-Type', /json/);

            expect([200, 201]).toContain(response.status);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('session');
            expect(response.body.data.session).toHaveProperty('id');

            sessionId = response.body.data.session.id;

            console.log('✓ Step 3: Training session created, sessionId:', sessionId);
        });

        it('should start the training session', async () => {
            const response = await request(BASE_URL)
                .patch(`/api/sessions/${sessionId}`)
                .set('Authorization', authToken ? `Bearer ${authToken}` : '')
                .send({
                    status: 'in_progress',
                })
                .expect(200)
                .expect('Content-Type', /json/);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data.session.status).toBe('in_progress');

            console.log('✓ Step 3b: Training session started');
        });
    });

    describe('4. Complete Training Session', () => {
        it('should record exercise progress', async () => {
            const response = await request(BASE_URL)
                .post('/api/progress')
                .set('Authorization', authToken ? `Bearer ${authToken}` : '')
                .send({
                    sessionId,
                    exerciseKey: 'push-ups',
                    levelTarget: 'standard',
                    levelResult: 'standard',
                    volumeTarget: 36,
                    volumeActual: 35,
                    rpe: 7.5,
                    decision: 'maintain',
                })
                .expect('Content-Type', /json/);

            expect([200, 201]).toContain(response.status);
            expect(response.body).toHaveProperty('success', true);

            console.log('✓ Step 4: Exercise progress recorded');
        });

        it('should mark session as completed', async () => {
            const response = await request(BASE_URL)
                .patch(`/api/sessions/${sessionId}`)
                .set('Authorization', authToken ? `Bearer ${authToken}` : '')
                .send({
                    status: 'done',
                    notes: 'Great workout!',
                })
                .expect(200)
                .expect('Content-Type', /json/);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data.session.status).toBe('done');

            console.log('✓ Step 4b: Session marked as completed');
        });
    });

    describe('5. View Statistics (Analytics)', () => {
        it('should fetch overview statistics', async () => {
            const response = await request(BASE_URL)
                .get('/api/analytics/overview')
                .set('Authorization', authToken ? `Bearer ${authToken}` : '')
                .expect(200)
                .expect('Content-Type', /json/);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('overview');
            expect(response.body.data.overview).toHaveProperty('totalWorkouts');
            expect(response.body.data.overview).toHaveProperty('completionRate');

            console.log('✓ Step 5: Overview statistics fetched');
        });

        it('should fetch visualization data', async () => {
            const response = await request(BASE_URL)
                .get('/api/analytics/visualization')
                .query({
                    type: 'volume_trend',
                    period: '30d',
                })
                .set('Authorization', authToken ? `Bearer ${authToken}` : '')
                .expect(200)
                .expect('Content-Type', /json/);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('labels');
            expect(response.body.data).toHaveProperty('datasets');
            expect(Array.isArray(response.body.data.datasets)).toBe(true);

            console.log('✓ Step 5b: Visualization data fetched');
        });

        it('should fetch user progress history', async () => {
            const response = await request(BASE_URL)
                .get('/api/sessions')
                .query({
                    limit: 10,
                    status: 'done',
                })
                .set('Authorization', authToken ? `Bearer ${authToken}` : '')
                .expect(200)
                .expect('Content-Type', /json/);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('sessions');
            expect(Array.isArray(response.body.data.sessions)).toBe(true);

            // Our completed session should be in the list
            const completedSession = response.body.data.sessions.find(
                (s: any) => s.id === sessionId
            );
            expect(completedSession).toBeDefined();
            expect(completedSession.status).toBe('done');

            console.log('✓ Step 5c: Progress history fetched, session visible');
        });
    });

    describe('6. Integration: Analytics Refresh', () => {
        it('should refresh materialized views via analytics service', async () => {
            // This calls the analytics microservice to refresh MVs
            const response = await request(BASE_URL)
                .post('/api/proxy/analytics/refresh')
                .set('Authorization', authToken ? `Bearer ${authToken}` : '')
                .send({})
                .expect('Content-Type', /json/);

            // Should succeed or return 503 if analytics service is down
            if (response.status === 200) {
                expect(response.body).toHaveProperty('success', true);
                console.log('✓ Step 6: Analytics MVs refreshed successfully');
            } else if (response.status === 503) {
                console.log('⚠ Step 6: Analytics service unavailable (expected in some envs)');
            } else {
                throw new Error(`Unexpected status: ${response.status}`);
            }
        });
    });

    afterAll(async () => {
        console.log('\n✅ E2E Test completed: Full user flow validated');
    });
});
