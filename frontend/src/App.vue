<template>
  <div ref="appRootRef" class="app">

    <!-- Loading indicator moved to Navigation bar top border -->
    <PinScreen v-if="!pinVerified" @success="handlePinSuccess" />
    <div v-else :class="['app-container', { 'app-container--grid': isGridLayoutActive }]">
      <header 
        ref="headerRef"
        class="app-header"
        :style="headerStyle"
      >


        <div class="header-content">
          <div class="header-logo-group">
            <button
              ref="logoButtonRef"
              type="button"
              class="header-logo"
              aria-label="Train Zone: настройка акцентных цветов"
              title="Настройки темы"
              :aria-expanded="showThemeCustomizer ? 'true' : 'false'"
              aria-controls="theme-customizer"
              @click="toggleThemeCustomizer"
            >
              <span class="header-logo__brand" aria-hidden="true">
                <span class="header-logo__img"></span>
              </span>
            </button>
          </div>

          <div class="header-actions">
            <button
              type="button"
              class="header-action-btn header-action-btn--status"
              :class="{ 
                'header-action-btn--active': heroStatus === 'training',
                'header-action-btn--rest': heroStatus === 'rest'
              }"
              @click="handleAdviceClick"
              :aria-pressed="heroStatus === 'training' ? 'true' : 'false'"
              aria-label="Открыть совет на день"
              :title="heroStatus === 'training' ? 'День тренировки' : 'День отдыха'"
            >
              <span class="header-action-btn__date">
                <span class="header-action-btn__day">{{ currentDay }}</span>
                <span class="header-action-btn__month">{{ currentMonth }}</span>
              </span>
              <span class="header-action-btn__hover-text">
                {{ heroStatus === 'training' ? 'GO' : 'ZZZ' }}
              </span>
            </button>

          </div>
        </div>

        <!-- Theme Customizer (Full Width) -->
        <div
          v-if="showThemeCustomizer"
          ref="customizerRef"
          id="theme-customizer"
          class="header-customizer-container"
        >
          <ThemeCustomizerPopover @close="closeThemeCustomizer" />
        </div>

        <!-- Pull Indicator -->
        <div 
          ref="headerPullIndicatorRef"
          class="header-pull-indicator"
          :class="{ 'header-pull-indicator--active': isDragging }"
          @mousedown="handleDragStart"
          @touchstart="handleDragStart"
          @click="toggleHero"
          role="button"
          :aria-expanded="heroExpanded"
          aria-label="Потяните чтобы раскрыть панель"
        >
          <div class="header-pull-indicator__bar"></div>
        </div>
      </header>

      <!-- Content panel - simplified to be always visible/sticky if needed, or just part of flow -->
      <div 
        class="header-content-panel" 
        :class="{ 'header-content-panel--expanded': heroExpanded }"
        :style="contentPanelStyle"
      >
        <TrainingProgramPanel
          ref="trainingPanelRef"
          :discipline-name="selectedDiscipline?.name"
          :discipline-image="selectedDiscipline?.imageUrl"
          :program-name="selectedProgram?.name"
          :exercises="selectedExercises"
          :current-levels="currentLevels"
          @program-selected="handleProgramSelected"
        />
      </div>

      <main 
        id="main-content" 
        class="app-main"
        :class="{ 'app-main--locked': heroExpanded }"
      >

        <ErrorBoundary :boundary-key="routeBoundaryKey" ref="routeErrorBoundary">
          <router-view v-slot="{ Component }">
            <Suspense>
              <template #default>
                <transition name="fade-slide" mode="out-in">
                  <component :is="Component" />
                </transition>
              </template>
              <template #fallback>
                <RouteSkeleton />
              </template>
            </Suspense>
          </router-view>
          <template #fallback="{ reset: boundaryReset }">
            <div class="route-error" role="alert">
              <p class="route-error__title">Не удалось загрузить экран</p>
              <p class="route-error__hint">Попробуйте ещё раз — мы уже зафиксировали проблему.</p>
              <div class="route-error__actions">
                <button type="button" class="route-error__btn" @click="handleRouteRetry(boundaryReset)">
                  Перезагрузить экран
                </button>
              </div>
            </div>
          </template>
        </ErrorBoundary>
      </main>

      <footer ref="footerRef" class="app-footer">
        <Navigation
          :active-tab="activeTab"
          @tab-change="handleTabChange"
          variant="bottom"
        />
      </footer>
    </div>

    <div class="toast-container" role="region" aria-live="polite">
      <Toast />
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import { cachedApiClient } from '@/services/cachedApi';
import { useInteractiveSurfaces } from '@/composables/useInteractiveSurfaces';
import { useHeroPanel } from '@/composables/useHeroPanel';
import { createLazyComponent } from '@/utils/lazyComponent';
import { startCriticalPrefetch } from '@/features/core/prefetchResources';
import { useKeyboardShortcuts } from '@/features/core/keyboardShortcuts';
import ErrorBoundary from '@/modules/shared/components/ErrorBoundary.vue';

