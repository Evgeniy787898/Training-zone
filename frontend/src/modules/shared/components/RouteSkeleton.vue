<template>
  <!-- Minimal loading placeholder - just dark background, pages have their own skeletons -->
  <div class="route-loading" aria-hidden="true"></div>
</template>

<style scoped>
.route-loading {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--color-bg, #050505);
}
</style>
