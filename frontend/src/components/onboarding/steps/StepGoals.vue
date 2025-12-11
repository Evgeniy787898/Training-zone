<template>
    <div class="w-full">
        <h2 class="text-2xl font-bold mb-2">Какая у вас цель?</h2>
        <p class="text-text-muted mb-8">Выберите одну или несколько целей, чтобы мы построили программу.</p>

        <div class="space-y-3">
            <button
                v-for="goal in goals"
                :key="goal.id"
                @click="toggleGoal(goal.id)"
                class="w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between group"
                :class="isSelected(goal.id) 
                    ? 'bg-accent/10 border-accent shadow-sm shadow-accent/10' 
                    : 'bg-surface-elevated border-border hover:border-border-strong'"
            >
                <div class="flex items-center gap-4">
                    <span class="text-2xl">{{ goal.emoji }}</span>
                    <div>
                        <div class="font-medium text-lg text-white group-hover:text-accent-hover transition-colors">
                            {{ goal.title }}
                        </div>
                        <div class="text-sm text-text-muted">
                            {{ goal.description }}
                        </div>
                    </div>
                </div>
                
                <div 
                    class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
                    :class="isSelected(goal.id) ? 'bg-accent border-accent' : 'border-border-strong'"
                >
                    <i v-if="isSelected(goal.id)" class="pi pi-check text-xs text-white pb-[1px]"></i>
                </div>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useOnboardingStore } from '@/stores/onboarding';

const store = useOnboardingStore();

const goals = [
    { id: 'muscle_gain', title: 'Набрать мышечную массу', description: 'Гипертрофия и сила', emoji: '💪' },
    { id: 'fat_loss', title: 'Сбросить лишний вес', description: 'Жиросжигание и рельеф', emoji: '🔥' },
    { id: 'strength', title: 'Увеличить силу', description: 'Пауэрлифтинг и база', emoji: '🏋️‍♂️' },
    { id: 'endurance', title: 'Развить выносливость', description: 'Кардио и функционал', emoji: '🏃‍♂️' },
    { id: 'health', title: 'Поддержать здоровье', description: 'Общий тонус и активность', emoji: '🧘‍♂️' }
];

const isSelected = (id: string) => store.data.goals.includes(id);

const toggleGoal = (id: string) => {
    const current = [...store.data.goals];
    if (current.includes(id)) {
        store.updateData('goals', current.filter(g => g !== id));
    } else {
        // Single selection for simplicity in MVP, but array supported
        // For MVP let's allow multiple to match store schema
        store.updateData('goals', [...current, id]);
    }
};
</script>