import type { AppRouteSlug } from '@/router';

const PinScreen = createLazyComponent(() => import('@/modules/profile/components/PinScreen.vue'), { delay: 0 });
const Navigation = createLazyComponent(() => import('@/modules/shared/components/Navigation.vue'));
const Toast = createLazyComponent(() => import('@/modules/shared/components/Toast.vue'));
const TrainingProgramPanel = createLazyComponent(() => import('@/modules/training/components/TrainingProgramPanel.vue'));
const RouteSkeleton = createLazyComponent(() => import('@/modules/shared/components/RouteSkeleton.vue'));
const ThemeCustomizerPopover = createLazyComponent(() => import('@/modules/shared/components/ThemeCustomizerPopover.vue'));

const router = useRouter();
const route = useRoute();
const appStore = useAppStore();
const {
  programDiscipline,
  programDefinition,
  programExercises,
  programCurrentLevels,
} = storeToRefs(appStore);

const appRootRef = ref<HTMLElement | null>(null);
const pinVerified = ref(false);
const heroExpanded = ref(false);
const isGridLayoutActive = ref(false);
const showThemeCustomizer = ref(false);
const logoButtonRef = ref<HTMLButtonElement | null>(null);
const customizerRef = ref<HTMLElement | null>(null);
type TrainingProgramPanelExpose = {
  focusProgress: () => void;
};
const trainingPanelRef = ref<TrainingProgramPanelExpose | null>(null);
const selectedDiscipline = programDiscipline;
const selectedProgram = programDefinition;
const selectedExercises = programExercises;
const currentLevels = programCurrentLevels;

const routeResetNonce = ref(0);
const routeBoundaryKey = computed(() => `${router.currentRoute.value.fullPath}|${routeResetNonce.value}`);
const routeErrorBoundary = ref<{ reset: () => void } | null>(null);



const closeThemeCustomizer = () => {
  showThemeCustomizer.value = false;
};

const toggleThemeCustomizer = () => {
  if (!showThemeCustomizer.value && heroExpanded.value) {
    heroExpanded.value = false;
  }
  showThemeCustomizer.value = !showThemeCustomizer.value;
};

const handleDocumentClick = (event: MouseEvent) => {
  if (!showThemeCustomizer.value) return;
  const target = event.target as Node | null;
  if (!target) return;
  if (
    customizerRef.value &&
    customizerRef.value.contains(target)
  ) {
    return;
  }
  if (logoButtonRef.value && logoButtonRef.value.contains(target)) {
    return;
  }
  closeThemeCustomizer();
};

const handleEscapeKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeThemeCustomizer();
  }
};

const pathBySlug: Record<AppRouteSlug, string> = {
  today: '/today',
  exercises: '/exercises',
  programs: '/programs',
  settings: '/settings',
  progress: '/progress',
  report: '/report',
  library: '/library',
  week: '/week',
};

const navigateToSlug = (slug: AppRouteSlug) => {
  if (!pinVerified.value) return;
  const path = pathBySlug[slug];
  if (!path) return;
  void router.push(path);
};


