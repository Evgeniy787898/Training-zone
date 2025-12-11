<template>
  <div class="evolution-page">
    <!-- Background -->
    <div class="page-bg">
      <div class="page-bg__grid"></div>
      <div class="page-bg__glow page-bg__glow--1"></div>
      <div class="page-bg__glow page-bg__glow--2"></div>
    </div>
    
    <!-- SECTION 1: Current Body / Photos -->
    <section class="section-body relative">
      <header class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold">Текущее положение</h2>
        <button v-if="photos.length > 0" class="text-accent text-sm font-medium" @click="showUpload = true">
          + Добавить
        </button>
      </header>

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>

      <!-- Empty State: Hero Upload -->
      <div v-else-if="photos.length === 0" class="hero-upload" @click="showUpload = true">
        <div class="hero-content text-center">
          <div class="icon-wrapper mb-4 text-6xl">📸</div>
          <h3 class="text-2xl font-bold mb-2">Загрузи первое фото</h3>
          <p class="text-muted mb-6">Начни отслеживать свою эволюцию прямо сейчас. Тело — это храм.</p>
          <BaseButton variant="primary" size="lg">
            Добавить фото
          </BaseButton>
        </div>
      </div>

      <!-- Populated State: Gallery Preview -->
      <div v-else class="photos-gallery">
        <!-- Latest Photo (Hero) -->
        <div v-if="latestPhoto" class="latest-photo-card mb-4" @click="openPhoto(latestPhoto)">
           <div class="photo-badge">Актуальное</div>
           <img :src="latestPhoto.imageUrl" class="w-full h-64 object-cover rounded-xl shadow-lg" loading="lazy" />
           <div class="photo-info mt-2 flex justify-between text-sm">
             <span class="font-medium">{{ formatDate(latestPhoto.capturedAt) }}</span>
             <span v-if="latestPhoto.weightKg" class="text-muted">{{ latestPhoto.weightKg }} кг</span>
           </div>
        </div>

        <!-- Recent Grid (3 items max) -->
        <div v-if="recentPhotos.length > 0" class="recent-grid grid grid-cols-3 gap-2">
           <div v-for="photo in recentPhotos" :key="photo.id" class="mini-photo cursor-pointer" @click="openPhoto(photo)">
              <img :src="photo.imageUrl" class="w-full h-24 object-cover rounded-lg" loading="lazy" />
           </div>
           <div class="view-all-btn flex items-center justify-center bg-surface-secondary rounded-lg h-24 cursor-pointer text-xs text-muted" @click="router.push('/progress-photos')">
             <span>Все фото →</span>
           </div>
        </div>
      </div>
    </section>

    <!-- Divider -->
    <div class="my-8 border-t border-border"></div>

    <!-- SECTION 2: Evolution / 360° View -->
    <section class="section-digital-lab">
      <header class="mb-4">
        <h2 class="text-xl font-bold flex items-center gap-2">
          Эволюция
        </h2>
        <p class="text-muted text-sm">360° просмотр прогресса трансформации тела</p>
      </header>
      
      <!-- Direct Link to Evolution Page -->
      <div class="digital-lab-card" @click="router.push('/evolution')">
        <div class="lab-content">
          <h3 class="font-bold text-lg mb-1">360° просмотр</h3>
          <p class="text-sm text-gray-300 mb-4 opacity-90">Загрузи серию фото и смотри на своё тело со всех сторон</p>
          <button class="lab-btn">Открыть</button>
        </div>
        <div class="lab-visual">
          🔄
        </div>
      </div>
    </section>

    <!-- Modals -->
    <!-- Upload Modal -->
    <div v-if="showUpload" class="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" @click.self="showUpload = false">
      <div class="modal-content bg-background w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
          <button class="absolute top-4 right-4 text-muted text-2xl" @click="showUpload = false">✕</button>
          <h2 class="text-xl font-bold mb-4">Новое фото</h2>
          <ProgressPhotoUpload @uploaded="onUploaded" />
      </div>
    </div>

    <!-- Fullscreen Viewer -->
    <div v-if="viewerPhoto" class="viewer-overlay fixed inset-0 z-[100] bg-black flex flex-col justify-center" @click="viewerPhoto = null">
      <button class="absolute top-4 right-4 text-white text-4xl z-10" @click="viewerPhoto = null">✕</button>
      <img :src="viewerPhoto.imageUrl" class="w-full h-full object-contain" @click.stop />
      <div class="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-md p-6 text-white" @click.stop>
        <div class="text-center mb-2 font-medium">{{ formatDate(viewerPhoto.capturedAt) }}</div>
        <div class="flex justify-center gap-4 text-sm opacity-80">
             <span v-if="viewerPhoto.weightKg">{{ viewerPhoto.weightKg }} кг</span>
             <span v-if="viewerPhoto.bodyFat">{{ viewerPhoto.bodyFat }}% жира</span>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { progressPhotoService, type ProgressPhoto } from '@/services/progressPhotos';
