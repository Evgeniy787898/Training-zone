<template>
  <nav
    :class="['app-nav', `app-nav--${variant}`, { 'app-nav--loading': isLoading }]"
    aria-label="Основная навигация"
    role="navigation"
  >
    <div class="nav-buttons">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="[
          'nav-tab',
          { 'active': activeTab === tab.id }
        ]"
        @click="handleTabClick(tab.id)"
        @mouseenter="handlePrefetch(tab.id)"
        @focus="handlePrefetch(tab.id)"
        @touchstart.passive="handlePrefetch(tab.id)"
        :aria-current="activeTab === tab.id ? 'page' : undefined"
        :aria-label="tab.label"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.id"
        tabindex="0"
      >
        <AppIcon
          class="nav-icon"
          :name="tab.icon"
          :variant="activeTab === tab.id ? 'accent' : 'neutral'"
          tone="ghost"
          :size="32"
          aria-hidden="true"
        />
        <span class="nav-label">
          {{ tab.label }}
        </span>
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { prefetchRouteBySlug, type AppRouteSlug } from '@/router';
import { prefetchPredictedRoute } from '@/features/core/prefetchResources';
import { useProgressState } from '@/services/progressTracker';
import { hapticSelection } from '@/utils/hapticFeedback';
import AppIcon from './AppIcon.vue';
import type { IconName } from '../icons/registry';

const { isActive: isLoading } = useProgressState();

const emit = defineEmits<{
  'tab-change': [tabId: string];
}>();

defineProps<{
  activeTab: string;
  variant?: 'bottom' | 'top';
}>();

type TabDefinition = {
  id: 'today' | 'exercises' | 'evolution' | 'history' | 'settings';
  label: string;
  route: AppRouteSlug;
  icon: IconName;
};

const tabs: readonly TabDefinition[] = [
  {
    id: 'today',
    label: 'Сегодня',
    route: 'today',
    icon: 'calendar'
  },
  {
    id: 'exercises',
    label: 'Программы',
    route: 'exercises',
    icon: 'stack'
  },
  {
    id: 'evolution',
    label: 'Эволюция',
    route: 'evolution',
    icon: 'chart'
  },
  {
    id: 'history',
    label: 'История',
    route: 'history',
    icon: 'clock'
  },
  {
    id: 'settings',
    label: 'Настройки',
    route: 'settings',
    icon: 'settings'
  },
] as const;

type TabId = TabDefinition['id'];

const tabRouteMap: Record<TabId, AppRouteSlug> = {
  today: 'today',
  exercises: 'exercises',
  evolution: 'evolution',
  history: 'history',
  settings: 'settings',
};

const handleTabClick = (tabId: string) => {
  hapticSelection();
  emit('tab-change', tabId);
};

const handlePrefetch = (tabId: TabId) => {
  const slug = tabRouteMap[tabId];
  if (slug) {
    void prefetchRouteBySlug(slug);
    prefetchPredictedRoute(slug);
  }
};
</script>

<style scoped>
.app-nav {
  width: 100%;
  max-width: var(--max-width-content);
  margin: 0 auto;
  box-sizing: border-box;
  background: var(--color-bg-nav);
  border-top: 2px solid var(--color-border);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  z-index: 100;
  position: relative;
  backdrop-filter: blur(20px);
}

/* Loading state - subtle pulsing border */
.app-nav--loading {
  border-top-color: transparent;
}

.app-nav--loading::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(
    90deg,
    var(--color-accent-light),
    var(--color-accent),
    var(--color-accent-light)
  );
  background-size: 200% 100%;
  animation: nav-loading-pulse 2s ease-in-out infinite;
}

@keyframes nav-loading-pulse {
  0%, 100% {
    background-position: 0% 50%;
    opacity: 0.6;
  }
  50% {
    background-position: 100% 50%;
    opacity: 1;
  }
}

.app-nav--bottom {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  box-shadow: var(--shadow-lg);
}

.nav-buttons {
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: var(--nav-bar-height);
  padding: 8px 16px;
  gap: 8px;
}

.nav-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: transparent;
  border: none;
  padding: 8px 12px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 16px;
  position: relative;
  overflow: hidden; /* For ripple or fill effects */
}

.nav-tab:hover {
  color: var(--color-text-primary);
  background: var(--color-surface-hover);
}

.nav-tab:active {
  transform: scale(0.95);
}

/* Active State - Pill Background */
.nav-tab.active {
  color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 12%, transparent);
}

/* Icon styling */
.nav-icon {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); /* Bouncy transition */
}

.nav-tab.active .nav-icon {
  transform: translateY(-2px) scale(1.1);
  filter: drop-shadow(0 4px 8px color-mix(in srgb, var(--color-accent) 40%, transparent));
}

.nav-tab.active .nav-icon :deep(svg) {
  /* Ensure SVG inherits or uses specific fills if needed, 
     but AppIcon handles variant='accent' usually via color prop */
}

/* Label styling */
.nav-label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
  transition: all 0.3s ease;
}

.nav-tab.active .nav-label {
  font-weight: 600;
  color: var(--color-accent);
  transform: translateY(-1px);
}

/* Desktop/Tablet adjustments */
@media (min-width: 768px) {
  .app-nav {
    border-radius: 24px;
    margin-bottom: var(--space-md);
    border: 1px solid var(--color-border);
  }
  
  .app-nav--bottom {
    position: sticky;
    bottom: var(--space-md);
  }
}
</style>
