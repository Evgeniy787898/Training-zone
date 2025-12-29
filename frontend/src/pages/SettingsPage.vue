<template>
  <div class="settings-page">
    <!-- Background -->
    <div class="settings-bg">
      <div class="settings-bg__grid"></div>
      <div class="settings-bg__glow settings-bg__glow--1"></div>
      <div class="settings-bg__glow settings-bg__glow--2"></div>
    </div>

    <!-- Header -->
    <header class="settings-header">
      <h1>Настройки</h1>
      <p>Персонализируй приложение под себя</p>
    </header>

    <!-- Tabs with smart fades -->
    <div class="tabs-wrapper">
      <div 
        class="tabs-fade tabs-fade--left"
        :class="{ 'tabs-fade--visible': showTabsFadeLeft }"
      ></div>
      <div 
        class="tabs-track"
        ref="tabsTrackRef"
        @scroll="handleTabsScroll"
      >
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-item"
          :class="{ 'tab-item--active': activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <AppIcon :name="tab.icon as any" variant="accent" tone="ghost" :size="18" />
          <span>{{ tab.label }}</span>
        </button>
      </div>
      <div 
        class="tabs-fade tabs-fade--right"
        :class="{ 'tabs-fade--visible': showTabsFadeRight }"
      ></div>
    </div>

    <!-- Content with overlay scroll -->
    <main class="settings-main" ref="mainRef">
      <Transition name="fade" mode="out-in">
        
        <!-- Profile / Body Params -->
        <div v-if="activeTab === 'profile'" key="profile" class="panel">
          <BodyParamsWidget
            :loading="profileLoading"
            :body-params="bodyParams"
            @update="handleBodyParamsUpdate"
          />
        </div>

        <!-- Notifications -->
        <div v-else-if="activeTab === 'notifications'" key="notifications" class="panel">
          <div class="card">
            <div class="card-header">
              <AppIcon name="bell" variant="accent" tone="ghost" :size="26" />
              <div class="card-header__text">
                <h2>Уведомления</h2>
                <span>Напоминания в Telegram</span>
              </div>
            </div>
            <div class="card-body">
              <div class="setting-item">
                <div class="setting-item__info">
                  <span class="setting-item__title">Напоминания включены</span>
                  <span class="setting-item__desc">Получать уведомления о тренировках</span>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="notificationsEnabled" @change="handleNotificationToggle" />
                  <span></span>
                </label>
              </div>
              <Transition name="slide-down">
                <div v-if="notificationsEnabled" class="setting-item setting-item--sub">
                  <div class="setting-item__info">
                    <span class="setting-item__title">Время напоминания</span>
                    <span class="setting-item__desc">{{ userTimezone }}</span>
                  </div>
                  <input type="time" v-model="notificationTime" class="time-field" @change="handleNotificationTimeChange" />
                </div>
              </Transition>
            </div>
          </div>
        </div>

        <!-- Security -->
        <div v-else-if="activeTab === 'security'" key="security" class="panel">
          <div class="card">
            <div class="card-header">
              <AppIcon name="lock" variant="accent" tone="ghost" :size="26" />
              <div class="card-header__text">
                <h2>PIN-код</h2>
                <span>Защита доступа</span>
              </div>
            </div>
            <div class="card-body">
              <div class="setting-item">
                <div class="setting-item__info">
                  <span class="setting-item__title">Изменить PIN-код</span>
                  <span class="setting-item__desc">4-6 цифр для входа</span>
                </div>
                <button class="action-btn" @click="showPinModal = true">Изменить</button>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <AppIcon name="logOut" variant="accent" tone="ghost" :size="26" />
              <div class="card-header__text">
                <h2>Аккаунт</h2>
                <span>Управление сессией</span>
              </div>
            </div>
            <div class="card-body">
              <div class="setting-item">
                <div class="setting-item__info">
                  <span class="setting-item__title">Выход из аккаунта</span>
                  <span class="setting-item__desc">Завершить сессию WebApp</span>
                </div>
                <button class="action-btn action-btn--danger" @click="handleLogout">Выйти</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Data -->
        <div v-else-if="activeTab === 'data'" key="data" class="panel">
          <div class="card">
            <div class="card-header">
              <AppIcon name="hardDrive" variant="accent" tone="ghost" :size="26" />
              <div class="card-header__text">
                <h2>Локальный кэш</h2>
                <span>Данные на устройстве</span>
              </div>
            </div>
            <div class="card-body">
              <div class="stats-grid">
                <div class="stat-box">
                  <strong>{{ cacheSize }}</strong>
                  <span>РАЗМЕР</span>
                </div>
                <div class="stat-box">
                  <strong>{{ cacheItems }}</strong>
                  <span>ЭЛЕМЕНТОВ</span>
                </div>
              </div>
              <button class="wide-btn wide-btn--warning" @click="clearLocalCache">
                <AppIcon name="trash" variant="warning" tone="ghost" :size="16" />
                Очистить кэш
              </button>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <AppIcon name="cloud" variant="accent" tone="ghost" :size="26" />
              <div class="card-header__text">
                <h2>Облачные данные</h2>
                <span>Синхронизация с сервером</span>
              </div>
            </div>
            <div class="card-body">
              <p class="info-text">Сброс серверного кэша поможет, если данные рассинхронизировались между устройствами.</p>
              <button class="wide-btn wide-btn--warning" :disabled="serverLoading" @click="clearServerCache">
                <AppIcon :name="serverLoading ? 'loader' : 'refresh'" variant="warning" tone="ghost" :size="16" :class="{ spinning: serverLoading }" />
                {{ serverLoading ? 'Очистка...' : 'Сбросить серверный кэш' }}
              </button>
            </div>
          </div>
        </div>
        
        <!-- AI Settings (PERS-INS-002) -->
        <div v-else-if="activeTab === 'ai'" key="ai" class="panel panel--ai">
          <AiInstructionsEditor />
        </div>
      </Transition>
    </main>

    <!-- Footer -->
    <footer class="settings-footer">
      <span>Training Zone <em>v2.0.0</em></span>
      <a href="https://t.me/av1242" target="_blank">
        <AppIcon name="messageCircle" variant="muted" tone="ghost" :size="14" />
        Поддержка
      </a>
    </footer>

    <!-- PIN Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showPinModal" class="modal-overlay" @click.self="closePinModal">
          <div class="modal-box">
            <header>
              <h3>Смена PIN-кода</h3>
              <button @click="closePinModal"><AppIcon name="x" tone="ghost" :size="18" /></button>
            </header>
            <form @submit.prevent="handlePinChange">
              <label>Текущий PIN<input type="password" inputmode="numeric" maxlength="6" v-model="pinForm.current" placeholder="••••" required /></label>
              <label>Новый PIN<input type="password" inputmode="numeric" maxlength="6" v-model="pinForm.new" placeholder="••••" required /></label>
              <label>Подтвердите<input type="password" inputmode="numeric" maxlength="6" v-model="pinForm.confirm" placeholder="••••" required /></label>
              <p v-if="pinError" class="error-msg">{{ pinError }}</p>
              <div class="modal-actions">
                <button type="button" class="action-btn" @click="closePinModal">Отмена</button>
                <button type="submit" class="action-btn action-btn--primary" :disabled="pinLoading">{{ pinLoading ? 'Сохраняю...' : 'Сохранить' }}</button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { useAppStore } from '@/stores/app';
