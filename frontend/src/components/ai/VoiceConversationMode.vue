<script setup lang="ts">
/**
 * ChatGPT-Style Advanced Voice Mode (GPT-VOICE-001 to GPT-VOICE-020)
 *
 * Premium voice conversation interface with:
 * - Real-time streaming TTS via WebSocket
 * - Interruption support (user can talk over AI)
 * - Voice Activity Detection (VAD)
 * - Pulsing orb animation
 * - Emotion-aware voice modulation
 * - Ultra-low latency (<500ms)
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import LiquidOrb from './LiquidOrb.vue';
import { api } from '@/services/api';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'send-message', message: string): void;
}>();

// ==========================================
// STATE
// ==========================================

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted' | 'error';

const state = ref<VoiceState>('idle');
const currentTranscript = ref('');
const aiTranscript = ref('');
const errorMessage = ref('');
const connectionStatus = ref<'disconnected' | 'connecting' | 'connected'>('disconnected');
const isCallActive = ref(false);

// Microphone permission state
const micPermission = ref<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
const showPermissionPrompt = ref(false);

// Canvas for liquid blob
const liquidCanvas = ref<HTMLCanvasElement | null>(null);
let liquidAnimationId: number | null = null;

// Audio visualization
const audioLevel = ref(0);
const orbScale = ref(1);
const orbGlow = ref(0);

// Voice settings (reserved for future use)
// const voiceSpeed = ref(1.0);
// const voiceEmotion = ref<'neutral' | 'enthusiastic' | 'calm' | 'serious'>('neutral');

// Conversation history for context
const conversationHistory = ref<Array<{
  role: 'user' | 'assistant';
  content: string;
  emotion?: string;
  timestamp: Date;
}>>([]);

// Audio context and nodes
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let mediaStream: MediaStream | null = null;
let recognition: any = null; // SpeechRecognition - fallback

// MediaRecorder for Whisper transcription (primary method)
let mediaRecorder: MediaRecorder | null = null;
let recorderStream: MediaStream | null = null; // Separate stream for recorder
let audioChunks: Blob[] = [];
let isRecording = ref(false);
let recordingTimer: ReturnType<typeof setInterval> | null = null;
const RECORDING_CHUNK_DURATION = 5000; // 5 seconds for better quality/context

// Web Audio API fallback for raw audio capture (bypasses MediaRecorder)
let scriptProcessor: ScriptProcessorNode | null = null;
let pcmBuffers: Float32Array[] = [];
const SAMPLE_RATE = 16000; // Whisper prefers 16kHz

// Timers and animation
let animationFrameId: number | null = null;
let silenceTimer: ReturnType<typeof setTimeout> | null = null;
const SILENCE_TIMEOUT = 1500; // ms of silence before auto-sending

// ==========================================
// COMPUTED
// ==========================================

const stateLabel = computed(() => {
  switch (state.value) {
    case 'listening': return 'Слушаю...';
    case 'thinking': return 'Думаю...';
    case 'speaking': return 'Говорю...';
    case 'interrupted': return 'Прерван';
    case 'error': return errorMessage.value || 'Ошибка';
    default: return 'Нажми для начала';
  }
});

// Unused after ChatGPT redesign - kept for future reference
// const stateColor = computed(() => {
//   switch (state.value) {
//     case 'listening': return 'var(--voice-color-listening, #22c55e)';
//     case 'thinking': return 'var(--voice-color-thinking, #f59e0b)';
//     case 'speaking': return 'var(--voice-color-speaking, #8b5cf6)';
//     case 'interrupted': return 'var(--voice-color-interrupted, #f97316)';
//     case 'error': return 'var(--voice-color-error, #ef4444)';
//     default: return 'var(--color-accent)';
//   }
// });

// const isActive = computed(() => 
//   ['listening', 'thinking', 'speaking', 'interrupted'].includes(state.value)
// );

// ==========================================
// MICROPHONE PERMISSION HANDLING
// ==========================================

// Detect if running inside Telegram WebApp
function isTelegramWebApp(): boolean {
  return !!(window as any).Telegram?.WebApp;
}

// Check current microphone permission status
async function checkMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt'> {
  console.log('[VoiceMode] Checking microphone permission...');
  
  try {
    // Try using Permissions API (modern browsers)
    if (navigator.permissions) {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      console.log('[VoiceMode] Permissions API result:', result.state);
      micPermission.value = result.state as 'granted' | 'denied' | 'prompt';
      return result.state as 'granted' | 'denied' | 'prompt';
    }
  } catch (e) {
    console.log('[VoiceMode] Permissions API not available, will try getUserMedia directly');
  }
  
  // Fallback: assume prompt is needed
  micPermission.value = 'prompt';
  return 'prompt';
}

// Request microphone permission explicitly
async function requestMicrophonePermission(): Promise<boolean> {
  console.log('[VoiceMode] Requesting microphone permission...');
  
  // For Telegram WebApp, try using their API first
  if (isTelegramWebApp()) {
    const tg = (window as any).Telegram.WebApp;
    console.log('[VoiceMode] Telegram WebApp detected');
    
    // Telegram WebApp 6.9+ has requestWriteAccess, but for microphone we need getUserMedia
    // Show a popup explaining we need permission
    if (tg.showPopup) {
      await new Promise<void>((resolve) => {
        tg.showPopup({
          title: 'Доступ к микрофону',
          message: 'Для голосового режима нужен доступ к микрофону. Нажмите "Разрешить" в следующем запросе браузера.',
          buttons: [{ type: 'ok', text: 'Понятно' }]
        }, () => resolve());
      });
    }
  }
  
  try {
    // Request actual media access - this triggers the browser permission prompt
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      } 
    });
    
    // Permission granted! Stop the stream for now, we'll create a new one later
    stream.getTracks().forEach(track => track.stop());
    
    console.log('[VoiceMode] Microphone permission granted!');
    micPermission.value = 'granted';
    showPermissionPrompt.value = false;
    return true;
    
  } catch (err: any) {
    console.error('[VoiceMode] Microphone permission denied:', err);
    
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      micPermission.value = 'denied';
      errorMessage.value = 'Доступ к микрофону запрещён. Пожалуйста, разрешите в настройках браузера.';
      
      // Show instruction for Telegram users
      if (isTelegramWebApp()) {
        const tg = (window as any).Telegram.WebApp;
        if (tg.showPopup) {
          tg.showPopup({
            title: 'Микрофон заблокирован',
            message: 'Разрешите доступ к микрофону в настройках браузера, затем попробуйте снова.',
            buttons: [{ type: 'ok' }]
          });
        }
      }
    } else {
      errorMessage.value = 'Ошибка доступа к микрофону: ' + (err.message || err.name);
    }
    
    return false;
  }
}

// ==========================================
// INITIALIZATION
// ==========================================

function initSpeechRecognition(): boolean {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    errorMessage.value = 'Браузер не поддерживает распознавание речи';
    state.value = 'error';
    return false;
  }
  
  recognition = new SpeechRecognition();
  recognition.lang = 'ru-RU';
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.maxAlternatives = 1;
  
  recognition.onstart = () => {
    console.log('[VoiceMode] Recognition started - listening...');
    state.value = 'listening';
    currentTranscript.value = '';
    startSilenceTimer();
  };
  
  recognition.onresult = (event: any) => {
    let transcript = '';
    let isFinal = false;
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        isFinal = true;
      }
    }
    
    console.log('[VoiceMode] Transcript:', transcript, 'isFinal:', isFinal);
    currentTranscript.value = transcript;
    resetSilenceTimer();
    
    if (isFinal && transcript.trim()) {
      console.log('[VoiceMode] Final speech detected, sending to AI:', transcript.trim());
      clearSilenceTimer();
      handleUserSpeechComplete(transcript.trim());
    }
  };
  
  recognition.onerror = (event: any) => {
    console.log('[VoiceMode] Recognition error:', event.error);
    
    // no-speech is NORMAL - just restart immediately, don't log as error
    if (event.error === 'no-speech') {
      // Restart instantly - user may just be pausing
      if (isCallActive.value && state.value === 'listening') {
        setTimeout(() => restartRecognition(), 50); // Fast restart
      }
      return;
    }
    
    console.warn('[VoiceMode] Recognition error:', event.error);
    
    if (event.error === 'not-allowed') {
      errorMessage.value = 'Доступ к микрофону запрещён';
      state.value = 'error';
      endCall();
    } else if (event.error !== 'aborted') {
      // Don't show error for aborted - it's expected when stopping
    }
  };
  
  recognition.onend = () => {
    console.log('[VoiceMode] Recognition ended, isCallActive:', isCallActive.value, 'state:', state.value);
    // Restart if still in listening mode
    if (isCallActive.value && state.value === 'listening') {
      console.log('[VoiceMode] Restarting recognition...');
      restartRecognition();
    }
  };
  
  return true;
}

function restartRecognition(): void {
  if (!recognition) return;
  
  try {
    recognition.start();
  } catch (e) {
    // May already be running
  }
}

async function initAudioContext(): Promise<boolean> {
  try {
    // First, enumerate all audio input devices to find a REAL microphone
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(d => d.kind === 'audioinput');
    
    console.log('[VoiceMode] Available audio input devices:', audioInputs.length);
    audioInputs.forEach((d, i) => {
      console.log(`[VoiceMode] Device ${i}: "${d.label}" id: ${d.deviceId.substring(0, 20)}...`);
    });
    
    // Filter out virtual audio devices (BlackHole, Soundflower, etc.)
    const virtualDevicePatterns = ['blackhole', 'soundflower', 'virtual', 'loopback', 'aggregate'];
    const realMicrophones = audioInputs.filter(d => {
      const label = d.label.toLowerCase();
      return !virtualDevicePatterns.some(pattern => label.includes(pattern));
    });
    
    console.log('[VoiceMode] Real microphones found:', realMicrophones.length);
    
    // Prefer devices with 'microphone', 'built-in', 'headset' in label
    let selectedDevice = realMicrophones.find(d => 
      d.label.toLowerCase().includes('microphone') ||
      d.label.toLowerCase().includes('built-in') ||
      d.label.toLowerCase().includes('headset')
    );
    
    // If no preferred device, use first real microphone
    if (!selectedDevice && realMicrophones.length > 0) {
      selectedDevice = realMicrophones[0];
    }
    
    // If still no device, use first available (may be virtual)
    if (!selectedDevice && audioInputs.length > 0) {
      console.warn('[VoiceMode] No real microphone found, using:', audioInputs[0].label);
      selectedDevice = audioInputs[0];
    }
    
    console.log('[VoiceMode] Selected microphone:', selectedDevice?.label || 'default');
    
    // Get audio with specific device
    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };
    
    if (selectedDevice && selectedDevice.deviceId) {
      audioConstraints.deviceId = { exact: selectedDevice.deviceId };
    }
    
    mediaStream = await navigator.mediaDevices.getUserMedia({ 
      audio: audioConstraints
    });
    
    // Log audio track diagnostics
    const audioTracks = mediaStream.getAudioTracks();
    console.log('[VoiceMode] Audio tracks:', audioTracks.length);
    audioTracks.forEach((track, i) => {
      console.log(`[VoiceMode] Track ${i}:`, {
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        settings: track.getSettings()
      });
    });
    
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    
    const source = audioContext.createMediaStreamSource(mediaStream);
    source.connect(analyser);
    
    // Clone the stream for MediaRecorder instead of getting a new one
    // This works better in some browsers/environments
    recorderStream = mediaStream.clone();
    const recorderTracks = recorderStream.getAudioTracks();
    console.log('[VoiceMode] Cloned stream for MediaRecorder, tracks:', recorderTracks.length);
    recorderTracks.forEach((track, i) => {
      console.log(`[VoiceMode] Recorder Track ${i}:`, {
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState
      });
    });
    
    // Initialize MediaRecorder for Whisper
    initMediaRecorder();
    
    // Initialize Web Audio fallback (ScriptProcessorNode for raw PCM capture)
    initWebAudioRecorder();
    
    startAudioVisualization();
    return true;
  } catch (err) {
    console.error('[VoiceMode] Microphone access failed:', err);
    errorMessage.value = 'Не удалось получить доступ к микрофону';
    state.value = 'error';
    return false;
  }
}

// Initialize MediaRecorder for Whisper-based transcription
function initMediaRecorder(): void {
  if (!recorderStream) {
    console.error('[VoiceMode] No recorder stream available');
    return;
  }
  
  try {
    // Try to use webm/opus with high bitrate
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
    
    // High quality audio recording: 128 kbps - using SEPARATE recorderStream
    mediaRecorder = new MediaRecorder(recorderStream, { 
      mimeType,
      audioBitsPerSecond: 128000  // 128 kbps for high quality
    });
    console.log('[VoiceMode] MediaRecorder initialized with mimeType:', mimeType, 'bitrate: 128kbps');
    
    mediaRecorder.ondataavailable = (event) => {
      console.log('[VoiceMode] ondataavailable, chunk size:', event.data.size);
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = async () => {
      const totalSize = audioChunks.reduce((sum, chunk) => sum + chunk.size, 0);
      console.log('[VoiceMode] Recording stopped, chunks:', audioChunks.length, 'total size:', totalSize);
      console.log('[VoiceMode] PCM buffers collected:', pcmBuffers.length);
      
      // Check if MediaRecorder captured real audio (> 2KB means actual data)
      const mediaRecorderWorked = totalSize > 2000;
      
      // Don't send if already processing or speaking
      if (state.value === 'thinking' || state.value === 'speaking') {
        console.log('[VoiceMode] Already processing/speaking, skipping this recording');
        audioChunks = [];
        pcmBuffers = [];
        return;
      }
      
      let audioBlob: Blob | null = null;
      
      if (mediaRecorderWorked && audioChunks.length > 0) {
        // MediaRecorder worked - use its output
        audioBlob = new Blob(audioChunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
        console.log('[VoiceMode] Using MediaRecorder output:', audioBlob.size, 'bytes');
      } else if (pcmBuffers.length > 0) {
        // MediaRecorder failed - use Web Audio fallback
        console.log('[VoiceMode] MediaRecorder empty, using Web Audio fallback');
        
        // Concatenate all PCM buffers
        const totalSamples = pcmBuffers.reduce((sum, buf) => sum + buf.length, 0);
        const concatenated = new Float32Array(totalSamples);
        let offset = 0;
        for (const buf of pcmBuffers) {
          concatenated.set(buf, offset);
          offset += buf.length;
        }
        
        // Encode to WAV
        audioBlob = encodeWAV(concatenated, SAMPLE_RATE);
        console.log('[VoiceMode] Created WAV from PCM:', audioBlob.size, 'bytes', 'samples:', totalSamples);
      } else {
        console.log('[VoiceMode] No audio data from either method - skipping');
      }
      
      // Clear buffers
      audioChunks = [];
      pcmBuffers = [];
      
      if (audioBlob && audioBlob.size > 100 && isCallActive.value) {
        console.log('[VoiceMode] Sending', (audioBlob.size / 1024).toFixed(1), 'KB to Whisper');
        
        // Send to Whisper for transcription
        await whisperTranscribe(audioBlob);
        
        // Continue recording if still active and listening
        if (isCallActive.value && state.value === 'listening') {
          startWhisperRecording();
        }
      } else if (isCallActive.value && state.value === 'listening') {
        // Continue recording even if nothing to send
        startWhisperRecording();
      }
    };
  } catch (err) {
    console.error('[VoiceMode] MediaRecorder init failed:', err);
  }
}

// WAV encoder - converts PCM Float32Array to WAV Blob
function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  
  // Write WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  
  // Write samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}

// Initialize Web Audio API recorder as fallback
function initWebAudioRecorder(): void {
  if (!audioContext || !mediaStream) return;
  
  try {
    const source = audioContext.createMediaStreamSource(mediaStream);
    
    // ScriptProcessorNode (deprecated but widely supported)
    scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
    
    scriptProcessor.onaudioprocess = (e) => {
      if (isRecording.value) {
        const inputData = e.inputBuffer.getChannelData(0);
        // Downsample to 16kHz if needed
        const downsampleRatio = Math.round(audioContext!.sampleRate / SAMPLE_RATE);
        const downsampled = new Float32Array(Math.floor(inputData.length / downsampleRatio));
        for (let i = 0; i < downsampled.length; i++) {
          downsampled[i] = inputData[i * downsampleRatio];
        }
        pcmBuffers.push(new Float32Array(downsampled));
      }
    };
    
    source.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);
    
    console.log('[VoiceMode] Web Audio recorder initialized (ScriptProcessorNode)');
  } catch (err) {
    console.error('[VoiceMode] Web Audio recorder init failed:', err);
  }
}

// Start recording audio for Whisper
function startWhisperRecording(): void {
  if (!mediaRecorder || mediaRecorder.state === 'recording') return;
  
  audioChunks = [];
  isRecording.value = true;
  
  try {
    // NO timeslice - accumulate full audio for better quality
    mediaRecorder.start();
    console.log('[VoiceMode] Whisper recording started (5 sec, 128kbps)');
    
    // Stop after RECORDING_CHUNK_DURATION to process
    recordingTimer = setTimeout(() => {
      if (mediaRecorder?.state === 'recording') {
        mediaRecorder.stop();
        isRecording.value = false;
        console.log('[VoiceMode] Recording stopped for transcription');
      }
    }, RECORDING_CHUNK_DURATION);
  } catch (err) {
    console.error('[VoiceMode] Failed to start recording:', err);
  }
}

// Stop Whisper recording
function stopWhisperRecording(): void {
  if (recordingTimer) {
    clearTimeout(recordingTimer);
    recordingTimer = null;
  }
  
  if (mediaRecorder?.state === 'recording') {
    try {
      mediaRecorder.stop();
    } catch (e) {
      // Ignore
    }
  }
  isRecording.value = false;
}

// Send audio to Whisper API for transcription
async function whisperTranscribe(audioBlob: Blob): Promise<void> {
  console.log('[VoiceMode] whisperTranscribe called, blob size:', audioBlob.size);
  
  if (audioBlob.size < 100) {
    console.log('[VoiceMode] Audio blob empty, skipping');
    return;
  }
  
  console.log('[VoiceMode] Sending', (audioBlob.size / 1024).toFixed(1), 'KB to Whisper...');
  
  try {
    const formData = new FormData();
    
    // Determine file extension from mime type
    const ext = audioBlob.type.includes('webm') ? 'webm' : 'mp4';
    formData.append('audio', audioBlob, `recording.${ext}`);
    
    // Use axios api client - it has CSRF token and auth interceptors
    const response = await api.post('/assistant/transcribe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    const transcript = response.data?.data?.text || response.data?.text || '';
    
    if (transcript.trim()) {
      console.log('[VoiceMode] Whisper transcript:', transcript);
      currentTranscript.value = transcript;
      
      // Process the transcribed text
      handleUserSpeechComplete(transcript.trim());
    } else {
      console.log('[VoiceMode] Empty transcript from Whisper');
    }
  } catch (err: any) {
    console.error('[VoiceMode] Whisper transcription failed:', err?.response?.status, err?.message);
  }
}

// ==========================================
// AUDIO VISUALIZATION (GPT-VOICE-012)
// ==========================================

function startAudioVisualization(): void {
  if (!analyser) {
    console.log('[VoiceMode] startAudioVisualization: no analyser!');
    return;
  }
  
  console.log('[VoiceMode] startAudioVisualization started');
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  let logCounter = 0;
  
  const animate = () => {
    if (!analyser || !isCallActive.value) {
      audioLevel.value = 0;
      orbScale.value = 1;
      orbGlow.value = 0;
      return;
    }
    
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate average volume
    const sum = dataArray.reduce((a, b) => a + b, 0);
    const avg = sum / dataArray.length;
    const normalizedLevel = Math.min(1, avg / 128);
    
    // Log audio level every 2 seconds (120 frames at 60fps)
    logCounter++;
    if (logCounter % 120 === 0) {
      console.log('[VoiceMode] Audio level:', normalizedLevel.toFixed(3), 'avg:', avg.toFixed(1));
    }
    
    audioLevel.value = normalizedLevel;
    
    // Update orb animation based on state
    if (state.value === 'listening') {
      // Pulsing based on voice level
      orbScale.value = 1 + normalizedLevel * 0.3;
      orbGlow.value = normalizedLevel;
    } else if (state.value === 'thinking') {
      // Slow breathing effect
      orbScale.value = 1 + Math.sin(Date.now() / 300) * 0.1;
      orbGlow.value = 0.5 + Math.sin(Date.now() / 500) * 0.3;
    } else if (state.value === 'speaking') {
      // Fast pulse to indicate speaking
      orbScale.value = 1 + Math.sin(Date.now() / 100) * 0.15;
      orbGlow.value = 0.8 + Math.sin(Date.now() / 150) * 0.2;
    } else {
      orbScale.value = 1;
      orbGlow.value = 0;
    }
    
    animationFrameId = requestAnimationFrame(animate);
  };
  
  animate();
}

function stopAudioVisualization(): void {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  audioLevel.value = 0;
  orbScale.value = 1;
  orbGlow.value = 0;
}

// ==========================================
// LIQUID BLOB ANIMATION (Premium water effect)
// ==========================================

// Simplex noise implementation for organic movement
class SimplexNoise {
  private perm: number[] = [];
  
  constructor(seed = Math.random()) {
    const p = [];
    for (let i = 0; i < 256; i++) p[i] = i;
    let n: number;
    let q: number;
    for (let i = 255; i > 0; i--) {
      n = Math.floor((seed * (i + 1)) % 256);
      seed = (seed * 16807) % 2147483647;
      q = p[i];
      p[i] = p[n];
      p[n] = q;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }
  
  noise2D(x: number, y: number): number {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const grad = (h: number, x: number, y: number) => {
      const v = (h & 1) === 0 ? x : y;
      return (h & 2) === 0 ? v : -v;
    };
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    let n0 = t0 < 0 ? 0 : Math.pow(t0, 4) * grad(this.perm[ii + this.perm[jj]], x0, y0);
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    let n1 = t1 < 0 ? 0 : Math.pow(t1, 4) * grad(this.perm[ii + i1 + this.perm[jj + j1]], x1, y1);
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    let n2 = t2 < 0 ? 0 : Math.pow(t2, 4) * grad(this.perm[ii + 1 + this.perm[jj + 1]], x2, y2);
    return 70 * (n0 + n1 + n2);
  }
}

const noise = new SimplexNoise();

function startLiquidAnimation(): void {
  if (!liquidCanvas.value) return;
  
  const canvas = liquidCanvas.value;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const baseRadius = 105;
  let time = 0;
  
  const offCanvas = document.createElement('canvas');
  offCanvas.width = canvas.width;
  offCanvas.height = canvas.height;
  // offCanvas reserved for future optimization
  
  // UNIFIED 3D FLOW FIELD - everything connects through this
  const getFlowValue = (x: number, y: number, z: number, t: number, scale: number = 1): number => {
    return noise.noise2D(x * scale + t, y * scale + z * 0.5 + t * 0.7) * 0.5 +
           noise.noise2D(x * scale * 2 + t * 0.8, y * scale * 2 + z + t * 0.5) * 0.3 +
           noise.noise2D(x * scale * 0.5 + t * 0.3, y * scale * 0.5 + z * 0.3 + t * 0.2) * 0.2;
  };
  
  // Optimized high-point-count blob (uses subsampling for performance)
  const generateUltraSmoothPoints = (t: number, amp: number, spd: number) => {
    const points: { x: number; y: number }[] = [];
    const numPoints = 512; // 512 control points, interpolated to thousands visually
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const flowX = Math.cos(angle);
      const flowY = Math.sin(angle);
      // Use unified flow field for edge deformation
      const deform = getFlowValue(flowX * 2, flowY * 2, 0, t * spd, 0.8);
      const radius = baseRadius + deform * amp;
      points.push({
        x: centerX + flowX * radius,
        y: centerY + flowY * radius
      });
    }
    return points;
  };
  
  // Ultra-smooth bezier with sub-pixel precision
  const drawUltraSmoothBlob = (points: { x: number; y: number }[], tension = 0.22) => {
    ctx.beginPath();
    const len = points.length;
    for (let i = 0; i < len; i++) {
      const p0 = points[(i - 1 + len) % len];
      const p1 = points[i];
      const p2 = points[(i + 1) % len];
      const p3 = points[(i + 2) % len];
      if (i === 0) ctx.moveTo(p1.x, p1.y);
      ctx.bezierCurveTo(
        p1.x + (p2.x - p0.x) * tension, p1.y + (p2.y - p0.y) * tension,
        p2.x - (p3.x - p1.x) * tension, p2.y - (p3.y - p1.y) * tension,
        p2.x, p2.y
      );
    }
    ctx.closePath();
  };
  
  // ========================================
  // ULTRA-DYNAMIC LIVING PLASMA ORB
  // ========================================
  const drawLivingInterior = (t: number) => {
    const spd = 0.005;
    
    // === LAYER 1: Outer shell particles (fast chaotic rotation) ===
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const layer1Particles = 40;
    for (let i = 0; i < layer1Particles; i++) {
      // Each particle has its OWN rotation axis and speed
      const particleT = t * spd + i * 100;
      const rotSpeed = 0.8 + (i % 7) * 0.15;
      const rotAxis = (i % 5) * 0.2;
      
      // Chaotic orbit - not circular!
      const orbitX = Math.sin(particleT * rotSpeed + rotAxis) * 0.6 +
                     Math.sin(particleT * rotSpeed * 1.7) * 0.3 +
                     Math.sin(particleT * rotSpeed * 2.3) * 0.1;
      const orbitY = Math.cos(particleT * rotSpeed * 0.9 + rotAxis * 2) * 0.5 +
                     Math.cos(particleT * rotSpeed * 1.3) * 0.35 +
                     Math.cos(particleT * rotSpeed * 2.1) * 0.15;
      
      const r = baseRadius * (0.65 + orbitX * 0.15);
      const px = centerX + orbitY * r;
      const py = centerY + Math.sin(particleT * rotSpeed * 1.1 + i) * r * 0.55;
      
      // Visibility based on depth simulation
      const depth = Math.sin(particleT * rotSpeed * 0.7);
      const alpha = depth > -0.3 ? (0.08 + depth * 0.04) : 0;
      
      if (alpha > 0.02) {
        const size = Math.max(3, 5 + noise.noise2D(i, particleT * 0.01) * 4);
        const grad = ctx.createRadialGradient(px, py, 0, px, py, size);
        grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        grad.addColorStop(0.5, `rgba(200, 240, 255, ${alpha * 0.5})`);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }
    }
    ctx.restore();
    
    // === LAYER 2: Plasma streams (flowing curves) ===
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const numStreams = 8;
    for (let s = 0; s < numStreams; s++) {
      const streamT = t * spd * (0.5 + s * 0.1);
      const streamPhase = (s / numStreams) * Math.PI * 2;
      
      ctx.beginPath();
      for (let p = 0; p < 30; p++) {
        const progress = p / 29;
        // Flowing plasma path - irregular, organic
        const angle = streamPhase + progress * Math.PI * 1.5 + 
                     noise.noise2D(s, streamT + progress * 2) * 0.8;
        const rOff = noise.noise2D(s + 10, streamT + progress * 3) * 0.15;
        const r = baseRadius * (0.3 + progress * 0.35 + rOff);
        
        const px = centerX + Math.cos(angle + streamT * 0.5) * r;
        const py = centerY + Math.sin(angle * 1.2 + streamT * 0.4) * r * 0.8;
        
        if (p === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      
      const streamAlpha = 0.03 + Math.sin(streamT * 2 + s) * 0.015;
      ctx.strokeStyle = `rgba(200, 235, 255, ${streamAlpha})`;
      ctx.lineWidth = 2 + Math.sin(streamT + s) * 1;
      ctx.stroke();
    }
    ctx.restore();
    
    // === LAYER 3: Mid-depth energy blobs (slow independent rotation) ===
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const numBlobs = 15;
    for (let b = 0; b < numBlobs; b++) {
      const blobT = t * spd * (0.3 + (b % 5) * 0.08);
      // Each blob rotates on its own crazy axis
      const axisAngle = (b / numBlobs) * Math.PI * 4 + blobT * 0.3;
      const orbitSize = 0.25 + (b % 4) * 0.1;
      
      // Lissajous-like pattern for organic feel
      const lissX = Math.sin(blobT * 1.3 + b) * Math.cos(blobT * 0.7);
      const lissY = Math.sin(blobT * 0.9 + b * 0.5) * Math.cos(blobT * 1.1 + axisAngle);
      
      const px = centerX + lissX * baseRadius * orbitSize;
      const py = centerY + lissY * baseRadius * orbitSize * 0.85;
      
      const blobSize = Math.max(8, 12 + noise.noise2D(b, blobT * 0.5) * 8);
      const blobAlpha = 0.06 + Math.sin(blobT * 1.5 + b * 0.7) * 0.03;
      
      const grad = ctx.createRadialGradient(px, py, 0, px, py, blobSize);
      grad.addColorStop(0, `rgba(255, 255, 255, ${blobAlpha})`);
      grad.addColorStop(0.3, `rgba(220, 245, 255, ${blobAlpha * 0.6})`);
      grad.addColorStop(0.7, `rgba(180, 220, 255, ${blobAlpha * 0.2})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.beginPath();
      ctx.arc(px, py, blobSize, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.restore();
    
    // === LAYER 4: Deep core swirl (slow majestic rotation) ===
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const coreT = t * spd * 0.2;
    for (let ring = 0; ring < 5; ring++) {
      const ringR = baseRadius * (0.15 + ring * 0.08);
      const ringSpeed = 0.5 + ring * 0.2;
      const segments = 8 + ring * 2;
      
      for (let seg = 0; seg < segments; seg++) {
        const segAngle = (seg / segments) * Math.PI * 2 + coreT * ringSpeed * (ring % 2 === 0 ? 1 : -1);
        const wobble = noise.noise2D(ring, coreT + seg * 0.3) * 0.15;
        
        const px = centerX + Math.cos(segAngle) * (ringR + wobble * ringR);
        const py = centerY + Math.sin(segAngle) * (ringR + wobble * ringR) * 0.9;
        
        const segSize = Math.max(3, 4 + ring * 0.5);
        const segAlpha = 0.04 + ring * 0.01;
        
        const grad = ctx.createRadialGradient(px, py, 0, px, py, segSize);
        grad.addColorStop(0, `rgba(240, 250, 255, ${segAlpha})`);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.beginPath();
        ctx.arc(px, py, segSize, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }
    }
    ctx.restore();
    
    // === LAYER 5: Energy pulse waves (expanding rings) ===
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const numPulses = 3;
    for (let p = 0; p < numPulses; p++) {
      const pulsePhase = ((t * spd * 0.8 + p * 0.33) % 1); // 0 to 1 cycle
      const pulseR = baseRadius * (0.1 + pulsePhase * 0.6);
      const pulseAlpha = (1 - pulsePhase) * 0.04;
      
      if (pulseAlpha > 0.005) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(200, 235, 255, ${pulseAlpha})`;
        ctx.lineWidth = 2 + (1 - pulsePhase) * 3;
        ctx.stroke();
      }
    }
    ctx.restore();
    
    // === LAYER 6: Flying sparks (random trajectories) ===
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const numSparks = 20;
    for (let s = 0; s < numSparks; s++) {
      const sparkSeed = s * 137.5; // Golden angle for distribution
      const sparkT = (t * spd * 1.2 + sparkSeed) % 10;
      
      // Random-ish but deterministic trajectory
      const trajX = Math.sin(sparkSeed) * Math.cos(sparkT * 2 + sparkSeed * 0.1);
      const trajY = Math.cos(sparkSeed * 1.3) * Math.sin(sparkT * 1.7 + sparkSeed * 0.2);
      const trajZ = Math.sin(sparkT * 1.3 + sparkSeed);
      
      const sparkR = baseRadius * 0.55;
      const px = centerX + trajX * sparkR;
      const py = centerY + trajY * sparkR * 0.85;
      
      // Visibility based on "depth"
      const sparkAlpha = trajZ > 0 ? 0.1 * trajZ : 0;
      
      if (sparkAlpha > 0.02) {
        const sparkSize = 2 + trajZ * 2;
        ctx.beginPath();
        ctx.arc(px, py, sparkSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${sparkAlpha})`;
        ctx.fill();
      }
    }
    ctx.restore();
    
    // === LAYER 7: Central breathing core ===
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const breathPhase = Math.sin(t * spd * 1.5) * 0.3 + 0.7;
    const coreSize = baseRadius * 0.35 * breathPhase;
    const coreX = centerX + Math.sin(t * spd * 0.4) * 5;
    const coreY = centerY + Math.cos(t * spd * 0.3) * 4;
    
    const coreGrad = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, coreSize);
    coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    coreGrad.addColorStop(0.2, 'rgba(240, 250, 255, 0.12)');
    coreGrad.addColorStop(0.5, 'rgba(200, 235, 255, 0.05)');
    coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.beginPath();
    ctx.arc(coreX, coreY, coreSize, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();
    ctx.restore();
    
    // === LAYER 8: Connecting energy threads ===
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const numThreads = 6;
    for (let th = 0; th < numThreads; th++) {
      const threadT = t * spd * (0.4 + th * 0.05);
      const startAngle = (th / numThreads) * Math.PI * 2 + threadT * 0.3;
      const endAngle = startAngle + Math.PI * (0.5 + Math.sin(threadT + th) * 0.3);
      
      const startR = baseRadius * (0.2 + Math.sin(threadT + th * 2) * 0.1);
      const endR = baseRadius * (0.5 + Math.cos(threadT * 1.3 + th) * 0.1);
      
      const x1 = centerX + Math.cos(startAngle) * startR;
      const y1 = centerY + Math.sin(startAngle) * startR * 0.9;
      const x2 = centerX + Math.cos(endAngle) * endR;
      const y2 = centerY + Math.sin(endAngle) * endR * 0.9;
      
      // Control point for curve
      const cpX = centerX + Math.sin(threadT * 0.7 + th) * baseRadius * 0.25;
      const cpY = centerY + Math.cos(threadT * 0.5 + th * 1.5) * baseRadius * 0.2;
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cpX, cpY, x2, y2);
      ctx.strokeStyle = `rgba(200, 235, 255, ${0.025 + Math.sin(threadT * 2) * 0.01})`;
      ctx.lineWidth = 1 + Math.sin(threadT + th) * 0.5;
      ctx.stroke();
    }
    ctx.restore();
  };
  
  const animate = () => {
    if (!liquidCanvas.value || !props.isOpen) {
      stopLiquidAnimation();
      return;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // FIXED BLUE COLOR - no changes based on state
    const hue = 210;
    
    // Only amplitude and speed change based on state (color stays blue)
    let amplitude = 6;
    let speed = 0.012;
    
    if (state.value === 'listening') {
      amplitude = 10 + audioLevel.value * 20;
      speed = 0.02 + audioLevel.value * 0.012;
    } else if (state.value === 'thinking') {
      amplitude = 8;
      speed = 0.01;
    } else if (state.value === 'speaking') {
      amplitude = 14 + Math.sin(time * 0.06) * 4;
      speed = 0.028;
    }
    
    // 512 points with unified flow field for million-D smoothness
    const points = generateUltraSmoothPoints(time, amplitude, speed);
    
    // Layer 1: Outer glow
    ctx.save();
    ctx.filter = 'blur(25px)';
    drawUltraSmoothBlob(points);
    ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.35)`;
    ctx.fill();
    ctx.restore();
    
    // Layer 2: Mid glow
    ctx.save();
    ctx.filter = 'blur(12px)';
    drawUltraSmoothBlob(points);
    ctx.fillStyle = `hsla(${hue}, 70%, 65%, 0.45)`;
    ctx.fill();
    ctx.restore();
    
    // Layer 3: Main 3D sphere
    ctx.save();
    ctx.filter = 'none';
    drawUltraSmoothBlob(points);
    const mainGrad = ctx.createRadialGradient(
      centerX - baseRadius * 0.3, centerY - baseRadius * 0.3, 0,
      centerX, centerY, baseRadius + amplitude
    );
    mainGrad.addColorStop(0, `hsla(${hue}, 60%, 95%, 1)`);
    mainGrad.addColorStop(0.15, `hsla(${hue}, 70%, 82%, 1)`);
    mainGrad.addColorStop(0.4, `hsla(${hue}, 75%, 68%, 1)`);
    mainGrad.addColorStop(0.7, `hsla(${hue}, 80%, 55%, 1)`);
    mainGrad.addColorStop(1, `hsla(${hue}, 85%, 38%, 1)`);
    ctx.fillStyle = mainGrad;
    ctx.fill();
    ctx.restore();
    
    // Layer 4: Main specular highlight
    ctx.save();
    const hlX = centerX - baseRadius * 0.35;
    const hlY = centerY - baseRadius * 0.35;
    const hlGrad = ctx.createRadialGradient(hlX, hlY, 0, hlX, hlY, baseRadius * 0.5);
    hlGrad.addColorStop(0, 'rgba(255,255,255,0.9)');
    hlGrad.addColorStop(0.3, 'rgba(255,255,255,0.5)');
    hlGrad.addColorStop(0.6, 'rgba(255,255,255,0.1)');
    hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.ellipse(hlX, hlY, baseRadius * 0.4, baseRadius * 0.25, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = hlGrad;
    ctx.fill();
    ctx.restore();
    
    // Layer 5: Small highlight
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(centerX - baseRadius * 0.15, centerY - baseRadius * 0.5, baseRadius * 0.12, baseRadius * 0.06, -Math.PI / 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
    ctx.restore();
    
    // Layer 6: Bottom rim light
    ctx.save();
    const rimGrad = ctx.createRadialGradient(
      centerX, centerY + baseRadius * 0.6, 0,
      centerX, centerY + baseRadius * 0.6, baseRadius * 0.4
    );
    rimGrad.addColorStop(0, `hsla(${hue}, 50%, 75%, 0.3)`);
    rimGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + baseRadius * 0.6, baseRadius * 0.5, baseRadius * 0.15, 0, 0, Math.PI * 2);
    ctx.fillStyle = rimGrad;
    ctx.fill();
    ctx.restore();
    
    // Layer 7: Inner depth (subsurface scattering simulation)
    ctx.save();
    const sssGrad = ctx.createRadialGradient(
      centerX + baseRadius * 0.2, centerY + baseRadius * 0.2, 0,
      centerX, centerY, baseRadius
    );
    sssGrad.addColorStop(0, `hsla(${hue}, 90%, 70%, 0.15)`);
    sssGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
    sssGrad.addColorStop(1, 'rgba(255,255,255,0)');
    drawUltraSmoothBlob(points);
    ctx.fillStyle = sssGrad;
    ctx.fill();
    ctx.restore();
    
    // Layer 8: Fresnel edge (bright edge where light wraps)
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const fresnelGrad = ctx.createRadialGradient(
      centerX, centerY, baseRadius * 0.7,
      centerX, centerY, baseRadius + amplitude
    );
    fresnelGrad.addColorStop(0, 'rgba(255,255,255,0)');
    fresnelGrad.addColorStop(0.6, 'rgba(255,255,255,0)');
    fresnelGrad.addColorStop(0.85, `hsla(${hue}, 50%, 85%, 0.3)`);
    fresnelGrad.addColorStop(1, `hsla(${hue}, 40%, 95%, 0.5)`);
    drawUltraSmoothBlob(points);
    ctx.fillStyle = fresnelGrad;
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    
    // Layer 9: Core brightness (glass-like inner glow)
    ctx.save();
    const coreGrad = ctx.createRadialGradient(
      centerX - baseRadius * 0.1, centerY - baseRadius * 0.1, 0,
      centerX, centerY, baseRadius * 0.6
    );
    coreGrad.addColorStop(0, 'rgba(255,255,255,0.3)');
    coreGrad.addColorStop(0.4, 'rgba(255,255,255,0.1)');
    coreGrad.addColorStop(1, 'rgba(255,255,255,0)');
    drawUltraSmoothBlob(points);
    ctx.fillStyle = coreGrad;
    ctx.fill();
    ctx.restore();
    
    // Layer 10: Ambient occlusion (subtle shadow at edges)
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const aoGrad = ctx.createRadialGradient(
      centerX, centerY, baseRadius * 0.6,
      centerX, centerY, baseRadius + amplitude
    );
    aoGrad.addColorStop(0, 'rgba(255,255,255,1)');
    aoGrad.addColorStop(0.7, 'rgba(255,255,255,1)');
    aoGrad.addColorStop(1, `hsla(${hue}, 60%, 30%, 0.2)`);
    drawUltraSmoothBlob(points);
    ctx.fillStyle = aoGrad;
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    
    // UNIFIED LIVING INTERIOR - interconnected organic flow
    drawLivingInterior(time);
    
    // Layer 17: Extra deep shimmer
    ctx.save();
    const shimmerAngle = time * 0.003;
    const shimmerX = centerX + Math.cos(shimmerAngle) * baseRadius * 0.15;
    const shimmerY = centerY + Math.sin(shimmerAngle * 1.3) * baseRadius * 0.12;
    const shimmerGrad = ctx.createRadialGradient(shimmerX, shimmerY, 0, shimmerX, shimmerY, baseRadius * 0.4);
    shimmerGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
    shimmerGrad.addColorStop(0.3, 'rgba(200, 230, 255, 0.15)');
    shimmerGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.globalCompositeOperation = 'screen';
    drawUltraSmoothBlob(points);
    ctx.fillStyle = shimmerGrad;
    ctx.fill();
    ctx.restore();
    
    // Layer 18-20: Additional internal depth orbits
    for (let orbit = 0; orbit < 3; orbit++) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const orbitPhase = time * 0.002 * (orbit + 1);
      const orbitRadius = baseRadius * (0.3 + orbit * 0.15);
      const ox = centerX + Math.cos(orbitPhase) * orbitRadius * 0.4;
      const oy = centerY + Math.sin(orbitPhase * 1.2) * orbitRadius * 0.35;
      const oGrad = ctx.createRadialGradient(ox, oy, 0, ox, oy, baseRadius * 0.15);
      oGrad.addColorStop(0, `rgba(255, 255, 255, ${0.08 - orbit * 0.02})`);
      oGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.beginPath();
      ctx.arc(ox, oy, baseRadius * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = oGrad;
      ctx.fill();
      ctx.restore();
    }
    
    time++;
    liquidAnimationId = requestAnimationFrame(animate);
  };
  
  animate();
}

function stopLiquidAnimation(): void {
  if (liquidAnimationId) {
    cancelAnimationFrame(liquidAnimationId);
    liquidAnimationId = null;
  }
}

// ==========================================
// SILENCE DETECTION (GPT-VOICE-003)
// ==========================================

function startSilenceTimer(): void {
  clearSilenceTimer();
  silenceTimer = setTimeout(() => {
    // Auto-send if we have transcript after silence
    if (currentTranscript.value.trim() && state.value === 'listening') {
      handleUserSpeechComplete(currentTranscript.value.trim());
    }
  }, SILENCE_TIMEOUT);
}

function resetSilenceTimer(): void {
  clearSilenceTimer();
  startSilenceTimer();
}

function clearSilenceTimer(): void {
  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }
}

// ==========================================
// SPEECH HANDLING
// ==========================================

async function handleUserSpeechComplete(text: string): Promise<void> {
  if (!text.trim()) return;
  
  // Stop listening while processing
  recognition?.stop();
  clearSilenceTimer();
  state.value = 'thinking';
  
  // Add to history
  conversationHistory.value.push({
    role: 'user',
    content: text,
    timestamp: new Date(),
  });
  
  // Emit to parent for AI processing
  emit('send-message', text);
}

/**
 * Receive AI response (called from parent)
 * Supports both text and audio data
 */
