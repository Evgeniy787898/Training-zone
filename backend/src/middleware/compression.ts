import type { Request, Response, NextFunction } from 'express';
import { brotliCompress, constants as zlibConstants, gzip } from 'node:zlib';
import { promisify } from 'node:util';
import type { CompressionDefaults } from '../types/compression.js';
import { compressionDefaults } from '../config/constants.js';

const brotliCompressAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

type SupportedEncoding = 'br' | 'gzip';

const EXCLUDED_STATUS_CODES = new Set([204, 205, 304]);

const ensureBuffer = (chunk: any, encoding?: BufferEncoding): Buffer => {
  if (chunk === undefined || chunk === null) {
    return Buffer.alloc(0);
  }
  if (Buffer.isBuffer(chunk)) {
    return chunk;
  }
  if (typeof chunk === 'string') {
    return Buffer.from(chunk, encoding as BufferEncoding | undefined);
  }
  return Buffer.from(chunk);
};

const appendVary = (res: Response, value: string) => {
  const existing = res.getHeader('Vary');
  if (!existing) {
    res.setHeader('Vary', value);
    return;
  }
  const normalized = Array.isArray(existing)
    ? existing.join(', ')
    : String(existing);
  const tokens = normalized
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.includes(value.toLowerCase())) {
    return;
  }
  res.setHeader('Vary', `${normalized}, ${value}`);
};

const parseAcceptEncoding = (header: string) => {
  return header
    .split(',')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((token) => {
      const [name, ...params] = token.split(';').map((value) => value.trim());
      let quality = 1;
      for (const param of params) {
        if (!param) {
          continue;
        }
        const [key, rawValue] = param.split('=').map((value) => value.trim());
        if (key.toLowerCase() === 'q') {
          const parsed = Number(rawValue);
          if (Number.isFinite(parsed)) {
            quality = Math.max(0, Math.min(1, parsed));
          }
        }
      }
      return {
        name: name.toLowerCase(),
        q: quality,
      };
    })
    .filter((entry) => entry.name && entry.q > 0)
    .sort((a, b) => b.q - a.q);
};

const pickEncoding = (
  header: string,
  preferBrotli: boolean,
): SupportedEncoding | null => {
  const parsed = parseAcceptEncoding(header);
  if (!parsed.length) {
    return null;
  }

  const preferredOrder: SupportedEncoding[] = preferBrotli ? ['br', 'gzip'] : ['gzip', 'br'];

  for (const { name } of parsed) {
    if (name === '*') {
      return preferredOrder[0];
    }
    if (preferredOrder.includes(name as SupportedEncoding)) {
      return name as SupportedEncoding;
    }
    if (name === 'identity') {
      return null;
    }
  }

  return null;
};

const isCompressibleContentType = (
  contentType: number | string | string[] | undefined,
  config: CompressionDefaults,
) => {
  if (!contentType) {
    return false;
  }
  const normalized = Array.isArray(contentType)
    ? contentType.join(',').toLowerCase()
    : String(contentType).toLowerCase();
  if (config.excludedContentTypes.some((pattern) => pattern.test(normalized))) {
    return false;
  }
  return config.compressibleContentTypes.some((pattern) => pattern.test(normalized));
};

const clamp = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
};

const compressPayload = async (
  payload: Buffer,
  encoding: SupportedEncoding,
  config: CompressionDefaults,
) => {
  if (encoding === 'br') {
    return brotliCompressAsync(payload, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: clamp(config.brotliQuality, 0, 11),
        [zlibConstants.BROTLI_PARAM_MODE]: zlibConstants.BROTLI_MODE_GENERIC,
      },
    });
  }

  return gzipAsync(payload, {
    level: clamp(config.gzipLevel, -1, 9),
  });
};

export interface CompressionMiddlewareOptions extends Partial<CompressionDefaults> {}