import { apiClient } from '@/services/api';
import { clearAllCaches, invalidateProgramContextCaches } from '@/services/cacheManager';
import { cachedApiClient } from '@/services/cachedApi';
import AppIcon from '@/modules/shared/components/AppIcon.vue';
import BodyParamsWidget from '@/modules/settings/widgets/BodyParamsWidget.vue';
import { AiInstructionsEditor } from '@/components/ai';

const appStore = useAppStore();

// Tabs scroll
const tabsTrackRef = ref<HTMLElement | null>(null);
const showTabsFadeLeft = ref(false);
const showTabsFadeRight = ref(true);

const handleTabsScroll = () => {
  if (!tabsTrackRef.value) return;
  const { scrollLeft, scrollWidth, clientWidth } = tabsTrackRef.value;
  const threshold = 5;
  showTabsFadeLeft.value = scrollLeft > threshold;
  showTabsFadeRight.value = scrollLeft < scrollWidth - clientWidth - threshold;
};

onMounted(() => {
  nextTick(() => handleTabsScroll());
});

type TabId = 'profile' | 'notifications' | 'security' | 'data' | 'ai';
const activeTab = ref<TabId>('profile');
const tabs = [
  { id: 'profile' as TabId, label: 'Профиль', icon: 'user' },
  { id: 'notifications' as TabId, label: 'Уведомления', icon: 'bell' },
  { id: 'security' as TabId, label: 'Безопасность', icon: 'shield' },
  { id: 'data' as TabId, label: 'Данные', icon: 'hardDrive' },
  { id: 'ai' as TabId, label: 'AI', icon: 'cpu' },
];

