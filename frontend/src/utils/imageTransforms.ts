const TRANSFORM_KEYS = ['maxwidth', 'maxheight', 'quality'];

const stripTransformsFromQuery = (query: string) => {
  const filtered = query
    .split('&')
    .map((part) => part.trim())
    .filter((part) => {
      const [rawKey] = part.split('=');
      if (!rawKey) return false;
      const normalized = rawKey.toLowerCase();
      return !TRANSFORM_KEYS.includes(normalized);
    });
  return filtered.join('&');
};

export const stripImageTransforms = (input?: string | null): string | null => {
  if (!input) return input ?? null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const questionIndex = trimmed.indexOf('?');
  if (questionIndex === -1) {
    return trimmed;
  }
  const base = trimmed.slice(0, questionIndex);
  const query = trimmed.slice(questionIndex + 1);
  const cleanedQuery = stripTransformsFromQuery(query);
  return cleanedQuery ? `${base}?${cleanedQuery}` : base;
};

export const stripSrcsetTransforms = (srcset?: string | null): string | null => {
  if (!srcset) return null;
  const entries = srcset
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split(/\s+/);
      const url = parts.shift();
      if (!url) return entry;
      const stripped = stripImageTransforms(url) ?? url;
      return [stripped, ...parts].join(' ').trim();
    });
  return entries.join(', ');
};
