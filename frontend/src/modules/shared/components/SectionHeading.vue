<template>
  <header
    class="section-heading"
    :class="{ 'section-heading--compact': compact }"
    data-animate="fade-up"
  >
    <div class="section-heading__labels">
      <p v-if="eyebrow" class="section-heading__eyebrow">{{ eyebrow }}</p>
      <h1 v-if="as === 'h1'" class="section-heading__title">
        <slot name="icon" />
        {{ title }}
      </h1>
      <h2 v-else class="section-heading__title">
        <slot name="icon" />
        {{ title }}
      </h2>
      <p v-if="description" class="section-heading__description">
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.actions" class="section-heading__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
interface Props {
  title: string;
  description?: string;
  eyebrow?: string;
  compact?: boolean;
  as?: 'h1' | 'h2';
}

withDefaults(defineProps<Props>(), {
  compact: false,
  as: 'h2'
});
</script>
