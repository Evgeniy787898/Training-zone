<template>
  <div 
    class="animated-status-icon" 
    :class="`animated-status-icon--${localStatus}`"
    @click="toggleStatus"
    style="cursor: pointer;"
  >
    <!-- Пульсирующая надпись GO (тренировка) -->
    <div 
      v-if="localStatus === 'training'"
      class="go-text"
    >
      GO
    </div>
    
    <!-- Часы с анимацией (отдых) - минималистичный стиль -->
    <svg 
      v-else-if="localStatus === 'rest'"
      class="animated-status-icon__svg animated-status-icon__svg--rest"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- Циферблат (круг) -->
      <circle 
        class="clock-face"
        cx="24"
        cy="24"
        r="20"
        fill="none"
        stroke="var(--color-text-primary)"
        stroke-width="2"
      />
      
      <!-- Часовые метки (12, 3, 6, 9) -->
      <line x1="24" y1="6" x2="24" y2="8" stroke="var(--color-text-primary)" stroke-width="2" stroke-linecap="round"/>
      <line x1="42" y1="24" x2="40" y2="24" stroke="var(--color-text-primary)" stroke-width="2" stroke-linecap="round"/>
      <line x1="24" y1="42" x2="24" y2="40" stroke="var(--color-text-primary)" stroke-width="2" stroke-linecap="round"/>
      <line x1="6" y1="24" x2="8" y2="24" stroke="var(--color-text-primary)" stroke-width="2" stroke-linecap="round"/>
      
      <!-- Центр часов -->
      <circle cx="24" cy="24" r="2" fill="var(--color-text-primary)"/>
      
      <!-- Часовая стрелка (показывает 3 часа) -->
      <line 
        class="hour-hand"
        x1="24"
        y1="24"
        x2="32"
        y2="24"
        stroke="var(--color-text-primary)"
        stroke-width="2.5"
        stroke-linecap="round"
        transform-origin="24 24"
      />
      
      <!-- Минутная стрелка (показывает 15 минут, движется) -->
      <line 
        class="minute-hand"
        x1="24"
        y1="24"
        x2="24"
        y2="14"
        stroke="var(--color-text-primary)"
        stroke-width="2"
        stroke-linecap="round"
        transform-origin="24 24"
      />
      
      <!-- Zzz - первая буква (маленькая) -->
      <text 
        class="zzz-1"
        x="10"
        y="10"
        font-size="6"
        fill="var(--color-text-primary)"
        font-weight="600"
        font-family="Inter, Arial, sans-serif"
        text-anchor="middle"
      >Z</text>
      
      <!-- Zzz - вторая буква (средняя) -->
      <text 
        class="zzz-2"
        x="38"
        y="12"
        font-size="8"
        fill="var(--color-text-primary)"
        font-weight="600"
        font-family="Inter, Arial, sans-serif"
        text-anchor="middle"
      >Z</text>
      
      <!-- Zzz - третья буква (большая) -->
      <text 
        class="zzz-3"
        x="20"
        y="6"
        font-size="10"
        fill="var(--color-text-primary)"
        font-weight="600"
        font-family="Inter, Arial, sans-serif"
        text-anchor="middle"
      >Z</text>
    </svg>
    
    <!-- По умолчанию - стоящий человечек -->
    <svg 
      v-else
      class="animated-status-icon__svg"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- Голова -->
      <circle 
        class="head-default"
        cx="24"
        cy="10"
        r="5"
        fill="none"
        stroke="var(--color-text-secondary)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      
      <!-- Тело -->
      <path 
        class="body-default"
        d="M 21 15 L 24 28 L 27 15"
        fill="none"
        stroke="var(--color-text-secondary)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      
      <!-- Левая рука -->
      <path 
        class="arm-left-default"
        d="M 21 17 L 15 22"
        fill="none"
        stroke="var(--color-text-secondary)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      
      <!-- Правая рука -->
      <path 
        class="arm-right-default"
        d="M 27 17 L 33 22"
        fill="none"
        stroke="var(--color-text-secondary)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      
      <!-- Левая нога -->
      <path 
        class="leg-left-default"
        d="M 22 28 L 20 38"
        fill="none"
        stroke="var(--color-text-secondary)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      
      <!-- Правая нога -->
      <path 
        class="leg-right-default"
        d="M 26 28 L 28 38"
        fill="none"
        stroke="var(--color-text-secondary)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  status?: 'training' | 'rest' | null;
}>();

// Временное локальное состояние для переключения иконок (для проверки)
const localStatusOverride = ref<'training' | 'rest' | null>(null);

// Используем локальное состояние, если оно задано, иначе берем из props
const localStatus = computed(() => {
  if (localStatusOverride.value !== null) {
    return localStatusOverride.value;
  }
  return props.status;
});