// Current date for header button
const currentDate = new Date();
const currentDay = computed(() => currentDate.getDate().toString());
const currentMonth = computed(() => {
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return months[currentDate.getMonth()];
});

// Header refs for Hero Panel
const headerRef = ref<HTMLElement | null>(null);
const footerRef = ref<HTMLElement | null>(null);
const headerPullIndicatorRef = ref<HTMLElement | null>(null);

useInteractiveSurfaces(appRootRef, {
  selectors: [
    '.surface-card',
    '.stat-card',
    '.progress-chart__bar',
    '.report-exercise',
    '.week-card',
    '.tabata__dial',
    '.tabata__action',
    '.nav-tab',
  ],
});

// Use Hero Panel composable
const {
  isDragging,
  headerStyle,
  contentPanelStyle,
  handleDragStart,
  toggleHero,
  setupEventListeners,
  cleanupEventListeners,
  scheduleMaxOffsetUpdate,
} = useHeroPanel(
  { headerRef, footerRef, headerPullIndicatorRef },
  { heroExpanded, isGridLayoutActive }
);


// Handle route changes - update offset calculations
watch(
  () => router.currentRoute.value.path,
  () => {
    nextTick(() => {
      scheduleMaxOffsetUpdate();
    });

    routeErrorBoundary.value?.reset();
    routeResetNonce.value += 1;

      // Загружаем данные программы при переходе на страницу программ (только если PIN верифицирован)
      if ((router.currentRoute.value.path === '/exercises' || router.currentRoute.value.path === '/programs') && pinVerified.value) {
        loadUserProgramData();
    }
  },
);

onMounted(() => {
  appStore.initializeTheme();
  // Initial state: require PIN until verified in this runtime session
  pinVerified.value = false;

  document.addEventListener('click', handleDocumentClick, true);
  document.addEventListener('keydown', handleEscapeKey);

  if (typeof window !== 'undefined') {
    gridLayoutMediaQuery = window.matchMedia(GRID_LAYOUT_QUERY);
    applyGridLayoutPreference(gridLayoutMediaQuery.matches);
    gridLayoutMediaQuery.addEventListener('change', handleGridLayoutChange);
  }
  
  // Устанавливаем начальный статус по умолчанию (будет обновлен при загрузке данных)
  // Проверяем текущий маршрут - если это главная страница, устанавливаем 'rest'
  const route = router.currentRoute.value;
  if (route.path === '/' || route.path.includes('/today')) {
    // Статус будет установлен в TodayPage при загрузке данных
    appStore.setHeroStatus('rest');
  }

  setupEventListeners();
});

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick, true);
  document.removeEventListener('keydown', handleEscapeKey);
  gridLayoutMediaQuery?.removeEventListener('change', handleGridLayoutChange);
  
  cleanupEventListeners();
  
  appStore.stopAssistantSessionMonitor();
});

const handlePinSuccess = () => {
  // Mark verified for current session only
  // Animation already handled in PinScreen
  pinVerified.value = true;

  void appStore.refreshAssistantSessionState({ force: true });
  appStore.ensureAssistantSessionMonitor();

  // Загружаем данные программы из БД после успешной верификации PIN
  // Используем кэш для быстрой загрузки
  loadUserProgramData(true);

  startCriticalPrefetch();
};

const activeTab = computed(() => {
  const route = router.currentRoute.value;
  if (route.path.includes('/exercises') && !route.path.includes('/programs')) return 'exercises';
  if (route.path.includes('/programs')) return 'exercises';
  if (route.path.includes('/settings')) return 'settings';
  return 'today';
});

watch(
  () => route.fullPath,
  () => {
    closeThemeCustomizer();
  },
);

// Сбрасываем скролл панели при разворачивании
watch(heroExpanded, (expanded) => {
  if (expanded) {
    nextTick(() => {
      const panel = document.querySelector('.header-content-panel');
      if (panel) {
        panel.scrollTop = 0;
      }
    });
  }
});

const heroStatus = computed(() => appStore.heroStatus);

const handleRouteRetry = (boundaryReset: () => void) => {
  boundaryReset();
  routeResetNonce.value += 1;
};

