type StepHandler<Context> = (context: Context) => void | Promise<void>;

export interface LifecycleStep<Context> {
  name: string;
  run?: StepHandler<Context>;
  cleanup?: StepHandler<Context>;
}

export interface LifecycleOptions<Context> {
  logger?: Pick<Console, 'log' | 'error'>;
  onError?: (error: unknown, step: LifecycleStep<Context>) => void;
}

export class ApplicationLifecycle<Context> {
  private readonly steps: LifecycleStep<Context>[] = [];
  private readonly executed: LifecycleStep<Context>[] = [];
  private shuttingDown = false;
  private started = false;

  constructor(
    private readonly context: Context,
    private readonly options: LifecycleOptions<Context> = {},
  ) {}

  registerStep(step: LifecycleStep<Context>): void {
    if (!step?.name) {
      throw new Error('Lifecycle step must have a name');
    }
    this.steps.push(step);
  }

  getContext(): Context {
    return this.context;
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
    for (const step of this.steps) {
      try {
        this.options.logger?.log?.(`[lifecycle] Starting step: ${step.name}`);
        await step.run?.(this.context);
        this.executed.push(step);
      } catch (error) {
        this.handleStepError(error, step);
        await this.shutdown();
        throw error;
      }
    }
  }

  async shutdown(): Promise<void> {
    if (this.shuttingDown) {
      return;
    }
    this.shuttingDown = true;
    for (const step of [...this.executed].reverse()) {
      try {
        this.options.logger?.log?.(`[lifecycle] Cleaning up step: ${step.name}`);
        await step.cleanup?.(this.context);
      } catch (error) {
        this.handleStepError(error, step);
      }
    }
  }

  private handleStepError(error: unknown, step: LifecycleStep<Context>) {
    if (this.options.onError) {
      this.options.onError(error, step);
    } else {
      this.options.logger?.error?.(
        `[lifecycle] Step "${step.name}" failed`,
        error,
      );
    }
  }
}
