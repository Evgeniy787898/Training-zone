const normalizeString = (value: unknown) => {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim().toLowerCase();
};

const hasMatchingCode = (error: Record<string, any>, codes: ReadonlySet<string>) => {
    const code = typeof error.code === 'string' ? error.code : undefined;
    return code ? codes.has(code) : false;
};

const includesAny = (haystack: string, needles: string[]) => {
    if (!haystack) {
        return false;
    }
    return needles.some((needle) => haystack.includes(needle));
};

const createSchemaErrorDetector = (hints: string[], codes: string[] = []) => {
    const normalizedHints = hints.map((item) => item.toLowerCase());
    const codeSet = new Set(codes);

    return (error: unknown): boolean => {
        if (!error || typeof error !== 'object') {
            return false;
        }

        const err = error as Record<string, any>;

        if (codes.length && hasMatchingCode(err, codeSet)) {
            return true;
        }

        const message = normalizeString(err.message);
        if (includesAny(message, normalizedHints)) {
            return true;
        }

        const metaTarget = normalizeString(err.meta?.target);
        if (includesAny(metaTarget, normalizedHints)) {
            return true;
        }

        const metaColumn = normalizeString(err.meta?.column_name);
        if (includesAny(metaColumn, normalizedHints)) {
            return true;
        }

        return false;
    };
};

export const isTrainingSessionSchemaError = createSchemaErrorDetector(
    ['training_session', 'training sessions', 'training_session_exercises', 'training session exercises'],
    ['P2021', 'P2022', 'P2010', 'P2003', 'P2000']
);

export const isUserProgramSchemaError = createSchemaErrorDetector(
    ['user_training_program', 'user training program', 'user_training_programs', 'user training programs'],
    ['P2021', 'P2022', 'P2010', 'P2000', 'P2003', 'P2025']
);

export const isAchievementSchemaError = createSchemaErrorDetector(
    ['achievement', 'achievements'],
    ['P2021', 'P2022', 'P2010', 'P2003', 'P2000']
);

