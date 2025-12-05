import { useAppStore } from '@/stores/app';

type InstantFeedbackPayload = {
    title?: string;
    message: string;
};

type InstantFeedbackOptions = {
    start?: InstantFeedbackPayload;
    success?: InstantFeedbackPayload;
    error?: InstantFeedbackPayload;
};

export const useInstantFeedback = () => {
    const appStore = useAppStore();

    const show = (type: 'info' | 'success' | 'error', payload?: InstantFeedbackPayload) => {
        if (!payload) return;
        appStore.showToast({
            title: payload.title ?? (type === 'success' ? 'Готово' : type === 'error' ? 'Ошибка' : 'Выполняем'),
            message: payload.message,
            type,
        });
    };

    const runWithInstantFeedback = async <T>(fn: () => Promise<T>, options: InstantFeedbackOptions): Promise<T> => {
        show('info', options.start);
        try {
            const result = await fn();
            show('success', options.success);
            return result;
        } catch (error) {
            show('error', options.error);
            throw error;
        }
    };

    return {
        runWithInstantFeedback,
        signalStart: (payload: InstantFeedbackPayload) => show('info', payload),
        signalSuccess: (payload: InstantFeedbackPayload) => show('success', payload),
        signalError: (payload: InstantFeedbackPayload) => show('error', payload),
    };
};
