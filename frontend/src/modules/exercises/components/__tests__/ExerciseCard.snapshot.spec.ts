import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ExerciseCard from '../ExerciseCard.vue';
import type { ExerciseCatalogItem, ExerciseHistoryItem } from '@/types';

const baseExercise: ExerciseCatalogItem = {
    key: 'planche-basics',
    title: 'Планка и баланс',
    focus: 'Кор',
    description: 'Статическая нагрузка для кора и плечевого пояса.',
    cue: 'Держи поясницу ровной и смотри вперёд.',
    tags: ['баланс', 'кор'],
    media: {
        image: 'https://cdn.tzona.app/exercises/planche.jpg',
    },
    levels: [
        { id: 'lvl-1', exerciseKey: 'planche-basics', level: '1', title: 'Уровень 1', sets: 3, reps: 12 },
        { id: 'lvl-2', exerciseKey: 'planche-basics', level: '2', title: 'Уровень 2', sets: 4, reps: 10 },
    ],
    latest_progress: {
        level: '2',
        session_date: '2024-12-12',
    },
};

const historyItems: ExerciseHistoryItem[] = [
    {
        id: 'hist-1',
        sessionId: 'sess-1',
        exerciseKey: 'planche-basics',
        levelResult: '2',
        rpe: 7,
        decision: 'advance',
        session: { date: '2024-12-01' },
    },
    {
        id: 'hist-2',
        sessionId: 'sess-2',
        exerciseKey: 'planche-basics',
        levelResult: '1',
        rpe: 6,
        decision: 'hold',
        session: { date: '2024-11-28' },
    },
];

const mountCard = (props: InstanceType<typeof ExerciseCard>['$props']) =>
    mount(ExerciseCard, {
        props,
        global: {
            stubs: {
                NeonIcon: {
                    template: '<span class="neon-icon-stub"><slot /></span>',
                },
            },
        },
    });

describe('ExerciseCard snapshots', () => {
    it('renders a collapsed card with metadata', () => {
        const wrapper = mountCard({ exercise: baseExercise, expanded: false });
        expect(wrapper.html()).toMatchSnapshot();
    });

    it('renders expanded card with history and levels', () => {
        const wrapper = mountCard({ exercise: baseExercise, expanded: true, history: historyItems, loadingHistory: false });
        expect(wrapper.html()).toMatchSnapshot();
    });
});
