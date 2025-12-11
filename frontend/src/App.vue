<template>
  <div ref="appRootRef" class="app">

    <!-- Loading indicator moved to Navigation bar top border -->
    <PinScreen v-if="!pinVerified" @success="handlePinSuccess" />
    <div v-else :class="['app-container', { 'app-container--grid': isGridLayoutActive }]">
      <transition name="header-slide">
        <AppHeader
          v-show="!appStore.isFocusMode"
          ref="appHeaderRef"
          :hero-status="heroStatus"
          :hero-expanded="heroExpanded"
          :is-dragging="isDragging"
          :header-style="headerStyle"
          :current-day="currentDay"
          :current-month="currentMonth"
          @drag-start="handleDragStart"
          @toggle-hero="toggleHero"
          @advice-click="handleAdviceClick"
        />
      </transition>


      <!-- Content panel - simplified to be always visible/sticky if needed, or just part of flow -->
      <HeroPanel
        ref="heroPanelRef"
        :hero-expanded="heroExpanded"
        :content-panel-style="contentPanelStyle"
        :discipline-name="selectedDiscipline?.label || 'Калистеника'"
        :discipline-image="selectedDiscipline?.image || '/img/calisthenics.jpg'"
        :program-name="selectedProgram?.name"
        :exercises="selectedExercises"
        :current-levels="currentLevels"
        @program-selected="handleProgramSelection"
      />

      <main 
        id="main-content" 
        class="app-main"
        :class="{ 
          'app-main--locked': heroExpanded,
          'app-main--fullscreen': appStore.isFocusMode 
        }"
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

      <transition name="footer-slide">
        <AppFooter
          v-show="!appStore.isFocusMode"
          ref="appFooterRef"
          :active-tab="activeTab"
          @tab-change="handleTabChange"
        />
      </transition>
    </div>

    <div class="toast-container" role="region" aria-live="polite">
      <Toast />
    </div>

    <OfflineIndicator :is-online="isOnline" />

    <!-- GAP-010: Global AI Widget -->
    <FloatingAiWidget v-if="pinVerified" />
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
import type { AppRouteSlug } from '@/router';

import ErrorBoundary from '@/modules/shared/components/ErrorBoundary.vue';
import { useNetworkStatus } from '@/composables/useNetworkStatus';

import { useAppLayout } from '@/composables/useAppLayout';
import { installViewTransitions } from '@/composables/useViewTransitions';

const PinScreen = createLazyComponent(() => import('@/modules/profile/components/PinScreen.vue'), { delay: 0 });
const AppHeader = createLazyComponent(() => import('@/components/layout/AppHeader.vue'));
const AppFooter = createLazyComponent(() => import('@/components/layout/AppFooter.vue'));
const HeroPanel = createLazyComponent(() => import('@/components/layout/HeroPanel.vue'));
const Toast = createLazyComponent(() => import('@/modules/shared/components/Toast.vue'));
const FloatingAiWidget = createLazyComponent(() => import('@/components/FloatingAiWidget.vue'));
const RouteSkeleton = createLazyComponent(() => import('@/modules/shared/components/RouteSkeleton.vue'));

const OfflineIndicator = createLazyComponent(() => import('@/modules/shared/components/OfflineIndicator.vue'));

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

const { isGridLayoutActive, heroExpanded } = useAppLayout();

const appHeaderRef = ref<InstanceType<typeof AppHeader> | null>(null);
const appFooterRef = ref<InstanceType<typeof AppFooter> | null>(null);
const heroPanelRef = ref<InstanceType<typeof HeroPanel> | null>(null);
const programPanelRef = computed(() => heroPanelRef.value || null);
const selectedDiscipline = programDiscipline;
const selectedProgram = programDefinition;
const selectedExercises = programExercises;
const currentLevels = programCurrentLevels;

const { isOnline } = useNetworkStatus();

watch(isOnline, (online, oldVal) => {
  if (online && oldVal === false) {
    appStore.showToast({
      title: 'Подключение восстановлено',
      message: 'Синхронизация данных...',
      type: 'success'
    });
  }
});

const routeResetNonce = ref(0);
const routeBoundaryKey = computed(() => `${router.currentRoute.value.fullPath}|${routeResetNonce.value}`);
const routeErrorBoundary = ref<{ reset: () => void } | null>(null);





const pathBySlug: Record<AppRouteSlug, string> = {
  today: '/today',
  exercises: '/exercises',
  programs: '/programs',
  settings: '/settings',
  progress: '/progress',
  evolution: '/evolution',
  report: '/report',
  library: '/library',
  week: '/week',
  onboarding: '/onboarding',
  progressPhotos: '/progress-photos',
  history: '/history',
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

const headerRef = computed(() => appHeaderRef.value?.headerRef || null);
const headerPullIndicatorRef = computed(() => appHeaderRef.value?.headerPullIndicatorRef || null);
const footerRef = computed(() => appFooterRef.value?.footerRef || null);

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
  scheduleMaxOffsetUpdate: _scheduleMaxOffsetUpdate,
} = useHeroPanel(
  { headerRef, footerRef, headerPullIndicatorRef },
  { heroExpanded, isGridLayoutActive }
);

// GRID LAYOUT LOGIC MOVED TO useAppLayout

const handlePinSuccess = () => {
  pinVerified.value = true;

  void appStore.refreshAssistantSessionState({ force: true });
  appStore.ensureAssistantSessionMonitor();

  // Загружаем данные программы из БД после успешной верификации PIN
  // Используем кэш для быстрой загрузки
  loadUserProgramData(true);

  startCriticalPrefetch();
};

// Lifecycle
onMounted(async () => {
  appStore.initializeTheme();
  // Initial state: require PIN until verified in this runtime session
  pinVerified.value = false;
  
  // Layout listener handled by useAppLayout
  
  // Устанавливаем начальный статус по умолчанию (будет обновлен при загрузке данных)
  // Проверяем текущий маршрут - если это главная страница, устанавливаем 'rest'
  const route = router.currentRoute.value;
  if (route.path === '/' || route.path.includes('/today')) {
    // Статус будет установлен в TodayPage при загрузке данных
    appStore.setHeroStatus('rest');
  }

  setupEventListeners();

  // DS-002: Enable View Transitions API if supported
  installViewTransitions();
});

onUnmounted(() => {
  gridLayoutMediaQuery?.removeEventListener('change', handleGridLayoutChange);
  
  cleanupEventListeners();
  
  appStore.stopAssistantSessionMonitor();
});

const activeTab = computed(() => {
  const route = router.currentRoute.value;
  if (route.path.includes('/exercises') && !route.path.includes('/programs')) return 'exercises';
  if (route.path.includes('/programs')) return 'exercises';
  if (route.path.includes('/evolution')) return 'evolution';
  if (route.path.includes('/progress')) return 'evolution'; // Redirect progress to evolution
  if (route.path.includes('/settings')) return 'settings';
  if (route.path.includes('/history')) return 'history';
  return 'today';
});

watch(
  () => route.fullPath,
  () => {
    appHeaderRef.value?.closeThemeCustomizer?.();
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
      appHeaderRef.value?.toggleThemeCustomizer?.();
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

const handleProgramSelection = async (programData: any) => {
  if (!pinVerified.value) {
    return;
  }

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
    programPanelRef.value?.focusProgress();

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
    case 'evolution':
      router.push('/evolution');
      break;
    case 'history':
      router.push('/history');
      break;
  }
};
</script>

<style scoped>
/* Core app layout - scoped styles */
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
  -webkit-overflow-scrolling: touch;
}

/* All layout styles moved to assets/css/app-layout.css */
</style>
