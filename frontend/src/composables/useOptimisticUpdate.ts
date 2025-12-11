import { ref, type Ref } from 'vue';

/**
 * Optimistic UI Updates composable
 * 
 * Паттерн: 
 * 1. Сразу обновить UI (optimistic)
 * 2. Отправить запрос на сервер
 * 3. При ошибке — откатить к предыдущему состоянию
 * 
 * @example
 * const { execute, isLoading, error } = useOptimisticUpdate({
 *   onOptimistic: () => { items.value.push(newItem); return items.value.length - 1; },
 *   onRollback: (index) => { items.value.splice(index, 1); },
 *   onSuccess: (result, index) => { items.value[index].id = result.id; },
 * });
 * 
 * await execute(() => api.createItem(newItem));
 */

export interface OptimisticUpdateOptions<TResult, TRollbackData = void> {
    /**
     * Выполняется СРАЗУ — обновляет UI оптимистично.
     * Возвращает данные для возможного отката (например, индекс или предыдущее значение).
     */
    onOptimistic: () => TRollbackData;

    /**
     * Выполняется при ошибке API — откатывает UI к предыдущему состоянию.
     */
    onRollback: (rollbackData: TRollbackData) => void;

    /**
     * Выполняется при успехе API — синхронизирует UI с ответом сервера.
     */
    onSuccess?: (result: TResult, rollbackData: TRollbackData) => void;

    /**
     * Выполняется при ошибке после отката — для уведомления пользователя.
     */
    onError?: (error: unknown, rollbackData: TRollbackData) => void;
}

export interface OptimisticUpdateReturn<TResult> {
    /** Выполнить оптимистичную операцию */
    execute: (apiCall: () => Promise<TResult>) => Promise<TResult | null>;
    /** Флаг загрузки */
    isLoading: Ref<boolean>;
    /** Последняя ошибка */
    error: Ref<unknown | null>;
    /** Сбросить состояние ошибки */
    clearError: () => void;
}

export function useOptimisticUpdate<TResult, TRollbackData = void>(
    options: OptimisticUpdateOptions<TResult, TRollbackData>
): OptimisticUpdateReturn<TResult> {
    const isLoading = ref(false);
    const error = ref<unknown | null>(null);

    const clearError = () => {
        error.value = null;
    };

    const execute = async (apiCall: () => Promise<TResult>): Promise<TResult | null> => {
        // 1. Оптимистичное обновление UI
        const rollbackData = options.onOptimistic();

        isLoading.value = true;
        error.value = null;

        try {
            // 2. Отправка запроса на сервер
            const result = await apiCall();

            // 3. Успех — синхронизируем с ответом сервера
            options.onSuccess?.(result, rollbackData);

            return result;
        } catch (err) {
            // 4. Ошибка — откатываем UI
            options.onRollback(rollbackData);
            error.value = err;
            options.onError?.(err, rollbackData);

            return null;
        } finally {
            isLoading.value = false;
        }
    };

    return {
        execute,
        isLoading,
        error,
        clearError,
    };
}

/**
 * Упрощённая версия для обновления одного ref значения
 * 
 * @example
 * const { execute } = useOptimisticValue(sessionStatus, 'done');
 * await execute(() => api.updateSession(id, { status: 'done' }));
 */
export function useOptimisticValue<T, TResult = unknown>(
    valueRef: Ref<T>,
    optimisticValue: T
): OptimisticUpdateReturn<TResult> {
    let previousValue: T;

    return useOptimisticUpdate<TResult, T>({
        onOptimistic: () => {
            previousValue = valueRef.value;
            valueRef.value = optimisticValue;
            return previousValue;
        },
        onRollback: (prev) => {
            valueRef.value = prev;
        },
    });
}

