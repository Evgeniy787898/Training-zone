<template>
  <div class="analytics-strip" :class="{ 'analytics-strip--loading': loading }">
    <!-- Regularity -->
    <div
      class="metric-card"
      :class="{ 'metric-card--flipped': flipped.regularity }"
      @click="toggleFlip('regularity')"
    >
      <div class="metric-inner">
        <!-- Front -->
        <div class="metric-front metric-front--success">
          <div class="metric-ring">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" class="ring-track" />
              <circle
                cx="50"
                cy="50"
                r="42"
                class="ring-progress ring-progress--success"
                :stroke-dasharray="`${adherence * 2.64} 264`"
              />
            </svg>
            <div class="metric-value">
              <span class="metric-number">{{ Math.round(adherence) }}</span>
              <span class="metric-unit">%</span>
            </div>
          </div>
          <span class="metric-title">Регулярность</span>
        </div>
        
        <!-- Back -->
        <div class="metric-back metric-back--success">
          <div class="metric-formula">
            <span class="formula-line">{{ completedSessions }} из {{ totalSessions }}</span>
            <span class="formula-result">= {{ Math.round(adherence) }}%</span>
          </div>
          <span class="metric-hint">за 30 дней</span>
        </div>
      </div>
    </div>

    <!-- Volume -->
    <div
      class="metric-card"
      :class="{ 'metric-card--flipped': flipped.volume }"
      @click="toggleFlip('volume')"
    >
      <div class="metric-inner">
        <!-- Front -->
        <div class="metric-front metric-front--info">
          <div class="metric-ring">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" class="ring-track" />
              <circle
                cx="50"
                cy="50"
                r="42"
                class="ring-progress ring-progress--info"
                :stroke-dasharray="`${volumePercent * 2.64} 264`"
              />
            </svg>
            <div class="metric-value">
              <span class="metric-number metric-number--small">{{ formattedVolume }}</span>
            </div>
          </div>
          <span class="metric-title">Объём</span>
        </div>
        
        <!-- Back -->
        <div class="metric-back metric-back--info">
          <div class="metric-formula">
            <span class="formula-line">{{ formatNumber(totalVolume) }} ÷ {{ periodSessions }}</span>
            <span class="formula-result">= {{ formatNumber(averageVolume) }}</span>
          </div>
          <span class="metric-hint">кг за тренировку</span>
        </div>
      </div>
    </div>

    <!-- Intensity -->
    <div
      class="metric-card"
      :class="{ 'metric-card--flipped': flipped.intensity }"
      @click="toggleFlip('intensity')"
    >
      <div class="metric-inner">
        <!-- Front -->
        <div class="metric-front metric-front--warning">
          <div class="metric-ring">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" class="ring-track" />
              <circle
                cx="50"
                cy="50"
                r="42"
                class="ring-progress ring-progress--warning"
                :stroke-dasharray="`${heavyShare * 2.64} 264`"
              />
            </svg>
            <div class="metric-value">
              <span class="metric-number">{{ Math.round(heavyShare) }}</span>
              <span class="metric-unit">%</span>
            </div>
          </div>
          <span class="metric-title">Интенсивность</span>
        </div>
        
        <!-- Back -->
        <div class="metric-back metric-back--warning">
          <div class="metric-formula">
            <span class="formula-line">RPE 8-10</span>
            <span class="formula-result">= {{ Math.round(heavyShare) }}%</span>
          </div>
          <span class="metric-hint">тяжёлых подходов</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, onUnmounted } from 'vue';

interface Props {
  adherence: number;
  totalSessions?: number;
  completedSessions?: number;
  averageVolume: number;
  totalVolume?: number;
  periodSessions?: number;
  heavyShare: number;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  totalSessions: 0,
  completedSessions: 0,
  totalVolume: 0,
  periodSessions: 0,
  loading: false,
});

const flipped = reactive({
  regularity: false,
  volume: false,
  intensity: false,
});

// Auto-return timers
const timers: Record<string, ReturnType<typeof setTimeout> | null> = {
  regularity: null,
  volume: null,
  intensity: null,
};

const toggleFlip = (key: 'regularity' | 'volume' | 'intensity') => {
  // Clear existing timer
  if (timers[key]) {
    clearTimeout(timers[key]!);
    timers[key] = null;
  }
  
  flipped[key] = !flipped[key];
  
  // Set auto-return after 5 seconds
  if (flipped[key]) {
    timers[key] = setTimeout(() => {
      flipped[key] = false;
      timers[key] = null;
    }, 5000);
  }
};

// Cleanup on unmount
onUnmounted(() => {
  Object.values(timers).forEach(timer => {
    if (timer) clearTimeout(timer);
  });
});

const volumePercent = computed(() => Math.min(props.averageVolume / 50, 100));

const formattedVolume = computed(() => {
  if (props.averageVolume >= 1000) {
    return `${(props.averageVolume / 1000).toFixed(1)}k`;
  }
  return Math.round(props.averageVolume).toString();
});

const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return Math.round(num).toString();
};
</script>

<style scoped>
.analytics-strip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 0.5rem;
  background: var(--color-bg-elevated);
  border-bottom: 1px solid var(--color-border-subtle);
  overflow: hidden;
}

.analytics-strip--loading {
  opacity: 0.5;
}

/* Card */
.metric-card {
  flex: 0 1 100px;
  perspective: 400px;
  cursor: pointer;
}

.metric-inner {
  position: relative;
  width: 100%;
  height: 90px;
  transition: transform 0.5s ease;
  transform-style: preserve-3d;
}

.metric-card--flipped .metric-inner {
  transform: rotateY(180deg);
}

.metric-front,
.metric-back {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.4rem;
}

/* Front */
.metric-front {
  background: var(--color-bg-card);
  border: 1px solid color-mix(in srgb, var(--metric-color) 25%, transparent);
}

.metric-front--success { --metric-color: var(--color-success); }
.metric-front--info { --metric-color: var(--color-info); }
.metric-front--warning { --metric-color: var(--color-warning); }

/* Ring */
.metric-ring {
  position: relative;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
}

.metric-ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-track {
  fill: none;
  stroke: color-mix(in srgb, var(--metric-color) 15%, transparent);
  stroke-width: 6;
}

.ring-progress {
  fill: none;
  stroke-width: 6;
  stroke-linecap: round;
  transition: stroke-dasharray 0.6s ease;
}

.ring-progress--success { stroke: var(--color-success); }
.ring-progress--info { stroke: var(--color-info); }
.ring-progress--warning { stroke: var(--color-warning); }

.metric-value {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.metric-number {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--metric-color);
}

.metric-number--small {
  font-size: 0.95rem;
}

.metric-unit {
  font-size: 0.6rem;
  color: var(--metric-color);
  opacity: 0.7;
}

.metric-title {
  font-size: 0.55rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin-top: 0.2rem;
}

/* Back */
.metric-back {
  transform: rotateY(180deg);
  background: color-mix(in srgb, var(--metric-color) 12%, var(--color-bg-card));
  border: 1px solid color-mix(in srgb, var(--metric-color) 30%, transparent);
}

.metric-back--success { --metric-color: var(--color-success); }
.metric-back--info { --metric-color: var(--color-info); }
.metric-back--warning { --metric-color: var(--color-warning); }

.metric-formula {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
}

.formula-line {
  font-size: 0.65rem;
  color: var(--color-text-secondary);
}

.formula-result {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--metric-color);
}

.metric-hint {
  font-size: 0.5rem;
  color: var(--color-text-tertiary);
  margin-top: 0.25rem;
}
</style>
