<template>
  <div 
    class="zip-uploader"
    :class="{ 'zip-uploader--dragging': isDragging, 'zip-uploader--uploading': uploading }"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <!-- Upload progress -->
    <template v-if="uploading">
      <div class="zip-uploader__progress">
        <div class="spinner"></div>
        <span class="status">{{ statusText }}</span>
        <div v-if="progress > 0" class="progress-bar">
          <div class="progress-bar__fill" :style="{ width: `${progress}%` }"></div>
        </div>
      </div>
    </template>

    <!-- Upload zone -->
    <template v-else>
      <div class="zip-uploader__content">
        <span class="icon">{{ isDragging ? '📥' : '📦' }}</span>
        <h3>{{ isDragging ? 'Отпустите для загрузки' : title }}</h3>
        <p>{{ description }}</p>
        <button class="upload-btn" @click="triggerFileInput">
          Выбрать ZIP-архив
        </button>
        <span class="hint">ZIP-архив с кадрами (001.jpg, 002.jpg, ...)</span>
      </div>
      <input 
        ref="fileInputRef"
        type="file"
        accept=".zip,application/zip"
        class="hidden-input"
        @change="onFileSelect"
      />
    </template>

    <!-- Error message -->
    <div v-if="errorMessage" class="zip-uploader__error">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { evolutionService } from '@/services/evolution';
import { useAppStore } from '@/stores/app';

const props = defineProps<{
  scanType: 'current' | 'goal';
  title?: string;
  description?: string;
}>();

const emit = defineEmits<{
  (e: 'uploaded'): void;
  (e: 'error', message: string): void;
}>();

const appStore = useAppStore();
const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const uploading = ref(false);
const progress = ref(0);
const statusText = ref('');
const errorMessage = ref('');

const title = computed(() => props.title || 'Загрузите архив с фотографиями');
const description = computed(() => props.description || 'Перетащите ZIP-файл сюда или нажмите кнопку');

function triggerFileInput() {
  fileInputRef.value?.click();
}

function onDragOver() {
  isDragging.value = true;
}

function onDragLeave() {
  isDragging.value = false;
}

function onDrop(event: DragEvent) {
  isDragging.value = false;
  const files = event.dataTransfer?.files;
  if (files && files[0]) {
    handleFile(files[0]);
  }
}

function onFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    handleFile(target.files[0]);
  }
}

async function handleFile(file: File) {
  // Validate file type
  if (!file.name.endsWith('.zip') && file.type !== 'application/zip') {
    errorMessage.value = 'Пожалуйста, выберите ZIP-архив';
    return;
  }

  // Validate file size (max 100MB)
  const maxSize = 100 * 1024 * 1024;
  if (file.size > maxSize) {
    errorMessage.value = 'Файл слишком большой. Максимум 100 МБ';
    return;
  }

  errorMessage.value = '';
  uploading.value = true;
  progress.value = 0;
  statusText.value = 'Загрузка архива...';

  try {
    await evolutionService.uploadZip(props.scanType, file);
    
    statusText.value = 'Готово!';
    appStore.showToast({
      title: 'Успешно загружено',
      message: '360° просмотр готов',
      type: 'success',
    });
    
    emit('uploaded');
  } catch (error: any) {
    console.error('[ZipUploader] Upload failed:', error);
    const message = error?.response?.data?.message || error?.message || 'Не удалось загрузить архив';
    errorMessage.value = message;
    emit('error', message);
    appStore.showToast({
      title: 'Ошибка загрузки',
      message,
      type: 'error',
    });
  } finally {
    uploading.value = false;
    progress.value = 0;
    statusText.value = '';
    // Reset file input
    if (fileInputRef.value) {
      fileInputRef.value.value = '';
    }
  }
}
</script>

<style scoped>
.zip-uploader {
  position: relative;
  width: 100%;
  min-height: 280px;
  background: rgba(255,255,255,0.02);
  border: 2px dashed var(--color-border, rgba(255,255,255,0.1));
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.zip-uploader--dragging {
  border-color: var(--color-accent, #00ffcc);
  background: rgba(0,255,204,0.05);
}

.zip-uploader--uploading {
  border-style: solid;
  border-color: var(--color-accent, #00ffcc);
}

.zip-uploader__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 24px;
}

.zip-uploader__content .icon {
  font-size: 56px;
  opacity: 0.8;
}

.zip-uploader__content h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text-primary, white);
}

.zip-uploader__content p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-secondary, rgba(255,255,255,0.7));
  max-width: 280px;
}

.upload-btn {
  margin-top: 8px;
  padding: 12px 24px;
  background: var(--color-accent, #00ffcc);
  color: var(--color-accent-contrast, black);
  border: none;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.15s;
}

.upload-btn:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.upload-btn:active {
  transform: scale(0.98);
}

.hint {
  font-size: 0.75rem;
  color: var(--color-text-muted, rgba(255,255,255,0.4));
}

.hidden-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.zip-uploader__progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--color-border, rgba(255,255,255,0.1));
  border-top-color: var(--color-accent, #00ffcc);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status {
  font-size: 0.9rem;
  color: var(--color-text-secondary, rgba(255,255,255,0.7));
}

.progress-bar {
  width: 200px;
  height: 4px;
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar__fill {
  height: 100%;
  background: var(--color-accent, #00ffcc);
  transition: width 0.3s ease;
}

.zip-uploader__error {
  position: absolute;
  bottom: 16px;
  left: 16px;
  right: 16px;
  background: rgba(239,68,68,0.15);
  color: #ef4444;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 0.85rem;
  text-align: center;
}
</style>
