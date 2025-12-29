<template>
  <Transition name="music-fade">
    <div v-if="isOpen" class="music-player-overlay" @click.self="handleClose">
      <div class="music-player">
        <header class="music-player__header">
          <h3 class="music-player__title">🎵 Музыка</h3>
          <button class="music-player__close" @click="handleClose">✕</button>
        </header>
        
        <div class="music-player__body">
          <!-- Current track display -->
          <div class="music-player__now-playing" v-if="currentTrack">
            <div class="music-player__cover">
              <div class="music-player__waveform">
                <div 
                  v-for="i in 12" 
                  :key="i" 
                  class="waveform-bar"
                  :class="{ active: isPlaying }"
                  :style="{ animationDelay: `${i * 0.05}s` }"
                />
              </div>
            </div>
            
            <div class="music-player__track-info">
              <span class="music-player__track-name">{{ currentTrack.name }}</span>
              <span class="music-player__track-duration">{{ formatDuration(currentTime) }} / {{ formatDuration(currentTrack.duration || 0) }}</span>
            </div>
            
            <!-- Progress bar -->
            <div class="music-player__progress-container">
              <input
                type="range"
                class="music-player__progress"
                :value="currentTime"
                :max="currentTrack.duration || 0"
                @input="handleSeek"
              />
            </div>
            
            <!-- Controls -->
            <div class="music-player__controls">
              <button class="music-player__ctrl-btn" @click="prevTrack" :disabled="!hasPrev">
                ⏮
              </button>
              <button class="music-player__ctrl-btn music-player__ctrl-btn--play" @click="togglePlay">
                {{ isPlaying ? '❚❚' : '▶' }}
              </button>
              <button class="music-player__ctrl-btn" @click="nextTrack" :disabled="!hasNext">
                ⏭
              </button>
              
              <button 
                class="music-player__mode-btn" 
                :class="{ active: shuffle }"
                @click="toggleShuffle"
              >
                🔀
              </button>
              <button 
                class="music-player__mode-btn"
                :class="{ active: repeat !== 'none' }"
                @click="cycleRepeat"
              >
                {{ repeat === 'one' ? '🔂' : '🔁' }}
              </button>
            </div>
          </div>
          
          <!-- Empty state -->
          <div v-else class="music-player__empty">
            <span class="music-player__empty-icon">🎧</span>
            <p>Пока нет треков</p>
          </div>
          
          <!-- Playlist -->
          <div class="music-player__playlist">
            <div class="music-player__playlist-header">
              <span>Плейлист ({{ tracks.length }})</span>
              <label class="music-player__upload-btn">
                <input 
                  type="file" 
                  accept="audio/mp3,audio/mpeg,audio/wav"
                  @change="handleFileSelect"
                  hidden
                />
                ➕
              </label>
            </div>
            
            <div class="music-player__tracks" v-if="tracks.length > 0">
              <div 
                v-for="(track, idx) in tracks" 
                :key="track.id"
                class="music-player__track-item"
                :class="{ 
                  'music-player__track-item--active': currentTrackIndex === idx,
                  'music-player__track-item--uploading': track.uploading 
                }"
                @click="playTrack(idx)"
              >
                <div class="track-item__info">
                  <span class="track-item__number">{{ idx + 1 }}</span>
                  <span class="track-item__name">{{ track.name }}</span>
                  <span class="track-item__duration">{{ formatDuration(track.duration || 0) }}</span>
                </div>
                
                <div v-if="track.uploading" class="track-item__progress">
                  <div class="track-item__progress-bar" :style="{ width: `${track.uploadProgress || 0}%` }" />
                </div>
                
                <button 
                  v-if="!track.uploading"
                  class="track-item__delete" 
                  @click.stop="deleteTrack(track.id)"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div v-else class="music-player__no-tracks">
              <button class="music-player__add-first-btn" @click="triggerUpload">
                ➕ Добавить музыку
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { hapticLight, hapticSelection } from '@/utils/hapticFeedback';

interface MusicTrack {
  id: string;
  name: string;
  fileName: string;
  storageUrl: string;
  duration?: number;
  uploading?: boolean;
  uploadProgress?: number;
}

interface Props {
  isOpen: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'update:isOpen', value: boolean): void;
  (e: 'playing-change', isPlaying: boolean): void;
}>();

// Close handler for both emit types
const handleClose = () => {
  emit('close');
  emit('update:isOpen', false);
};

// State
const tracks = ref<MusicTrack[]>([]);
const currentTrackIndex = ref(-1);
const isPlaying = ref(false);
const currentTime = ref(0);
const shuffle = ref(false);
const repeat = ref<'none' | 'one' | 'all'>('none');

// Audio element
let audio: HTMLAudioElement | null = null;

// Computed
const currentTrack = computed(() => 
  currentTrackIndex.value >= 0 ? tracks.value[currentTrackIndex.value] : null
);