const GRID_LAYOUT_QUERY = '(min-width: 1200px)';
let gridLayoutMediaQuery: MediaQueryList | null = null;
const handleGridLayoutChange = (event: MediaQueryListEvent) => {
  applyGridLayoutPreference(event.matches);
};

const applyGridLayoutPreference = (matches: boolean) => {
  if (isGridLayoutActive.value === matches) return;
  isGridLayoutActive.value = matches;
  heroExpanded.value = matches;
};

const handleAdviceClick = () => {
  if (appStore.openAdviceModalFn) {
    appStore.openAdviceModalFn();
  }
};

useKeyboardShortcuts([
  {
    combo: 'alt+1',
    description: 'Открыть экран «Сегодня»',
    handler: () => navigateToSlug('today'),
  },
  {
    combo: 'alt+2',
    description: 'Открыть прогресс',
    handler: () => navigateToSlug('progress'),
  },
  {
    combo: 'alt+3',
    description: 'Открыть упражнения',
    handler: () => navigateToSlug('exercises'),
  },
  {
    combo: 'alt+4',
    description: 'Открыть настройки',
    handler: () => navigateToSlug('settings'),
  },
  {
    combo: 'alt+d',
    description: 'Показать совет на день',
    handler: () => handleAdviceClick(),
  },

  {
    combo: 'alt+t',
    description: 'Открыть выбор темы',
    handler: () => {
      if (!pinVerified.value) return;
      toggleThemeCustomizer();
    },
  },
]);

// Загрузка данных программы из БД (используем общее состояние стора)
const loadUserProgramData = async (force = false) => {
  if (!pinVerified.value) {
    return;
  }

  try {
    await appStore.ensureProgramContext({ force, includeLevels: true });
  } catch (err) {
    console.error('Failed to load user program context:', err);
  }
};

const handleProgramSelected = async (programData: any) => {
  try {
    const action = programData.action || 'save';
    
    let successMessage = 'Программа сохранена';
    
    // Выполняем действие в зависимости от типа (используем кэшированный API)
    if (action === 'update') {
      // Обновляем существующую программу
      await cachedApiClient.updateUserProgram({
        disciplineId: programData.discipline.id,
        programId: programData.program.id,
        initialLevels: programData.initialLevels || {},
        currentLevels: programData.initialLevels || {},
      });
      successMessage = 'Программа изменена';
    } else if (action === 'create') {
      // Создаем новую запись
      await cachedApiClient.createUserProgram({
        disciplineId: programData.discipline.id,
        programId: programData.program.id,
        initialLevels: programData.initialLevels || {},
        currentLevels: programData.initialLevels || {},
      });
      successMessage = 'Программа добавлена';
    } else {
      // Сохраняем (создаем или обновляем)
      await cachedApiClient.saveUserProgram({
        disciplineId: programData.discipline.id,
        programId: programData.program.id,
        initialLevels: programData.initialLevels || {},
        currentLevels: programData.initialLevels || {},
      });
      successMessage = 'Программа сохранена';
    }
    
    // Перезагружаем данные программы после сохранения
    await appStore.ensureProgramContext({ force: true, includeLevels: true });
    trainingPanelRef.value?.focusProgress();

    // Показываем уведомление об успешном сохранении
    appStore.showToast({
      title: successMessage,
      message: 'Ваш выбор успешно сохранён в базе данных',
      type: 'success',
    });
  } catch (err: any) {
    console.error('Failed to save user program:', err);
    appStore.showToast({
      title: 'Ошибка сохранения',
      message: err.message || 'Не удалось сохранить программу',
      type: 'error',
    });
  }
};

const handleTabChange = (tabId: string) => {
  heroExpanded.value = false;
  switch (tabId) {
    case 'today':
      router.push('/');
      break;
    case 'exercises':
      router.push('/exercises');
      break;
    case 'settings':
      router.push('/settings');
      break;
  }
};
</script>

<style scoped>

.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--color-bg);
  color: var(--color-text-primary);
  transition: background-color var(--transition-slow), color var(--transition-base);
}

