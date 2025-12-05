import type { SafePrismaClient } from '../types/prisma.js';
import type { SessionRepository } from '../repositories/sessionRepository.js';
import type { SessionServiceContract } from '../types/services.js';

export type DependencyToken<T> = symbol & { __type?: T };

export const createToken = <T>(description: string): DependencyToken<T> =>
    Symbol(description) as DependencyToken<T>;

type Factory<T> = (container: DependencyContainer) => T;

type FactoryRegistration<T> = {
    factory: Factory<T>;
    singleton: boolean;
};

export class DependencyContainer {
    private readonly registrations = new Map<DependencyToken<any>, FactoryRegistration<any>>();
    private readonly instances = new Map<DependencyToken<any>, any>();

    constructor(private readonly parent?: DependencyContainer | null) {}

    registerValue<T>(token: DependencyToken<T>, value: T) {
        this.instances.set(token, value);
        this.registrations.delete(token);
    }

    registerFactory<T>(token: DependencyToken<T>, factory: Factory<T>, options?: { singleton?: boolean }) {
        this.registrations.set(token, {
            factory,
            singleton: options?.singleton !== false,
        });
        if (options?.singleton === false) {
            this.instances.delete(token);
        }
    }

    resolve<T>(token: DependencyToken<T>): T {
        if (this.instances.has(token)) {
            return this.instances.get(token);
        }

        const registration = this.registrations.get(token);
        if (registration) {
            const value = registration.factory(this);
            if (registration.singleton) {
                this.instances.set(token, value);
            }
            return value;
        }

        if (this.parent) {
            return this.parent.resolve(token);
        }

        throw new Error(`Dependency "${token.description ?? 'unknown'}" is not registered`);
    }

    tryResolve<T>(token: DependencyToken<T>): T | undefined {
        try {
            return this.resolve(token);
        } catch {
            return undefined;
        }
    }

    createScope() {
        return new DependencyContainer(this);
    }
}

export const diTokens = {
    prisma: createToken<SafePrismaClient>('prisma'),
    sessionRepository: createToken<SessionRepository>('sessionRepository'),
    sessionService: createToken<SessionServiceContract>('sessionService'),
} as const;

export const appContainer = new DependencyContainer(null);
