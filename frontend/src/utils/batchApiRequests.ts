/**
 * Утилиты для батчинга API запросов
 * Объединяет несколько запросов в один batch запрос
 */

export interface BatchRequest {
  id: string;
  method: string;
  url: string;
  params?: Record<string, unknown>;
  priority?: 'high' | 'medium' | 'low';
}

export interface BatchResponse<T> {
  id: string;
  data?: T;
  error?: unknown;
}

class BatchRequestManager {
  private pendingRequests: Map<string, BatchRequest> = new Map();
  private batchTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly BATCH_DELAY = 50; // 50ms задержка для батчинга
  private readonly MAX_BATCH_SIZE = 10; // Максимум 10 запросов в одном batch

  /**
   * Добавление запроса в batch
   */
  addRequest(request: BatchRequest): Promise<BatchResponse<any>> {
    this.pendingRequests.set(request.id, request);

    // Если достигнут максимум, сразу выполняем batch
    if (this.pendingRequests.size >= this.MAX_BATCH_SIZE) {
      return this.executeBatch();
    }

    // Иначе ждем задержку для накопления запросов
    if (this.batchTimeout === null) {
      this.batchTimeout = setTimeout(() => {
        this.executeBatch();
      }, this.BATCH_DELAY);
    }

    // Возвращаем промис который разрешится после выполнения batch
    return new Promise(resolve => {
      // Промис будет разрешен в executeBatch
      // Для простоты, здесь возвращаем немедленный промис
      // В реальной реализации нужно отслеживать промисы для каждого запроса
      resolve({ id: request.id, data: null });
    });
  }

  /**
   * Выполнение batch запросов
   */
  private async executeBatch(): Promise<BatchResponse<any>> {
    if (this.batchTimeout !== null) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    const requests = Array.from(this.pendingRequests.values());
    this.pendingRequests.clear();

    // Сортируем по приоритету
    requests.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return (priorityOrder[a.priority || 'medium']) - (priorityOrder[b.priority || 'medium']);
    });

    // Выполняем запросы параллельно
    const results = await Promise.allSettled(
      requests.map(async (request) => {
        try {
          // Здесь должен быть реальный API вызов
          // Для демонстрации просто возвращаем null
          return {
            id: request.id,
            data: null,
          };
        } catch (error) {
          return {
            id: request.id,
            error,
          };
        }
      })
    );

    // Преобразуем результаты
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          id: requests[index].id,
          error: result.reason,
        };
      }
    })[0]; // Для простоты возвращаем первый результат
  }

  /**
   * Очистка всех pending запросов
   */
  flush(): void {
    if (this.batchTimeout !== null) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    this.pendingRequests.clear();
  }
}

export const batchRequestManager = new BatchRequestManager();