function receiveAiResponse(response: string | { text: string; emotion?: string }): void {
  const text = typeof response === 'string' ? response : response.text;
  const emotion = typeof response === 'object' ? response.emotion : undefined;
  
  aiTranscript.value = text;
  
  // Add to history
  conversationHistory.value.push({
    role: 'assistant',
    content: text,
    emotion: emotion,
    timestamp: new Date(),
  });
  
  // Speak the response
  speakResponse(text, emotion);
}

// ==========================================
// TEXT-TO-SPEECH using OpenAI (GPT-VOICE-001, GPT-VOICE-006)
// ==========================================

let currentAudio: HTMLAudioElement | null = null;

async function speakResponse(text: string, _emotion?: string): Promise<void> {
  state.value = 'speaking';
  
  // IMPORTANT: Stop recording before TTS plays to avoid capturing speaker audio!
  stopWhisperRecording();
  
  try {
    console.log('[VoiceMode] Requesting OpenAI TTS for:', text.substring(0, 50) + '...');
    
    // Use OpenAI TTS via backend API
    const response = await api.post('/assistant/speak', 
      { 
        text, 
        voice: 'onyx' // Premium male voice (or 'nova' for female)
      },
      { responseType: 'blob' }
    );
    
    // Create audio element and play
    const audioBlob = response.data;
    const audioUrl = URL.createObjectURL(audioBlob);
    
    // Stop any previous audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
    }
    
    currentAudio = new Audio(audioUrl);
    
    currentAudio.onended = () => {
      console.log('[VoiceMode] TTS playback ended');
      URL.revokeObjectURL(audioUrl);
      if (isCallActive.value) {
        // Resume listening after speaking WITH DELAY to avoid capturing echo
        state.value = 'listening';
        aiTranscript.value = '';
        restartRecognition();
        
        // Wait 1 second before starting recording to avoid capturing speaker echo
        setTimeout(() => {
          if (isCallActive.value && state.value === 'listening') {
            console.log('[VoiceMode] Starting recording after TTS delay');
            startWhisperRecording();
            startSilenceTimer();
          }
        }, 1000);
      } else {
        state.value = 'idle';
      }
    };
    
    currentAudio.onerror = (e) => {
      console.error('[VoiceMode] TTS playback error:', e);
      URL.revokeObjectURL(audioUrl);
      if (isCallActive.value) {
        state.value = 'listening';
        restartRecognition();
        // Wait 1 second before starting recording
        setTimeout(() => {
          if (isCallActive.value && state.value === 'listening') {
            startWhisperRecording();
          }
        }, 1000);
      }
    };
    
    await currentAudio.play();
    console.log('[VoiceMode] TTS playing...');
    
  } catch (err: any) {
    console.error('[VoiceMode] OpenAI TTS failed:', err?.response?.status, err?.message);
    
    // Fallback to browser TTS if OpenAI fails
    console.log('[VoiceMode] Falling back to browser TTS...');
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ru-RU';
      utterance.rate = 1.0;
      
      utterance.onend = () => {
        if (isCallActive.value) {
          state.value = 'listening';
          restartRecognition();
          startWhisperRecording();
        } else {
          state.value = 'idle';
        }
      };
      
      speechSynthesis.speak(utterance);
    } catch (fallbackErr) {
      console.error('[VoiceMode] Browser TTS also failed:', fallbackErr);
      if (isCallActive.value) {
        state.value = 'listening';
        restartRecognition();
        startWhisperRecording();
      }
    }
  }
}

