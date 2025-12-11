
import { microserviceClients } from '../../config/constants.js';

async function verifyAiIntegration() {
    console.log('[Verify] Starting AI Advisor integration check...');

    if (!microserviceClients.aiAdvisor.enabled) {
        console.warn('[Verify] AI Advisor is DISABLED in config.');
        return;
    }

    try {
        const { request } = await import('undici');
        const aiUrl = `${microserviceClients.aiAdvisor.baseUrl}/api/generate-advice`;
        console.log(`[Verify] Calling URL: ${aiUrl}`);

        const payload = {
            exerciseKey: 'squat_barbell', // Mock exercise
            currentLevel: '1.1',
            performance: {},
            goals: ['strength'],
            context: []
        };

        const started = Date.now();
        const aiRes = await request(aiUrl, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-trace-id': 'verify-manual-' + Date.now(),
            },
            body: JSON.stringify(payload)
        });

        const duration = Date.now() - started;
        console.log(`[Verify] Response status: ${aiRes.statusCode} (${duration}ms)`);

        if (aiRes.statusCode === 200) {
            const data = await aiRes.body.json();
            console.log('[Verify] SUCCESS. Received advice:', JSON.stringify(data, null, 2));
        } else {
            console.error('[Verify] FAILED. Response body:', await aiRes.body.text());
        }

    } catch (error) {
        console.error('[Verify] ERROR calling service:', error);
    }
}

verifyAiIntegration().catch(console.error);
