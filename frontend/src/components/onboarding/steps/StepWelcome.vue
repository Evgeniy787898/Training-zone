<template>
    <div class="flex flex-col items-center text-center h-full justify-center pb-20">
        <div class="w-24 h-24 mb-8 bg-gradient-to-br from-accent to-accent-hover rounded-3xl flex items-center justify-center shadow-lg shadow-accent/25 animate-pulse-slow">
            <span class="text-4xl">⚡️</span>
        </div>

        <h1 class="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Добро пожаловать в TZONA
        </h1>

        <p class="text-text-secondary text-lg leading-relaxed max-w-xs">
            Твой персональный AI-тренер для достижения идеальной формы.
        </p>

        <div class="mt-12 grid grid-cols-1 gap-4 w-full text-left">
            <div class="bg-surface-elevated/50 p-4 rounded-xl border border-border/50 flex items-start gap-4">
                <div class="p-2 bg-success/10 rounded-lg text-success">
                    <i class="pi pi-check"></i>
                </div>
                <div>
                    <div class="font-medium text-white mb-1">Персональный план</div>
                    <div class="text-sm text-text-muted">Адаптируется под твои цели</div>
                </div>
            </div>
            
            <div class="bg-surface-elevated/50 p-4 rounded-xl border border-border/50 flex items-start gap-4">
                <div class="p-2 bg-info/10 rounded-lg text-info">
                    <i class="pi pi-bolt"></i>
                </div>
                <div>
                    <div class="font-medium text-white mb-1">AI-аналитика</div>
                    <div class="text-sm text-text-muted">Умные советы и прогресс</div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.animate-pulse-slow {
    animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: .8; }
}
</style>
