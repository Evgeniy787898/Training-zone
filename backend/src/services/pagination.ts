import { paginationConfig } from '../config/constants.js';
import type { PaginationMeta, PaginationQuery } from '../types/pagination.js';

export interface PaginationState {
    page: number;
    pageSize: number;
    limit: number;
    offset: number;
}

export interface ResolvePaginationOptions {
    defaultPageSize?: number;
    maxPageSize?: number;
}

export const resolvePagination = (
    query?: PaginationQuery,
    options?: ResolvePaginationOptions,
): PaginationState => {
    const defaultPageSize = options?.defaultPageSize ?? paginationConfig.defaultPageSize;
    const maxPageSize = options?.maxPageSize ?? paginationConfig.maxPageSize;

    const rawPage = query?.page ?? 1;
    const rawPageSize = query?.page_size ?? defaultPageSize;

    const pageSize = Math.min(Math.max(rawPageSize, 1), maxPageSize);
    const page = Math.max(rawPage, 1);

    return {
        page,
        pageSize,
        limit: pageSize,
        offset: (page - 1) * pageSize,
    };
};

export const buildPaginationMeta = ({
    total,
    page,
    pageSize,
}: {
    total: number;
    page: number;
    pageSize: number;
}): PaginationMeta => {
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
    return {
        page,
        page_size: pageSize,
        total,
        total_pages: totalPages,
        has_more: totalPages > 0 ? page < totalPages : false,
    };
};