// Body Params (FEAT-003)
const profileLoading = ref(false);
const bodyParams = computed(() => {
  const prefs = appStore.profileSummary?.profile?.preferences as Record<string, unknown> | undefined;
  return {
    weightKg: (prefs?.weightKg as number) ?? null,
    heightCm: (prefs?.heightCm as number) ?? null,
  };
});

const handleBodyParamsUpdate = async (params: { weightKg: number | null; heightCm: number | null }) => {
  profileLoading.value = true;
  try {
    await apiClient.updateProfile({
      preferences: {
        weightKg: params.weightKg,
        heightCm: params.heightCm,
      },
    } as any);
    // Refresh profile summary
    await appStore.refreshProfile();
    appStore.showToast({ title: 'Параметры сохранены', type: 'success' });
  } catch (e: any) {
    appStore.showToast({ title: 'Ошибка', message: e.message, type: 'error' });
  } finally {
    profileLoading.value = false;
  }
};

// Notifications
const notificationsEnabled = ref(!appStore.profileSummary?.profile?.notificationsPaused);
const notificationTime = ref(appStore.profileSummary?.profile?.notificationTime?.substring(0, 5) || '10:00');
const userTimezone = computed(() => appStore.profileSummary?.profile?.timezone || 'Europe/Moscow');

const handleNotificationToggle = async () => {
  try {
    await apiClient.updateProfile({ notifications_paused: !notificationsEnabled.value });
    appStore.showToast({ title: notificationsEnabled.value ? 'Уведомления включены' : 'Уведомления выключены', type: 'success' });
  } catch (e: any) {
    notificationsEnabled.value = !notificationsEnabled.value;
    appStore.showToast({ title: 'Ошибка', message: e.message, type: 'error' });
  }
};

const handleNotificationTimeChange = async () => {
  try {
    await apiClient.updateProfile({ notification_time: notificationTime.value + ':00' });
    appStore.showToast({ title: 'Время обновлено', type: 'success' });
  } catch (e: any) {
    appStore.showToast({ title: 'Ошибка', message: e.message, type: 'error' });
  }
};

// Security
const showPinModal = ref(false);
const pinLoading = ref(false);
const pinError = ref('');
const pinForm = ref({ current: '', new: '', confirm: '' });

const closePinModal = () => {
  showPinModal.value = false;
  pinForm.value = { current: '', new: '', confirm: '' };
  pinError.value = '';
};

const handlePinChange = async () => {
  pinError.value = '';
  if (!/^\d{4,6}$/.test(pinForm.value.current)) { pinError.value = 'Текущий PIN: 4-6 цифр'; return; }
  if (!/^\d{4,6}$/.test(pinForm.value.new)) { pinError.value = 'Новый PIN: 4-6 цифр'; return; }
  if (pinForm.value.new !== pinForm.value.confirm) { pinError.value = 'PIN-коды не совпадают'; return; }
  
  pinLoading.value = true;
  try {
    await apiClient.changePin(pinForm.value.current, pinForm.value.new);
    appStore.showToast({ title: 'PIN-код изменён', type: 'success' });
    closePinModal();
  } catch (e: any) {
    pinError.value = e.message?.includes('Неверный') ? 'Неверный текущий PIN' : (e.message || 'Ошибка');
  } finally {
    pinLoading.value = false;
  }
};

const handleLogout = () => {
  appStore.showToast({ title: 'Выход', message: 'Закройте WebApp в Telegram.', type: 'info' });
};

// Cache
const cacheSize = ref('...');
const cacheItems = ref(0);
const serverLoading = ref(false);

const calculateCache = () => {
  let total = 0, count = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      total += key.length + (localStorage.getItem(key)?.length || 0);
      if (key.startsWith('tzona') || key.startsWith('app_')) count++;
    }
  }
  const bytes = total * 2;
  cacheSize.value = bytes < 1024 ? `${bytes} Б` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} КБ` : `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
  cacheItems.value = count || localStorage.length;
};

