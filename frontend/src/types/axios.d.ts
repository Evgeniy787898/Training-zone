import 'axios';

declare module 'axios' {
    interface InternalAxiosRequestConfig<D = any> {
        /**
         * Позволяет отключить глобальную дедупликацию запросов
         * для конкретного вызова (например, для WebSocket туннелей
         * или SSE, где параллельные соединения допустимы).
         */
        disableDeduplication?: boolean;
    }
}