// Функция переключения статуса
const toggleStatus = () => {
  if (localStatusOverride.value === null) {
    // Инициализируем на основе текущего prop или начинаем с 'training'
    localStatusOverride.value = props.status === 'training' ? 'rest' : 'training';
  } else {
    // Переключаем между 'training' и 'rest'
    localStatusOverride.value = localStatusOverride.value === 'training' ? 'rest' : 'training';
  }
};
</script>

<style scoped>
.animated-status-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  position: relative;
}

.animated-status-icon--rest {
  width: 48px;
  height: 48px;
}

.animated-status-icon--training {
  width: 48px;
  height: 48px;
}

.animated-status-icon__svg {
  width: 100%;
  height: 100%;
  display: block;
  margin: 0;
  padding: 0;
}

.animated-status-icon__svg--rest {
  overflow: hidden;
  border-radius: 50%;
  vertical-align: middle;
}

/* ========================================
   ПУЛЬСИРУЮЩАЯ НАДПИСЬ GO (ТРЕНИРОВКА)
   ======================================== */

.go-text {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-family: 'Inter', 'Helvetica Neue', 'Arial', sans-serif;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0;
  color: var(--color-accent);
  text-align: center;
  line-height: 1;
  margin: 0;
  padding: 0;
  animation: pulse-go 3s ease-in-out infinite;
  transform-origin: center center;
  white-space: nowrap;
}

@keyframes pulse-go {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.4);
    opacity: 0.85;
  }
}


/* ========================================
   АНИМАЦИЯ ЧАСОВ (ОТДЫХ)
   ======================================== */

/* Циферблат */
.animated-status-icon--rest .clock-face {
  opacity: 0.9;
}

/* Часовая стрелка - медленное плавное движение */
.animated-status-icon--rest .hour-hand {
  animation: rotate-hour 20s linear infinite;
  transform-origin: 24 24;
}

@keyframes rotate-hour {
  from {
    transform: rotate(90deg);
  }
  to {
    transform: rotate(450deg);
  }
}

/* Минутная стрелка - медленное движение */
.animated-status-icon--rest .minute-hand {
  animation: rotate-minute 4s linear infinite;
  transform-origin: 24 24;
}

@keyframes rotate-minute {
  from {
    transform: rotate(90deg);
  }
  to {
    transform: rotate(450deg);
  }
}

/* Zzz буквы - медленное плавное появление и исчезновение */
.animated-status-icon--rest .zzz-1 {
  animation: float-zzz-elegant 5s ease-in-out infinite;
  animation-delay: 0s;
}

.animated-status-icon--rest .zzz-2 {
  animation: float-zzz-elegant 5s ease-in-out infinite;
  animation-delay: 0.8s;
}

.animated-status-icon--rest .zzz-3 {
  animation: float-zzz-elegant 5s ease-in-out infinite;
  animation-delay: 1.6s;
}

@keyframes float-zzz-elegant {
  0% {
    opacity: 0;
    transform: translateY(4px) translateX(0) scale(0.85);
  }
  25% {
    opacity: 0.8;
    transform: translateY(1px) translateX(0.5px) scale(1);
  }
  50% {
    opacity: 1;
    transform: translateY(-2px) translateX(1px) scale(1.05);
  }
  75% {
    opacity: 0.7;
    transform: translateY(-5px) translateX(1.5px) scale(1.1);
  }
  100% {
    opacity: 0;
    transform: translateY(-8px) translateX(2px) scale(1.15);
  }
}

/* ========================================
   ДЕФОЛТНАЯ ИКОНКА (ЛЕГКОЕ ДЫХАНИЕ)
   ======================================== */

.animated-status-icon:not(.animated-status-icon--training):not(.animated-status-icon--rest) .head-default {
  animation: breathe-default-head 3s ease-in-out infinite;
  transform-origin: 24 10;
}

.animated-status-icon:not(.animated-status-icon--training):not(.animated-status-icon--rest) .body-default {
  animation: breathe-default-body 3s ease-in-out infinite;
  transform-origin: 24 21.5;
  animation-delay: 0.15s;
}

@keyframes breathe-default-head {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(1.03); }
}

@keyframes breathe-default-body {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(1.04); }
}

/* ========================================
   АДАПТИВНОСТЬ
   ======================================== */

@media (max-width: 480px) {
  .animated-status-icon {
    width: 40px;
    height: 40px;
  }
  
  .animated-status-icon--rest,
  .animated-status-icon--training {
    width: 40px;
    height: 40px;
  }
  
  .go-text {
    font-size: 14px;
  }
}

@media (max-width: 360px) {
  .animated-status-icon {
    width: 36px;
    height: 36px;
  }
  
  .animated-status-icon--rest,
  .animated-status-icon--training {
    width: 36px;
    height: 36px;
  }
  
  .go-text {
    font-size: 12px;
  }
}
</style>