.app-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch; /* Smooth scroll на iOS */
}

.app-container--grid {
  display: grid;
  grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr) auto;
  grid-template-areas:
    'header header'
    'panel main'
    'footer footer';
  gap: clamp(1rem, 3vw, 2.5rem);
  padding: clamp(0.75rem, 2vw, 1.5rem) clamp(1rem, 4vw, 3rem);
  max-width: 1500px;
  margin: 0 auto;
}

.app-container--grid .app-header {
  grid-area: header;
  position: sticky;
  top: 0;
  left: auto;
  right: auto;
  margin: 0;
  border-radius: clamp(18px, 3vw, 28px);
}

.app-container--grid .header-pull-indicator {
  display: none;
}

.app-container--grid .header-content-panel {
  grid-area: panel;
  position: sticky;
  top: calc(var(--header-height) + clamp(0.75rem, 2vw, 1.5rem));
  left: auto;
  right: auto;
  height: auto !important;
  max-height: calc(100vh - var(--header-height) - var(--footer-height) - clamp(3rem, 5vw, 6rem));
  border-radius: clamp(18px, 4vw, 28px);
  padding: clamp(1rem, 2vw, 1.5rem);
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.app-container--grid .header-content-panel--expanded {
  overflow-y: auto;
}

.app-container--grid .app-main {
  grid-area: main;
  padding-top: clamp(1rem, 2vw, 2.25rem);
  padding-bottom: clamp(var(--footer-height), 10vh, var(--footer-height) + 2rem);
}

.app-container--grid .app-footer {
  grid-area: footer;
  position: sticky;
  bottom: 0;
  left: auto;
  right: auto;
  border-radius: clamp(18px, 3vw, 28px);
}

/* Header - Sticky Navigation */
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  height: var(--header-height);
  min-height: var(--header-height);
  max-height: var(--header-height);
  background: var(--panel-surface-base, var(--color-bg-elevated));
  background-image: var(--panel-surface-gradient, var(--gradient-surface));
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  backdrop-filter: saturate(180%) blur(16px);
  /* Оптимизация производительности */
  will-change: transform;
  backface-visibility: hidden;
  transform: translateZ(0);
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    background-color var(--transition-base),
    border-color var(--transition-base);
  touch-action: pan-y;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  cursor: default;
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.header-content-panel--expanded {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.app-header:active {
  cursor: default;
}

.header-content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  height: 100%;
  padding: 0 1.5rem;
  max-width: var(--max-width-content);
  margin: 0 auto;
  width: 100%;
  z-index: 1;
  pointer-events: auto;
  transition: padding var(--transition-base);
}

.header-content * {
  pointer-events: auto;
}

.header-logo-group {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.header-customizer-container {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 90;
}


.header-logo {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  color: #fff;
  cursor: pointer;
  line-height: 1;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.header-logo:hover {
  transform: scale(1.02);
  /* No background or border on the button itself, just the logo content */
}

.header-logo:hover .header-logo__train {
  color: var(--color-accent);
  text-shadow: 0 0 20px var(--color-accent-light);
}

.header-logo:hover .header-logo__zone {
  color: var(--color-accent-contrast);
  text-shadow: 0 0 20px var(--color-accent-light);
}

.header-logo:active {
  transform: scale(0.97);
}

.header-logo:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
}

.header-logo__brand {
  display: flex;
  align-items: center;
}

.header-logo__img {
  display: block;
  width: 140px;
  height: 58px;
  background-color: #fff;
  mask-image: url('/img/logo-train-zone.png');
  -webkit-mask-image: url('/img/logo-train-zone.png');
  mask-size: contain;
  -webkit-mask-size: contain;
  mask-repeat: no-repeat;
  -webkit-mask-repeat: no-repeat;
  mask-position: center left;
  -webkit-mask-position: center left;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.header-logo:hover .header-logo__img {
  background: var(--gradient-accent);
  transform: scale(1.02);
  filter: drop-shadow(0 0 8px var(--color-accent-light));
}

.header-logo__wordmark {
  letter-spacing: 0.14em;
  color: inherit;
}

.header-logo__indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  color: var(--color-accent);
  border-radius: var(--radius-sm);
  transition: color var(--transition-fast), transform var(--transition-fast);
}

.header-logo__icon svg {
  width: 20px;
  height: 20px;
}

  /* Pull-to-reveal indicator */
  .header-pull-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 12px;
  cursor: grab;
  -webkit-tap-highlight-color: transparent;
  touch-action: pan-y;
  user-select: none;
  transition: background-color var(--transition-fast);
  background: transparent;
  pointer-events: auto;
}

.header-pull-indicator:active {
  cursor: grabbing;
}

.header-pull-indicator:hover {
  background-color: var(--color-surface);
}

.header-pull-indicator__bar {
  width: clamp(40px, 8vw, 64px);
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(148, 163, 184, 0.8) 0%, rgba(100, 116, 139, 0.9) 100%);
  transition: all var(--transition-base);
  opacity: 0.95;
  box-shadow: var(--shadow-sm), inset 0 1px 0 var(--overlay-strong);
}

