import { imageProcessorConfig } from '../../config/constants.js';
import { cacheGet, cacheSet } from '../infrastructure/cache.js';
import { ensureTraceId } from '../../services/trace.js';
import { parseImageProcessorResponse } from '../../services/externalDataValidation.js';

const coverPositions = [
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
] as const;

type CoverPosition = (typeof coverPositions)[number];
type ResizeMode = (typeof imageProcessorConfig.allowedResizeModes)[number];

export type ImageOptimizationOptions = {
  maxWidth?: number | null;
  maxHeight?: number | null;
  quality?: number | null;
  format?: string | null;
  resizeMode?: string | null;
  coverPosition?: CoverPosition | string | null;
  background?: string | null;
  grayscale?: boolean | null;
  sharpen?: boolean | null;
  stripMetadata?: boolean | null;
  traceId?: string | null;
  cacheKey?: string | null;
};

export type ImageOptimizationResult = {
  buffer: Buffer;
  width: number;
  height: number;
  format: string | null;
  size: number;
  optimized: boolean;
  fromCache: boolean;
};

type CachedOptimizedImage = {
  payload: string;
  width: number;
  height: number;
  format: string | null;
  size: number;
};

const hasImageProcessor = (): boolean =>
  Boolean(imageProcessorConfig.enabled && imageProcessorConfig.baseUrl);

const normalizeDimension = (value: number | null | undefined, fallback: number): number | null => {
  if (value === null) {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return clampDimension(Math.floor(value));
  }
  if (typeof fallback === 'number' && Number.isFinite(fallback) && fallback > 0) {
    return clampDimension(Math.floor(fallback));
  }
  return null;
};

const clampDimension = (value: number): number =>
  clampNumber(
    value,
    imageProcessorConfig.limits.minDimension,
    imageProcessorConfig.limits.maxDimension,
  );

const normalizeQuality = (value: number | null | undefined): number => {
  const fallback = imageProcessorConfig.defaults.quality;
  if (value === null) {
    return fallback;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clampNumber(
      Math.floor(value),
      imageProcessorConfig.limits.minQuality,
      imageProcessorConfig.limits.maxQuality,
    );
  }
  return fallback;
};

const clampNumber = (value: number, min: number, max: number): number => {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

const normalizeFormat = (format: unknown): string | null => {
  if (!format || typeof format !== 'string') {
    return null;
  }
  const normalized = format.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith('image/')) {
    return normalized;
  }
  return `image/${normalized}`;
};

const isAllowedFormat = (format: string | null | undefined): boolean => {
  if (!format) {
    return false;
  }
  return imageProcessorConfig.allowedFormats.includes(format);
};

type AcceptFormat = { mime: string; quality: number };

const parseAcceptHeader = (acceptHeader: string | null | undefined): AcceptFormat[] => {
  if (!acceptHeader || typeof acceptHeader !== 'string') {
    return [];
  }

  return acceptHeader
    .split(',')
    .map((part) => {
      const [mime, ...params] = part.trim().split(';');
      const qualityParam = params
        .map((param) => param.trim())
        .find((param) => param.startsWith('q='));
      const quality = qualityParam ? Number.parseFloat(qualityParam.slice(2)) : 1;
      return { mime: mime.toLowerCase(), quality: Number.isFinite(quality) ? quality : 0 };
    })
    .filter((entry) => Boolean(entry.mime))
    .sort((a, b) => b.quality - a.quality);
};

export const resolveTargetImageFormat = (
  explicitFormat: string | null | undefined,
  acceptHeader: string | null | undefined,
): string | null => {
  const normalizedExplicit = normalizeFormat(explicitFormat);
  if (isAllowedFormat(normalizedExplicit)) {
    return normalizedExplicit;
  }

  const accepted = parseAcceptHeader(acceptHeader);
  for (const entry of accepted) {
    const normalized = normalizeFormat(entry.mime);
    if (isAllowedFormat(normalized)) {
      return normalized;
    }
    if (entry.mime === '*/*') {
      break;
    }
  }

  if (isAllowedFormat(imageProcessorConfig.defaults.format)) {
    return imageProcessorConfig.defaults.format;
  }

  return imageProcessorConfig.allowedFormats[0] ?? null;
};

