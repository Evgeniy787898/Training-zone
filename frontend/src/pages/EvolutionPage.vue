<template>
  <div 
    class="evolution-page"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <!-- Background (matching Settings page) -->
    <div class="evolution-bg">
      <div class="evolution-bg__grid"></div>
      <div class="evolution-bg__glow evolution-bg__glow--1"></div>
      <div class="evolution-bg__glow evolution-bg__glow--2"></div>
    </div>

    <header class="evolution-header">
      <!-- Delete buttons (left side, icon-only) -->
      <div class="evolution-header__left" v-if="!isInitializing && (currentHasData || goalHasData) && !isFullscreen">
        <button 
          v-if="currentHasData" 
          class="header-action-btn header-action-btn--delete"
          @click="deleteScan('current')"
          title="Удалить &laquo;Сейчас&raquo;"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          <span class="delete-label">С</span>
        </button>
        <button 
          v-if="goalHasData" 
          class="header-action-btn header-action-btn--delete"
          @click="deleteScan('goal')"
          title="Удалить &laquo;Цель&raquo;"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          <span class="delete-label">Ц</span>
        </button>
      </div>
      
      <!-- Centered text (always in center) -->
      <div class="evolution-header__center">
        <h1>Эволюция</h1>
        <p class="evolution-subtitle">Визуализируй свою трансформацию</p>
      </div>
      
      <!-- Action buttons (absolute positioned to the right) -->
      <div class="evolution-header__actions" v-if="!isInitializing && (currentHasData || goalHasData)">
        <!-- Play/Pause auto-rotate button -->
        <button 
          class="header-action-btn"
          :class="{ 'header-action-btn--active': isAutoRotating }"
          @click="toggleAutoRotate"
          :title="isAutoRotating ? 'Остановить автовращение' : 'Запустить автовращение'"
        >
          <svg v-if="!isAutoRotating" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"/>
            <rect x="14" y="4" width="4" height="16"/>
          </svg>
        </button>
        
        <!-- Fullscreen button -->
        <button 
          class="header-action-btn"
          @click="toggleFullscreen"
          :title="isFullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'"
        >
          <svg v-if="!isFullscreen" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
            <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
            <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
            <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
          </svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 14h6v6"/>
            <path d="M20 10h-6V4"/>
            <path d="M14 10l7-7"/>
            <path d="M3 21l7-7"/>
          </svg>
        </button>
      </div>
    </header>

    <main class="evolution-content">
      <!-- Compare Viewer -->
      <div 
        ref="viewerContainerRef"
        class="viewer-container" 
        :class="{ 'viewer-container--fullscreen': isFullscreen, 'viewer-container--dragging': isDragging }"
      >
        <CompareViewer
          :left-frames="currentFrames"
          :right-frames="goalFrames"
          :loading="isInitializing"
          :loading-text="loadingText"
          :is-auto-rotating="isAutoRotating"
          :hide-controls="true"
          @upload-left="triggerUpload('current')"
          @upload-right="triggerUpload('goal')"
        />
        
        <!-- Drag & Drop overlay (D5) -->
        <div v-if="isDragging" class="drop-overlay">
          <div class="drop-content">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span>Отпустите для загрузки ZIP</span>
          </div>
        </div>
      </div>

      <!-- Delete buttons moved to header -->

      <input ref="fileInput" type="file" accept=".zip" class="hidden-input" @change="handleFileSelected" />

      <!-- Progress Overlay -->
      <Transition name="fade">
        <div v-if="uploading" class="progress-overlay">
          <div class="progress-box">
            <div class="progress-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="upload-progress-icon">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            <div class="progress-text">{{ statusDetail }}</div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
            </div>
            <div class="progress-percent">{{ progressDisplay }}</div>
          </div>
        </div>
      </Transition>
    </main>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { evolutionService } from '@/services/evolution';
import { useAppStore } from '@/stores/app';
import CompareViewer from '@/components/evolution/CompareViewer.vue';
import { api } from '@/services/api';
import evolutionCacheService from '@/services/evolutionCacheService';

// Component name for keep-alive to work
defineOptions({
  name: 'EvolutionPage'
});

const appStore = useAppStore();