.header-pull-indicator--active .header-pull-indicator__bar {
  width: clamp(48px, 10vw, 72px);
  height: 5px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--color-info) 70%, transparent) 0%, var(--color-accent) 100%);
  box-shadow: 0 3px 8px color-mix(in srgb, var(--color-accent) 35%, transparent), inset 0 1px 0 var(--overlay-strong);
}

@media (max-width: 768px) {
  .header-pull-indicator {
    padding: 0.375rem 0;
  }
  
  .header-pull-indicator__bar {
    width: 36px;
    height: 3.5px;
  }
  
  .header-pull-indicator--active .header-pull-indicator__bar {
    width: 44px;
    height: 4px;
  }
}

@media (max-width: 480px) {
  .header-pull-indicator {
    padding: 0.25rem 0;
  }
  
  .header-pull-indicator__bar {
    width: 32px;
    height: 3px;
  }
  
  .header-pull-indicator--active .header-pull-indicator__bar {
    width: 40px;
    height: 3.5px;
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  padding: 0;
  background: var(--color-surface-glass);
  border: 1px solid var(--color-border);
  border-radius: 50%;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
  backdrop-filter: saturate(160%) blur(18px);
  box-shadow: var(--shadow-md);
}

.header-action-btn--status {
  width: auto;
  min-width: 52px;
  height: 44px;
  padding: 0 12px;
  border-radius: 14px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  font-weight: 600;
  position: relative;
  overflow: hidden;
}

.header-action-btn__date {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.header-action-btn__day {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.header-action-btn__month {
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-secondary);
}

.header-action-btn__hover-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.15em;
  opacity: 0;
  transform: scale(0.8);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.header-action-btn--status:hover .header-action-btn__date,
.header-action-btn--status:focus-visible .header-action-btn__date {
  opacity: 0;
  transform: scale(0.8);
}

.header-action-btn--status:hover .header-action-btn__hover-text,
.header-action-btn--status:focus-visible .header-action-btn__hover-text {
  opacity: 1;
  transform: scale(1);
}

/* Training day - GO with green glow */
.header-action-btn--status.header-action-btn--active {
  background: var(--gradient-accent);
  border-color: transparent;
  box-shadow: 0 4px 16px var(--color-accent-light);
}

.header-action-btn--status.header-action-btn--active .header-action-btn__hover-text {
  color: #fff;
  text-shadow: 0 0 12px rgba(255, 255, 255, 0.5);
}

/* Rest day - ZZZ with theme colors */
.header-action-btn--status.header-action-btn--rest:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-accent);
}

.header-action-btn--status.header-action-btn--rest .header-action-btn__hover-text {
  color: var(--color-accent);
}

.header-action-btn--status:hover,
.header-action-btn--status:focus-visible {
  border-color: var(--color-accent);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.header-action-btn--status.header-action-btn--active .header-action-btn__go {
  text-shadow: 0 0 18px rgba(255, 255, 255, 0.7);
}

.header-action-btn__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
}

