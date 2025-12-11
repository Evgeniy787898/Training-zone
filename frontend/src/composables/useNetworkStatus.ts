import { ref, readonly, onMounted, onUnmounted } from 'vue';

export function useNetworkStatus() {
    const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const updateOnlineStatus = () => {
        isOnline.value = navigator.onLine;
    };

    onMounted(() => {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', updateOnlineStatus);
            window.addEventListener('offline', updateOnlineStatus);
        }
    });

    onUnmounted(() => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('online', updateOnlineStatus);
            window.removeEventListener('offline', updateOnlineStatus);
        }
    });

    return {
        isOnline: readonly(isOnline)
    };
}
