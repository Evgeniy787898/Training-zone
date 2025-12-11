import { ref, type ComponentPublicInstance, type Ref } from 'vue';
import { STAGE_NAV, STAGE_ORDER } from '@/constants/today';
import type { StageId } from '@/types/today';
import { hapticSelection } from '@/utils/hapticFeedback';

export function useStageNavigation(
    activeStage: Ref<StageId>,
    timerFocusMode: Ref<boolean>,
    isStageLocked: (stageId: StageId) => boolean = () => false
) {
    const stageButtonRefs = ref<Array<HTMLButtonElement | null>>([]);

    const setStageButtonRef = (el: Element | ComponentPublicInstance | null) => {
        if (!el) return;
        const button = el as HTMLButtonElement;
        if (!button) return;
        const stageId = button.dataset.stageId as StageId | undefined;
        if (!stageId) return;
        const index = STAGE_ORDER.indexOf(stageId);
        if (index >= 0) {
            stageButtonRefs.value[index] = button;
        }
    };

    const findNextEnabledStageIndex = (startIndex: number, direction: 1 | -1) => {
        const length = STAGE_ORDER.length;
        for (let i = 1; i <= length; i += 1) {
            const candidate = (startIndex + direction * i + length) % length;
            if (!isStageLocked(STAGE_ORDER[candidate])) {
                return candidate;
            }
        }
        return startIndex;
    };

    const focusStageButton = (index: number) => {
        const target = stageButtonRefs.value[index];
        if (target) {
            target.focus();
        }
    };

    const setStage = (stageId: StageId) => {
        if (isStageLocked(stageId)) {
            return;
        }
        hapticSelection();
        activeStage.value = stageId;
        if (stageId !== 'timer' && timerFocusMode.value) {
            timerFocusMode.value = false;
        }
    };

    const handleStageKeydown = (event: KeyboardEvent, stageId: StageId) => {
        const currentIndex = STAGE_ORDER.indexOf(stageId);
        if (currentIndex === -1) return;

        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            const nextIndex = findNextEnabledStageIndex(currentIndex, 1);
            const nextStage = STAGE_ORDER[nextIndex];
            setStage(nextStage);
            focusStageButton(nextIndex);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            const prevIndex = findNextEnabledStageIndex(currentIndex, -1);
            const prevStage = STAGE_ORDER[prevIndex];
            setStage(prevStage);
            focusStageButton(prevIndex);
        } else if (event.key === 'Home') {
            event.preventDefault();
            const firstIndex = findNextEnabledStageIndex(-1, 1);
            const firstStage = STAGE_ORDER[firstIndex];
            setStage(firstStage);
            focusStageButton(firstIndex);
        } else if (event.key === 'End') {
            event.preventDefault();
            const lastIndex = findNextEnabledStageIndex(0, -1);
            const lastStage = STAGE_ORDER[lastIndex];
            setStage(lastStage);
            focusStageButton(lastIndex);
        }
    };

    return {
        stageNav: STAGE_NAV,
        stageOrder: STAGE_ORDER,
        setStageButtonRef,
        handleStageKeydown,
        setStage,
    };
}