.header-action-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: var(--color-border-strong);
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.header-action-btn:active {
  transform: translateY(0) scale(0.96);
  box-shadow: var(--shadow-md);
}

/* Header Content Panel - fills space from top to header */
.header-content-panel {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 99; /* Below header (z-index: 100) */
  height: 0;
  overflow: hidden; /* Expanded state adds overflow-y via modifier class */
  background-color: var(--panel-surface-base, var(--color-bg-elevated));
  background-image: var(--panel-surface-gradient, var(--gradient-accent));
  box-shadow: var(--shadow-dark-xl);
  -webkit-overflow-scrolling: touch;
  /* Optimize scrolling performance */
  will-change: height;
  backface-visibility: hidden;
  transform: translateZ(0);
}

.header-content-panel--expanded {
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.4) transparent;
}

.header-content-panel--expanded::-webkit-scrollbar {
  width: 6px;
}

.header-content-panel--expanded::-webkit-scrollbar-thumb {
  background-color: rgba(148, 163, 184, 0.45);
  border-radius: 999px;
  transition: background-color 0.2s ease;
}

.header-content-panel--expanded:hover::-webkit-scrollbar-thumb,
.header-content-panel--expanded:focus-visible::-webkit-scrollbar-thumb {
  background-color: rgba(148, 163, 184, 0.6);
}

.header-content-panel--expanded::-webkit-scrollbar-track {
  background: transparent;
}

.hero-banner {
  position: relative;
  height: 160px;
  background-size: cover;
  background-position: center;
  background-color: var(--color-bg-secondary);
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 1.5rem;
}

.hero-greeting {
  font-size: var(--font-size-sm);
  color: rgba(255,255,255,0.9);
  margin: 0 0 0.5rem;
}

.hero-title {
  font-size: var(--font-size-2xl);
  font-weight: 600;
  color: var(--color-text-inverse);
  margin: 0;
  text-shadow: var(--text-shadow-sm);
}

.demo-notice {
  padding: 0.75rem 1rem;
  text-align: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
}

/* Header slide transition */
.header-slide-enter-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.header-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.header-slide-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.header-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.header-slide-enter-to,
.header-slide-leave-from {
  opacity: 1;
  transform: translateY(0);
}

/* Main */
.app-main {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0;
  padding-top: var(--header-height);
  padding-bottom: calc(var(--footer-height) + env(safe-area-inset-bottom) + 16px);
  background: transparent;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  scrollbar-gutter: stable both-edges;
}

.app-main:hover,
.app-main:focus-visible,
.app-main:active {
  scrollbar-width: thin;
}

.app-main::-webkit-scrollbar {
  width: 0;
  height: 0;
  opacity: 0;
  background: transparent;
  transition: width 0.2s ease-in-out, opacity 0.2s ease-in-out;
}

.app-main::-webkit-scrollbar-thumb {
  background-color: transparent;
  border-radius: var(--radius-full);
  transition: background-color 0.2s ease-in-out;
}

.app-main:hover::-webkit-scrollbar,
.app-main:focus-visible::-webkit-scrollbar,
.app-main:active::-webkit-scrollbar {
  width: 6px;
  height: 6px;
  opacity: 1;
}

.app-main:hover::-webkit-scrollbar-thumb,
.app-main:focus-visible::-webkit-scrollbar-thumb,
.app-main:active::-webkit-scrollbar-thumb {
  /* Используем CSS переменные если они установлены, иначе fallback */
  background-color: var(--scroll-thumb-color-hover, rgba(32, 33, 35, 0.45));
}

/* Lock main content scroll when header expanded */
.app-main--locked {
  overflow: hidden;
  height: 100vh;
  height: 100dvh;
}

/* Removed deprecated overlay overflow support (not supported in Firefox) */