// ==========================================
// INTERRUPTION HANDLING (GPT-VOICE-002)
// ==========================================

function handleInterruption(): void {
  if (state.value === 'speaking') {
    // Stop TTS immediately
    speechSynthesis.cancel();
    state.value = 'interrupted';
    
    // Brief pause then resume listening
    setTimeout(() => {
      if (isCallActive.value) {
        state.value = 'listening';
        restartRecognition();
        startSilenceTimer();
      }
    }, 300);
  }
}

// ==========================================
// CALL CONTROL
// ==========================================

async function startCall(): Promise<void> {
  console.log('[VoiceMode] Starting call...');
  errorMessage.value = '';
  connectionStatus.value = 'connecting';
  
  // Check microphone permission first
  const permStatus = await checkMicrophonePermission();
  console.log('[VoiceMode] Permission status:', permStatus);
  
  if (permStatus !== 'granted') {
    // Request permission
    const granted = await requestMicrophonePermission();
    if (!granted) {
      console.error('[VoiceMode] Microphone permission denied');
      state.value = 'error';
      connectionStatus.value = 'disconnected';
      return;
    }
  }
  
  // Initialize speech recognition (fallback)
  if (!recognition && !initSpeechRecognition()) {
    console.log('[VoiceMode] Speech recognition not available, will use Whisper only');
    // Don't return - Whisper will work without Web Speech API
  }
  
  // Initialize audio context
  if (!audioContext) {
    console.log('[VoiceMode] Initializing audio context...');
    const success = await initAudioContext();
    if (!success) {
      console.error('[VoiceMode] Failed to init audio context');
      connectionStatus.value = 'disconnected';
      return;
    }
  }
  
  isCallActive.value = true;
  connectionStatus.value = 'connected';
  state.value = 'listening';
  console.log('[VoiceMode] Call connected, starting recognition...');
  
  try {
    // Stop any existing recognition before starting new one
    recognition?.stop();
    // Small delay to ensure clean state
    await new Promise(resolve => setTimeout(resolve, 100));
    recognition?.start();
    console.log('[VoiceMode] Recognition.start() called');
  } catch (e) {
    console.warn('[VoiceMode] Recognition start error (may be expected):', e);
  }
  
  // Start Whisper recording (primary method - works in Telegram WebView)
  startWhisperRecording();
}

