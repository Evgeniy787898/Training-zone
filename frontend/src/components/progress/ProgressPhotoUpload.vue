<template>
  <div class="progress-upload">
    <!-- PHOTO-U01: Drag & Drop zone -->
    <div 
      class="upload-area" 
      :class="{ 'has-image': !!previewUrl, 'drag-over': isDragging }"
      @click="triggerFileInput"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
    >
      <img v-if="previewUrl" :src="previewUrl" class="preview-image" alt="Preview" />
      <div v-else class="placeholder">
        <span class="icon">{{ isDragging ? '📥' : '📷' }}</span>
        <span class="text">{{ isDragging ? 'Отпустите для загрузки' : 'Нажмите или перетащите фото' }}</span>
      </div>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="hidden-input"
        @change="handleFileChange"
      />
    </div>

    <div class="form-fields">
      <BaseInput
        v-model="form.note"
        label="Заметка"
        placeholder="Как ощущения?"
      />
      
      <div class="measurements-row">
        <BaseInput
          v-model="form.weightKg"
          label="Вес (кг)"
          type="number"
          placeholder="0.0"
        />
        <BaseInput
          v-model="form.bodyFat"
          label="% Жира"
          type="number"
          placeholder="0.0"
        />
      </div>

      <div class="date-row">
          <label class="date-label">Дата</label>
          <input type="date" v-model="form.capturedAt" class="date-input" />
      </div>

      <BaseButton
        variant="primary"
        :loading="loading"
        :disabled="!selectedFile"
        @click="upload"
        class="submit-btn"
      >
        Сохранить
      </BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import { progressPhotoService } from '@/services/progressPhotos';
import { useAccentColor, ACCENT_PRESETS } from '@/composables/useAccentColor';

const emit = defineEmits(['uploaded']);
const { currentAccent } = useAccentColor();
const accentColor = computed(() => ACCENT_PRESETS[currentAccent.value].primary);

const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const previewUrl = ref<string | null>(null);
const loading = ref(false);
const isDragging = ref(false); // PHOTO-U01: Drag & Drop state

const form = reactive({
  note: '',
  weightKg: '',
  bodyFat: '',
  capturedAt: new Date().toISOString().split('T')[0],
});

const triggerFileInput = () => {
  fileInput.value?.click();
};

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    const file = target.files[0];
    selectedFile.value = file;
    previewUrl.value = URL.createObjectURL(file);
  }
};

// PHOTO-U01: Drag & Drop handlers
const handleDragOver = () => {
  isDragging.value = true;
};

const handleDragLeave = () => {
  isDragging.value = false;
};

const handleDrop = (event: DragEvent) => {
  isDragging.value = false;
  const files = event.dataTransfer?.files;
  if (files && files[0] && files[0].type.startsWith('image/')) {
    selectedFile.value = files[0];
    previewUrl.value = URL.createObjectURL(files[0]);
  }
};

const upload = async () => {
  if (!selectedFile.value) return;

  try {
    loading.value = true;
    await progressPhotoService.uploadPhoto({
      image: selectedFile.value,
      note: form.note,
      weightKg: form.weightKg ? Number(form.weightKg) : undefined,
      bodyFat: form.bodyFat ? Number(form.bodyFat) : undefined,
      capturedAt: new Date(form.capturedAt).toISOString(),
    });
    
    // Reset form
    selectedFile.value = null;
    previewUrl.value = null;
    form.note = '';
    form.weightKg = '';
    form.bodyFat = '';
    
    emit('uploaded');
  } catch (error) {
    console.error('Upload failed', error);
    alert('Не удалось загрузить фото');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.progress-upload {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.upload-area {
  width: 100%;
  aspect-ratio: 3/4;
  background: var(--color-background-soft);
  border: 2px dashed var(--color-border);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  position: relative;
  transition: all 0.2s;
}

.upload-area:hover {
  border-color: v-bind(accentColor);
  background: var(--color-background-mute);
}

/* PHOTO-U01: Drag over visual feedback */
.upload-area.drag-over {
  border-color: v-bind(accentColor);
  border-style: solid;
  background: rgba(59, 130, 246, 0.1);
  transform: scale(1.02);
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.2);
}

.upload-area.has-image {
  border-style: solid;
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--color-text-muted);
}

.icon {
  font-size: 32px;
}

.hidden-input {
  display: none;
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.measurements-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.date-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.date-label {
    font-size: 14px;
    color: var(--color-text-muted); 
}

.date-input {
    background: var(--color-background-soft);
    border: 1px solid var(--color-border);
    padding: 10px;
    border-radius: 8px;
    color: var(--color-text);
    font-size: 16px;
}

.submit-btn {
  margin-top: 8px;
}
</style>