const toProcessorFormat = (format: string): string => format.replace(/^image\//, '');

const normalizeResizeMode = (mode: unknown): ResizeMode => {
  if (!mode || typeof mode !== 'string') {
    return imageProcessorConfig.defaults.mode;
  }
  const normalized = mode.trim().toLowerCase() as ResizeMode;
  return imageProcessorConfig.allowedResizeModes.includes(normalized)
    ? normalized
    : imageProcessorConfig.defaults.mode;
};

const normalizeCoverPosition = (position: unknown): CoverPosition => {
  if (!position || typeof position !== 'string') {
    return 'center';
  }
  const normalized = position.trim().toLowerCase() as CoverPosition;
  return coverPositions.includes(normalized) ? normalized : 'center';
};

const hexColorPattern = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const normalizeBackgroundColor = (
  color: unknown,
): { value: string | null; isCustom: boolean } => {
  if (color === null) {
    return { value: null, isCustom: true };
  }
  if (!color || typeof color !== 'string') {
    return { value: imageProcessorConfig.defaults.background ?? null, isCustom: false };
  }
  const trimmed = color.trim();
  if (!trimmed) {
    return { value: imageProcessorConfig.defaults.background ?? null, isCustom: false };
  }
  const match = trimmed.match(hexColorPattern);
  if (!match) {
    return { value: imageProcessorConfig.defaults.background ?? null, isCustom: false };
  }
  let hex = match[1];
  if (hex.length === 3 || hex.length === 4) {
    hex = hex
      .split('')
      .map((char) => `${char}${char}`)
      .join('');
  }
  if (hex.length === 6) {
    hex = `${hex}FF`;
  }
  return { value: `#${hex.toUpperCase()}`, isCustom: true };
};

const normalizeBooleanFlag = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const buildCacheKey = (baseKey: string | null | undefined, suffix: string): string | null => {
  if (!baseKey || imageProcessorConfig.cacheTtlSeconds <= 0) {
    return null;
  }
  return `imageproc:${baseKey}:${suffix}`;
};

const logProcessorError = (message: string, error: unknown, metadata?: Record<string, unknown>) => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  console.error(message, {
    error: error instanceof Error ? { name: error.name, message: error.message } : error,
    ...metadata,
  });
};

type NormalizedOptimizationOptions = {
  maxWidth: number | null;
  maxHeight: number | null;
  quality: number;
  format: string;
  mode: ResizeMode;
  coverPosition: CoverPosition;
  background: string | null;
  backgroundIsCustom: boolean;
  adjustments: {
    grayscale: boolean;
    sharpen: boolean;
    stripMetadata: boolean;
  };
};

const shouldSendResizePayload = (options: NormalizedOptimizationOptions): boolean =>
  Boolean(
    options.maxWidth ||
    options.maxHeight ||
    (options.backgroundIsCustom && options.background !== null) ||
    options.mode !== imageProcessorConfig.defaults.mode ||
    options.coverPosition !== 'center',
  );

const buildResizePayload = (
  options: NormalizedOptimizationOptions,
): Record<string, unknown> | undefined => {
  if (!shouldSendResizePayload(options)) {
    return undefined;
  }
  const resize: Record<string, unknown> = {
    mode: options.mode,
  };
  if (options.maxWidth) {
    resize.maxWidth = options.maxWidth;
  }
  if (options.maxHeight) {
    resize.maxHeight = options.maxHeight;
  }
  if (options.coverPosition !== 'center') {
    resize.position = options.coverPosition;
  }
  if (options.backgroundIsCustom && options.background) {
    resize.background = options.background;
  }
  return resize;
};