// State
const currentHasData = ref(false);
const goalHasData = ref(false);
const currentFrames = ref<string[]>([]);
const goalFrames = ref<string[]>([]);
const uploading = ref(false);
const uploadTarget = ref<'current' | 'goal'>('current');
const fileInput = ref<HTMLInputElement | null>(null);
const viewerContainerRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const isFullscreen = ref(false);

// Auto-rotate state (controlled from header)
const isAutoRotating = ref(false);
let autoRotateInterval: ReturnType<typeof setInterval> | null = null;
// compareViewerRef removed - not currently used

// Progress state
const statusDetail = ref('');
const progressPercent = ref(0);
const loadingText = ref('Загрузка данных...');

const progressDisplay = computed(() => {
  if (progressPercent.value >= 100) return '';
  return `${progressPercent.value}%`;
});

const isInitializing = ref(true);

// Fullscreen toggle (D4)
function toggleFullscreen() {
  if (!viewerContainerRef.value) return;
  
  if (!document.fullscreenElement) {
    viewerContainerRef.value.requestFullscreen().then(() => {
      isFullscreen.value = true;
    }).catch(err => {
      console.warn('[Evolution] Fullscreen failed:', err);
    });
  } else {
    document.exitFullscreen();
    isFullscreen.value = false;
  }
}

// Auto-rotate toggle (moved from CompareViewer to header)
// autoRotateIndex removed - not currently used
function toggleAutoRotate() {
  if (isAutoRotating.value) {
    // Stop
    isAutoRotating.value = false;
    if (autoRotateInterval) {
      clearInterval(autoRotateInterval);
      autoRotateInterval = null;
    }
  } else {
    // Start - emit to CompareViewer via exposed method
    isAutoRotating.value = true;
    // We'll control it via CompareViewer's exposed methods
  }
}

// stopAutoRotate function removed - not currently used

// ESC key to exit fullscreen
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isFullscreen.value) {
    document.exitFullscreen();
  }
}

// Fullscreen change listener
function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement;
}

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  document.removeEventListener('keydown', handleKeydown);
});

// Drag & Drop handlers (D5)
function handleDragOver(e: DragEvent) {
  if (e.dataTransfer?.types.includes('Files')) {
    isDragging.value = true;
  }
}

function handleDragLeave(e: DragEvent) {
  // Only set false if leaving the container entirely
  if (!e.relatedTarget || !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
    isDragging.value = false;
  }
}

function handleDrop(e: DragEvent) {
  isDragging.value = false;
  
  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;
  
  const file = files[0];
  if (!file.name.toLowerCase().endsWith('.zip')) {
    appStore.showToast({ 
      title: 'Неверный формат', 
      message: 'Пожалуйста, загрузите ZIP-архив', 
      type: 'error' 
    });
    return;
  }
  
  // Determine which slot to upload to
  if (!currentHasData.value) {
    uploadTarget.value = 'current';
  } else if (!goalHasData.value) {
    uploadTarget.value = 'goal';
  } else {
    // Both have data, ask user
    const target = confirm('Загрузить как "Текущее"?\n\nОК = Текущее\nОтмена = Цель') ? 'current' : 'goal';
    uploadTarget.value = target;
  }
  
  // Process the file
  processZipFile(file);
}

