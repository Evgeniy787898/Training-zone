<template>
  <div class="evolution-page">
    <!-- Header -->
    <header class="evolution-header">
      <h1>Эволюция</h1>
      <p>Визуализируй свой путь трансформации</p>
    </header>

    <!-- Tabs -->
    <div class="evolution-tabs">
      <button 
        :class="['tab-btn', { 'tab-btn--active': activeTab === 'current' }]"
        @click="activeTab = 'current'"
      >
        <AppIcon name="user" :size="18" :variant="activeTab === 'current' ? 'accent' : 'neutral'" tone="ghost" />
        <span>Текущая форма</span>
      </button>
      <button 
        :class="['tab-btn', { 'tab-btn--active': activeTab === 'goal' }]"
        @click="activeTab = 'goal'"
      >
        <AppIcon name="target" :size="18" :variant="activeTab === 'goal' ? 'accent' : 'neutral'" tone="ghost" />
        <span>Цель</span>
      </button>
    </div>

    <!-- Scrollable Content Area -->
    <main class="evolution-content">
      <!-- CURRENT TAB -->
      <div v-show="activeTab === 'current'" class="tab-panel">
        <!-- Has data: 360 viewer -->
        <div v-if="currentHasData" class="viewer-container">
          <div class="viewer-placeholder">
            <AppIcon name="refresh-cw" :size="48" variant="accent" tone="ghost" />
            <p>360° просмотр загружен</p>
            <p class="frame-count">{{ currentFrames.length }} кадров</p>
          </div>
          <button class="delete-btn" @click="deleteScan('current')">
            <AppIcon name="trash-2" :size="16" variant="error" tone="ghost" />
            Удалить и загрузить заново
          </button>
        </div>

        <!-- No data: Upload zone -->
        <div v-else class="upload-zone" @click="triggerUpload('current')">
          <AppIcon name="camera" :size="56" variant="accent" tone="ghost" />
          <h3>Загрузите текущее состояние</h3>
          <p>ZIP-архив с кадрами 360° съёмки вашего тела</p>
          <button class="upload-btn" @click.stop="triggerUpload('current')">
            <AppIcon name="upload" :size="20" variant="neutral" tone="ghost" />
            Выбрать ZIP-архив
          </button>
          <span class="upload-hint">Файлы: 001.jpg, 002.jpg, ... до 360 кадров</span>
        </div>
      </div>

      <!-- GOAL TAB -->
      <div v-show="activeTab === 'goal'" class="tab-panel">
        <!-- Has data: 360 viewer -->
        <div v-if="goalHasData" class="viewer-container">
          <div class="viewer-placeholder">
            <AppIcon name="refresh-cw" :size="48" variant="accent" tone="ghost" />
            <p>360° просмотр цели загружен</p>
            <p class="frame-count">{{ goalFrames.length }} кадров</p>
          </div>
          <button class="delete-btn" @click="deleteScan('goal')">
            <AppIcon name="trash-2" :size="16" variant="error" tone="ghost" />
            Удалить и загрузить заново
          </button>
        </div>

        <!-- No data: Upload zone -->
        <div v-else class="upload-zone" @click="triggerUpload('goal')">
          <AppIcon name="target" :size="56" variant="accent" tone="ghost" />
          <h3>Загрузите целевое состояние</h3>
          <p>Визуализация желаемого результата трансформации</p>
          <button class="upload-btn" @click.stop="triggerUpload('goal')">
            <AppIcon name="upload" :size="20" variant="neutral" tone="ghost" />
            Выбрать ZIP-архив
          </button>
          <span class="upload-hint">Можно использовать референс или AI визуализацию</span>
        </div>
      </div>

      <!-- Hidden file input -->
      <input 
        ref="fileInput"
        type="file"
        accept=".zip,application/zip"
        class="hidden-input"
        @change="handleFileSelected"
      />

      <!-- Upload progress overlay -->
      <div v-if="uploading" class="upload-overlay">
        <div class="upload-progress">
          <div class="spinner"></div>
          <p>{{ uploadStatus }}</p>
        </div>
      </div>
    </main>

    <!-- Info block -->
    <div class="evolution-info">
      <AppIcon name="info" :size="20" variant="accent" tone="ghost" />
      <div class="info-text">
        <strong>Как создать 360° съёмку?</strong>
        <span>Запишите видео, поворачиваясь на 360°, разбейте на кадры, назовите 001.jpg...360.jpg, упакуйте в ZIP.</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { evolutionService } from '@/services/evolution';
import { useAppStore } from '@/stores/app';
import AppIcon from '@/modules/shared/components/AppIcon.vue';

const appStore = useAppStore();

// State
const activeTab = ref<'current' | 'goal'>('current');
const currentHasData = ref(false);
const goalHasData = ref(false);
const currentFrames = ref<string[]>([]);
const goalFrames = ref<string[]>([]);
const uploading = ref(false);
const uploadStatus = ref('');
const uploadTarget = ref<'current' | 'goal'>('current');
const fileInput = ref<HTMLInputElement | null>(null);

