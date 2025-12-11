<template>
    <div class="w-full">
        <h2 class="text-2xl font-bold mb-2">Ваш уровень подготовки</h2>
        <p class="text-text-muted mb-8">Это поможет подобрать оптимальную нагрузку.</p>

        <div class="space-y-4">
            <button
                v-for="lvl in levels"
                :key="lvl.id"
                @click="selectLevel(lvl.id)"
                class="w-full text-left p-5 rounded-xl border transition-all duration-200 relative overflow-hidden group"
                :class="store.data.level === lvl.id
                    ? 'bg-accent/10 border-accent shadow-sm shadow-accent/10' 
                    : 'bg-surface-elevated border-border hover:border-border-strong'"
            >
                <div class="relative z-10">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-lg text-white">{{ lvl.title }}</span>
                        <span v-if="store.data.level === lvl.id" class="text-accent">
                            <i class="pi pi-check-circle"></i>
                        </span>
                    </div>
                    <p class="text-sm text-text-muted mb-3">{{ lvl.description }}</p>
                    
                    <!-- Level Indicators -->
                    <div class="flex gap-1">
                        <div 
                            v-for="i in 3" 
                            :key="i"
                            class="h-1.5 w-8 rounded-full transition-colors"
                            :class="i <= lvl.value ? (store.data.level === lvl.id ? 'bg-accent' : 'bg-surface-strong') : 'bg-surface'"
                        ></div>
                    </div>
                </div>
            </button>
        </div>
        
        <div class="mt-8">
            <h3 class="font-medium text-white mb-4">Сколько дней в неделю готовы тренироваться?</h3>
            <div class="flex justify-between gap-2 p-1 bg-surface-elevated rounded-xl border border-border">
                <button
                    v-for="days in [2, 3, 4, 5, 6]"
                    :key="days"
                    @click="store.updateData('daysPerWeek', days)"
                    class="flex-1 py-3 rounded-lg text-sm font-medium transition-all"
                    :class="store.data.daysPerWeek === days ? 'bg-accent text-white shadow-md' : 'text-text-muted hover:text-white'"
                >
                    {{ days }}
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useOnboardingStore } from '@/stores/onboarding';

const store = useOnboardingStore();

type LevelId = 'beginner' | 'intermediate' | 'advanced';

const levels: Array<{ id: LevelId; title: string; description: string; value: number }> = [
    { 
        id: 'beginner', 
        title: 'Новичок', 
        description: 'Никогда не тренировался или был долгий перерыв',
        value: 1
    },
    { 
        id: 'intermediate', 
        title: 'Любитель', 
        description: 'Тренируюсь регулярно более 6 месяцев',
        value: 2 
    },
    { 
        id: 'advanced', 
        title: 'Продвинутый', 
        description: 'Опытный атлет, тренируюсь годами',
        value: 3
    }
];

const selectLevel = (id: LevelId) => {
    store.updateData('level', id);
};
</script>
