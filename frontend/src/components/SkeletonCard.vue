<template>
  <div class="skeleton-card">
    <div v-if="avatar" class="skeleton-card-header">
      <SkeletonLoader :width="avatarSize" :height="avatarSize" circle :animated="animated" />
      <div class="skeleton-card-header-content">
        <SkeletonLoader width="60%" height="1rem" :animated="animated" />
        <SkeletonLoader width="40%" height="0.75rem" :animated="animated" />
      </div>
    </div>
    <div v-else class="skeleton-card-title">
      <SkeletonLoader width="50%" height="1.25rem" :animated="animated" />
    </div>
    <div class="skeleton-card-body">
      <SkeletonText :lines="contentLines" :animated="animated" />
    </div>
  </div>
</template>

<script setup lang="ts">
import SkeletonLoader from './SkeletonLoader.vue';
import SkeletonText from './SkeletonText.vue';

interface Props {
  avatar?: boolean;
  avatarSize?: number;
  contentLines?: number;
  animated?: boolean;
}

withDefaults(defineProps<Props>(), {
  avatar: false,
  avatarSize: 40,
  contentLines: 3,
  animated: true,
});
</script>

<style scoped>
.skeleton-card {
  padding: var(--space-lg);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.skeleton-card-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.skeleton-card-header-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.skeleton-card-title {
  margin-bottom: var(--space-lg);
}

.skeleton-card-body {
  /* Body content */
}
</style>