const hasPrev = computed(() => currentTrackIndex.value > 0 || repeat.value === 'all');
const hasNext = computed(() => currentTrackIndex.value < tracks.value.length - 1 || repeat.value === 'all');

// Format helpers
const formatDuration = (seconds: number): string => {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

// Audio controls
const initAudio = () => {
  if (!audio) {
    audio = new Audio();
    audio.addEventListener('timeupdate', () => {
      currentTime.value = audio?.currentTime || 0;
    });
    audio.addEventListener('ended', handleTrackEnd);
    audio.addEventListener('loadedmetadata', () => {
      if (currentTrack.value && audio) {
        tracks.value[currentTrackIndex.value].duration = audio.duration;
      }
    });
  }
};

const playTrack = (index: number) => {
  if (index < 0 || index >= tracks.value.length) return;
  
  initAudio();
  currentTrackIndex.value = index;
  
  if (audio && currentTrack.value) {
    audio.src = currentTrack.value.storageUrl;
    audio.play().then(() => {
      isPlaying.value = true;
      emit('playing-change', true);
    }).catch(console.error);
  }
  
  hapticLight();
};

const togglePlay = () => {
  if (!audio) return;
  
  if (isPlaying.value) {
    audio.pause();
    isPlaying.value = false;
  } else {
    if (currentTrackIndex.value < 0 && tracks.value.length > 0) {
      playTrack(0);
    } else {
      audio.play().catch(console.error);
      isPlaying.value = true;
    }
  }
  
  emit('playing-change', isPlaying.value);
  hapticLight();
};

const nextTrack = () => {
  let nextIndex = currentTrackIndex.value + 1;
  
  if (shuffle.value) {
    nextIndex = Math.floor(Math.random() * tracks.value.length);
  } else if (nextIndex >= tracks.value.length) {
    nextIndex = repeat.value === 'all' ? 0 : currentTrackIndex.value;
  }
  
  playTrack(nextIndex);
};

const prevTrack = () => {
  let prevIndex = currentTrackIndex.value - 1;
  
  if (prevIndex < 0) {
    prevIndex = repeat.value === 'all' ? tracks.value.length - 1 : 0;
  }
  
  playTrack(prevIndex);
};

const handleTrackEnd = () => {
  if (repeat.value === 'one') {
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(console.error);
    }
  } else {
    nextTrack();
  }
};

const handleSeek = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (audio) {
    audio.currentTime = parseFloat(target.value);
  }
};

const toggleShuffle = () => {
  shuffle.value = !shuffle.value;
  hapticLight();
};

const cycleRepeat = () => {
  const modes: Array<'none' | 'one' | 'all'> = ['none', 'all', 'one'];
  const currentIdx = modes.indexOf(repeat.value);
  repeat.value = modes[(currentIdx + 1) % modes.length];
  hapticLight();
};

// File handling
const handleFileSelect = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  
  const tempId = `temp-${Date.now()}`;
  const newTrack: MusicTrack = {
    id: tempId,
    name: file.name.replace(/\.[^/.]+$/, ''),
    fileName: file.name,
    storageUrl: URL.createObjectURL(file),
    uploading: true,
    uploadProgress: 0
  };
  
  tracks.value.push(newTrack);
  
  // Simulate upload progress
  const interval = setInterval(() => {
    const track = tracks.value.find(t => t.id === tempId);
    if (track && track.uploadProgress !== undefined) {
      track.uploadProgress = Math.min(100, track.uploadProgress + 20);
      if (track.uploadProgress >= 100) {
        track.uploading = false;
        clearInterval(interval);
        hapticSelection();
      }
    }
  }, 300);
  
  // In real implementation: upload to Supabase Storage
  // await supabase.storage.from('training-music').upload(path, file);
  
  input.value = '';
};

const triggerUpload = () => {
  const input = document.querySelector('.music-player__upload-btn input') as HTMLInputElement;
  input?.click();
};

const deleteTrack = (id: string) => {
  const idx = tracks.value.findIndex(t => t.id === id);
  if (idx >= 0) {
    // Revoke object URL if it's a blob
    const track = tracks.value[idx];
    if (track.storageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(track.storageUrl);
    }
    
    tracks.value.splice(idx, 1);
    
    // Adjust current index
    if (currentTrackIndex.value >= tracks.value.length) {
      currentTrackIndex.value = tracks.value.length - 1;
    }
    if (currentTrackIndex.value === idx) {
      if (audio) audio.pause();
      isPlaying.value = false;
    }
    
    hapticLight();
  }
};

// Load saved tracks from localStorage
onMounted(() => {
  const saved = localStorage.getItem('training-music-tracks');
  if (saved) {
    try {
      tracks.value = JSON.parse(saved);
    } catch {}
  }
});

