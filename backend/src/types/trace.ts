export type TraceContext = {
    traceId: string;
    resource?: string;
};

export type TraceInit = Partial<TraceContext> & {
    traceId?: string | null;
};
