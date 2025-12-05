import { Agent, Dispatcher, setGlobalDispatcher } from 'undici';

import { httpClientConfig } from '../../config/constants';

let dispatcher: Dispatcher | null = null;

export function configureHttpClient(): Dispatcher {
  if (!dispatcher) {
    dispatcher = new Agent({
      connect: {
        timeout: httpClientConfig.connectTimeoutMs,
      },
      headersTimeout: httpClientConfig.headersTimeoutMs,
      bodyTimeout: httpClientConfig.bodyTimeoutMs,
      keepAliveTimeout: httpClientConfig.keepAliveTimeoutMs,
      keepAliveMaxTimeout: httpClientConfig.keepAliveMaxTimeoutMs,
      pipelining: httpClientConfig.pipelining,
      connections: httpClientConfig.maxSockets,
    });

    if (httpClientConfig.enableGlobalDispatcher) {
      setGlobalDispatcher(dispatcher);
    }
  }

  return dispatcher;
}

export async function closeHttpClient(): Promise<void> {
  if (!dispatcher) return;
  const toClose = dispatcher;
  dispatcher = null;
  await toClose.close();
}
