import type { StageId } from '@/types/today';

export const CARD_IMAGE_SIZES = '(max-width: 768px) 85vw, min(420px, 40vw)';

export const STAGE_NAV: { id: StageId; label: string }[] = [
    { id: 'workout', label: 'Тренировка' },
    { id: 'timer', label: 'Табата-таймер' },
    { id: 'results', label: 'Итоги' },
];

export const STAGE_ORDER: StageId[] = STAGE_NAV.map((item) => item.id);
