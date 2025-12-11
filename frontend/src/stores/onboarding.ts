import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiClient } from '@/services/api';
import { useAppStore } from '@/stores/app';
import type { Profile } from '@/types';

export type OnboardingStep = 'welcome' | 'goals' | 'level' | 'analysis' | 'program';

export interface OnboardingState {
    currentStep: OnboardingStep;
    data: {
        goals: string[];
        level: 'beginner' | 'intermediate' | 'advanced' | null;
        focusArea: string[];
        equipment: string[];
        daysPerWeek: number;
    };
    isCompleting: boolean;
}

export const useOnboardingStore = defineStore('onboarding', () => {
    const appStore = useAppStore();
    const currentStep = ref<OnboardingStep>('welcome');

    // Default form data
    const data = ref<OnboardingState['data']>({
        goals: [],
        level: null,
        focusArea: [],
        equipment: [],
        daysPerWeek: 3
    });

    const isCompleting = ref(false);

    const stepsOrder: OnboardingStep[] = ['welcome', 'goals', 'level', 'analysis', 'program'];

    const progress = computed(() => {
        const index = stepsOrder.indexOf(currentStep.value);
        return Math.round(((index + 1) / stepsOrder.length) * 100);
    });

    const canContinue = computed(() => {
        switch (currentStep.value) {
            case 'welcome': return true;
            case 'goals': return data.value.goals.length > 0;
            case 'level': return data.value.level !== null;
            case 'analysis': return true; // Auto-advance usually
            case 'program': return true;
            default: return false;
        }
    });

    function setStep(step: OnboardingStep) {
        currentStep.value = step;
    }

    function nextStep() {
        const index = stepsOrder.indexOf(currentStep.value);
        if (index < stepsOrder.length - 1) {
            currentStep.value = stepsOrder[index + 1];
        }
    }

    function prevStep() {
        const index = stepsOrder.indexOf(currentStep.value);
        if (index > 0) {
            currentStep.value = stepsOrder[index - 1];
        }
    }

    function updateData<K extends keyof OnboardingState['data']>(key: K, value: OnboardingState['data'][K]) {
        data.value[key] = value;
    }

    async function completeOnboarding() {
        if (isCompleting.value) return;
        isCompleting.value = true;
        try {
            // 1. Update Profile with gathered data
            const profileUpdates: Partial<Profile> = {
                goals: data.value.goals,
                equipment: data.value.equipment,
                preferences: {
                    ...appStore.profileSummary?.profile?.preferences,
                    isOnboarded: true,
                    level: data.value.level,
                    daysPerWeek: data.value.daysPerWeek,
                    focusArea: data.value.focusArea
                }
            };

            await apiClient.updateProfile(profileUpdates);

            // 2. Refresh app store to reflect changes
            await appStore.refreshProfile();

            return true;
        } catch (error) {
            console.error('Onboarding failed:', error);
            return false;
        } finally {
            isCompleting.value = false;
        }
    }

    return {
        currentStep,
        data,
        isCompleting,
        progress,
        canContinue,
        setStep,
        nextStep,
        prevStep,
        updateData,
        completeOnboarding
    };
});
