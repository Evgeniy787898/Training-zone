import { ref, readonly } from 'vue';
import { apiClient } from '@/services/api';

export interface AiStep {
    id: string;
    label: string;
    status: 'pending' | 'active' | 'done';
}

export function useAiStream() {
    const loading = ref(false);
    const error = ref<string | null>(null);
    const steps = ref<AiStep[]>([]);
    const data = ref<any>(null);

    const initSteps = (initialSteps: AiStep[]) => {
        steps.value = initialSteps;
    };

    const updateStep = (id: string, status: 'active' | 'done', newLabel?: string) => {
        const step = steps.value.find(s => s.id === id);
        if (step) {
            step.status = status;
            if (newLabel) step.label = newLabel;
        }
    };

    const startStream = async (endpoint: string, payload: any, onData?: (data: any) => void) => {
        loading.value = true;
        error.value = null;
        data.value = null;

        // Reset steps to pending, except first one to active
        steps.value.forEach((s, i) => {
            s.status = i === 0 ? 'active' : 'pending';
        });

        try {
            await apiClient.streamRequest(endpoint, payload, (event) => {
                // Handle SSE events
                if (event.type === 'progress') {
                    const stage = event.data.stage;
                    if (stage === 'accepted') {
                        updateStep('connect', 'done');
                        updateStep('context', 'active');
                    } else if (stage === 'context_loaded') {
                        updateStep('context', 'done', `Контекст: ${event.data.entries} записей`);
                        updateStep('personalization', 'active');
                    } else if (stage === 'personalization_loaded') {
                        updateStep('personalization', 'done');
                        updateStep('generate', 'active');
                    } else if (stage === 'context_recorded') {
                        // context recorded happens after advice
                    }
                } else if (event.type === 'advice') {
                    data.value = event.data.payload;
                    updateStep('generate', 'done');
                    if (onData) onData(data.value);
                } else if (event.type === 'error') {
                    error.value = event.data.message || 'Ошибка генерации';
                    loading.value = false;
                } else if (event.type === 'complete') {
                    loading.value = false;
                }
            });
        } catch (err: any) {
            error.value = err.message || 'Ошибка соединения';
            loading.value = false;
        }
    };

    return {
        loading: readonly(loading),
        error: readonly(error),
        steps: readonly(steps),
        data: readonly(data),
        initSteps,
        startStream
    };
}
