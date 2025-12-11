/**
 * Voice Commands for Hands-Free Training (FE-V03)
 * 
 * Web Speech API integration for voice control during workouts.
 * Commands: "Готово", "Дальше", "Назад", "Пауза", "Стоп"
 */

import { ref, onUnmounted } from 'vue';

// Voice command definitions
interface VoiceCommand {
    keywords: string[];
    action: string;
    description: string;
}

// Supported voice commands (Russian)
const VOICE_COMMANDS: VoiceCommand[] = [
    {
        keywords: ['готово', 'готов', 'сделал', 'выполнил', 'done'],
        action: 'done',
        description: 'Отметить упражнение как выполненное',
    },
    {
        keywords: ['дальше', 'следующий', 'следующее', 'next'],
        action: 'next',
        description: 'Перейти к следующему упражнению',
    },
    {
        keywords: ['назад', 'предыдущий', 'предыдущее', 'back'],
        action: 'back',
        description: 'Вернуться к предыдущему упражнению',
    },
    {
        keywords: ['пауза', 'стоп', 'pause', 'stop'],
        action: 'pause',
        description: 'Приостановить таймер',
    },
    {
        keywords: ['продолжить', 'старт', 'resume', 'start'],
        action: 'resume',
        description: 'Продолжить таймер',
    },
    {
        keywords: ['помощь', 'команды', 'help'],
        action: 'help',
        description: 'Показать список команд',
    },
];

// Check if Web Speech API is supported
export const isSpeechRecognitionSupported = (): boolean => {
    return !!(
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition
    );
};

// Get SpeechRecognition constructor
const getSpeechRecognition = (): any => {
    return (
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition ||
        null
    );
};

/**
 * Vue composable for voice commands
 */
export const useVoiceCommands = (
    onCommand: (action: string, transcript: string) => void
) => {
    const isListening = ref(false);
    const isSupported = ref(isSpeechRecognitionSupported());
    const lastTranscript = ref('');
    const error = ref<string | null>(null);

    let recognition: any = null;

    // Initialize speech recognition
    const initRecognition = () => {
        const SpeechRecognition = getSpeechRecognition();
        if (!SpeechRecognition) {
            error.value = 'Speech recognition not supported';
            return null;
        }

        const rec = new SpeechRecognition();
        rec.lang = 'ru-RU';
        rec.continuous = true;
        rec.interimResults = false;
        rec.maxAlternatives = 1;

        rec.onresult = (event: any) => {
            const result = event.results[event.results.length - 1];
            if (result.isFinal) {
                const transcript = result[0].transcript.toLowerCase().trim();
                lastTranscript.value = transcript;

                // Match against commands
                for (const cmd of VOICE_COMMANDS) {
                    for (const keyword of cmd.keywords) {
                        if (transcript.includes(keyword)) {
                            console.log(`[voice] Command matched: ${cmd.action} from "${transcript}"`);
                            onCommand(cmd.action, transcript);
                            return;
                        }
                    }
                }

                console.log(`[voice] No command matched for: "${transcript}"`);
            }
        };

        rec.onerror = (event: any) => {
            console.warn('[voice] Recognition error:', event.error);
            error.value = event.error;
            if (event.error !== 'no-speech') {
                isListening.value = false;
            }
        };

        rec.onend = () => {
            // Auto-restart if still listening
            if (isListening.value) {
                try {
                    rec.start();
                } catch (e) {
                    console.warn('[voice] Failed to restart:', e);
                }
            }
        };

        return rec;
    };

    // Start listening
    const startListening = () => {
        if (!isSupported.value) {
            error.value = 'Speech recognition not supported';
            return false;
        }

        if (!recognition) {
            recognition = initRecognition();
        }

        if (recognition && !isListening.value) {
            try {
                recognition.start();
                isListening.value = true;
                error.value = null;
                console.log('[voice] Started listening');
                return true;
            } catch (e) {
                console.error('[voice] Failed to start:', e);
                error.value = 'Failed to start listening';
                return false;
            }
        }
        return false;
    };

    // Stop listening
    const stopListening = () => {
        if (recognition && isListening.value) {
            try {
                recognition.stop();
                isListening.value = false;
                console.log('[voice] Stopped listening');
            } catch (e) {
                console.warn('[voice] Failed to stop:', e);
            }
        }
    };

    // Toggle listening
    const toggleListening = () => {
        if (isListening.value) {
            stopListening();
        } else {
            startListening();
        }
    };

    // Get available commands
    const getCommands = (): VoiceCommand[] => VOICE_COMMANDS;

    // Cleanup on unmount
    onUnmounted(() => {
        stopListening();
    });

    return {
        isListening,
        isSupported,
        lastTranscript,
        error,
        startListening,
        stopListening,
        toggleListening,
        getCommands,
    };
};

export default {
    useVoiceCommands,
    isSpeechRecognitionSupported,
    VOICE_COMMANDS,
};
