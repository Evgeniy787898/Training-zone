<template>
  <section 
    class="theme-customizer" 
    role="dialog" 
    aria-label="Настройка темы" 
    tabindex="-1"
    @click.stop
  >
    <!-- Header -->
    <header class="theme-customizer__header">
      <div class="theme-customizer__title-row">
        <h2 class="theme-customizer__title">Выберите стиль</h2>
        <button class="theme-customizer__close" @click="$emit('close')" aria-label="Закрыть">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <p class="theme-customizer__subtitle">
        Пресеты меняют все цвета интерфейса, включая градиенты, тени и модальные окна.
      </p>
    </header>

    <div class="theme-customizer__content">
      <div class="presets-grid">
        <button
          v-for="preset in smartPresets"
          :key="preset.name"
          class="preset-card"
          :class="{ 'preset-card--active': isPresetActive(preset) }"
          @click="applyPreset(preset)"
        >
          <div class="preset-card__preview" :style="{ background: preset.colors.background }">
            <!-- Mock UI elements -->
            <div class="preset-mock-nav" :style="{ background: preset.colors.background }"></div>
            <div class="preset-mock-hero">
              <div class="preset-mock-title" :style="{ background: preset.colors.textPrimary }"></div>
              <div class="preset-mock-subtitle" :style="{ background: preset.colors.textSecondary }"></div>
            </div>
            <div class="preset-mock-btn" :style="{ background: preset.colors.accent }"></div>
          </div>
          <div class="preset-card__info">
            <span class="preset-card__name">{{ preset.name }}</span>
            <div class="preset-card__dots">
              <span class="color-dot" :style="{ background: preset.colors.accent }"></span>
              <span class="color-dot" :style="{ background: preset.colors.background }"></span>
            </div>
          </div>
        </button>
      </div>
    </div>

    <!-- Footer -->
    <footer class="theme-customizer__footer">
      <button class="footer-btn" @click="handleReset">
        Сбросить к стандартному
      </button>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();

defineEmits<{
  close: [];
}>();

// Helpers
const hexToRgb = (hex: string) => {
  const normalized = hex.trim().replace('#', '');
  if (normalized.length !== 6) return { r: 0, g: 0, b: 0 };
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return { r, g, b };
};

const rgbToHex = (c: { r: number, g: number, b: number }) => 
  `#${[c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

// Smart Presets
const smartPresets = [
  {
    name: 'Nocturne',
    colors: {
      accent: '#60a5fa',
      background: '#050505',
      textPrimary: '#f4f4f5',
      textSecondary: '#cbd5f5'
    }
  },
  {
    name: 'Deep Ocean',
    colors: {
      accent: '#22d3ee',
      background: '#0f172a',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8'
    }
  },
  {
    name: 'Cyberpunk',
    colors: {
      accent: '#f472b6',
      background: '#18181b',
      textPrimary: '#e4e4e7',
      textSecondary: '#a1a1aa'
    }
  },
  {
    name: 'Forest',
    colors: {
      accent: '#4ade80',
      background: '#022c22',
      textPrimary: '#ecfdf5',
      textSecondary: '#6ee7b7'
    }
  },
  {
    name: 'Sunset',
    colors: {
      accent: '#fb923c',
      background: '#2a1205',
      textPrimary: '#fff7ed',
      textSecondary: '#fdba74'
    }
  },
  {
    name: 'Royal',
    colors: {
      accent: '#c084fc',
      background: '#1e1b4b',
      textPrimary: '#faf5ff',
      textSecondary: '#e9d5ff'
    }
  },
  {
    name: 'Crimson',
    colors: {
      accent: '#f87171',
      background: '#2b0a0a',
      textPrimary: '#fef2f2',
      textSecondary: '#fca5a5'
    }
  },
  {
    name: 'Slate',
    colors: {
      accent: '#94a3b8',
      background: '#0f172a',
      textPrimary: '#f1f5f9',
      textSecondary: '#64748b'
    }
  }
];

const currentPalette = computed(() => appStore.customThemePalette);

const isPresetActive = (preset: typeof smartPresets[0]) => {
  const current = currentPalette.value;
  return (
    rgbToHex(current.accent) === preset.colors.accent &&
    rgbToHex(current.background) === preset.colors.background
  );
};

const applyPreset = (preset: typeof smartPresets[0]) => {
  appStore.setCustomThemePalette({
    accent: hexToRgb(preset.colors.accent),
    background: hexToRgb(preset.colors.background),
    textPrimary: hexToRgb(preset.colors.textPrimary),
    textSecondary: hexToRgb(preset.colors.textSecondary),
  });
};

const handleReset = () => {
  appStore.resetCustomTheme();
};
</script>

<style scoped>
.theme-customizer {
  width: 100%;
  background: var(--color-bg-modal);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--color-border);
  border-bottom-left-radius: 32px;
  border-bottom-right-radius: 32px;
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  max-height: 80vh;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Header */
.theme-customizer__header {
  padding: 1.5rem 1.5rem 1rem;
  border-bottom: 1px solid var(--color-border-subtle);
  position: relative;
}

.theme-customizer__title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  padding-right: 48px; /* Space for close button */
}

.theme-customizer__title {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: -0.02em;
}

.theme-customizer__subtitle {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.5;
  max-width: 90%;
}

.theme-customizer__close {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  width: 40px;
  height: 40px;
  background: transparent;
  border: 2px solid var(--color-border-strong);
  cursor: pointer;
  color: var(--color-text-primary);
  padding: 0;
  border-radius: 50%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-customizer__close:hover {
  border-color: var(--color-text-primary);
  transform: rotate(90deg) scale(1.1);
}

/* Content */
.theme-customizer__content {
  padding: 1.5rem;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* Presets Grid */
.presets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 1rem;
}

.preset-card {
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  transition: all 0.2s;
  cursos: pointer;
  overflow: hidden;
  padding: 0;
  position: relative;
}

.preset-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--color-accent-light);
}

.preset-card--active {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-light);
}

.preset-card__preview {
  height: 90px;
  position: relative;
  width: 100%;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

/* Mock UI */
.preset-mock-nav {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 12px;
  opacity: 0.8;
}

.preset-mock-hero {
  position: absolute;
  top: 24px;
  left: 12px;
  right: 12px;
}

.preset-mock-title {
  width: 60%;
  height: 8px;
  border-radius: 4px;
  margin-bottom: 6px;
}

.preset-mock-subtitle {
  width: 40%;
  height: 6px;
  border-radius: 3px;
  opacity: 0.6;
}

.preset-mock-btn {
  position: absolute;
  bottom: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.preset-card__info {
  padding: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preset-card__name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.preset-card__dots {
  display: flex;
  gap: -4px;
}

.color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.1);
  margin-left: -4px;
}

.color-dot:first-child {
  margin-left: 0;
  z-index: 1;
}

/* Footer */
.theme-customizer__footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--color-border-subtle);
  background: var(--color-bg-secondary);
}

.footer-btn {
  width: 100%;
  padding: 0.75rem;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--color-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.footer-btn:hover {
  background: var(--color-surface-hover);
}
</style>
