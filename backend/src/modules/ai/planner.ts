// TZONA V2 - Planner Service
// Ported from V1 planner.js
import {
    generateTrainingPlan,
    analyzeTrainingReport,
    buildMotivationMessage,
} from './internalAssistantEngine.js';

export class PlannerService {
    async generateTrainingPlan(userContext: any = {}) {
        try {
            return await generateTrainingPlan(userContext);
        } catch (error) {
            console.error('Error generating training plan:', error);
            throw new Error('Не удалось сгенерировать план тренировки');
        }
    }

    async analyzeTrainingReport(reportContext: any = {}) {
        try {
            return await analyzeTrainingReport(reportContext);
        } catch (error) {
            console.error('Error analyzing training report:', error);
            throw new Error('Не удалось проанализировать отчёт');
        }
    }

    async generateMotivationalMessage(context: any = {}) {
        try {
            return await buildMotivationMessage(context);
        } catch (error) {
            console.error('Error generating motivational message:', error);
            return 'Отличная работа! Продолжай в том же духе 💪';
        }
    }
}

export default new PlannerService();