/* Footer - Sticky Navigation */
.app-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  min-height: var(--footer-height);
  background: var(--color-bg-elevated);
  border-top: 1px solid var(--color-border);
  padding: 0;
  padding-bottom: env(safe-area-inset-bottom);
  /* Плавный переход при скролле */
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  /* Оптимизация производительности */
  will-change: transform;
  backface-visibility: hidden;
  /* Тень при скролле для визуального разделения */
  box-shadow: 0 -16px 32px rgba(15, 23, 42, 0.12); /* Keep specific footer shadow for now or use var if available */
  backdrop-filter: saturate(160%) blur(14px);
  /* GPU acceleration */
  transform: translateZ(0);
  display: flex;
  align-items: flex-start;
  box-sizing: border-box;
}

/* Toast */
.toast-container {
  position: fixed;
  top: calc(var(--header-height) + 1rem);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: calc(100% - 2rem);
  max-width: var(--max-width-content);
  pointer-events: none;
}

/* Transitions */
.fade-slide-enter-active {
  transition: all 0.3s ease-out;
}

.fade-slide-leave-active {
  transition: all 0.2s ease-in;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Responsive */
@media (max-width: 768px) {
  .header-content {
    padding: 0 1rem;
    height: var(--header-height);
  }
  
  .header-pull-indicator {
    height: 10px;
  }
  
  .header-pull-indicator__bar {
    width: clamp(36px, 7vw, 56px);
    height: 3.5px;
  }
  
  .header-pull-indicator--active .header-pull-indicator__bar {
    width: clamp(44px, 9vw, 64px);
    height: 4px;
  }

  .header-logo {
    font-size: clamp(1.25rem, 3.5vw, 1.75rem);
  }

  .header-action-btn {
    width: 40px;
    height: 40px;
  }

  .app-main {
    padding-top: var(--header-height);
  }
}

@media (max-width: 480px) {
  .header-content {
    padding: 0 0.875rem;
    height: var(--header-height);
  }
  
  .header-pull-indicator {
    height: 8px;
  }
  
  .header-pull-indicator__bar {
    width: clamp(32px, 6vw, 52px);
    height: 3px;
  }
  
  .header-pull-indicator--active .header-pull-indicator__bar {
    width: clamp(40px, 8vw, 60px);
    height: 3.5px;
  }

  .header-logo {
    font-size: clamp(1.125rem, 3vw, 1.5rem);
    letter-spacing: 0.1em;
  }

  .header-action-btn {
    width: 40px;
    height: 40px;
  }

  .app-main {
    padding-top: var(--header-height);
  }
}

@media (max-width: 360px) {
  .header-content {
    padding: 0 0.75rem;
    height: var(--header-height);
  }
  
  .header-pull-indicator {
    height: 8px;
  }
  
  .header-pull-indicator__bar {
    width: clamp(28px, 5vw, 48px);
    height: 3px;
  }
  
  .header-pull-indicator--active .header-pull-indicator__bar {
    width: clamp(36px, 7vw, 56px);
    height: 3.5px;
  }

  .header-logo {
    font-size: clamp(1rem, 2.5vw, 1.375rem);
    letter-spacing: 0.08em;
  }

  .header-action-btn {
    width: 32px;
    height: 32px;
  }

  .app-main {
    padding-top: var(--header-height);
  }
}

.route-error {
  display: grid;
  gap: 8px;
  padding: 24px 20px;
  background: color-mix(in srgb, var(--color-surface) 90%, var(--color-accent) 4%);
  border: 1px solid color-mix(in srgb, var(--color-accent) 40%, transparent);
  border-radius: 12px;
  color: var(--color-text);
}

.route-error__title {
  margin: 0;
  font-weight: 700;
  font-size: 1rem;
}

.route-error__hint {
  margin: 0;
  font-size: 0.95rem;
  color: var(--color-text-secondary);
}

.route-error__actions {
  display: flex;
  gap: 12px;
}

.route-error__btn {
  border: none;
  border-radius: 10px;
  padding: 10px 14px;
  background: var(--color-accent);
  color: var(--color-on-accent, #0b0c0f);
  font-weight: 700;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
}

.route-error__btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px color-mix(in srgb, var(--color-accent) 32%, transparent);
}

.route-error__btn:active {
  transform: translateY(0);
  box-shadow: none;
}

</style>