/**
 * Версия для CRUD операций над массивами
 * 
 * @example
 * // Добавление
 * const { executeAdd } = useOptimisticList(items);
 * await executeAdd(newItem, () => api.createItem(newItem));
 * 
 * // Удаление
 * await executeRemove(index, () => api.deleteItem(items.value[index].id));
 */
export interface OptimisticListReturn<T, TAddResult = T, TUpdateResult = T> {
    /** Добавить элемент оптимистично */
    executeAdd: (item: T, apiCall: () => Promise<TAddResult>) => Promise<TAddResult | null>;
    /** Удалить элемент оптимистично */
    executeRemove: (index: number, apiCall: () => Promise<unknown>) => Promise<boolean>;
    /** Обновить элемент оптимистично */
    executeUpdate: (
        index: number,
        updater: (item: T) => T,
        apiCall: () => Promise<TUpdateResult>
    ) => Promise<TUpdateResult | null>;
    /** Флаг загрузки */
    isLoading: Ref<boolean>;
    /** Последняя ошибка */
    error: Ref<unknown | null>;
}

export function useOptimisticList<T, TAddResult = T, TUpdateResult = T>(
    listRef: Ref<T[]>,
    options?: {
        onAddSuccess?: (result: TAddResult, item: T, index: number) => void;
        onUpdateSuccess?: (result: TUpdateResult, item: T, index: number) => void;
        onError?: (error: unknown, operation: 'add' | 'remove' | 'update') => void;
    }
): OptimisticListReturn<T, TAddResult, TUpdateResult> {
    const isLoading = ref(false);
    const error = ref<unknown | null>(null);

    const executeAdd = async (
        item: T,
        apiCall: () => Promise<TAddResult>
    ): Promise<TAddResult | null> => {
        // Оптимистично добавляем
        listRef.value = [...listRef.value, item];
        const addedIndex = listRef.value.length - 1;

        isLoading.value = true;
        error.value = null;

        try {
            const result = await apiCall();
            options?.onAddSuccess?.(result, item, addedIndex);
            return result;
        } catch (err) {
            // Откат — удаляем добавленный элемент
            listRef.value = listRef.value.filter((_, i) => i !== addedIndex);
            error.value = err;
            options?.onError?.(err, 'add');
            return null;
        } finally {
            isLoading.value = false;
        }
    };

    const executeRemove = async (
        index: number,
        apiCall: () => Promise<unknown>
    ): Promise<boolean> => {
        // Сохраняем удаляемый элемент для возможного отката
        const removedItem = listRef.value[index];

        // Оптимистично удаляем
        listRef.value = listRef.value.filter((_, i) => i !== index);

        isLoading.value = true;
        error.value = null;

        try {
            await apiCall();
            return true;
        } catch (err) {
            // Откат — возвращаем элемент на место
            const newList = [...listRef.value];
            newList.splice(index, 0, removedItem);
            listRef.value = newList;
            error.value = err;
            options?.onError?.(err, 'remove');
            return false;
        } finally {
            isLoading.value = false;
        }
    };

    const executeUpdate = async (
        index: number,
        updater: (item: T) => T,
        apiCall: () => Promise<TUpdateResult>
    ): Promise<TUpdateResult | null> => {
        // Сохраняем предыдущее значение
        const previousItem = listRef.value[index];

        // Оптимистично обновляем
        const updatedItem = updater(previousItem);
        listRef.value = listRef.value.map((item, i) => i === index ? updatedItem : item);

        isLoading.value = true;
        error.value = null;

        try {
            const result = await apiCall();
            options?.onUpdateSuccess?.(result, updatedItem, index);
            return result;
        } catch (err) {
            // Откат — возвращаем предыдущее значение
            listRef.value = listRef.value.map((item, i) => i === index ? previousItem : item);
            error.value = err;
            options?.onError?.(err, 'update');
            return null;
        } finally {
            isLoading.value = false;
        }
    };

    return {
        executeAdd,
        executeRemove,
        executeUpdate,
        isLoading,
        error,
    };
}