export const createCompressionMiddleware = (
  overrides: CompressionMiddlewareOptions = {},
) => {
  const config: CompressionDefaults = {
    ...compressionDefaults,
    ...overrides,
    compressibleContentTypes:
      overrides.compressibleContentTypes ?? compressionDefaults.compressibleContentTypes,
    excludedContentTypes:
      overrides.excludedContentTypes ?? compressionDefaults.excludedContentTypes,
  };

  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.enabled || req.method === 'HEAD' || req.headers['range']) {
      return next();
    }

    const acceptEncodingHeader = req.headers['accept-encoding'];
    if (typeof acceptEncodingHeader !== 'string' || !acceptEncodingHeader.trim()) {
      return next();
    }

    if (res.getHeader('Content-Encoding')) {
      return next();
    }

    const negotiatedEncoding = pickEncoding(acceptEncodingHeader, config.preferBrotli);
    if (!negotiatedEncoding) {
      return next();
    }

    const originalWrite = res.write;
    const originalEnd = res.end;
    const writeBound = res.write.bind(res) as (
      chunk: any,
      encoding?: BufferEncoding,
      cb?: (err?: Error) => void,
    ) => boolean;
    const endBound = res.end.bind(res) as (
      chunk?: any,
      encoding?: BufferEncoding,
      cb?: () => void,
    ) => Response;
    const chunks: Buffer[] = [];
    let finished = false;
    let aborted = false;

    const cleanup = () => {
      if (finished) {
        return;
      }
      finished = true;
      (res as any).write = originalWrite;
      (res as any).end = originalEnd;
      req.off('aborted', onAbort);
      res.off('close', cleanup);
    };

    const onAbort = () => {
      aborted = true;
      cleanup();
    };

    (res as any).write = (chunk: any, encoding?: BufferEncoding, cb?: (err?: Error) => void) => {
      if (finished) {
        return writeBound(chunk, encoding, cb);
      }
      chunks.push(ensureBuffer(chunk, encoding));
      if (typeof cb === 'function') {
        cb();
      }
      return true;
    };

    (res as any).end = (chunk?: any, encodingOrCb?: any, cb?: any) => {
      if (finished) {
        return endBound(chunk, encodingOrCb, cb);
      }

      let encoding: BufferEncoding | undefined;
      let callback: (() => void) | undefined;

      if (typeof chunk === 'function') {
        callback = chunk as () => void;
        chunk = undefined;
      } else if (typeof encodingOrCb === 'function') {
        callback = encodingOrCb as () => void;
      } else {
        encoding = encodingOrCb;
        callback = cb;
      }

      if (chunk !== undefined && chunk !== null) {
        chunks.push(ensureBuffer(chunk, encoding));
      }

      const finalize = async () => {
        cleanup();
        if (aborted) {
          callback?.();
          return;
        }

        const body = Buffer.concat(chunks);
        chunks.length = 0;

        if (
          !body.length ||
          body.length < config.thresholdBytes ||
          EXCLUDED_STATUS_CODES.has(res.statusCode || 200) ||
          res.getHeader('Content-Encoding') ||
          !isCompressibleContentType(res.getHeader('Content-Type'), config)
        ) {
          if (body.length) {
            res.setHeader('Content-Length', body.length);
            writeBound(body);
          }
          endBound();
          callback?.();
          return;
        }

        try {
          const compressed = await compressPayload(body, negotiatedEncoding, config);
          appendVary(res, 'Accept-Encoding');
          res.setHeader('Content-Encoding', negotiatedEncoding);
          res.setHeader('Content-Length', compressed.length);
          writeBound(compressed);
          endBound();
          callback?.();
        } catch (error) {
          console.error(
            `[compression] Failed to compress response for ${req.method} ${req.originalUrl}:`,
            error,
          );
          res.removeHeader('Content-Encoding');
          res.setHeader('Content-Length', body.length);
          writeBound(body);
          endBound();
          callback?.();
        }
      };

      void finalize();
      return res;
    };

    res.on('close', cleanup);
    req.on('aborted', onAbort);

    return next();
  };
};
