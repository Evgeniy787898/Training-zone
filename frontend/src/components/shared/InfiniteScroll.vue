<template>
  <!-- COMP-07: Infinite scroll component using IntersectionObserver -->
  <div class="infinite-scroll" ref="containerRef">
    <!-- Content slot -->
    <slot />

    <!-- Loading indicator -->
    <div 
      v-if="loading" 
      class="infinite-scroll-loading"
    >
      <slot name="loading">
        <div class="loading-spinner" />
        <span class="loading-text">{{ loadingText }}</span>
      </slot>
    </div>

    <!-- End of list message -->
    <div 
      v-else-if="endReached && showEndMessage" 
      class="infinite-scroll-end"
    >
      <slot name="end">
        <span class="end-text">{{ endText }}</span>
      </slot>
    </div>

    <!-- Sentinel element for intersection detection -->
    <div 
      ref="sentinelRef"
      class="infinite-scroll-sentinel"
      :style="{ height: sentinelHeight + 'px' }"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';

interface Props {
  loading?: boolean;
  endReached?: boolean;
  threshold?: number; // 0-1, how much of sentinel should be visible
  rootMargin?: string; // CSS margin for earlier triggering
  loadingText?: string;
  endText?: string;
  showEndMessage?: boolean;
  sentinelHeight?: number;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  endReached: false,
  threshold: 0.1,
  rootMargin: '100px',
  loadingText: 'Загрузка...',
  endText: 'Вы просмотрели всё',
  showEndMessage: true,
  sentinelHeight: 1,
  disabled: false,
});

const emit = defineEmits<{
  (e: 'load-more'): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const sentinelRef = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

function handleIntersection(entries: IntersectionObserverEntry[]) {
  const [entry] = entries;
  
  if (
    entry.isIntersecting && 
    !props.loading && 
    !props.endReached && 
    !props.disabled
  ) {
    emit('load-more');
  }
}

function setupObserver() {
  if (!sentinelRef.value || observer) return;
  
  observer = new IntersectionObserver(handleIntersection, {
    root: null, // viewport
    rootMargin: props.rootMargin,
    threshold: props.threshold,
  });
  
  observer.observe(sentinelRef.value);
}

function teardownObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

// Recreate observer when options change
watch(
  () => [props.rootMargin, props.threshold],
  () => {
    teardownObserver();
    setupObserver();
  }
);

// Pause/resume based on disabled prop
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) {
      teardownObserver();
    } else {
      setupObserver();
    }
  }
);

onMounted(() => {
  setupObserver();
});

onUnmounted(() => {
  teardownObserver();
});

// Expose methods
defineExpose({
  reset: () => {
    teardownObserver();
    setupObserver();
  },
});
</script>

<style scoped>
.infinite-scroll {
  position: relative;
}

.infinite-scroll-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
  gap: var(--space-sm);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.infinite-scroll-end {
  display: flex;
  justify-content: center;
  padding: var(--space-lg);
}

.end-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  font-style: italic;
}

.infinite-scroll-sentinel {
  width: 100%;
  pointer-events: none;
}
</style>
