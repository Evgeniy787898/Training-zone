import path from 'node:path';
import type { PathTraversalErrorShape } from '../types/exceptions.js';

export class PathTraversalError extends Error implements PathTraversalErrorShape {
    override name: 'PathTraversalError';

    constructor(message: string, public readonly baseDir: string, public readonly attemptedPath: string) {
        super(message);
        this.name = 'PathTraversalError';
    }
}

type PathSegment = string | number;

const sanitizeSegment = (segment: PathSegment, baseDir: string): string => {
    if (segment === null || segment === undefined) {
        throw new PathTraversalError('Path segment is undefined', baseDir, String(segment));
    }
    const value = String(segment);
    if (value.includes('\0')) {
        throw new PathTraversalError('Path segment contains null byte', baseDir, value);
    }
    return value;
};

const isRelativeTraversal = (relative: string): boolean => {
    if (!relative) {
        return false;
    }
    if (relative === '') {
        return false;
    }
    return relative.split(path.sep).some((part) => part === '..');
};

export const resolveSafePath = (baseDir: string, ...segments: PathSegment[]): string => {
    if (!baseDir) {
        throw new Error('Base directory must be provided for resolveSafePath');
    }
    const normalizedBase = path.resolve(baseDir);
    const sanitizedSegments = segments.map((segment) => sanitizeSegment(segment, normalizedBase));
    const resolved = path.resolve(normalizedBase, ...sanitizedSegments);
    const relative = path.relative(normalizedBase, resolved);

    if (relative === '' || (!isRelativeTraversal(relative) && !relative.startsWith('..') && !path.isAbsolute(relative))) {
        return resolved;
    }

    throw new PathTraversalError('Resolved path escapes the allowed directory', normalizedBase, resolved);
};

export const ensurePathWithin = (baseDir: string, targetPath: string): string => {
    if (!baseDir) {
        throw new Error('Base directory must be provided for ensurePathWithin');
    }
    if (!targetPath) {
        throw new PathTraversalError('Target path is empty', path.resolve(baseDir), targetPath);
    }

    const normalizedBase = path.resolve(baseDir);
    const normalizedTarget = path.resolve(targetPath);
    const relative = path.relative(normalizedBase, normalizedTarget);

    if (relative === '' || (!isRelativeTraversal(relative) && !relative.startsWith('..') && !path.isAbsolute(relative))) {
        return normalizedTarget;
    }

    throw new PathTraversalError('Target path escapes the allowed directory', normalizedBase, normalizedTarget);
};

export const isPathWithin = (baseDir: string, targetPath: string): boolean => {
    try {
        ensurePathWithin(baseDir, targetPath);
        return true;
    } catch (error) {
        return false;
    }
};

export const createSafeFileAccess = (baseDir: string) => {
    if (!baseDir) {
        throw new Error('Base directory must be provided for createSafeFileAccess');
    }
    const normalizedBase = path.resolve(baseDir);

    const resolvePath = (...segments: PathSegment[]) => resolveSafePath(normalizedBase, ...segments);

    return {
        root: normalizedBase,
        resolve: resolvePath,
        isWithin: (targetPath: string) => isPathWithin(normalizedBase, targetPath),
    } as const;
};