import { bodyScanService, type BodyScanSession } from '@/services/bodyScan';
import BaseButton from '@/components/ui/BaseButton.vue';
import ProgressPhotoUpload from '@/components/progress/ProgressPhotoUpload.vue';

const router = useRouter();
const photos = ref<ProgressPhoto[]>([]);
const latestScan = ref<BodyScanSession | null>(null);
const loading = ref(true);
const showUpload = ref(false);
const viewerPhoto = ref<ProgressPhoto | null>(null);

const latestPhoto = computed(() => photos.value[0] || null);
const recentPhotos = computed(() => photos.value.slice(1, 4));

const loadData = async () => {
  loading.value = true;
  try {
    const [photosRes, scanRes] = await Promise.all([
      progressPhotoService.getPhotos(),
      bodyScanService.getLatest() // Fetch AI analysis
    ]);
    
    photos.value = photosRes.data;
    latestScan.value = scanRes;
    
  } catch (e) {
    console.error('Failed to load evolution data', e);
  } finally {
    loading.value = false;
  }
};

const onUploaded = () => {
  showUpload.value = false;
  loadData();
  
  // Show the latest photo immediately if it was the first one
  if (photos.value.length === 0) {
    // Optimistic or rely on reload
  }
};

const openPhoto = (photo: ProgressPhoto) => {
  viewerPhoto.value = photo;
};

const formatDate = (iso: string) => {
  return new Date(iso).toLocaleDateString('ru-RU', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
};

onMounted(loadData);
</script>

<style scoped>
.evolution-page {
  padding: 16px;
  padding-bottom: 100px;
  max-width: 600px;
  margin: 0 auto;
  position: relative;
}

/* Background */
.page-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}
.page-bg__grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
  background-size: 28px 28px;
}
.page-bg__glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.25;
}
.page-bg__glow--1 { width: 180px; height: 180px; top: -40px; right: -20px; background: var(--color-accent); }
.page-bg__glow--2 { width: 140px; height: 140px; bottom: 25%; left: -30px; background: #a855f7; }

/* Hero Upload State */
.hero-upload {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--color-border);
  border-radius: 24px;
  background: var(--color-surface);
  cursor: pointer;
  transition: all 0.2s ease;
}
.hero-upload:hover {
  border-color: var(--color-accent);
  background: var(--color-bg-secondary);
}

/* Digital Lab Card */
.digital-lab-card {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-subtle);
  border-radius: 20px;
  padding: 24px;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease;
}
.digital-lab-card:active {
  transform: scale(0.98);
}
.digital-lab-card::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(circle at top right, var(--color-accent-subtle), transparent 70%);
}

.lab-btn {
  background: white;
  color: black;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 99px;
  font-size: 0.9rem;
}
.lab-visual {
  position: absolute;
  right: -10px;
  bottom: -10px;
  font-size: 5rem;
  opacity: 0.2;
  transform: rotate(-15deg);
}

.digital-lab-card.ai-active {
  background: radial-gradient(circle at top right, var(--color-accent-subtle), transparent 70%),
              var(--color-bg-elevated);
  border-color: var(--color-accent-subtle);
}

.badge-tag {
  font-size: 0.7rem;
  background: var(--color-accent-subtle);
  color: var(--color-accent);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--color-accent-subtle);
}

/* Photo Badges */
.photo-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
}
</style>