// Load initial data
onMounted(async () => {
  try {
    const status = await evolutionService.getStatus();
    currentHasData.value = status.current;
    goalHasData.value = status.goal;
    
    if (status.current) {
      currentFrames.value = await evolutionService.getFrames('current');
    }
    if (status.goal) {
      goalFrames.value = await evolutionService.getFrames('goal');
    }
  } catch (e) {
    console.log('[Evolution] No data yet or API error');
  }
});

function triggerUpload(type: 'current' | 'goal') {
  uploadTarget.value = type;
  fileInput.value?.click();
}

async function handleFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  // Validate
  if (!file.name.endsWith('.zip')) {
    appStore.showToast({ title: 'Ошибка', message: 'Выберите ZIP-архив', type: 'error' });
    return;
  }

  if (file.size > 100 * 1024 * 1024) {
    appStore.showToast({ title: 'Ошибка', message: 'Файл слишком большой (макс 100МБ)', type: 'error' });
    return;
  }

  uploading.value = true;
  uploadStatus.value = 'Загружаем архив...';

  try {
    await evolutionService.uploadZip(uploadTarget.value, file);
    
    uploadStatus.value = 'Готово!';
    
    if (uploadTarget.value === 'current') {
      currentHasData.value = true;
      currentFrames.value = await evolutionService.getFrames('current');
    } else {
      goalHasData.value = true;
      goalFrames.value = await evolutionService.getFrames('goal');
    }
    
    appStore.showToast({ title: 'Успешно!', message: '360° просмотр готов', type: 'success' });
  } catch (error: any) {
    console.error('[Evolution] Upload failed:', error);
    appStore.showToast({ 
      title: 'Ошибка загрузки', 
      message: error?.message || 'Не удалось загрузить', 
      type: 'error' 
    });
  } finally {
    uploading.value = false;
    uploadStatus.value = '';
    input.value = '';
  }
}

async function deleteScan(type: 'current' | 'goal') {
  if (!confirm('Удалить все фотографии? Это действие нельзя отменить.')) return;

  try {
    await evolutionService.deleteScan(type);
    
    if (type === 'current') {
      currentHasData.value = false;
      currentFrames.value = [];
    } else {
      goalHasData.value = false;
      goalFrames.value = [];
    }
    
    appStore.showToast({ title: 'Удалено', message: 'Можете загрузить новые фото', type: 'success' });
  } catch (error: any) {
    appStore.showToast({ title: 'Ошибка', message: error?.message || 'Не удалось удалить', type: 'error' });
  }
}
</script>

<style scoped>
.evolution-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0 1rem;
  padding-bottom: 1rem;
  box-sizing: border-box;
  overflow: hidden;
}

/* Header */
.evolution-header {
  text-align: center;
  padding: 0.5rem 0 0.3rem;
  flex-shrink: 0;
}
.evolution-header h1 {
  font-size: 1.3rem;
  font-weight: 800;
  margin: 0;
}
.evolution-header p {
  font-size: 0.72rem;
  color: var(--color-text-secondary);
  margin: 0.05rem 0 0;
}

/* Tabs */
.evolution-tabs {
  display: flex;
  gap: 8px;
  margin: 0.5rem 0;
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  color: var(--color-text-secondary);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: rgba(255,255,255,0.06);
}

.tab-btn--active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-accent-contrast, black);
}

/* Content - THIS IS THE KEY FIX */
.evolution-content {
  position: relative;
  flex: 1;
  min-height: 0; /* Important for flex children to scroll */
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

.tab-panel {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

/* Upload Zone */
.upload-zone {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 12px;
  background: rgba(255,255,255,0.02);
  border: 2px dashed rgba(255,255,255,0.15);
  border-radius: 20px;
  padding: 32px 24px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 280px;
}

.upload-zone:hover {
  border-color: var(--color-accent);
  background: rgba(0,255,204,0.03);
}

.upload-zone h3 {
  margin: 8px 0 0;
  font-size: 1.1rem;
  font-weight: 700;
}

.upload-zone p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  max-width: 280px;
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 14px 28px;
  background: var(--color-accent);
  color: var(--color-accent-contrast, black);
  border: none;
  border-radius: 14px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.15s;
}

.upload-btn:hover {
  filter: brightness(1.1);
  transform: translateY(-2px);
}

.upload-hint {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: 4px;
}

.hidden-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

/* Viewer container */
.viewer-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 280px;
}

.viewer-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
}

.viewer-placeholder p {
  margin: 0;
  color: var(--color-text-secondary);
}

.frame-count {
  font-size: 0.8rem;
  color: var(--color-accent);
}

.delete-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: rgba(239,68,68,0.1);
  color: #ef4444;
  border: 1px solid rgba(239,68,68,0.2);
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s;
}

.delete-btn:hover {
  background: rgba(239,68,68,0.2);
}

/* Upload overlay */
.upload-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  border-radius: 12px;
}

.upload-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: white;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(255,255,255,0.2);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Info block */
.evolution-info {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 12px;
  flex-shrink: 0;
  margin-top: 0.5rem;
}

.info-text {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

.info-text strong {
  display: block;
  color: var(--color-text-primary);
  margin-bottom: 2px;
}
</style>
