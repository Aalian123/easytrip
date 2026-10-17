import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  userId?: string;
  userLabel?: string;
  role?: string;
  riderId?: string | null;
  module?: string;
  action?: string;
}

/**
 * Carries the acting user from the HTTP layer down to the Prisma audit
 * extension without threading it through every service signature.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

export function currentContext(): RequestContext {
  return requestContext.getStore() ?? {};
}

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return requestContext.run(context, fn);
}
