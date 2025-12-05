// TZONA V2 - Progression Service
// Ported from V1 progression.js
import { DatabaseService } from '../integrations/supabase.js';

export class ProgressionService {
    constructor(private db: DatabaseService) { }

    async analyzeExercise(exerciseData: any) {
        const {
            targetSets,
            targetReps,
            actualSets,
            actualReps,
            rpe,
            notes,
        } = exerciseData;

        const targetVolume = targetSets * targetReps;
        const actualVolume = actualSets * actualReps;
        const completionRate = targetVolume > 0 ? actualVolume / targetVolume : 0;

        let decision: 'advance' | 'hold' | 'regress' = 'hold';
        let reasoning = '';

        if (completionRate >= 1.05 && rpe <= 7) {
            decision = 'advance';
            reasoning = 'Перевыполнение объёма при низком RPE - готов к повышению уровня';
        } else if (completionRate >= 0.9 && rpe <= 9) {
            decision = 'hold';
            reasoning = 'Хорошее выполнение - закрепляем уровень';
        } else if (completionRate < 0.9 || rpe >= 10 || notes?.includes('боль')) {
            decision = 'regress';
            reasoning = 'Недовыполнение или высокая нагрузка - снижаем уровень';
        }

        if (notes) {
            const painKeywords = ['боль', 'болит', 'травма', 'тянет', 'дискомфорт'];
            const hasPain = painKeywords.some(keyword =>
                notes.toLowerCase().includes(keyword)
            );

            if (hasPain) {
                decision = 'regress';
                reasoning = 'Признаки боли - переходим на облегчённый вариант';
            }
        }

        return {
            decision,
            reasoning,
            metrics: {
                targetVolume,
                actualVolume,
                completionRate: Math.round(completionRate * 100),
                rpe,
            },
        };
    }

    calculateNextLevel(currentLevel: string, decision: string): string {
        const [level, sublevel] = currentLevel.split('.').map(Number);
        let nextLevel = currentLevel;

        if (decision === 'advance') {
            if (sublevel >= 3) {
                nextLevel = `${level + 1}.1`;
            } else {
                nextLevel = `${level}.${sublevel + 1}`;
            }
        } else if (decision === 'regress') {
            if (sublevel <= 1) {
                if (level > 1) {
                    nextLevel = `${level - 1}.3`;
                }
            } else {
                nextLevel = `${level}.${sublevel - 1}`;
            }
        }

        return nextLevel;
    }

    async saveProgressionDecision(sessionId: string, exerciseKey: string, analysis: any, currentLevel: string, nextLevel: string) {
        try {
            await this.db.createExerciseProgress({
                session_id: sessionId,
                exercise_key: exerciseKey,
                level_target: currentLevel,
                level_result: nextLevel,
                volume_target: analysis.metrics.targetVolume,
                volume_actual: analysis.metrics.actualVolume,
                rpe: analysis.metrics.rpe,
                decision: analysis.decision,
                notes: analysis.reasoning,
                streak_success: analysis.decision === 'advance' ? 1 : 0,
            });

            return true;
        } catch (error) {
            console.error('Error saving progression decision:', error);
            return false;
        }
    }

    async getExerciseHistory(profileId: string, exerciseKey: string, limit = 10) {
        try {
            const history = await this.db.getExerciseProgressHistory(profileId, exerciseKey, limit);
            return history || [];
        } catch (error) {
            console.error('Error fetching exercise history:', error);
            return [];
        }
    }

    calculateProgressTrend(history: any[]) {
        if (!history || history.length < 2) {
            return { trend: 'neutral', percentage: 0 };
        }

        const recent = history.slice(0, 3);
        const advances = recent.filter(h => h.decision === 'advance').length;
        const regresses = recent.filter(h => h.decision === 'regress').length;

        if (advances > regresses) {
            return { trend: 'up', percentage: Math.round((advances / recent.length) * 100) };
        } else if (regresses > advances) {
            return { trend: 'down', percentage: Math.round((regresses / recent.length) * 100) };
        } else {
            return { trend: 'neutral', percentage: 50 };
        }
    }
}

export default ProgressionService;