function endCall(): void {
  console.log('[VoiceMode] endCall() called, isCallActive was:', isCallActive.value);
  console.trace('[VoiceMode] endCall stack trace:');
  
  isCallActive.value = false;
  clearSilenceTimer();
  
  // Stop Whisper recording
  stopWhisperRecording();
  
  // Stop recognition
  recognition?.stop();
  
  // Stop TTS
  speechSynthesis.cancel();
  
  // Stop visualization
  stopAudioVisualization();
  
  // Cleanup media stream
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  
  // Cleanup recorder stream
  if (recorderStream) {
    recorderStream.getTracks().forEach(track => track.stop());
    recorderStream = null;
  }
  
  if (audioContext) {
    audioContext.close();
    audioContext = null;
    analyser = null;
  }
  
  state.value = 'idle';
  currentTranscript.value = '';
  aiTranscript.value = '';
  connectionStatus.value = 'disconnected';
}

// Debounce to prevent rapid double-clicks
let lastToggleTime = 0;
const TOGGLE_DEBOUNCE_MS = 1000;

function toggleCall(): void {
  const now = Date.now();
  if (now - lastToggleTime < TOGGLE_DEBOUNCE_MS) {
    console.log('[VoiceMode] toggleCall debounced (too fast)');
    return;
  }
  lastToggleTime = now;
  
  console.log('[VoiceMode] toggleCall() called, isCallActive:', isCallActive.value);
  if (isCallActive.value) {
    console.log('[VoiceMode] --> ending call');
    endCall();
  } else {
    console.log('[VoiceMode] --> starting call');
    startCall();
  }
}

