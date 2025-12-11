<template>
  <div class="evolution-section">
    <div class="evolution-section__header">
      <h2>{{ title }}</h2>
      <p>{{ subtitle }}</p>
    </div>

    <div class="evolution-section__content">
      <!-- Loading state -->
      <template v-if="loading">
        <div class="evolution-section__loading">
          <div class="spinner"></div>
          <span>Загрузка...</span>
        </div>
      </template>

      <!-- Has scan - show viewer -->
      <template v-else-if="hasData">
        <Body360Viewer 
          :frames="frames" 
          :loading="loadingFrames"
          @index-change="onIndexChange"
        />
        <div class="evolution-section__actions">
          <button class="action-btn action-btn--danger" @click="confirmDelete">
            <span>🗑️</span> Удалить и загрузить заново
          </button>
        </div>
      </template>

      <!-- No scan - show uploader -->
      <template v-else>
        <ZipUploader 
          :scan-type="scanType"
          :title="uploadTitle"
          :description="uploadDescription"
          @uploaded="onUploaded"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { evolutionService } from '@/services/evolution';
import { evolution360Cache } from '@/services/evolution360Cache';
import { useAppStore } from '@/stores/app';
import Body360Viewer from './Body360Viewer.vue';
import ZipUploader from './ZipUploader.vue';

const props = defineProps<{
  scanType: 'current' | 'goal';
  title: string;
  subtitle: string;
  uploadTitle?: string;
  uploadDescription?: string;
  profileId?: string;
}>();

const emit = defineEmits<{
  (e: 'dataChange', hasScan: boolean): void;
}>();

const appStore = useAppStore();
const loading = ref(false); // По умолчанию false — сразу показываем uploader
const loadingFrames = ref(false);
const hasData = ref(false);
const frames = ref<string[]>([]);

const effectiveProfileId = computed(() => props.profileId || appStore.profileSummary?.profile?.id || 'unknown');

async function loadData() {
  // По умолчанию показываем uploader (не loading)
  loading.value = false;
  hasData.value = false;
  
  try {
    // Пробуем проверить есть ли данные в кэше или API
    const cached = await evolution360Cache.get(effectiveProfileId.value, props.scanType);
    if (cached && cached.length > 0) {
      frames.value = cached;
      hasData.value = true;
      return;
    }

    // Пробуем API — если ошибка, показываем uploader
    try {
      const hasScan = await evolutionService.hasScan(props.scanType);
      if (hasScan) {
        hasData.value = true;
        loadingFrames.value = true;
        
        const frameUrls = await evolutionService.getFrames(props.scanType);
        frames.value = frameUrls;
        
        await evolution360Cache.set(effectiveProfileId.value, props.scanType, frameUrls);
        loadingFrames.value = false;
      }
    } catch (apiError) {
      // API недоступен — показываем uploader
      console.warn('[EvolutionSection] API unavailable, showing uploader:', apiError);
      hasData.value = false;
    }
  } catch (error) {
    console.error('[EvolutionSection] Error in loadData:', error);
    hasData.value = false;
  } finally {
    loadingFrames.value = false;
  }
}

async function onUploaded() {
  // Clear cache and reload
  await evolution360Cache.clear(effectiveProfileId.value, props.scanType);
  await loadData();
  emit('dataChange', true);
}

async function confirmDelete() {
  if (!confirm('Удалить все загруженные фотографии? Это действие нельзя отменить.')) {
    return;
  }

  try {
    await evolutionService.deleteScan(props.scanType);
    await evolution360Cache.clear(effectiveProfileId.value, props.scanType);
    frames.value = [];
    hasData.value = false;
    emit('dataChange', false);
    appStore.showToast({
      title: 'Удалено',
      type: 'success',
    });
  } catch (error: any) {
    appStore.showToast({
      title: 'Ошибка',
      message: error?.message || 'Не удалось удалить',
      type: 'error',
    });
  }
}

function onIndexChange(index: number) {
  // Could be used for analytics or sync between sections
}

onMounted(loadData);

watch(() => props.scanType, loadData);
</script>

<style scoped>
.evolution-section {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 16px;
  overflow: hidden;
}

.evolution-section__header {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}

.evolution-section__header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text-primary, white);
}

.evolution-section__header p {
  margin: 4px 0 0;
  font-size: 0.8rem;
  color: var(--color-text-muted, rgba(255,255,255,0.5));
}

.evolution-section__content {
  padding: 16px;
}

.evolution-section__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  gap: 12px;
  color: var(--color-text-muted, rgba(255,255,255,0.5));
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border, rgba(255,255,255,0.1));
  border-top-color: var(--color-accent, #00ffcc);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.evolution-section__actions {
  margin-top: 12px;
  display: flex;
  justify-content: center;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--color-border, rgba(255,255,255,0.1));
  background: rgba(255,255,255,0.04);
  color: var(--color-text-secondary, rgba(255,255,255,0.7));
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover {
  background: rgba(255,255,255,0.08);
}

.action-btn--danger {
  background: rgba(239,68,68,0.1);
  border-color: transparent;
  color: #ef4444;
}

.action-btn--danger:hover {
  background: rgba(239,68,68,0.18);
}
</style>
