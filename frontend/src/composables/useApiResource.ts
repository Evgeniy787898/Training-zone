/**
 * useApiResource - Generic composable for API resource CRUD operations
 * Implements DRY-003: Унифицировать логику загрузки данных
 *
 * Provides unified loading/error/data pattern for all API calls
 */
import { ref, readonly, type Ref } from 'vue';

// ============================================
// TYPES
// ============================================

export interface ApiResourceState<T> {
    data: Ref<T | null>;
    loading: Ref<boolean>;
    error: Ref<string | null>;
    isLoaded: Ref<boolean>;
}

export interface ApiResourceActions<T, CreateDTO = Partial<T>, UpdateDTO = Partial<T>> {
    fetch: () => Promise<T | null>;
    create: (dto: CreateDTO) => Promise<T | null>;
    update: (id: string, dto: UpdateDTO) => Promise<T | null>;
    remove: (id: string) => Promise<boolean>;
    reset: () => void;
    setData: (data: T | null) => void;
}

export interface UseApiResourceOptions<T> {
    /** Initial data value */
    initialData?: T | null;
    /** Auto-fetch on mount */
    immediate?: boolean;
    /** Transform response data */
    transform?: (raw: unknown) => T;
    /** Error message transformer */
    formatError?: (error: unknown) => string;
}

export interface ApiEndpoints {
    /** GET endpoint for fetching */
    get?: string | (() => string);
    /** POST endpoint for creating */
    create?: string;
    /** PUT/PATCH endpoint for updating (id will be appended) */
    update?: string;
    /** DELETE endpoint (id will be appended) */
    delete?: string;
}

// ============================================
// COMPOSABLE
// ============================================

/**
 * Generic API resource composable
 *
 * @example
 * ```ts
 * const { data, loading, error, fetch, create } = useApiResource<User[]>({
 *   get: '/api/users',
 *   create: '/api/users',
 * });
 *
 * // Fetch data
 * await fetch();
 *
 * // Create new
 * await create({ name: 'John' });
 * ```
 */
export function useApiResource<T, CreateDTO = Partial<T>, UpdateDTO = Partial<T>>(
    endpoints: ApiEndpoints,
    options: UseApiResourceOptions<T> = {}
): ApiResourceState<T> & ApiResourceActions<T, CreateDTO, UpdateDTO> {
    const {
        initialData = null,
        transform = (raw: unknown) => raw as T,
        formatError = (err: unknown) => err instanceof Error ? err.message : 'Unknown error',
    } = options;

    // State
    const data = ref<T | null>(initialData) as Ref<T | null>;
    const loading = ref(false);
    const error = ref<string | null>(null);
    const isLoaded = ref(false);

    // Helpers
    const getEndpoint = (endpoint: string | (() => string) | undefined): string | null => {
        if (!endpoint) return null;
        return typeof endpoint === 'function' ? endpoint() : endpoint;
    };

    const handleRequest = async <R>(
        request: () => Promise<Response>,
        onSuccess?: (data: R) => void
    ): Promise<R | null> => {
        loading.value = true;
        error.value = null;

        try {
            const response = await request();

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `HTTP ${response.status}`);
            }

            const json = await response.json();
            const result = transform(json.data ?? json) as unknown as R;

            if (onSuccess) {
                onSuccess(result);
            }

            return result;
        } catch (err) {
            error.value = formatError(err);
            return null;
        } finally {
            loading.value = false;
        }
    };

    // Actions
    const fetch = async (): Promise<T | null> => {
        const url = getEndpoint(endpoints.get);
        if (!url) {
            error.value = 'No GET endpoint defined';
            return null;
        }

        return handleRequest<T>(
            () => window.fetch(url, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            }),
            (result) => {
                (data as Ref<T | null>).value = result;
                isLoaded.value = true;
            }
        );
    };

    const create = async (dto: CreateDTO): Promise<T | null> => {
        const url = endpoints.create;
        if (!url) {
            error.value = 'No CREATE endpoint defined';
            return null;
        }

        return handleRequest<T>(
            () => window.fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(dto),
            })
        );
    };

    const update = async (id: string, dto: UpdateDTO): Promise<T | null> => {
        const url = endpoints.update;
        if (!url) {
            error.value = 'No UPDATE endpoint defined';
            return null;
        }

        return handleRequest<T>(
            () => window.fetch(`${url}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(dto),
            })
        );
    };

    const remove = async (id: string): Promise<boolean> => {
        const url = endpoints.delete;
        if (!url) {
            error.value = 'No DELETE endpoint defined';
            return false;
        }

        const result = await handleRequest<boolean>(
            () => window.fetch(`${url}/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            }),
            () => true
        );

        return result ?? false;
    };

    const reset = (): void => {
        (data as Ref<T | null>).value = initialData;
        loading.value = false;
        error.value = null;
        isLoaded.value = false;
    };

    const setData = (newData: T | null): void => {
        (data as Ref<T | null>).value = newData;
    };

    return {
        // State (readonly)
        data: readonly(data) as Ref<T | null>,
        loading: readonly(loading),
        error: readonly(error),
        isLoaded: readonly(isLoaded),
        // Actions
        fetch,
        create,
        update,
        remove,
        reset,
        setData,
    };
}

/**
 * Simplified version for read-only resources
 */
export function useApiData<T>(
    url: string | (() => string),
    options?: UseApiResourceOptions<T>
) {
    return useApiResource<T>({ get: url }, options);
}

export default useApiResource;
