import { computed, ref } from 'vue';

const activeRequests = ref(0);
const visible = ref(false);
const lastStartedAt = ref<number | null>(null);
const MIN_VISIBLE_MS = 400;
const SHOW_DELAY_MS = 180;

function scheduleShow() {
    setTimeout(() => {
        if (activeRequests.value > 0) {
            visible.value = true;
        }
    }, SHOW_DELAY_MS);
}

export function beginProgress(): () => void {
    activeRequests.value += 1;
    lastStartedAt.value = Date.now();
    if (!visible.value) {
        scheduleShow();
    }

    let finished = false;
    const finish = () => {
        if (finished) return;
        finished = true;
        const elapsed = lastStartedAt.value ? Date.now() - lastStartedAt.value : 0;
        const hide = () => {
            activeRequests.value = Math.max(0, activeRequests.value - 1);
            if (activeRequests.value === 0) {
                visible.value = false;
                lastStartedAt.value = null;
            }
        };
        if (elapsed < MIN_VISIBLE_MS) {
            setTimeout(hide, MIN_VISIBLE_MS - elapsed);
        } else {
            hide();
        }
    };

    return finish;
}

export function useProgressState() {
    const isActive = computed(() => visible.value && activeRequests.value > 0);
    return { isActive };
}
