<template>
  <div class="training-program-drawer">
    <!-- Discipline Image Background -->
    <div class="drawer-banner">
      <img 
        v-if="disciplineImage" 
        :src="disciplineImage" 
        :alt="disciplineName"
        class="drawer-banner__image"
      />
      <div class="drawer-banner__gradient" v-else></div>
      
      <div class="drawer-overlay">
        <div class="drawer-overlay__content">
          <h2 class="drawer-discipline-title">{{ disciplineName || 'Направление не выбрано' }}</h2>
          <div class="drawer-program-badge" v-if="programName">
            <span class="drawer-program-badge__label">Программа</span>
            <span class="drawer-program-badge__value">{{ programName }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Compact Analytics Strip -->
    <AnalyticsStrip
      :adherence="adherence"
      :total-sessions="totalSessions"
      :completed-sessions="completedSessions"
      :average-volume="averageVolume"
      :total-volume="totalVolume"
      :period-sessions="periodSessions"
      :heavy-share="heavyShare"
      :loading="analyticsLoading"
    />

    <!-- Content -->
    <div class="drawer-content">
      <!-- Exercises List -->
      <div v-if="exercises.length > 0" class="drawer-exercises">
        <h3 class="drawer-exercises-title">Упражнения программы</h3>
        <div class="exercises-list">
          <div
            v-for="exercise in exercises"
            :key="exercise.exerciseKey"
            class="exercise-item"
          >
            <div class="exercise-item-header">
              <!-- Exercise Image (rotated like icon) -->
              <div 
                class="exercise-item-icon"
                :class="{ 'exercise-item-icon--has-image': exercise.iconUrl }"
              >
                <img 
                  v-if="exercise.iconUrl"
                  :src="exercise.iconUrl"
                  :alt="exercise.title"
                  class="exercise-item-icon__img"
                  loading="lazy"
                />
                <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                  <path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </div>
              <span class="exercise-item-title">{{ exercise.title }}</span>
            </div>
            <!-- Progress Bar for Levels -->
            <div v-if="exercise.progress" class="exercise-progress">
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: `${exercise.progress.percentage}%` }"
                ></div>
              </div>
              <div class="progress-info">
                <span class="progress-text">
                  <span class="progress-current">Уровень {{ exercise.progress.currentLevel }}</span>
                  <span class="progress-separator">/</span>
                  <span class="progress-total">{{ exercise.progress.totalLevels }}</span>
                  <span v-if="exercise.progress.remainingLevels > 0" class="progress-remaining">
                    (осталось {{ exercise.progress.remainingLevels }})
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Placeholder when no program selected -->
      <div v-else class="drawer-empty">
        <p>Выберите программу тренировок через вкладку «Настройки», чтобы увидеть план и прогресс.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import { cachedApiClient as apiClient } from '@/services/cachedApi';
import AnalyticsStrip from './AnalyticsStrip.vue';
import type { VolumeTrendReport, RpeDistributionReport } from '@/types';

interface Exercise {
  exerciseKey: string;
  title: string;
  icon?: string;
  progress?: {
    currentLevel: number;
    totalLevels: number;
    percentage: number;
  };
}

const props = defineProps<{
  disciplineName?: string;
  disciplineImage?: string;
  programName?: string;
  exercises?: Exercise[];
  currentLevels?: Record<string, number>;
}>();

const appStore = useAppStore();
const { profileSummary } = storeToRefs(appStore);

// Analytics data
const volumeData = ref<VolumeTrendReport | null>(null);
const rpeData = ref<RpeDistributionReport | null>(null);
const analyticsLoading = ref(false);

// Computed stats - main values
const adherence = computed(() => profileSummary.value?.adherence?.adherence_percent || 0);
const averageVolume = computed(() => volumeData.value?.summary?.average_volume || 0);
const heavyShare = computed(() => rpeData.value?.summary?.heavy_share || 0);

// Detailed breakdown for calculations display
const totalSessions = computed(() => profileSummary.value?.adherence?.total_sessions || 0);
const completedSessions = computed(() => profileSummary.value?.adherence?.completed_sessions || 0);
const totalVolume = computed(() => volumeData.value?.summary?.total_volume || 0);
const periodSessions = computed(() => volumeData.value?.summary?.period_sessions || 0);

// Fetch analytics on mount
const loadAnalytics = async () => {
  analyticsLoading.value = true;
  try {
    const [volume, rpe] = await Promise.all([
      apiClient.getReport<VolumeTrendReport>('volume_trend', { range: '30d' }).catch(() => null),
      apiClient.getReport<RpeDistributionReport>('rpe_distribution', { range: '30d' }).catch(() => null),
    ]);
    volumeData.value = volume;
    rpeData.value = rpe;
  } catch (e) {
    console.warn('[TrainingProgramDrawer] Failed to load analytics', e);
  } finally {
    analyticsLoading.value = false;
  }
};

onMounted(() => {
  loadAnalytics();
});