function handleClose(): void {
  endCall();
  emit('close');
}

// ==========================================
// LIFECYCLE
// ==========================================

defineExpose({
  receiveAiResponse,
  handleInterruption,
  isCallActive,
});

onUnmounted(() => {
  endCall();
});

watch(() => props.isOpen, (open) => {
  if (!open) {
    endCall();
    stopLiquidAnimation();
    // Stop any playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
    }
  } else {
    // Start liquid animation after canvas is rendered
    setTimeout(() => startLiquidAnimation(), 50);
    // NO AUTO-START - user must click orb to begin
    console.log('[VoiceMode] Modal opened - click orb to start listening');
  }
});

// Load voices on mount
onMounted(() => {
  // Chrome requires user interaction to load voices
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => {
    speechSynthesis.getVoices();
  };
});
</script>

<template>
  <Teleport to="body">
    <transition name="modal">
      <div v-if="isOpen" class="voice-modal">
        <!-- Main Content - centered -->
        <div class="voice-content">
          <!-- Three.js WebGL Liquid Orb -->
          <div class="voice-liquid-container" @click="toggleCall">
            <LiquidOrb
              :audioLevel="audioLevel"
              :state="state"
              :isActive="true"
            />
          </div>
          
          <!-- 4-Dot Equalizer (when AI is speaking) -->
          <div v-if="state === 'speaking'" class="voice-equalizer">
            <div class="voice-equalizer__dot voice-equalizer__dot--1"></div>
            <div class="voice-equalizer__dot voice-equalizer__dot--2"></div>
            <div class="voice-equalizer__dot voice-equalizer__dot--3"></div>
            <div class="voice-equalizer__dot voice-equalizer__dot--4"></div>
          </div>
          
          <!-- State label -->
          <div class="voice-state-label">{{ stateLabel }}</div>
          
          <!-- Transcript (subtle) -->
          <div v-if="currentTranscript || aiTranscript" class="voice-transcript-mini">
            <p v-if="currentTranscript">{{ currentTranscript }}</p>
            <p v-if="aiTranscript && state === 'speaking'" class="voice-transcript-mini--ai">{{ aiTranscript }}</p>
          </div>
        </div>
        
        <!-- Bottom Controls Bar -->
        <div class="voice-bottom-bar">
          <!-- Mic button (START only - doesn't stop) -->
          <button 
            class="voice-bottom-btn voice-bottom-btn--mic"
            :class="{ 'voice-bottom-btn--active': state === 'listening' }"
            @click="startCall"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </button>
          
          <!-- Close button -->
          <button 
            class="voice-bottom-btn voice-bottom-btn--close"
            @click="handleClose"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
/* Pure black background like ChatGPT */
.voice-modal {
  position: fixed;
  inset: 0;
  background: #000;
  display: flex;
  flex-direction: column;
  z-index: 10000;
}

/* Main content - centered */
.voice-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  gap: 24px;
}

