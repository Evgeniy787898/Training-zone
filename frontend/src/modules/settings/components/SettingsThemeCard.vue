<template>
  <BaseCard class="settings-card settings-card--theme">
    <template #header>
      <div class="surface-card__header--split">
        <div class="surface-card__title">
          <NeonIcon name="palette" variant="violet" :size="26" class="settings-card__title-icon" />
          <span>Оформление</span>
        </div>
      </div>
    </template>

    <div class="theme-settings">
      <!-- Theme Toggle -->
      <div class="theme-toggle">
        <label class="theme-toggle__label">Тема</label>
        <div class="theme-toggle__options">
          <button
            type="button"
            class="theme-toggle__btn"
            :class="{ 'theme-toggle__btn--active': currentTheme === 'light' }"
            @click="setTheme('light')"
          >
            <NeonIcon name="sun" :size="18" />
            <span>Светлая</span>
          </button>
          <button
            type="button"
            class="theme-toggle__btn"
            :class="{ 'theme-toggle__btn--active': currentTheme === 'dark' }"
            @click="setTheme('dark')"
          >
            <NeonIcon name="moon" :size="18" />
            <span>Тёмная</span>
          </button>
        </div>
      </div>

      <!-- Accent Color -->
      <div class="accent-color">
        <label class="accent-color__label">Акцентный цвет</label>
        
        <!-- Color Preview -->
        <div 
          class="accent-color__preview"
          :style="{ backgroundColor: accentHex }"
        >
          <span class="accent-color__hex">{{ accentHex }}</span>
        </div>

        <!-- RGB Sliders -->
        <div class="accent-color__sliders">
          <div class="accent-slider">
            <label class="accent-slider__label">R</label>
            <input
              type="range"
              min="0"
              max="255"
              :value="accentRgb.r"
              class="accent-slider__input accent-slider__input--red"
              @input="updateChannel('r', $event)"
            />
            <span class="accent-slider__value">{{ accentRgb.r }}</span>
          </div>
          <div class="accent-slider">
            <label class="accent-slider__label">G</label>
            <input
              type="range"
              min="0"
              max="255"
              :value="accentRgb.g"
              class="accent-slider__input accent-slider__input--green"
              @input="updateChannel('g', $event)"
            />
            <span class="accent-slider__value">{{ accentRgb.g }}</span>
          </div>
          <div class="accent-slider">
            <label class="accent-slider__label">B</label>
            <input
              type="range"
              min="0"
              max="255"
              :value="accentRgb.b"
              class="accent-slider__input accent-slider__input--blue"
              @input="updateChannel('b', $event)"
            />
            <span class="accent-slider__value">{{ accentRgb.b }}</span>
          </div>
        </div>

        <!-- Preset Colors -->
        <div class="accent-color__presets">
          <button
            v-for="preset in presets"
            :key="preset.name"
            type="button"
            class="accent-preset"
            :class="{ 'accent-preset--active': isPresetActive(preset) }"
            :style="{ backgroundColor: preset.hex }"
            :title="preset.name"
            @click="applyPreset(preset)"
          />
        </div>
      </div>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface ColorPreset {
  name: string;
  hex: string;
  rgb: RgbColor;
}

const STORAGE_KEY_THEME = 'tzona-theme';
const STORAGE_KEY_ACCENT = 'tzona-accent-rgb';

// Theme state
const currentTheme = ref<'light' | 'dark'>('dark');

// Accent color state
const accentRgb = ref<RgbColor>({ r: 16, g: 163, b: 127 }); // Default emerald

// Presets with RGB values
const presets: ColorPreset[] = [
  { name: 'Изумруд', hex: '#10a37f', rgb: { r: 16, g: 163, b: 127 } },
  { name: 'Фиолетовый', hex: '#8b5cf6', rgb: { r: 139, g: 92, b: 246 } },
  { name: 'Янтарь', hex: '#f59e0b', rgb: { r: 245, g: 158, b: 11 } },
  { name: 'Роза', hex: '#f43f5e', rgb: { r: 244, g: 63, b: 94 } },
  { name: 'Бирюза', hex: '#06b6d4', rgb: { r: 6, g: 182, b: 212 } },
];

// Computed hex value
const accentHex = computed(() => {
  const { r, g, b } = accentRgb.value;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
});

// Check if current color matches a preset
const isPresetActive = (preset: ColorPreset) => {
  const { r, g, b } = accentRgb.value;
  return r === preset.rgb.r && g === preset.rgb.g && b === preset.rgb.b;
};

// Apply theme to DOM
const applyTheme = (theme: 'light' | 'dark') => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY_THEME, theme);
};

