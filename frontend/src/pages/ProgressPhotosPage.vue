<template>
  <div class="page progress-photos-page">
    <!-- Background -->
    <div class="page-bg">
      <div class="page-bg__grid"></div>
      <div class="page-bg__glow page-bg__glow--1"></div>
      <div class="page-bg__glow page-bg__glow--2"></div>
    </div>
    <header class="header">
      <h1 class="title">Фото прогресса</h1>
      <div class="actions">
        <BaseButton variant="secondary" size="sm" @click="navigateToDigitalLab">
          Digital Lab 🧪
        </BaseButton>
        <BaseButton variant="primary" size="sm" @click="showUpload = true">
          + Добавить
        </BaseButton>
      </div>
    </header>

    <div v-if="loading" class="loading">
      Загрузка...
    </div>

    <div v-else-if="photos.length === 0" class="empty-state">
      <p>Нет фотографий. Сделайте первое фото!</p>
    </div>

    <div v-else class="photos-grid">
      <div v-for="photo in photos" :key="photo.id" class="photo-card" @click="openPhoto(photo)">
        <div class="image-wrapper">
          <img :src="photo.imageUrl" loading="lazy" />
          <div class="photo-meta">
            <span class="date">{{ formatDate(photo.capturedAt) }}</span>
            <span v-if="photo.weightKg" class="weight">{{ photo.weightKg }} кг</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Upload Modal Overlay -->
    <div v-if="showUpload" class="modal-overlay" @click.self="showUpload = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Новое фото</h2>
          <button class="close-btn" @click="showUpload = false">✕</button>
        </div>
        <ProgressPhotoUpload @uploaded="onUploaded" />
      </div>
    </div>

    <!-- Fullscreen Viewer -->
    <div v-if="viewerPhoto" class="viewer-overlay" @click="viewerPhoto = null">
      <div class="viewer-content" @click.stop>
        <img :src="viewerPhoto.imageUrl" />
        <div class="viewer-info">
          <div class="viewer-date">{{ formatDate(viewerPhoto.capturedAt) }}</div>
          <div v-if="viewerPhoto.note" class="viewer-note">{{ viewerPhoto.note }}</div>
          <div class="viewer-stats">
             <span v-if="viewerPhoto.weightKg">Вес: {{ viewerPhoto.weightKg }} кг</span>
             <span v-if="viewerPhoto.bodyFat">Жир: {{ viewerPhoto.bodyFat }}%</span>
          </div>
          <button class="delete-btn" @click="deletePhoto(viewerPhoto.id)">Удалить</button>
        </div>
        <button class="close-viewer" @click="viewerPhoto = null">✕</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { progressPhotoService, ProgressPhoto } from '@/services/progressPhotos';
import BaseButton from '@/components/ui/BaseButton.vue';
import ProgressPhotoUpload from '@/components/progress/ProgressPhotoUpload.vue';

const router = useRouter();

const navigateToDigitalLab = () => {
  router.push('/digital-lab');
};

const photos = ref<ProgressPhoto[]>([]);
const loading = ref(true);
const showUpload = ref(false);
const viewerPhoto = ref<ProgressPhoto | null>(null);

const loadPhotos = async () => {
  loading.value = true;
  try {
    const res = await progressPhotoService.getPhotos();
    photos.value = res.data;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
};

const onUploaded = () => {
  showUpload.value = false;
  loadPhotos();
};

const formatDate = (iso: string) => {
  return new Date(iso).toLocaleDateString();
};

const openPhoto = (photo: ProgressPhoto) => {
  viewerPhoto.value = photo;
};

const deletePhoto = async (id: string) => {
  if (!confirm('Удалить фото?')) return;
  try {
    await progressPhotoService.deletePhoto(id);
    viewerPhoto.value = null;
    loadPhotos();
  } catch (e) {
    alert('Ошибка удаления');
  }
};

onMounted(loadPhotos);
</script>

<style scoped>
.page {
  padding: 16px;
  padding-bottom: 80px; /* Tab bar space */
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

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.actions {
  display: flex;
  gap: 8px;
}

.title {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.photos-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px; /* Instagram style */
}

@media (min-width: 600px) {
    .photos-grid {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 10px;
    }
}

.photo-card {
  aspect-ratio: 1;
  position: relative;
  cursor: pointer;
}

.image-wrapper {
  width: 100%;
  height: 100%;
}

.image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-meta {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 4px;
    background: linear-gradient(transparent, rgba(0,0,0,0.7));
    color: white;
    font-size: 10px;
    display: flex;
    justify-content: space-between;
}

/* Modal Overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.modal-content {
  background: var(--color-bg-modal);
  width: 100%;
  max-width: 400px;
  border-radius: 16px;
  padding: 20px;
  box-shadow: var(--shadow-xl);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.close-btn {
    background: none;
    border: none;
    font-size: 24px;
    color: var(--color-text-muted);
    cursor: pointer;
}

/* Viewer */
.viewer-overlay {
    position: fixed;
    inset: 0;
    background: black;
    z-index: 200;
    display: flex;
    justify-content: center;
    align-items: center;
}

.viewer-content {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
}

.viewer-content img {
    flex: 1;
    object-fit: contain;
    width: 100%;
    height: 100%;
}

.viewer-info {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0,0,0,0.6);
    color: white;
    padding: 20px;
    backdrop-filter: blur(10px);
}

.close-viewer {
    position: absolute;
    top: 20px;
    right: 20px;
    background: rgba(0,0,0,0.5);
    color: white;
    border: none;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    font-size: 20px;
    cursor: pointer;
}


.delete-btn {
    background: rgba(239, 65, 70, 0.1);
    color: var(--color-danger);
    border: 1px solid var(--color-danger);
    padding: 8px 16px;
    border-radius: 8px;
    margin-top: 10px;
    width: 100%;
    cursor: pointer;
    transition: background-color 0.2s;
}

.delete-btn:hover {
    background: rgba(239, 65, 70, 0.2);
}

.viewer-stats {
    display: flex;
    gap: 16px;
    margin-top: 8px;
    font-weight: bold;
}
</style>
