import type { Request } from 'express';
import type { PaginationMeta } from '../../types/pagination.js';

export const buildResponseMeta = (
    req: Request,
    pagination?: PaginationMeta,
    fields?: readonly string[],
) => {
    if (!req.traceId && !pagination && !fields) {
        return undefined;
    }
    const meta: Record<string, unknown> = {};
    if (req.traceId) {
        meta.traceId = req.traceId;
    }
    if (pagination) {
        meta.pagination = pagination;
    }
    if (fields && fields.length > 0) {
        meta.fields = fields;
    }
    return meta;
};