/* Liquid Blob Canvas Container */
.voice-liquid-container {
  position: relative;
  width: 300px;
  height: 300px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.voice-liquid-canvas {
  display: block;
}

.voice-living-orb__breath--1 { animation-delay: 0s; }
.voice-living-orb__breath--2 { animation-delay: -1.3s; opacity: 0.7; }
.voice-living-orb__breath--3 { animation-delay: -2.6s; opacity: 0.4; }

.voice-living-orb__sphere {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(180deg, #87CEEB 0%, #60a5fa 30%, #3b82f6 60%, #1e40af 100%);
  box-shadow: 
    0 0 60px rgba(96, 165, 250, 0.6),
    0 0 120px rgba(56, 189, 248, 0.3),
    inset 0 -30px 60px rgba(0, 0, 0, 0.4),
    inset 0 30px 60px rgba(255, 255, 255, 0.4);
  animation: living-pulse 3s ease-in-out infinite;
}

.voice-living-orb__gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.2) 30%, transparent 60%);
  border-radius: 50%;
}

.voice-living-orb__shimmer {
  position: absolute;
  top: 10%;
  left: 15%;
  width: 30%;
  height: 20%;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  filter: blur(8px);
  animation: shimmer-move 6s ease-in-out infinite;
}

/* Listening state - wiggly motion */
.voice-living-orb__sphere--listening {
  animation: living-wiggle 0.5s ease-in-out infinite;
  box-shadow: 
    0 0 80px rgba(34, 197, 94, 0.7),
    0 0 150px rgba(34, 197, 94, 0.4),
    inset 0 -30px 60px rgba(0, 0, 0, 0.4),
    inset 0 30px 60px rgba(255, 255, 255, 0.4);
}

