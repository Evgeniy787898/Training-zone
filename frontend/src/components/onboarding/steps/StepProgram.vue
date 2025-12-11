<template>
    <div class="w-full">
        <h2 class="text-2xl font-bold mb-2">Ваша программа готова!</h2>
        <p class="text-text-muted mb-8">Мы подобрали оптимальный план на основе ваших целей.</p>

        <div class="bg-surface-elevated border border-border rounded-2xl overflow-hidden shadow-lg shadow-black/40">
            <!-- Header -->
            <div class="h-32 bg-gradient-to-br from-indigo-900 to-purple-900 relative p-6 flex flex-col justify-end">
                <div class="absolute top-4 right-4 bg-black/30 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white border border-white/10">
                    RECOMMENDED
                </div>
                <h3 class="text-2xl font-bold text-white mb-1">Functional Base</h3>
                <p class="text-indigo-200 text-sm">Универсальная фулл-боди программа</p>
            </div>

            <!-- Stats -->
            <div class="p-6">
                <div class="grid grid-cols-3 gap-4 mb-6">
                    <div class="text-center">
                        <div class="text-xl font-bold text-white">{{ store.data.daysPerWeek }}</div>
                        <div class="text-xs text-text-muted">дней/нед</div>
                    </div>
                    <div class="text-center border-l border-border">
                        <div class="text-xl font-bold text-white">{{ difficulty }}</div>
                        <div class="text-xs text-text-muted">сложность</div>
                    </div>
                    <div class="text-center border-l border-border">
                        <div class="text-xl font-bold text-white">45</div>
                        <div class="text-xs text-text-muted">мин/тр</div>
                    </div>
                </div>

                <div class="space-y-3 mb-6">
                    <div class="flex items-center gap-3 text-sm">
                        <i class="pi pi-check text-green-400"></i>
                        <span class="text-text-secondary">Фокус на {{ focusText }}</span>
                    </div>
                    <div class="flex items-center gap-3 text-sm">
                        <i class="pi pi-check text-green-400"></i>
                        <span class="text-text-secondary">Прогрессивная нагрузка</span>
                    </div>
                </div>
                
                <div class="p-4 bg-surface rounded-xl text-sm text-text-muted leading-relaxed">
                    Эта программа идеально подходит для старта. Мы начнем с базовых движений и будем постепенно увеличивать интенсивность.
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useOnboardingStore } from '@/stores/onboarding';

const store = useOnboardingStore();

const difficulty = computed(() => {
    switch (store.data.level) {
        case 'beginner': return 'Easy';
        case 'intermediate': return 'Med';
        case 'advanced': return 'Hard';
        default: return 'Med';
    }
});

const focusText = computed(() => {
    if (store.data.goals.includes('muscle_gain')) return 'гипертрофию';
    if (store.data.goals.includes('fat_loss')) return 'сжигание жира';
    if (store.data.goals.includes('strength')) return 'силу';
    return 'общее развитие';
});
</script>