// Apply accent to DOM
const applyAccent = (rgb: RgbColor) => {
  const root = document.documentElement;
  const hex = `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`;
  
  // Calculate hover (slightly darker)
  const hoverRgb = {
    r: Math.max(0, rgb.r - 20),
    g: Math.max(0, rgb.g - 20),
    b: Math.max(0, rgb.b - 20),
  };
  const hoverHex = `#${hoverRgb.r.toString(16).padStart(2, '0')}${hoverRgb.g.toString(16).padStart(2, '0')}${hoverRgb.b.toString(16).padStart(2, '0')}`;
  
  root.style.setProperty('--color-accent', hex);
  root.style.setProperty('--color-accent-hover', hoverHex);
  root.style.setProperty('--color-accent-subtle', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`);
  root.style.setProperty('--color-success', hex);
  
  localStorage.setItem(STORAGE_KEY_ACCENT, JSON.stringify(rgb));
};

// Set theme
const setTheme = (theme: 'light' | 'dark') => {
  currentTheme.value = theme;
  applyTheme(theme);
};

// Update single channel
const updateChannel = (channel: 'r' | 'g' | 'b', event: Event) => {
  const value = parseInt((event.target as HTMLInputElement).value, 10);
  accentRgb.value = { ...accentRgb.value, [channel]: value };
};

// Apply preset
const applyPreset = (preset: ColorPreset) => {
  accentRgb.value = { ...preset.rgb };
};

// Watch accent changes
watch(accentRgb, (newVal) => {
  applyAccent(newVal);
}, { deep: true });

// Load saved values on mount
onMounted(() => {
  // Load theme
  const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
  if (savedTheme === 'light' || savedTheme === 'dark') {
    currentTheme.value = savedTheme;
  } else {
    // Detect system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    currentTheme.value = prefersDark ? 'dark' : 'light';
  }
  applyTheme(currentTheme.value);

  // Load accent
  try {
    const savedAccent = localStorage.getItem(STORAGE_KEY_ACCENT);
    if (savedAccent) {
      const parsed = JSON.parse(savedAccent);
      if (typeof parsed.r === 'number' && typeof parsed.g === 'number' && typeof parsed.b === 'number') {
        accentRgb.value = parsed;
      }
    }
  } catch {
    // Use default
  }
  applyAccent(accentRgb.value);
});
</script>

<style scoped>
.theme-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg, 1.5rem);
}

/* Theme Toggle */
.theme-toggle {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm, 0.75rem);
}

.theme-toggle__label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.theme-toggle__options {
  display: flex;
  gap: var(--space-xs, 0.5rem);
}

.theme-toggle__btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs, 0.5rem);
  padding: var(--space-sm, 0.75rem) var(--space-md, 1rem);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md, 12px);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-toggle__btn:hover {
  border-color: var(--color-accent);
  color: var(--color-text-primary);
}

.theme-toggle__btn--active {
  border-color: var(--color-accent);
  background: var(--color-accent-subtle);
  color: var(--color-accent);
}

/* Accent Color */
.accent-color {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm, 0.75rem);
}

.accent-color__label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.accent-color__preview {
  height: 48px;
  border-radius: var(--radius-md, 12px);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.accent-color__hex {
  font-size: 0.75rem;
  font-weight: 600;
  color: #fff;
  text-transform: uppercase;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* RGB Sliders */
.accent-color__sliders {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm, 0.75rem);
}

.accent-slider {
  display: grid;
  grid-template-columns: 24px 1fr 40px;
  align-items: center;
  gap: var(--space-sm, 0.75rem);
}

.accent-slider__label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text-muted);
}

.accent-slider__input {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  appearance: none;
  background: var(--color-bg-tertiary);
  cursor: pointer;
}

.accent-slider__input::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-accent);
  border: 2px solid var(--color-bg);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  cursor: grab;
}

.accent-slider__input--red::-webkit-slider-thumb {
  background: #ef4444;
}

.accent-slider__input--green::-webkit-slider-thumb {
  background: #22c55e;
}

.accent-slider__input--blue::-webkit-slider-thumb {
  background: #3b82f6;
}

.accent-slider__value {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-align: right;
}

/* Preset Colors */
.accent-color__presets {
  display: flex;
  gap: var(--space-sm, 0.75rem);
  margin-top: var(--space-xs, 0.5rem);
}

.accent-preset {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.accent-preset:hover {
  transform: scale(1.1);
}

.accent-preset--active {
  border-color: var(--color-text-primary);
  box-shadow: 0 0 0 3px var(--color-bg), 0 0 0 5px var(--color-accent);
}
</style>