/* Thinking state - slow rotation */
.voice-living-orb__sphere--thinking {
  animation: living-think 2s linear infinite;
}

/* Idle state - gentle breathing */
.voice-living-orb__sphere--idle {
  animation: living-idle 4s ease-in-out infinite;
}

/* Living Orb Animations */
@keyframes living-glow {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.15); }
}

@keyframes living-breath {
  0%, 100% { transform: scale(1); opacity: 0.3; }
  50% { transform: scale(1.4); opacity: 0; }
}

@keyframes living-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}

@keyframes living-wiggle {
  0%, 100% { transform: scale(1) translateX(0); }
  25% { transform: scale(1.02) translateX(-2px) rotate(-1deg); }
  50% { transform: scale(1.04) translateX(0); }
  75% { transform: scale(1.02) translateX(2px) rotate(1deg); }
}

@keyframes living-think {
  0% { filter: hue-rotate(0deg); }
  100% { filter: hue-rotate(30deg); }
}

@keyframes living-idle {
  0%, 100% { transform: scale(1); box-shadow: 0 0 60px rgba(96, 165, 250, 0.6), inset 0 -30px 60px rgba(0, 0, 0, 0.4), inset 0 30px 60px rgba(255, 255, 255, 0.4); }
  50% { transform: scale(1.02); box-shadow: 0 0 80px rgba(96, 165, 250, 0.8), inset 0 -30px 60px rgba(0, 0, 0, 0.4), inset 0 30px 60px rgba(255, 255, 255, 0.4); }
}

