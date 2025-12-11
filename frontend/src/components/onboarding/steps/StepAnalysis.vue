<template>
    <div class="flex flex-col items-center justify-center h-full pb-20 w-full text-center">
        <!-- Analyzing Animation -->
        <div class="relative w-48 h-48 mb-8 flex items-center justify-center">
            <div class="absolute inset-0 border-4 border-surface-strong rounded-full opacity-30"></div>
            <div class="absolute inset-0 border-t-4 border-accent rounded-full animate-spin"></div>
            
            <div class="w-24 h-24 bg-surface-elevated rounded-full flex items-center justify-center shadow-inner relative z-10">
                <span class="text-4xl animate-bounce">🤖</span>
            </div>
            
            <!-- Floating Particles -->
            <div class="absolute inset-0 animate-ping opacity-20 bg-accent rounded-full"></div>
        </div>

        <h2 class="text-2xl font-bold mb-2">Analyzing Profile...</h2>
        
        <div class="h-8 relative overflow-hidden w-64">
             <TransitionGroup name="list" tag="div" class="absolute w-full text-center">
                <div v-for="msg in activeMessages" :key="msg" class="text-text-muted text-sm w-full">
                    {{ msg }}
                </div>
             </TransitionGroup>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useOnboardingStore } from '@/stores/onboarding';

const store = useOnboardingStore();
const messages = [
    'Обработка биометрики...',
    'Анализ целей...',
    'Подбор программы...',
    'Калибровка нагрузки...',
    'Синхронизация с базой...',
    'Готово! 🚀'
];

const currentMsgIndex = ref(0);
const activeMessages = computed(() => [messages[currentMsgIndex.value]]);

onMounted(() => {
    const interval = setInterval(() => {
        if (currentMsgIndex.value < messages.length - 1) {
            currentMsgIndex.value++;
        } else {
            clearInterval(interval);
            setTimeout(() => {
                store.nextStep();
            }, 800);
        }
    }, 800);
});
</script>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.4s ease;
}
.list-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.list-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
