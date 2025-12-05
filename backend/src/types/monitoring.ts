export type MonitoringSeverity = 'info' | 'warning' | 'critical';

export interface MonitoringEventInput {
    category: string;
    severity: MonitoringSeverity;
    message: string;
    traceId?: string | null;
    profileId?: string | null;
    resource?: string;
    metadata?: Record<string, unknown>;
    error?: unknown;
}

export interface MonitoringAlertConfig {
    dedupeTtlMs: number;
    minSeverityForAlerts: MonitoringSeverity;
    webhookUrl?: string;
    webhookAuthHeader?: string;
    telegramBotToken?: string;
    telegramChatId?: string;
    webhookTimeoutMs: number;
}
