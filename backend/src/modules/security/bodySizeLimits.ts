import { bodySizeDefaults, sizeUnits } from '../../config/constants.js';

const { KB, MB, GB } = sizeUnits;

const parseSizeLimit = (value: string | undefined, fallback: number) => {
    if (!value) {
        return fallback;
    }

    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
        return fallback;
    }

    const match = trimmed.match(/^(\d+)(b|kb|mb|gb)?$/);
    if (!match) {
        console.warn(`Invalid body size limit value: "${value}", falling back to ${fallback} bytes`);
        return fallback;
    }

    const [, amountRaw, unitRaw] = match;
    const amount = Number(amountRaw);
    const unit = unitRaw ?? 'b';

    if (!Number.isFinite(amount) || amount <= 0) {
        console.warn(`Invalid body size amount: "${value}", falling back to ${fallback} bytes`);
        return fallback;
    }

    switch (unit) {
        case 'b':
            return amount;
        case 'kb':
            return amount * KB;
        case 'mb':
            return amount * MB;
        case 'gb':
            return amount * GB;
        default:
            console.warn(`Unsupported unit in body size limit: "${value}", falling back to ${fallback} bytes`);
            return fallback;
    }
};

const describeSize = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return 'unknown';
    }
    if (bytes >= GB) {
        return `${(bytes / GB).toFixed(2)} GB`;
    }
    if (bytes >= MB) {
        return `${(bytes / MB).toFixed(2)} MB`;
    }
    if (bytes >= KB) {
        return `${(bytes / KB).toFixed(2)} KB`;
    }
    return `${bytes} B`;
};

const parsedLimits = {
    json: parseSizeLimit(process.env.REQUEST_BODY_JSON_LIMIT, bodySizeDefaults.jsonBytes),
    form: parseSizeLimit(process.env.REQUEST_BODY_FORM_LIMIT, bodySizeDefaults.formBytes),
    text: parseSizeLimit(process.env.REQUEST_BODY_TEXT_LIMIT, bodySizeDefaults.textBytes),
    binary: parseSizeLimit(process.env.REQUEST_BODY_BINARY_LIMIT, bodySizeDefaults.binaryBytes),
};

const fallbackDefault = Math.max(parsedLimits.json, parsedLimits.form, parsedLimits.text, parsedLimits.binary);
const defaultLimit = parseSizeLimit(process.env.REQUEST_BODY_DEFAULT_LIMIT, fallbackDefault);

export const bodySizeLimits = Object.freeze({
    ...parsedLimits,
    default: defaultLimit,
});

export const resolveBodyLimitForContentType = (contentType?: string | null) => {
    if (!contentType) {
        return bodySizeLimits.default;
    }
    const lower = contentType.toLowerCase();
    if (lower.includes('application/json')) {
        return bodySizeLimits.json;
    }
    if (lower.includes('application/x-www-form-urlencoded')) {
        return bodySizeLimits.form;
    }
    if (lower.startsWith('text/')) {
        return bodySizeLimits.text;
    }
    if (lower.includes('application/octet-stream')) {
        return bodySizeLimits.binary;
    }
    return bodySizeLimits.default;
};

export const describeBodySize = describeSize;