const clearLocalCache = () => {
  if (!confirm(`Очистить локальный кэш?\n\nРазмер: ${cacheSize.value}\nЭлементов: ${cacheItems.value}`)) return;
  clearAllCaches();
  appStore.showToast({ title: 'Кэш очищен', type: 'success' });
  calculateCache();
};

const clearServerCache = async () => {
  if (!confirm('Сбросить серверный кэш?')) return;
  serverLoading.value = true;
  try {
    await cachedApiClient.clearServerCache();
    invalidateProgramContextCaches();
    appStore.showToast({ title: 'Серверный кэш сброшен', type: 'success' });
  } catch (e: any) {
    appStore.showToast({ title: 'Ошибка', message: e.message, type: 'error' });
  } finally {
    serverLoading.value = false;
  }
};

onMounted(calculateCache);
</script>

<style scoped>
.settings-page {
  position: fixed;
  inset: var(--header-height, 60px) 0 calc(var(--footer-height, 64px) + env(safe-area-inset-bottom)) 0;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  overflow: hidden;
}

/* Background */
.settings-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.settings-bg__grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
  background-size: 28px 28px;
}
.settings-bg__glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.25;
}
.settings-bg__glow--1 { width: 180px; height: 180px; top: -40px; right: -20px; background: var(--color-accent); }
.settings-bg__glow--2 { width: 140px; height: 140px; bottom: 25%; left: -30px; background: #a855f7; }

/* Header */
.settings-header {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 0.5rem 1rem 0.3rem;
  flex-shrink: 0;
}
.settings-header h1 {
  font-size: 1.3rem;
  font-weight: 800;
  margin: 0;
  color: var(--color-text-primary);
}
.settings-header p {
  font-size: 0.72rem;
  color: var(--color-text-secondary);
  margin: 0.05rem 0 0;
}

/* Tabs wrapper - SMART FADES like ExerciseModal */
.tabs-wrapper {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  margin: 0 -1rem;
  padding: 0.25rem 0; /* Add vertical padding for smooth fade edges */
}

.tabs-track {
  display: flex;
  gap: 0.4rem;
  padding: 0.35rem 2rem;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.tabs-track::-webkit-scrollbar { display: none; }

/* Smart fade overlays - smooth edges using mask */
.tabs-fade {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 56px;
  pointer-events: none;
  z-index: 5;
  opacity: 0;
  transition: opacity 0.25s ease;
  /* Use mask to create soft edges on all sides */
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%);
}
.tabs-fade--visible {
  opacity: 1;
}
.tabs-fade--left {
  left: 0;
  background: linear-gradient(to right, var(--color-bg) 0%, var(--color-bg) 50%, transparent 100%);
}
.tabs-fade--right {
  right: 0;
  background: linear-gradient(to left, var(--color-bg) 0%, var(--color-bg) 50%, transparent 100%);
}

.tab-item {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.45rem 0.8rem;
  border-radius: 999px;
  border: 1px solid transparent;
  background: rgba(255,255,255,0.03);
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.15s;
}
.tab-item:hover { background: rgba(255,255,255,0.06); color: var(--color-text-primary); }
.tab-item--active {
  background: var(--color-bg-elevated);
  border-color: var(--color-border);
  color: var(--color-text-primary);
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}

/* Main - TRUE OVERLAY SCROLL (no content shift) */
.settings-main {
  position: relative;
  z-index: 1;
  flex: 1;
  padding: 0.4rem 1rem 0.8rem;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  /* Truly invisible scrollbar that doesn't shift content */
  scrollbar-width: none;
}
.settings-main::-webkit-scrollbar {
  width: 0;
  height: 0;
  background: transparent;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
}

/* Card */
.card {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 12px;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 0.85rem;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
.card-header__text { flex: 1; }
.card-header__text h2 { font-size: 0.9rem; font-weight: 700; margin: 0; color: var(--color-text-primary); }
.card-header__text span { font-size: 0.68rem; color: var(--color-text-muted); }
.card-body { padding: 0.7rem 0.85rem; display: flex; flex-direction: column; gap: 0.55rem; }

/* Setting Item */
.setting-item { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; }
.setting-item--sub { padding-left: 0.5rem; border-left: 2px solid var(--color-accent); margin-left: 0.1rem; }
.setting-item__info { flex: 1; min-width: 0; }
.setting-item__title { display: block; font-size: 0.82rem; font-weight: 600; color: var(--color-text-primary); }
.setting-item__desc { display: block; font-size: 0.68rem; color: var(--color-text-muted); }

/* Toggle */
.toggle-switch { position: relative; width: 40px; height: 22px; flex-shrink: 0; }
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.toggle-switch span {
  position: absolute; inset: 0;
  background: rgba(255,255,255,0.1);
  border-radius: 99px;
  cursor: pointer;
  transition: background 0.2s;
}
.toggle-switch span::after {
  content: '';
  position: absolute;
  top: 2px; left: 2px;
  width: 18px; height: 18px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}
.toggle-switch input:checked + span { background: var(--color-accent); }
.toggle-switch input:checked + span::after { transform: translateX(18px); }

/* Time field */
.time-field {
  padding: 0.3rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: rgba(255,255,255,0.02);
  color: var(--color-text-primary);
  font-size: 0.8rem;
  font-weight: 600;
}

/* Stats */
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; }
.stat-box {
  display: flex; flex-direction: column; align-items: center;
  padding: 0.5rem;
  background: rgba(255,255,255,0.02);
  border-radius: 6px;
}
.stat-box strong { font-size: 0.95rem; font-weight: 800; color: var(--color-text-primary); }
.stat-box span { font-size: 0.55rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.03em; }

/* Info */
.info-text { font-size: 0.72rem; color: var(--color-text-secondary); line-height: 1.35; margin: 0; }

/* Buttons */
.action-btn {
  padding: 0.4rem 0.7rem;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: rgba(255,255,255,0.04);
  color: var(--color-text-primary);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.action-btn:hover { background: rgba(255,255,255,0.08); }
.action-btn--primary { background: var(--color-accent); border-color: transparent; color: var(--color-accent-contrast); }
.action-btn--primary:hover { filter: brightness(1.1); }
.action-btn--danger { background: rgba(239,68,68,0.1); border-color: transparent; color: #ef4444; }
.action-btn--danger:hover { background: rgba(239,68,68,0.18); }

.wide-btn {
  display: flex; align-items: center; justify-content: center; gap: 0.3rem;
  width: 100%;
  padding: 0.55rem;
  border-radius: 8px;
  border: none;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.wide-btn--warning { background: rgba(245,158,11,0.1); color: #f59e0b; }
.wide-btn--warning:hover { background: rgba(245,158,11,0.18); }
.wide-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Footer */
.settings-footer {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.45rem 1rem;
  border-top: 1px solid rgba(255,255,255,0.03);
  flex-shrink: 0;
  font-size: 0.68rem;
  color: var(--color-text-muted);
}
.settings-footer em { font-style: normal; opacity: 0.6; }
.settings-footer a { display: flex; align-items: center; gap: 0.2rem; color: var(--color-text-secondary); transition: color 0.15s; }
.settings-footer a:hover { color: var(--color-accent); }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  padding: 1rem;
}
.modal-box {
  width: 100%; max-width: 280px;
  background: var(--color-bg-elevated);
  border-radius: 12px;
  border: 1px solid var(--color-border);
  overflow: hidden;
}
.modal-box header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.65rem 0.85rem;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
.modal-box header h3 { font-size: 0.85rem; font-weight: 700; margin: 0; }
.modal-box header button { background: none; border: none; color: var(--color-text-secondary); cursor: pointer; padding: 0.1rem; }
.modal-box form { padding: 0.75rem 0.85rem; display: flex; flex-direction: column; gap: 0.5rem; }
.modal-box label { display: flex; flex-direction: column; gap: 0.15rem; font-size: 0.68rem; font-weight: 600; color: var(--color-text-secondary); }
.modal-box input {
  padding: 0.45rem 0.6rem;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: rgba(255,255,255,0.02);
  color: var(--color-text-primary);
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  text-align: center;
}
.modal-box input:focus { outline: none; border-color: var(--color-accent); }
.error-msg { font-size: 0.72rem; color: #ef4444; text-align: center; margin: 0; }
.modal-actions { display: flex; gap: 0.4rem; margin-top: 0.25rem; }
.modal-actions .action-btn { flex: 1; }

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s, transform 0.15s; }
.fade-enter-from { opacity: 0; transform: translateY(6px); }
.fade-leave-to { opacity: 0; transform: translateY(-4px); }

.slide-down-enter-active, .slide-down-leave-active { transition: all 0.15s; overflow: hidden; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; max-height: 0; }

.modal-enter-active, .modal-leave-active { transition: opacity 0.15s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

.spinning { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