@keyframes shimmer-move {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.6; }
  50% { transform: translate(10px, 5px) scale(1.1); opacity: 0.8; }
}

/* 4-Dot Equalizer (ChatGPT style when AI speaks) */
.voice-equalizer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 180px;
}

.voice-equalizer__dot {
  width: 40px;
  height: 40px;
  background: #fff;
  border-radius: 50%;
  animation: eq-bounce 1.2s ease-in-out infinite;
}

.voice-equalizer__dot--1 { animation-delay: 0s; }
.voice-equalizer__dot--2 { animation-delay: 0.15s; }
.voice-equalizer__dot--3 { animation-delay: 0.3s; }
.voice-equalizer__dot--4 { animation-delay: 0.45s; }

@keyframes eq-bounce {
  0%, 100% { transform: scaleY(1); opacity: 0.6; }
  50% { transform: scaleY(1.8); opacity: 1; }
}

.voice-state-label { font-size: 1rem; color: rgba(255, 255, 255, 0.7); text-align: center; }
.voice-transcript-mini { max-width: 300px; text-align: center; font-size: 0.875rem; color: rgba(255, 255, 255, 0.5); }
.voice-transcript-mini--ai { color: rgba(96, 165, 250, 0.8); }

/* Bottom bar */
.voice-bottom-bar { display: flex; justify-content: center; gap: 20px; padding: 24px; padding-bottom: max(24px, env(safe-area-inset-bottom)); }
.voice-bottom-btn { width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer; transition: all 0.2s ease; }
.voice-bottom-btn--mic { background: #fff; color: #000; }
.voice-bottom-btn--mic:hover { transform: scale(1.05); }
.voice-bottom-btn--mic.voice-bottom-btn--active { background: #22c55e; color: #fff; }
.voice-bottom-btn--close { background: rgba(255, 255, 255, 0.1); color: #fff; }
.voice-bottom-btn--close:hover { background: rgba(255, 255, 255, 0.2); }

.modal-enter-active, .modal-leave-active { transition: opacity 0.3s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.voice-level { display: none; }

/* Header - title left, X right */
.voice-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg);
}

.voice-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.voice-close {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 50%;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.voice-close:hover {
  background: var(--color-surface-elevated);
  color: var(--color-text);
}

/* Orb Container */
.voice-orb-container {
  position: relative;
  width: 220px;
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* The main orb (GPT-VOICE-012) */
.voice-orb {
  position: relative;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.1s ease-out;
  transform: scale(var(--orb-scale, 1));
}

.voice-orb__inner {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: linear-gradient(
    135deg,
    rgba(139, 92, 246, 0.3) 0%,
    rgba(168, 85, 247, 0.2) 50%,
    rgba(139, 92, 246, 0.1) 100%
  );
  box-shadow: 
    0 0 60px rgba(139, 92, 246, calc(0.3 * var(--orb-glow, 0))),
    0 0 120px rgba(139, 92, 246, calc(0.2 * var(--orb-glow, 0))),
    inset 0 0 60px rgba(139, 92, 246, 0.1);
  overflow: hidden;
}

.voice-orb__core {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 60%;
  height: 60%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(
    circle,
    var(--orb-color, var(--color-accent)) 0%,
    transparent 70%
  );
  opacity: calc(0.5 + 0.5 * var(--orb-glow, 0));
  animation: pulse-core 2s ease-in-out infinite;
}

.voice-orb__ring {
  position: absolute;
  inset: 10%;
  border-radius: 50%;
  border: 2px solid var(--orb-color, var(--color-accent));
  opacity: calc(0.2 + 0.3 * var(--orb-glow, 0));
  animation: ring-pulse 3s ease-in-out infinite;
}

.voice-orb__ring--2 {
  inset: 20%;
  animation-delay: -1s;
}

.voice-orb__ring--3 {
  inset: 30%;
  animation-delay: -2s;
}

.voice-orb__icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  z-index: 2;
}

.voice-orb__icon--spin {
  animation: spin 1s linear infinite;
}

/* Orb states */
.voice-orb--listening .voice-orb__inner {
  background: linear-gradient(
    135deg,
    rgba(34, 197, 94, 0.3) 0%,
    rgba(22, 163, 74, 0.2) 100%
  );
  box-shadow: 
    0 0 80px rgba(34, 197, 94, calc(0.4 * var(--orb-glow, 0))),
    0 0 160px rgba(34, 197, 94, calc(0.2 * var(--orb-glow, 0)));
}

.voice-orb--thinking .voice-orb__inner {
  background: linear-gradient(
    135deg,
    rgba(245, 158, 11, 0.3) 0%,
    rgba(217, 119, 6, 0.2) 100%
  );
  animation: thinking-glow 2s ease-in-out infinite;
}

.voice-orb--speaking .voice-orb__inner {
  background: linear-gradient(
    135deg,
    rgba(139, 92, 246, 0.4) 0%,
    rgba(168, 85, 247, 0.3) 100%
  );
}

.voice-orb--error .voice-orb__inner {
  background: linear-gradient(
    135deg,
    rgba(239, 68, 68, 0.3) 0%,
    rgba(220, 38, 38, 0.2) 100%
  );
}

/* Animations */
@keyframes pulse-core {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
  50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.8; }
}

@keyframes ring-pulse {
  0%, 100% { transform: scale(1); opacity: 0.2; }
  50% { transform: scale(1.05); opacity: 0.4; }
}

@keyframes thinking-glow {
  0%, 100% { box-shadow: 0 0 60px rgba(245, 158, 11, 0.3); }
  50% { box-shadow: 0 0 100px rgba(245, 158, 11, 0.5); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* State Label */
.voice-state {
  text-align: center;
  min-height: 28px;
}

.voice-state__label {
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  transition: color 0.3s;
}

.voice-state__label--listening {
  color: #22c55e;
}

.voice-state__label--error {
  color: var(--color-error);
}

/* Transcripts (GPT-VOICE-013) */
.voice-transcripts {
  width: 100%;
  min-height: 100px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.voice-transcript {
  padding: var(--spacing-md);
  background: rgba(255, 255, 255, 0.03);
  border-radius: var(--radius-lg);
  border-left: 3px solid;
}

.voice-transcript--user {
  border-color: #22c55e;
}

.voice-transcript--ai {
  border-color: var(--color-accent);
}

.voice-transcript__label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  display: block;
  margin-bottom: var(--spacing-xs);
}

.voice-transcript--user .voice-transcript__label {
  color: #22c55e;
}

.voice-transcript--ai .voice-transcript__label {
  color: var(--color-accent);
}

.voice-transcript__text {
  margin: 0;
  color: var(--color-text);
  font-size: 0.95rem;
  line-height: 1.5;
}

/* History */
.voice-history {
  width: 100%;
  max-height: 120px;
  overflow-y: auto;
}

.voice-history__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-sm);
}

.voice-history__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.voice-history__item {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  padding: var(--spacing-xs);
  background: rgba(255, 255, 255, 0.02);
  border-radius: var(--radius-sm);
}

.voice-history__item--user {
  border-left: 2px solid #22c55e;
}

.voice-history__role {
  font-weight: 600;
  margin-right: var(--spacing-xs);
}

/* Controls */
.voice-controls {
  display: flex;
  gap: var(--spacing-md);
}

.voice-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-full);
  border: none;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.voice-btn--end {
  background: var(--color-error);
  color: white;
}

.voice-btn--end:hover {
  filter: brightness(1.1);
  transform: scale(1.05);
}

.voice-btn--interrupt {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.voice-btn--interrupt:hover {
  background: rgba(245, 158, 11, 0.3);
}

/* Instructions */
.voice-instructions {
  text-align: center;
}

.voice-instructions p {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin: 0;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Hidden audio level indicator */
.voice-level {
  display: none;
}
</style>

