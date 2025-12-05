import { memoize } from './memoize';

const ABSOLUTE_URL_PATTERN = /^(?:[a-z][a-z0-9+.-]*:)?\/\//iu;
const DATA_URL_PATTERN = /^data:/iu;
const BLOB_URL_PATTERN = /^blob:/iu;
const EXERCISE_MEDIA_PATTERN = /\/exercise-levels\//iu;

const DEFAULT_WIDTHS = Object.freeze([320, 480, 640, 768, 960, 1280]);
const DEFAULT_SIZES = '(max-width: 768px) 90vw, min(640px, 60vw)';
const DEFAULT_QUALITY = 82;

export type ExerciseImageSource = {
  src: string;
  srcset?: string | null;
  sizes?: string | null;
};

const appendQueryParam = (
  url: string,
  key: string,
  value?: string | number | null,
): string => {
  if (value === null || value === undefined || value === '') {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
};

const withQueryParams = (
  url: string,
  params: {
    maxWidth?: number | null;
    maxHeight?: number | null;
    quality?: number | null;
  },
): string => {
  let result = url;
  if (params.maxWidth && Number.isFinite(params.maxWidth)) {
    result = appendQueryParam(result, 'maxWidth', Math.max(1, Math.floor(params.maxWidth)));
  }
  if (params.maxHeight && Number.isFinite(params.maxHeight)) {
    result = appendQueryParam(result, 'maxHeight', Math.max(1, Math.floor(params.maxHeight)));
  }
  if (params.quality && Number.isFinite(params.quality)) {
    result = appendQueryParam(result, 'quality', Math.max(1, Math.min(100, Math.floor(params.quality))));
  }
  return result;
};

export const normalizeExerciseImageValue = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (DATA_URL_PATTERN.test(trimmed) || BLOB_URL_PATTERN.test(trimmed)) {
    return trimmed;
  }
  if (ABSOLUTE_URL_PATTERN.test(trimmed) || trimmed.startsWith('/')) {
    return trimmed;
  }
  return `data:image/webp;base64,${trimmed}`;
};

type BuildExerciseImageSourceOptions = {
  defaultWidth?: number;
  widths?: number[];
  sizes?: string;
  quality?: number;
  maxHeight?: number;
};

const imageSourceCacheKey = (
  value?: string | null,
  options: BuildExerciseImageSourceOptions = {},
): string => {
  const normalized = normalizeExerciseImageValue(value) ?? 'null';
  const widthsKey = Array.isArray(options.widths) ? options.widths.join(',') : 'auto';
  return [
    normalized,
    options.defaultWidth ?? 'auto',
    options.sizes ?? 'auto',
    options.quality ?? 'auto',
    options.maxHeight ?? 'auto',
    widthsKey,
  ].join('|');
};

const buildExerciseImageSourceInternal = (
  value?: string | null,
  options: BuildExerciseImageSourceOptions = {},
): ExerciseImageSource | null => {
  const normalized = normalizeExerciseImageValue(value);
  if (!normalized) {
    return null;
  }

  const shouldOptimize = EXERCISE_MEDIA_PATTERN.test(normalized);
  const defaultWidth = options.defaultWidth ?? 640;
  const targetQuality = options.quality ?? DEFAULT_QUALITY;
  const maxHeight = options.maxHeight;

  let src = normalized;
  let srcset: string | null = null;

  if (shouldOptimize) {
    src = withQueryParams(normalized, {
      maxWidth: defaultWidth,
      maxHeight,
      quality: targetQuality,
    });

    const widths = Array.from(
      new Set((options.widths ?? DEFAULT_WIDTHS).filter((width) => Number.isFinite(width) && width > 0)),
    ).sort((a, b) => a - b);

    const entries = widths
      .map((width) =>
        withQueryParams(normalized, {
          maxWidth: width,
          maxHeight,
          quality: targetQuality,
        }),
      )
      .map((variant, index) => `${variant} ${widths[index]}w`);

    if (entries.length) {
      srcset = entries.join(', ');
    }
  }

  return {
    src,
    srcset,
    sizes: options.sizes ?? DEFAULT_SIZES,
  };
};

export const buildExerciseImageSource = memoize(buildExerciseImageSourceInternal, {
  getKey: (value?: string | null, options: BuildExerciseImageSourceOptions = {}) =>
    imageSourceCacheKey(value, options),
  maxSize: 2000,
});

export const collectExerciseImageSources = (
  values: Array<string | null | undefined>,
  options?: BuildExerciseImageSourceOptions,
): ExerciseImageSource[] => {
  const sources: ExerciseImageSource[] = [];
  const seen = new Set<string>();

  values.forEach((value) => {
    const source = buildExerciseImageSource(value, options);
    if (source && !seen.has(source.src)) {
      seen.add(source.src);
      sources.push(source);
    }
  });

  return sources;
};

export const DEFAULT_EXERCISE_IMAGE_SIZES = DEFAULT_SIZES;
