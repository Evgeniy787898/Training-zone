export interface CompressionDefaults {
  enabled: boolean;
  thresholdBytes: number;
  preferBrotli: boolean;
  brotliQuality: number;
  gzipLevel: number;
  compressibleContentTypes: ReadonlyArray<RegExp>;
  excludedContentTypes: ReadonlyArray<RegExp>;
}