const exercises = computed(() => {
  const exercisesList = props.exercises || [];
  const currentLevels = props.currentLevels || {};
  
  // Вычисляем прогресс для каждого упражнения
  return exercisesList.map((exercise: any) => {
    const currentLevel = currentLevels[exercise.exerciseKey] || exercise.initialLevel || 1;
    const maxLevel = exercise.maxLevel || 10;
    const percentage = (currentLevel / maxLevel) * 100;
    const remainingLevels = maxLevel - currentLevel;
    
    return {
      ...exercise,
      progress: {
        currentLevel,
        totalLevels: maxLevel,
        remainingLevels,
        percentage: Math.min(100, Math.max(0, percentage))
      }
    };
  });
});
</script>

<style scoped>
.training-program-drawer {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: var(--panel-surface-base, var(--color-bg-elevated));
  color: var(--color-text-primary);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--color-border);
  animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}



@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.drawer-banner {
  position: relative;
  width: 100%;
  height: 240px;
  overflow: hidden;
  background: var(--color-bg-card);
}

.drawer-banner__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 20%; /* Focus on top part where faces usually are */
  transition: transform 0.5s ease-in-out;
  will-change: transform;
}

.drawer-banner__gradient {
  width: 100%;
  height: 100%;
  background: var(--gradient-accent);
}

.drawer-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 0%, var(--color-bg-elevated) 100%);
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  padding: 2rem;
}

.drawer-overlay__content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 100%;
  width: 100%;
}

.drawer-discipline-title {
  font-family: 'Inter', 'Roboto Flex', 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: clamp(2rem, 6vw, 2.8rem);
  font-weight: 800;
  color: var(--color-text-primary);
  text-align: left;
  margin: 0;
  line-height: 1.1;
  text-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
  letter-spacing: -0.02em;
}

.drawer-program-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--color-surface);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 12px;
  border: 1px solid var(--color-border);
  align-self: flex-start;
  margin-top: 0.25rem;
}

.drawer-program-badge__label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  letter-spacing: 0.05em;
}

.drawer-program-badge__value {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.drawer-content {
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: var(--panel-surface-base, var(--color-bg-elevated));
}

.drawer-exercises {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.drawer-exercises-title {
  font-family: 'Inter', 'Roboto Flex', 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
  padding-left: 0.25rem;
}

.exercises-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.exercise-item {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: 1.25rem 1.5rem;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: none;
  animation: slideInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) backwards;
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.exercise-item:nth-child(1) { animation-delay: 0.05s; }
.exercise-item:nth-child(2) { animation-delay: 0.1s; }
.exercise-item:nth-child(3) { animation-delay: 0.15s; }
.exercise-item:nth-child(4) { animation-delay: 0.2s; }
.exercise-item:nth-child(5) { animation-delay: 0.25s; }
.exercise-item:nth-child(n+6) { animation-delay: 0.3s; }

.exercise-item:hover {
  border-color: var(--color-accent);
  box-shadow: none;
  transform: translateY(-2px);
}

.exercise-item-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.exercise-item-icon {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary);
  border-radius: 16px;
  color: var(--color-accent);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid var(--color-border);
  overflow: hidden;
  transform: rotate(-3deg);
}

/* Icon with image */
.exercise-item-icon--has-image {
  background: var(--color-bg-elevated);
  padding: 0;
}

.exercise-item-icon__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.exercise-item:hover .exercise-item-icon {
  transform: scale(1.08) rotate(3deg);
  border-color: var(--color-accent);
  box-shadow: 0 4px 16px var(--color-accent-light);
}

.exercise-item:hover .exercise-item-icon--has-image .exercise-item-icon__img {
  transform: scale(1.1);
}

.exercise-item:hover .exercise-item-icon:not(.exercise-item-icon--has-image) {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

.exercise-item-title {
  font-family: 'Inter', 'Roboto Flex', 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  flex: 1;
  line-height: 1.35;
}

.exercise-progress {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin-top: 0.25rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--color-bg-secondary);
  border-radius: 999px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-accent) 0%, var(--color-accent-hover) 100%);
  border-radius: 999px;
  transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
  animation: progressGrow 0.6s cubic-bezier(0.4, 0, 0.2, 1) backwards;
  position: relative;
  overflow: hidden;
}

.progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 50%,
    transparent 100%
  );
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@keyframes progressGrow {
  from { width: 0; opacity: 0; }
  to { opacity: 1; }
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-text {
  font-family: 'Inter', 'Roboto Flex', 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.progress-current {
  font-weight: 700;
  color: var(--color-accent);
}

.progress-separator {
  color: var(--color-text-muted);
  opacity: 0.5;
}

.progress-total {
  color: var(--color-text-secondary);
}

.progress-remaining {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-left: 0.25rem;
}

.drawer-empty {
  padding: 3rem 2rem;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 1rem;
  line-height: 1.6;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary);
  border-radius: 24px;
  border: 2px dashed var(--color-border);
}

@media (max-width: 768px) {
  .drawer-banner {
    height: 220px;
  }

  .drawer-discipline-title {
    font-size: 2.2rem;
  }

  .drawer-content {
    padding: 1.25rem;
    gap: 1.25rem;
  }
}

@media (max-width: 480px) {
  .drawer-banner {
    height: 200px;
  }

  .drawer-discipline-title {
    font-size: 1.8rem;
  }
  
  .drawer-overlay {
    padding: 1.5rem;
  }

  .drawer-content {
    padding: 1rem;
    gap: 1rem;
  }
  
  .exercise-item {
    padding: 1rem 1.25rem;
  }
}
</style>