async function loadFramesSecure(scanType: string, filenames: string[]): Promise<string[]> {
  const total = filenames.length;
  let loaded = 0;
  let fromCache = 0;
  let fromNetwork = 0;
  
  const results: (string | null)[] = new Array(total).fill(null);
  
  // Debounced text update (max once every 100ms)
  let lastUpdateTime = 0;
  const updateText = () => {
    const now = Date.now();
    if (now - lastUpdateTime < 100 && loaded < total) return;
    lastUpdateTime = now;
    
    if (fromCache === total) {
      loadingText.value = 'Мгновенная загрузка...';
    } else if (fromCache > 0) {
      loadingText.value = `Из кэша (${loaded}/${total})...`;
    } else {
      loadingText.value = `Загрузка (${loaded}/${total})...`;
    }
  };
  
  // Helper to load single frame
  const loadFrame = async (filenameOrUrl: string, _index: number): Promise<string | null> => {
    try {
      let filename = filenameOrUrl;
      if (filenameOrUrl.includes('http') || filenameOrUrl.includes('/') || filenameOrUrl.includes('%2F')) {
        const match = filenameOrUrl.match(/(\d+\.(png|webp|jpe?g))$/i);
        if (match) {
          filename = match[1];
        } else {
          const decoded = decodeURIComponent(filenameOrUrl);
          const parts = decoded.split(/[\/\\]/);
          filename = parts[parts.length - 1] || filenameOrUrl;
        }
      }
      
      const cacheKey = `${scanType}:${filename}`;
      
      const cachedUrl = await evolutionCacheService.get(cacheKey);
      if (cachedUrl) {
        fromCache++;
        loaded++;
        updateText();
        return cachedUrl;
      }
      
      fromNetwork++;
      const { data } = await api.get(`/evolution/proxy/${scanType}/${filename}`, {
        responseType: 'blob'
      });
      
      const url = await evolutionCacheService.set(cacheKey, data);
      loaded++;
      updateText();
      return url;
    } catch (e) {
      console.error(`[Evolution] Failed to load frame ${filenameOrUrl}`, e);
      loaded++;
      updateText();
      return null;
    }
  };
  
  // Retry wrapper for failed loads (#5)
  const loadFrameWithRetry = async (filenameOrUrl: string, index: number, retries = 2): Promise<string | null> => {
    let url = await loadFrame(filenameOrUrl, index);
    let attempts = 0;
    
    while (url === null && attempts < retries) {
      attempts++;
      console.log(`[Evolution] Retrying frame ${index} (attempt ${attempts}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
      // Reset counters for retry
      loaded--;
      fromNetwork--;
      url = await loadFrame(filenameOrUrl, index);
    }
    
    return url;
  };
  
  updateText();
  
  // P2: Progressive loading - first load every 10th frame for quick preview
  const priorityIndices: number[] = [];
  const remainingIndices: number[] = [];
  
  for (let i = 0; i < total; i++) {
    if (i % 10 === 0 || i === 0) {
      priorityIndices.push(i);
    } else {
      remainingIndices.push(i);
    }
  }
  
  // Load priority frames first (allow user to see something quickly)
  const priorityPromises = priorityIndices.map(async (i) => {
    const url = await loadFrameWithRetry(filenames[i], i);
    results[i] = url;
    return { index: i, url };
  });
  
  await Promise.all(priorityPromises);
  
  // Check if all are from cache - if so, just load everything
  if (fromCache === priorityIndices.length && fromNetwork === 0) {
    // Everything cached, load rest in parallel
    const restPromises = remainingIndices.map(async (i) => {
      const url = await loadFrameWithRetry(filenames[i], i);
      results[i] = url;
    });
    await Promise.all(restPromises);
  } else {
    // Load remaining frames in background (smaller batches to not overwhelm server)
    // Reduced from 20 to 5 to prevent 429 errors from ngrok/backend rate limiting
    const BATCH_SIZE = 5;
    const BATCH_DELAY_MS = 100; // Delay between batches to prevent rate limiting
    
    for (let b = 0; b < remainingIndices.length; b += BATCH_SIZE) {
      const batch = remainingIndices.slice(b, b + BATCH_SIZE);
      await Promise.all(batch.map(async (i) => {
        const url = await loadFrameWithRetry(filenames[i], i);
        results[i] = url;
      }));
      
      // Add small delay between batches to avoid 429
      if (b + BATCH_SIZE < remainingIndices.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }
  }
  
  console.log(`[Evolution] Loaded: ${fromCache} from cache, ${fromNetwork} from network`);
  loadingText.value = 'Готово!';
  
  return results.filter((url): url is string => url !== null);
}

onMounted(async () => {
  try {
    const status = await evolutionService.getStatus();
    currentHasData.value = status.current;
    goalHasData.value = status.goal;
    
    const tasks = [];
    
    if (status.current) {
        tasks.push(async () => {
            const filenames = await evolutionService.getFrames('current');
            currentFrames.value = await loadFramesSecure('current', filenames);
        });
    }
    
    if (status.goal) {
        tasks.push(async () => {
             const filenames = await evolutionService.getFrames('goal');
             goalFrames.value = await loadFramesSecure('goal', filenames);
        });
    }
    
    await Promise.all(tasks.map(t => t()));
  } catch (e) {
    console.log('[Evolution] No data yet or error', e);
  } finally {
    isInitializing.value = false;
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

  if (!file.name.endsWith('.zip')) {
    appStore.showToast({ title: 'Ошибка', message: 'Выберите ZIP-архив', type: 'error' });
    input.value = '';
    return;
  }

  await processZipFile(file);
  input.value = '';
}

async function processZipFile(file: File | Blob) {
  uploading.value = true;
  const scanType = uploadTarget.value;
  progressPercent.value = 0;
  statusDetail.value = 'Загрузка файла...';

  try {
    const result = await evolutionService.uploadZip(scanType, file, (percent) => {
      progressPercent.value = percent;
      if (percent >= 100) {
        statusDetail.value = 'Обработка на сервере...';
      } else {
        statusDetail.value = 'Отправка архива...';
      }
    });
    
    // Update local state only if we have valid data
    if (result && result.frames && Array.isArray(result.frames)) {
      if (scanType === 'current') {
        currentHasData.value = true;
        currentFrames.value = result.frames;
      } else {
        goalHasData.value = true;
        goalFrames.value = result.frames;
      }
      
      appStore.showToast({ 
        title: '✅ Готово!', 
        message: `${result.frameCount} кадров загружено`, 
        type: 'success' 
      });
    } else {
      throw new Error('Сервер не вернул данные');
    }
  } catch (error: any) {
    console.error('[Evolution] Upload failed:', error);
    appStore.showToast({ title: 'Ошибка', message: error?.message || 'Не удалось загрузить', type: 'error' });
  } finally {
    uploading.value = false;
    statusDetail.value = '';
    progressPercent.value = 0;
  }
}

async function deleteScan(type: 'current' | 'goal') {
  if (!confirm('Удалить все фотографии?')) return;
  try {
    await evolutionService.deleteScan(type);
    // Clear cache for this scan type
    await evolutionCacheService.clearByScanType(type);
    if (type === 'current') { currentHasData.value = false; currentFrames.value = []; }
    else { goalHasData.value = false; goalFrames.value = []; }
    appStore.showToast({ title: 'Удалено', message: 'Можете загрузить новые', type: 'success' });
  } catch (error: any) {
    appStore.showToast({ title: 'Ошибка', message: error?.message || 'Не удалось удалить', type: 'error' });
  }
}
</script>

<style scoped>
/* Page Layout - Fixed position like Settings page */
.evolution-page { 
  position: fixed;
  inset: var(--header-height, 60px) 0 calc(var(--footer-height, 64px) + env(safe-area-inset-bottom)) 0;
  display: flex; 
  flex-direction: column; 
  padding: 0 16px 8px; 
  box-sizing: border-box; 
  overflow: hidden;
  background: var(--color-bg);
}

/* Background (matching Settings page) */
.evolution-bg {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -16px;
  right: -16px;
  pointer-events: none;
  overflow: hidden;
}
.evolution-bg__grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
  background-size: 28px 28px;
}
.evolution-bg__glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.25;
}
.evolution-bg__glow--1 { width: 180px; height: 180px; top: -40px; right: -20px; background: var(--color-accent); }
.evolution-bg__glow--2 { width: 140px; height: 140px; bottom: 25%; left: -30px; background: #a855f7; }

/* Header */
.evolution-header { 
  position: relative;
  z-index: 1;
  padding: 0.5rem 0 0.3rem; 
  flex-shrink: 0; 
}
/* Center block - always centered */
.evolution-header__center {
  text-align: center;
}
.evolution-header h1 { 
  font-size: 1.3rem; 
  font-weight: 800; 
  margin: 0;
  color: var(--color-text-primary);
}
.evolution-subtitle { 
  font-size: 0.72rem; 
  color: var(--color-text-secondary); 
  margin: 2px 0 0;
}
/* Buttons - absolute positioned to the left (delete) */
.evolution-header__left {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 6px;
  align-items: center;
}
/* Buttons - absolute positioned to the right (actions) */
.evolution-header__actions {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 8px;
  align-items: center;
}
.header-action-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: none;
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}
.header-action-btn:hover {
  background: var(--color-accent);
  color: white;
  transform: scale(1.05);
}
.header-action-btn:active {
  transform: scale(0.95);
}
.header-action-btn--active {
  background: var(--color-accent);
  color: white;
}
/* Delete button specific styles */
.header-action-btn--delete {
  width: 32px;
  height: 32px;
  position: relative;
}
.header-action-btn--delete:hover {
  background: #ef4444;
  color: white;
}
.delete-label {
  position: absolute;
  bottom: 2px;
  right: 2px;
  font-size: 8px;
  font-weight: 700;
  line-height: 1;
  color: inherit;
}

/* Main Content Area */
.evolution-content { 
  position: relative;
  z-index: 1;
  flex: 1; 
  min-height: 0; 
  display: flex;
  flex-direction: column;
  gap: 4px; /* Reduced for more viewer space */
  overflow: hidden;
}

/* Viewer Container */
.viewer-container { 
  position: relative;
  flex: 1; 
  min-height: 0;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  transition: all 0.3s ease;
}

/* Fullscreen mode */
.viewer-container--fullscreen {
  position: fixed !important;
  inset: 0 !important;
  z-index: 9999 !important;
  border-radius: 0 !important;
  border: none !important;
  background: #000;
}

/* Drag & Drop visual */
.viewer-container--dragging {
  border-color: var(--color-accent);
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
}

/* Fullscreen button (D4) */
.fullscreen-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 25;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.5);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px;
  color: white;
  cursor: pointer;
  opacity: 0.7;
  transition: all 0.2s;
  backdrop-filter: blur(8px);
}

.fullscreen-btn:hover {
  opacity: 1;
  background: rgba(0,0,0,0.7);
  border-color: var(--color-accent);
}

/* Drop overlay (D5) */
.drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(16, 185, 129, 0.15);
  border: 3px dashed var(--color-accent);
  border-radius: 16px;
  backdrop-filter: blur(4px);
}

.drop-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--color-accent);
  font-weight: 600;
  font-size: 1rem;
}

.drop-content svg {
  animation: bounce 1s infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

/* Action Buttons (Delete) */
.action-buttons {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-shrink: 0;
}

.delete-btn { 
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 14px; 
  background: rgba(239,68,68,0.08); 
  color: #ef4444; 
  border: 1px solid rgba(239,68,68,0.15); 
  border-radius: 8px; 
  font-weight: 600; 
  font-size: 0.75rem; 
  cursor: pointer;
  transition: all 0.2s;
}
.delete-btn:hover { 
  background: rgba(239,68,68,0.15);
  border-color: rgba(239,68,68,0.3);
}
.delete-btn svg {
  opacity: 0.8;
}

.hidden-input { position: absolute; opacity: 0; pointer-events: none; }

/* Progress Overlay */
.progress-overlay { 
  position: absolute; 
  inset: 0; 
  background: rgba(10, 10, 15, 0.95); 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  z-index: 100; 
  border-radius: 16px; 
  backdrop-filter: blur(12px);
}
.progress-box { 
  width: 100%; 
  max-width: 280px; 
  padding: 28px 24px; 
  text-align: center;
  background: rgba(255,255,255,0.03);
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.08);
}
.progress-icon {
  margin-bottom: 16px;
}
.upload-progress-icon {
  color: var(--color-accent);
  animation: float 2s ease-in-out infinite;
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
.progress-text { 
  font-size: 0.9rem; 
  color: var(--color-text-secondary); 
  margin-bottom: 16px;
  font-weight: 500;
}
.progress-bar { 
  height: 6px; 
  background: rgba(255,255,255,0.1); 
  border-radius: 6px; 
  overflow: hidden;
}
.progress-fill { 
  height: 100%; 
  background: linear-gradient(90deg, var(--color-accent) 0%, #0d9573 100%);
  border-radius: 6px; 
  transition: width 0.3s ease;
}
.progress-percent { 
  margin-top: 12px; 
  font-size: 1.3rem; 
  font-weight: 700; 
  color: var(--color-accent); 
  min-height: 1.8rem;
}

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
