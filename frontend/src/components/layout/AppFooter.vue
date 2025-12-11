<template>
  <footer ref="footerRef" class="app-footer">
    <Navigation
      :active-tab="activeTab"
      @tab-change="$emit('tabChange', $event)"
      variant="bottom"
    />
  </footer>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { createLazyComponent } from '@/utils/lazyComponent';

const Navigation = createLazyComponent(() => import('@/modules/shared/components/Navigation.vue'));

defineProps<{
  activeTab: string;
}>();

defineEmits<{
  (e: 'tabChange', tabId: string): void;
}>();

const footerRef = ref<HTMLElement | null>(null);

// Expose ref for parent to use in useHeroPanel
defineExpose({
  footerRef,
});
</script>

<style scoped>
.app-footer {
  /* Styling inherited or specific to footer */
  /* In App.vue it was handled by .app-container--grid logic mostly, 
     but check if any specific styles were attached to .app-footer directly in App.vue 
     besides grid positioning which stays in parent. 
     The original App.vue bad specific styles for footer? 
     Let's copy any relevant styles. */
}
</style>
