<template>
    <div class="fixed inset-0 z-50 bg-[#050505] text-white overflow-hidden flex flex-col">
        <!-- Progress Bar -->
        <div class="h-1 bg-surface-strong/30 w-full">
            <div 
                class="h-full bg-accent transition-all duration-500 ease-out"
                :style="{ width: `${store.progress}%` }"
            ></div>
        </div>

        <!-- Header -->
        <header class="h-14 flex items-center justify-between px-4 shrink-0">
            <button 
                v-if="store.currentStep !== 'welcome' && store.currentStep !== 'analysis'"
                @click="store.prevStep"
                class="text-text-muted hover:text-white transition-colors p-2"
            >
                <i class="pi pi-arrow-left text-xl"></i>
            </button>
            <div v-else class="w-10"></div>

            <div class="font-medium text-sm text-text-muted">
                {{ stepTitle }}
            </div>

            <button 
                class="text-text-muted opacity-0 pointer-events-none p-2"
            >
                <i class="pi pi-times text-xl"></i>
            </button>
        </header>

        <!-- Main Content -->
        <main class="flex-1 overflow-y-auto overflow-x-hidden relative w-full max-w-lg mx-auto px-6 py-8 flex flex-col items-center">
            <Transition name="slide-fade" mode="out-in">
                <component :is="currentStepComponent" />
            </Transition>
        </main>

        <!-- Footer Actions -->
        <footer 
            class="p-6 shrink-0 max-w-lg mx-auto w-full"
            v-if="store.currentStep !== 'analysis'"
        >
            <BaseButton 
                variant="primary" 
                size="lg" 
                class="w-full shadow-lg shadow-accent/20"
                :disabled="!store.canContinue"
                :loading="store.isCompleting"
                @click="handleContinue"
            >
                {{ buttonLabel }}
            </BaseButton>
        </footer>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useOnboardingStore } from '@/stores/onboarding';
import BaseButton from '@/components/ui/BaseButton.vue';

// Steps
import StepWelcome from './steps/StepWelcome.vue';
import StepGoals from './steps/StepGoals.vue';
import StepLevel from './steps/StepLevel.vue';
import StepAnalysis from './steps/StepAnalysis.vue';
import StepProgram from './steps/StepProgram.vue';

const store = useOnboardingStore();
const router = useRouter();

const stepTitle = computed(() => {
    switch (store.currentStep) {
        case 'welcome': return 'Добро пожаловать';
        case 'goals': return 'Ваши цели';
        case 'level': return 'Ваш уровень';
        case 'analysis': return 'Анализ профиля';
        case 'program': return 'Подбор программы';
        default: return '';
    }
});

const currentStepComponent = computed(() => {
    switch (store.currentStep) {
        case 'welcome': return StepWelcome;
        case 'goals': return StepGoals;
        case 'level': return StepLevel;
        case 'analysis': return StepAnalysis;
        case 'program': return StepProgram;
        default: return StepWelcome;
    }
});

const buttonLabel = computed(() => {
    if (store.currentStep === 'program') return 'Начать тренировки';
    if (store.currentStep === 'welcome') return 'Поехали 🚀';
    return 'Продолжить';
});

const handleContinue = async () => {
    if (store.currentStep === 'program') {
        const success = await store.completeOnboarding();
        if (success) {
            router.replace('/today');
        }
    } else {
        store.nextStep();
    }
};
</script>

<style scoped>
/* Transition Effects */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease-out;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
