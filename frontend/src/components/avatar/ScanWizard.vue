<template>
  <div class="scan-wizard">
    <div class="camera-container" v-if="cameraActive">
      <video ref="videoRef" autoplay playsinline muted></video>
      <canvas ref="canvasRef" style="display: none;"></canvas>
      
      <!-- Silhouette Overlay -->
      <div class="silhouette-overlay" :class="currentStep">
        <svg viewBox="0 0 100 200" preserveAspectRatio="none">
           <!-- Generic body outline -->
           <path d="M50 20 Q50 10 60 10 T70 20 L80 50 L90 150 L80 190 L50 190 L20 190 L10 150 L20 50 L30 20 Q40 10 50 10" 
                 fill="none" stroke="rgba(0,255,204,0.5)" stroke-width="2" stroke-dasharray="5,5" />
        </svg>
        <div class="instruction">
            {{ stepInstructions[currentStep].text }}
        </div>
        <div class="scanner-line"></div>
      </div>

      <button class="capture-btn" @click="capturePhoto"></button>
    </div>

    <div v-else class="review-container">
        <div class="preview-grid">
            <div v-for="(file, step) in captures" :key="step" class="preview-item">
                <img :src="getObjectUrl(file)" />
                <span>{{ stepInstructions[step].label }}</span>
            </div>
        </div>
        
        <div class="biometrics-form">
            <h3>Биометрия</h3>
            <div class="form-row">
                <input type="number" v-model.number="biometrics.heightCm" placeholder="Рост (см)" />
                <input type="number" v-model.number="biometrics.weightKg" placeholder="Вес (кг)" />
            </div>
            <div class="form-row">
                <input type="number" v-model.number="biometrics.bodyFat" placeholder="% Жира (опц.)" />
            </div>
        </div>

        <button class="submit-btn" @click="submitSession" :disabled="loading">
            {{ loading ? 'Создание аватара...' : 'Готово' }}
        </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue';

const emit = defineEmits(['completed', 'cancel']);

type Step = 'front' | 'back' | 'left' | 'right';
const steps: Step[] = ['front', 'left', 'back', 'right']; // Rotation order
const currentStepIndex = ref(0);
const currentStep = ref<Step>('front');

const videoRef = ref<HTMLVideoElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const stream = ref<MediaStream | null>(null);

const captures = reactive<Record<Step, File | null>>({
    front: null,
    back: null,
    left: null,
    right: null,
});

const biometrics = reactive({
    heightCm: '',
    weightKg: '',
    bodyFat: '',
});

const cameraActive = ref(true);
const loading = ref(false);

const stepInstructions: Record<Step, { label: string; text: string }> = {
    front: { label: 'Спереди', text: 'Встаньте прямо, руки вдоль туловища' },
    left: { label: 'Слева', text: 'Повернитесь левым боком' },
    back: { label: 'Сзади', text: 'Встаньте спиной, руки чуть в стороны' },
    right: { label: 'Справа', text: 'Повернитесь правым боком' },
};

const startCamera = async () => {
    try {
        stream.value = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment', aspectRatio: 3/4 } 
        });
        if (videoRef.value) {
            videoRef.value.srcObject = stream.value;
        }
    } catch (err) {
        console.error('Camera error', err);
        alert('Не удалось получить доступ к камере');
    }
};

const stopCamera = () => {
    stream.value?.getTracks().forEach(track => track.stop());
    stream.value = null;
};

const capturePhoto = () => {
    if (!videoRef.value || !canvasRef.value) return;

    const video = videoRef.value;
    const canvas = canvasRef.value;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
        if (blob) {
            const file = new File([blob], `${currentStep.value}.jpg`, { type: 'image/jpeg' });
            captures[currentStep.value] = file;
            
            if (currentStepIndex.value < steps.length - 1) {
                currentStepIndex.value++;
                currentStep.value = steps[currentStepIndex.value];
            } else {
                cameraActive.value = false;
                stopCamera();
            }
        }
    }, 'image/jpeg', 0.8);
};

const getObjectUrl = (file: File | null) => {
    return file ? URL.createObjectURL(file) : '';
};

const submitSession = () => {
    if (!captures.front || !captures.back || !captures.left || !captures.right) return;
    
    loading.value = true;
    emit('completed', {
        files: { ...captures },
        biometrics: {
            heightCm: Number(biometrics.heightCm),
            weightKg: Number(biometrics.weightKg),
            bodyFat: Number(biometrics.bodyFat) || undefined
        }
    });
};

onMounted(startCamera);
onUnmounted(stopCamera);
</script>

<style scoped>
.scan-wizard {
    position: fixed;
    inset: 0;
    background: black;
    z-index: 200;
    display: flex;
    flex-direction: column;
}

.camera-container {
    flex: 1;
    position: relative;
    overflow: hidden;
}

video {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.silhouette-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}

.silhouette-overlay svg {
    height: 80%;
    width: auto;
    opacity: 0.6;
}

.instruction {
    position: absolute;
    top: 100px;
    background: rgba(0,0,0,0.6);
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 16px;
    backdrop-filter: blur(4px);
}

.capture-btn {
    position: absolute;
    bottom: 50px;
    left: 50%;
    transform: translateX(-50%);
    width: 80px;
    height: 80px;
    border-radius: 50%;
    border: 4px solid white;
    background: rgba(255,255,255,0.3);
    cursor: pointer;
    pointer-events: auto;
}

.capture-btn:active {
    background: white;
}

.scanner-line {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--color-accent);
    box-shadow: 0 0 15px var(--color-accent), 0 0 30px var(--color-accent);
    opacity: 0.8;
    animation: scan 3s linear infinite;
    z-index: 2;
}

@keyframes scan {
    0% {
        top: 0%;
        opacity: 0;
    }
    10% {
        opacity: 1;
    }
    90% {
        opacity: 1;
    }
    100% {
        top: 100%;
        opacity: 0;
    }
}

.review-container {
    flex: 1;
    padding: 20px;
    background: var(--color-background);
    color: var(--color-text);
    overflow-y: auto;
}

.preview-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 20px;
}

.preview-item {
    position: relative;
    aspect-ratio: 3/4;
}

.preview-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 8px;
}

.preview-item span {
    position: absolute;
    bottom: 4px;
    left: 4px;
    background: rgba(0,0,0,0.6);
    color: white;
    padding: 2px 6px;
    font-size: 12px;
    border-radius: 4px;
}

.biometrics-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.form-row {
    display: flex;
    gap: 12px;
}

input {
    flex: 1;
    padding: 12px;
    background: var(--color-background-soft);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    color: white;
    font-size: 16px;
}

.submit-btn {
    margin-top: 30px;
    width: 100%;
    padding: 16px;
    background: var(--color-accent, #00ffcc);
    color: black;
    border: none;
    border-radius: 12px;
    font-weight: bold;
    font-size: 18px;
    cursor: pointer;
}

.submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>