// Save tracks to localStorage
watch(tracks, (newTracks) => {
  const toSave = newTracks.filter(t => !t.uploading);
  localStorage.setItem('training-music-tracks', JSON.stringify(toSave));
}, { deep: true });

onUnmounted(() => {
  if (audio) {
    audio.pause();
    audio = null;
  }
});
</script>

<style scoped>
.music-player-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}

.music-player {
  width: 100%;
  height: 75vh;
  max-height: 85vh;
  background: var(--color-bg-modal, var(--color-bg-elevated));
  border-top-left-radius: 32px;
  border-top-right-radius: 32px;
  border: 1px solid var(--color-border);
  border-bottom: none;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.3);
}

.music-player__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px;
  background: var(--color-bg-modal, var(--color-bg-elevated));
  border-bottom: 1px solid var(--color-border);
  position: relative;
}

.music-player__title {
  font-size: 1.5rem;
  font-weight: 800;
  margin: 0;
  background: linear-gradient(135deg, var(--color-text-primary) 0%, var(--color-text-secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.music-player__close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 48px;
  height: 48px;
  background: transparent;
  border: 2px solid var(--color-border-strong, var(--color-border));
  cursor: pointer;
  color: var(--color-text-primary);
  border-radius: 50%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  z-index: 10;
}

.music-player__close:hover {
  border-color: var(--color-text-primary);
  transform: rotate(90deg) scale(1.1);
}

.music-player__body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* Now playing */
.music-player__now-playing {
  text-align: center;
  margin-bottom: 24px;
}

.music-player__cover {
  width: 120px;
  height: 120px;
  margin: 0 auto 16px;
  background: var(--color-bg-secondary);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.music-player__waveform {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 60px;
}

.waveform-bar {
  width: 4px;
  height: 20px;
  background: var(--color-accent);
  border-radius: 2px;
  opacity: 0.3;
}

.waveform-bar.active {
  animation: waveform 0.6s ease-in-out infinite alternate;
  opacity: 1;
}

@keyframes waveform {
  from { height: 20px; }
  to { height: 50px; }
}

.music-player__track-name {
  display: block;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 4px;
}

.music-player__track-duration {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* Progress */
.music-player__progress-container {
  margin: 16px 0;
}

.music-player__progress {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--color-bg-secondary);
}

.music-player__progress::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-accent);
  cursor: pointer;
}

/* Controls */
.music-player__controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
}

.music-player__ctrl-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: var(--color-bg-secondary);
  font-size: 1.25rem;
  cursor: pointer;
  transition: all 0.2s;
}

.music-player__ctrl-btn--play {
  width: 64px;
  height: 64px;
  background: var(--color-accent);
  font-size: 1.5rem;
}

.music-player__ctrl-btn:disabled {
  opacity: 0.3;
}

.music-player__mode-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: transparent;
  font-size: 1rem;
  cursor: pointer;
  opacity: 0.5;
}

.music-player__mode-btn.active {
  opacity: 1;
  background: var(--color-bg-secondary);
}

/* Playlist */
.music-player__playlist {
  border-top: 1px solid var(--color-border);
  padding-top: 16px;
}

.music-player__playlist-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.music-player__upload-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.music-player__tracks {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.music-player__track-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: var(--color-bg-secondary);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.music-player__track-item--active {
  background: color-mix(in srgb, var(--color-accent) 20%, var(--color-bg-secondary));
  border: 1px solid var(--color-accent);
}

.track-item__info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.track-item__number {
  width: 24px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.75rem;
}

.track-item__name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.875rem;
}

.track-item__duration {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.track-item__delete {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}

.music-player__track-item:hover .track-item__delete {
  opacity: 1;
}

/* Upload progress */
.track-item__progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--color-bg-tertiary);
  border-radius: 0 0 12px 12px;
  overflow: hidden;
}

.track-item__progress-bar {
  height: 100%;
  background: var(--color-accent);
  transition: width 0.3s;
}

/* Empty state */
.music-player__empty {
  text-align: center;
  padding: 40px;
  color: var(--color-text-muted);
}

.music-player__empty-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 8px;
}

.music-player__no-tracks,
.music-player__add-first-btn {
  text-align: center;
}

.music-player__add-first-btn {
  padding: 16px 24px;
  border-radius: 12px;
  border: 2px dashed var(--color-border);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 1rem;
  cursor: pointer;
  width: 100%;
  transition: all 0.2s;
}

.music-player__add-first-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

/* Transitions */
.music-fade-enter-active,
.music-fade-leave-active {
  transition: opacity 0.3s ease;
}

.music-fade-enter-active .music-player,
.music-fade-leave-active .music-player {
  transition: transform 0.3s ease;
}

.music-fade-enter-from,
.music-fade-leave-to {
  opacity: 0;
}

.music-fade-enter-from .music-player,
.music-fade-leave-to .music-player {
  transform: translateY(100%);
}
</style>
