/**
 * Training module types
 * Contains type definitions used across training-related components
 */

/**
 * Represents a program level value
 * Can be a simple number or a structured object with level and currentLevel
 */
export type ProgramLevel = number | {
    level?: number;
    currentLevel?: number;
};

/**
 * Map of exercise keys to their program levels
 */
export type ProgramLevelMap = Record<string, ProgramLevel>;
