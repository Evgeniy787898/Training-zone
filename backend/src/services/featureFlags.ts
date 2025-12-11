/**
 * Feature Flags Service (ARCH-V03)
 * 
 * Simple feature flags implementation with:
 * - Environment-based configuration
 * - Percentage-based rollout (canary releases)
 * - User-specific overrides
 */

// Feature flag definitions
export interface FeatureFlag {
    name: string;
    description: string;
    enabled: boolean;
    rolloutPercentage: number; // 0-100
    allowedUsers: string[];    // User IDs with explicit access
    deniedUsers: string[];     // User IDs explicitly blocked
}

// Default feature flags
const DEFAULT_FLAGS: Record<string, FeatureFlag> = {
    // AI Features
    'ai.streaming': {
        name: 'AI Streaming',
        description: 'Enable SSE streaming for AI responses',
        enabled: true,
        rolloutPercentage: 100,
        allowedUsers: [],
        deniedUsers: [],
    },
    'ai.celebration': {
        name: 'AI Celebration',
        description: 'Enable AI celebration messages on workout completion',
        enabled: true,
        rolloutPercentage: 100,
        allowedUsers: [],
        deniedUsers: [],
    },
    'ai.intent': {
        name: 'AI Intent Detection',
        description: 'Enable natural language intent detection in bot',
        enabled: true,
        rolloutPercentage: 100,
        allowedUsers: [],
        deniedUsers: [],
    },

    // UI Features
    'ui.focusMode': {
        name: 'Focus Mode',
        description: 'Enable fullscreen focus mode during training',
        enabled: true,
        rolloutPercentage: 100,
        allowedUsers: [],
        deniedUsers: [],
    },
    'ui.hapticFeedback': {
        name: 'Haptic Feedback',
        description: 'Enable haptic feedback on mobile',
        enabled: true,
        rolloutPercentage: 100,
        allowedUsers: [],
        deniedUsers: [],
    },
    'ui.microAnimations': {
        name: 'Micro Animations',
        description: 'Enable micro animations library',
        enabled: true,
        rolloutPercentage: 100,
        allowedUsers: [],
        deniedUsers: [],
    },

    // Experimental Features
    'experimental.voiceInput': {
        name: 'Voice Input',
        description: 'Enable voice input in bot (STT)',
        enabled: false,
        rolloutPercentage: 0,
        allowedUsers: [],
        deniedUsers: [],
    },
    'experimental.wearables': {
        name: 'Wearables Integration',
        description: 'Enable integration with fitness trackers',
        enabled: false,
        rolloutPercentage: 0,
        allowedUsers: [],
        deniedUsers: [],
    },
};

// Load flags from environment
const loadFlagsFromEnv = (): void => {
    const envFlags = process.env.FEATURE_FLAGS;
    if (!envFlags) return;

    try {
        const parsed = JSON.parse(envFlags);
        Object.entries(parsed).forEach(([key, value]) => {
            if (flags[key] && typeof value === 'boolean') {
                flags[key].enabled = value;
            }
        });
    } catch (e) {
        console.warn('[feature-flags] Failed to parse FEATURE_FLAGS env:', e);
    }
};

// In-memory flags store
const flags: Record<string, FeatureFlag> = { ...DEFAULT_FLAGS };

// Initialize from env
loadFlagsFromEnv();

/**
 * Simple hash function for user ID to determine rollout bucket
 */
const hashUserId = (userId: string): number => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        const char = userId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash % 100);
};

/**
 * Check if a feature is enabled for a specific user
 */
export const isFeatureEnabled = (
    flagName: string,
    userId?: string
): boolean => {
    const flag = flags[flagName];
    if (!flag) {
        console.warn(`[feature-flags] Unknown flag: ${flagName}`);
        return false;
    }

    // Global disable
    if (!flag.enabled) {
        return false;
    }

    // Check explicit user lists
    if (userId) {
        if (flag.deniedUsers.includes(userId)) {
            return false;
        }
        if (flag.allowedUsers.includes(userId)) {
            return true;
        }

        // Percentage-based rollout
        if (flag.rolloutPercentage < 100) {
            const userBucket = hashUserId(userId);
            return userBucket < flag.rolloutPercentage;
        }
    }

    return true;
};

/**
 * Get all feature flags (for admin panel)
 */
export const getAllFlags = (): Record<string, FeatureFlag> => {
    return { ...flags };
};

/**
 * Update a feature flag at runtime
 */
export const updateFlag = (
    flagName: string,
    updates: Partial<FeatureFlag>
): boolean => {
    const flag = flags[flagName];
    if (!flag) {
        console.warn(`[feature-flags] Cannot update unknown flag: ${flagName}`);
        return false;
    }

    Object.assign(flag, updates);
    console.log(`[feature-flags] Updated flag ${flagName}:`, updates);
    return true;
};

/**
 * Set rollout percentage (for canary releases)
 */
export const setRolloutPercentage = (
    flagName: string,
    percentage: number
): boolean => {
    if (percentage < 0 || percentage > 100) {
        console.warn(`[feature-flags] Invalid percentage: ${percentage}`);
        return false;
    }
    return updateFlag(flagName, { rolloutPercentage: percentage });
};

export default {
    isEnabled: isFeatureEnabled,
    getAll: getAllFlags,
    update: updateFlag,
    setRollout: setRolloutPercentage,
};
