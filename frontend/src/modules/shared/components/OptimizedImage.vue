<template>
<figure
  ref="containerRef"
  class="optimized-image"
  :class="{
    'optimized-image--loaded': isLoaded,
    'optimized-image--error': hasError,
  }"
>
    <img
      v-bind="imgAttrs"
      :class="['optimized-image__img', imgClass]"
    :src="shouldLoad ? resolvedSrc : undefined"
    :srcset="shouldLoad ? srcset || undefined : undefined"
    :sizes="shouldLoad ? sizes || undefined : undefined"
      :alt="alt"
      :loading="loading"
      :decoding="decoding"
      :fetchpriority="fetchpriority"
      @load="handleLoad"
      @error="handleError"
    />
    <div v-if="!isLoaded" class="optimized-image__placeholder" aria-hidden="true"></div>
  </figure>
</template>

<script setup lang="ts">
import { computed, ref, useAttrs, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';

const FALLBACK_DATA_URL =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="4" y="4" width="56" height="56" rx="8" fill="%23f1f5f9"/><path d="M18 38l10-10 8 8 10-12 10 14v6H8v-6l10-10z" fill="%23cbd5e1"/><circle cx="24" cy="24" r="6" fill="%239ca3af"/></svg>';

const props = withDefaults(
  defineProps<{
    src: string;
    srcset?: string | null;
    sizes?: string | null;
    alt?: string;
    loading?: 'eager' | 'lazy';
    decoding?: 'sync' | 'async' | 'auto';
    fetchpriority?: 'high' | 'low' | 'auto';
    fallbackSrc?: string;
    lazy?: boolean;
    rootMargin?: string;
  }>(),
  {
    alt: '',
    loading: 'lazy',
    decoding: 'async',
    fetchpriority: 'auto',
    fallbackSrc: FALLBACK_DATA_URL,
    lazy: true,
    rootMargin: '150px',
  },
);

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
const emit = defineEmits<{
  (e: 'load', event: Event): void;
  (e: 'error', event: Event): void;
}>();

const isLoaded = ref(false);
const hasError = ref(false);
const containerRef = ref<HTMLElement | null>(null);

const resolvedSrc = computed(() => (hasError.value ? props.fallbackSrc : props.src));

const shouldLoad = ref(props.loading === 'eager' || !props.lazy);

const imgAttrs = computed(() => {
  const { class: attrClass, ...rest } = attrs;
  return rest;
});

const imgClass = computed(() => attrs.class);

const handleLoad = (event: Event) => {
  isLoaded.value = true;
  hasError.value = false;
  emit('load', event);
};

const handleError = (event: Event) => {
  hasError.value = true;
  emit('error', event);
};

const observer = ref<IntersectionObserver | null>(null);

const startObserving = (el: HTMLElement | null) => {
  if (!el || shouldLoad.value || !props.lazy) return;

  if ('IntersectionObserver' in window) {
    observer.value = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            shouldLoad.value = true;
            observer.value?.disconnect();
          }
        });
      },
      { rootMargin: props.rootMargin },
    );

    observer.value.observe(el);
  } else {
    shouldLoad.value = true;
  }
};

const stopObserving = () => {
  observer.value?.disconnect();
  observer.value = null;
};

watch(
  () => props.src,
  () => {
    isLoaded.value = false;
    hasError.value = false;
    if (props.loading === 'eager' || !props.lazy) {
      shouldLoad.value = true;
      stopObserving();
    } else {
      shouldLoad.value = false;
      nextTick(() => startObserving(containerRef.value));
    }
  },
);

onMounted(() => {
  startObserving(containerRef.value);
});

onBeforeUnmount(() => {
  stopObserving();
});
</script>

<style scoped>
.optimized-image {
  position: relative;
  display: block;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(226, 232, 240, 0.9), rgba(203, 213, 225, 0.9));
  border-radius: 12px;
}

.optimized-image__img {
  display: block;
  width: 100%;
  height: auto;
  transition: opacity 0.3s ease;
  opacity: 0;
}

.optimized-image--loaded .optimized-image__img {
  opacity: 1;
}

.optimized-image__placeholder {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(226, 232, 240, 0.7), rgba(248, 250, 252, 0.8), rgba(226, 232, 240, 0.7));
  animation: optimized-image-shimmer 1.2s infinite;
}

.optimized-image--loaded .optimized-image__placeholder,
.optimized-image--error .optimized-image__placeholder {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.optimized-image--error .optimized-image__img {
  opacity: 0.8;
  filter: grayscale(0.4);
}

@keyframes optimized-image-shimmer {
  0% {
    background-position: -100% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
</style>