const requestProcessor = async (
  payload: string,
  options: NormalizedOptimizationOptions,
  traceId?: string | null,
): Promise<CachedOptimizedImage | null> => {
  if (!hasImageProcessor()) {
    return null;
  }
  let requestUrl: string;
  try {
    requestUrl = new URL(imageProcessorConfig.endpoint, imageProcessorConfig.baseUrl).toString();
  } catch (error) {
    logProcessorError('[image-processor] invalid base URL', error);
    return null;
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(1_000, imageProcessorConfig.timeoutMs);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body: Record<string, unknown> = {
      image: payload,
      quality: options.quality,
      format: toProcessorFormat(options.format),
      adjustments: {
        grayscale: options.adjustments.grayscale,
        sharpen: options.adjustments.sharpen,
        stripMetadata: options.adjustments.stripMetadata,
      },
    };

    const resizePayload = buildResizePayload(options);
    if (resizePayload) {
      body.resize = resizePayload;
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    const normalizedTraceId = ensureTraceId(traceId);
    if (normalizedTraceId) {
      headers['x-trace-id'] = normalizedTraceId;
    }

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`image-processor responded with ${response.status}`);
    }

    const data = parseImageProcessorResponse(await response.json());

    return {
      payload: data.processedImage,
      width: Number(data.width) || 0,
      height: Number(data.height) || 0,
      format: normalizeFormat(data.format) ?? 'image/webp',
      size: Number(data.size) || Buffer.from(data.processedImage, 'base64').length,
    };
  } catch (error) {
    logProcessorError('[image-processor] request failed', error, { traceId });
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const buildCacheSuffix = (options: NormalizedOptimizationOptions): string => {
  const backgroundToken = options.backgroundIsCustom
    ? options.background ?? 'disabled'
    : 'default';
  const parts = [
    `w:${options.maxWidth ?? 'auto'}`,
    `h:${options.maxHeight ?? 'auto'}`,
    `q:${options.quality}`,
    `fmt:${options.format}`,
    `mode:${options.mode}`,
    `pos:${options.coverPosition}`,
    `bg:${backgroundToken}`,
    `gs:${options.adjustments.grayscale ? 1 : 0}`,
    `sh:${options.adjustments.sharpen ? 1 : 0}`,
    `sm:${options.adjustments.stripMetadata ? 1 : 0}`,
  ];
  return parts.join(':');
};

const fallbackResult = (buffer: Buffer): ImageOptimizationResult => ({
  buffer,
  width: 0,
  height: 0,
  format: null,
  size: buffer.length,
  optimized: false,
  fromCache: false,
});

export const optimizeImageBuffer = async (
  buffer: Buffer,
  options: ImageOptimizationOptions = {},
): Promise<ImageOptimizationResult> => {
  if (!buffer || buffer.length === 0 || !hasImageProcessor()) {
    return fallbackResult(buffer);
  }

  const background = normalizeBackgroundColor(options.background);

  const normalized: NormalizedOptimizationOptions = {
    maxWidth: normalizeDimension(options.maxWidth, imageProcessorConfig.defaults.maxWidth),
    maxHeight: normalizeDimension(options.maxHeight, imageProcessorConfig.defaults.maxHeight),
    quality: normalizeQuality(options.quality),
    format: normalizeFormat(options.format) ?? imageProcessorConfig.defaults.format,
    mode: normalizeResizeMode(options.resizeMode),
    coverPosition: normalizeCoverPosition(options.coverPosition),
    background: background.value,
    backgroundIsCustom: background.isCustom,
    adjustments: {
      grayscale: normalizeBooleanFlag(options.grayscale, false),
      sharpen: normalizeBooleanFlag(options.sharpen, false),
      stripMetadata: normalizeBooleanFlag(
        options.stripMetadata,
        imageProcessorConfig.defaults.stripMetadata,
      ),
    },
  };

  const cacheSuffix = buildCacheSuffix(normalized);
  const cacheKey = buildCacheKey(options.cacheKey, cacheSuffix);

  if (cacheKey) {
    const cached = await cacheGet<CachedOptimizedImage>(cacheKey);
    if (cached?.payload) {
      return {
        buffer: Buffer.from(cached.payload, 'base64'),
        width: cached.width,
        height: cached.height,
        format: cached.format,
        size: cached.size,
        optimized: true,
        fromCache: true,
      };
    }
  }

  const payload = buffer.toString('base64');
  const response = await requestProcessor(payload, normalized, options.traceId);
  if (!response) {
    return fallbackResult(buffer);
  }

  if (cacheKey) {
    await cacheSet(cacheKey, response, imageProcessorConfig.cacheTtlSeconds);
  }

  return {
    buffer: Buffer.from(response.payload, 'base64'),
    width: response.width,
    height: response.height,
    format: response.format,
    size: response.size,
    optimized: true,
    fromCache: false,
  };
};

