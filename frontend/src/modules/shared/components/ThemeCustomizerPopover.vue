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

      <!-- Custom Accent Sliders (DS-003) -->
      <div class="accent-section">
        <h3 class="accent-section__title">Свой акцент</h3>
        <div class="accent-sliders">
          <div class="accent-slider">
            <label class="accent-slider__label" for="accent-r">R</label>
            <input
              id="accent-r"
              type="range"
              min="0"
              max="255"
              :value="accentR"
              class="accent-slider__input accent-slider__input--red"
              :style="{ background: redGradient }"
              @input="handleAccentChange('r', $event)"
            />
            <span class="accent-slider__value">{{ accentR }}</span>
          </div>
          <div class="accent-slider">
            <label class="accent-slider__label" for="accent-g">G</label>
            <input
              id="accent-g"
              type="range"
              min="0"
              max="255"
              :value="accentG"
              class="accent-slider__input accent-slider__input--green"
              :style="{ background: greenGradient }"
              @input="handleAccentChange('g', $event)"
            />
            <span class="accent-slider__value">{{ accentG }}</span>
          </div>
          <div class="accent-slider">
            <label class="accent-slider__label" for="accent-b">B</label>
            <input
              id="accent-b"
              type="range"
              min="0"
              max="255"
              :value="accentB"
              class="accent-slider__input accent-slider__input--blue"
              :style="{ background: blueGradient }"
              @input="handleAccentChange('b', $event)"
            />
            <span class="accent-slider__value">{{ accentB }}</span>
          </div>
        </div>
        <div class="accent-preview-row">
          <span class="accent-preview-label">Предпросмотр:</span>
          <div class="accent-preview-swatch" :style="{ background: accentHex }"></div>
          <span class="accent-preview-hex">{{ accentHex }}</span>
        </div>
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
import hapticFeedback from '@/utils/hapticFeedback';

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
    name: 'Тёмная',
    colors: {
      accent: '#60a5fa',
      background: '#050505',
      textPrimary: '#f4f4f5',
      textSecondary: '#cbd5f5'
    }
  },
  {
    name: 'Светлая',
    colors: {
      accent: '#3b82f6',
      background: '#ffffff',
      textPrimary: '#0f172a',
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
  hapticFeedback.selection();
};

const handleReset = () => {
  appStore.resetCustomTheme();
};

// DS-003: RGB Accent Sliders
const accentR = computed(() => currentPalette.value.accent.r);
const accentG = computed(() => currentPalette.value.accent.g);
const accentB = computed(() => currentPalette.value.accent.b);

const accentHex = computed(() => rgbToHex(currentPalette.value.accent));

const handleAccentChange = (channel: 'r' | 'g' | 'b', event: Event) => {
  const target = event.target as HTMLInputElement;
  const value = parseInt(target.value, 10);
  appStore.updateCustomThemeColor('accent', { [channel]: value });
  hapticFeedback.light();
};

const redGradient = computed(() => {
  const { g, b } = currentPalette.value.accent;
  return `linear-gradient(to right, rgb(0, ${g}, ${b}), rgb(255, ${g}, ${b}))`;
});

const greenGradient = computed(() => {
  const { r, b } = currentPalette.value.accent;
  return `linear-gradient(to right, rgb(${r}, 0, ${b}), rgb(${r}, 255, ${b}))`;
});

const blueGradient = computed(() => {
  const { r, g } = currentPalette.value.accent;
  return `linear-gradient(to right, rgb(${r}, ${g}, 0), rgb(${r}, ${g}, 255))`;
});
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

/* DS-003: Accent Sliders */
.accent-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border-subtle);
}

.accent-section__title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 1rem;
}

.accent-sliders {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.accent-slider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.accent-slider__label {
  width: 20px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.accent-slider__input {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  appearance: none;
  background: var(--color-border);
  cursor: pointer;
}

.accent-slider__input::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-accent);
  border: 2px solid var(--color-bg);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: transform 0.15s ease;
}

.accent-slider__input::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.accent-slider__input::-webkit-slider-thumb {
  background: white;
}

.accent-slider__value {
  width: 36px;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.accent-preview-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 0.75rem;
  background: var(--color-bg-secondary);
  border-radius: 12px;
}

.accent-preview-label {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.accent-preview-swatch {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 2px solid var(--color-border);
  flex-shrink: 0;
}

.accent-preview-hex {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary);
  font-family: monospace;
  text-transform: uppercase;
}
</style>
