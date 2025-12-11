<template>
  <div class="settings-cache-cards">
    <!-- Local Cache -->
    <BaseCard class="settings-card settings-card--cache">
      <template #header>
        <div class="surface-card__title">
          <NeonIcon name="database" variant="violet" :size="26" class="settings-card__title-icon" />
          <span>Кэш приложения</span>
        </div>
        <p class="surface-card__subtitle">
          Сбрасывай локальные данные, если нужно получить свежие ответы.
        </p>
      </template>

      <dl class="settings-cache" aria-live="polite">
        <div>
          <dt class="settings-cache__label">Размер кэша</dt>
          <dd class="settings-cache__value">{{ cacheStorageSize }}</dd>
        </div>
        <div>
          <dt class="settings-cache__label">Элементов</dt>
          <dd class="settings-cache__value">{{ cacheItemCount }}</dd>
        </div>
      </dl>
      
      <template #footer>
        <div class="settings-card__actions">
          <BaseButton variant="warning" @click="confirmClearCache">
            Очистить кэш
          </BaseButton>
        </div>
      </template>
    </BaseCard>

    <!-- Server Cache -->
    <BaseCard class="settings-card settings-card--server-data">
      <template #header>
        <div class="surface-card__title">
          <NeonIcon name="stack" variant="aqua" :size="26" class="settings-card__title-icon" />
          <span>Данные на сервере</span>
        </div>
        <p class="surface-card__subtitle">
          Управление данными, сохранёнными в облаке.
        </p>
      </template>

      <div class="server-data-actions">
         <div class="server-data-info">
           <p>Очистка серверного кэша может помочь, если данные на разных устройствах рассинхронизировались.</p>
         </div>
      </div>
      
      <template #footer>
        <div class="settings-card__actions">
          <BaseButton
            variant="warning"
            :loading="serverCacheCleaning"
            @click="confirmClearServerCache"
          >
            Сбросить серверный кэш
          </BaseButton>
        </div>
      </template>
    </BaseCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
import { clearAllCaches, invalidateProgramContextCaches } from '@/services/cacheManager';
import { cachedApiClient } from '@/services/cachedApi';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';

const appStore = useAppStore();

const cacheStorageSize = ref('Считаю…');
const cacheItemCount = ref(0);
const serverCacheCleaning = ref(false);

const calculateCacheSize = () => {
  try {
    let totalSize = 0;
    let itemCount = 0;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key) || '';
        totalSize += key.length + value.length;
        if (key.startsWith('tzona') || key.startsWith('app_')) {
          itemCount++;
        }
      }
    }
    
    const bytes = totalSize * 2;
    if (bytes < 1024) {
      cacheStorageSize.value = `${bytes} Б`;
    } else if (bytes < 1024 * 1024) {
      cacheStorageSize.value = `${(bytes / 1024).toFixed(1)} КБ`;
    } else {
      cacheStorageSize.value = `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
    }
    
    cacheItemCount.value = itemCount || localStorage.length;
  } catch (e) {
    cacheStorageSize.value = '—';
    cacheItemCount.value = 0;
  }
};

const confirmClearCache = () => {
  if (confirm(`Очистить кэш приложения?\n\nРазмер: ${cacheStorageSize.value}\nЭлементов: ${cacheItemCount.value}\n\nЭто удалит все локально сохранённые данные.`)) {
    clearCacheExecute();
  }
};

const clearCacheExecute = () => {
  try {
    clearAllCaches();
    appStore.showToast({
      title: 'Кэш очищен',
      message: 'Локальные данные удалены, свежие загрузятся при следующем запросе',
      type: 'success'
    });
    calculateCacheSize();
  } catch (error) {
    console.error('Failed to clear cache:', error);
    appStore.showToast({
      title: 'Ошибка',
      message: 'Не удалось очистить кэш',
      type: 'error'
    });
  }
};

const confirmClearServerCache = async () => {
  if (!confirm('Сбросить серверный кэш?\n\nЭто очистит кэшированные данные на сервере для вашего аккаунта.')) {
    return;
  }
  
  serverCacheCleaning.value = true;
  try {
    await cachedApiClient.invalidateCache(['*']);
    invalidateProgramContextCaches();
    appStore.showToast({
      title: 'Серверный кэш очищен',
      message: 'Кэшированные данные сброшены',
      type: 'success'
    });
  } catch (error: any) {
    console.error('Failed to clear server cache:', error);
    appStore.showToast({
      title: 'Ошибка',
      message: error.message || 'Не удалось очистить серверный кэш',
      type: 'error'
    });
  } finally {
    serverCacheCleaning.value = false;
  }
};

onMounted(() => {
  calculateCacheSize();
});
</script>
