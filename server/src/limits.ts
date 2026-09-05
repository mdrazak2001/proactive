import type { BrokerPrincipal } from './auth.js';
import { PublicError } from './errors.js';

interface PrincipalUsage {
  windowStartedAt: number;
  requestCount: number;
  inFlight: number;
  lastSeenAt: number;
}

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
const MAX_CONCURRENT_REQUESTS = 2;
const FORGET_AFTER_MS = 2 * WINDOW_MS;

export interface PrincipalLimiter {
  run<T>(principal: BrokerPrincipal, operation: () => Promise<T>): Promise<T>;
}

export function createPrincipalLimiter(): PrincipalLimiter {
  const usageByPrincipal = new Map<string, PrincipalUsage>();

  function prune(now: number): void {
    for (const [key, usage] of usageByPrincipal) {
      if (usage.inFlight === 0 && now - usage.lastSeenAt >= FORGET_AFTER_MS) {
        usageByPrincipal.delete(key);
      }
    }
  }

  async function run<T>(
    principal: BrokerPrincipal,
    operation: () => Promise<T>,
  ): Promise<T> {
    const now = Date.now();
    prune(now);
    const key = `${principal.mode}:${principal.subject}`;
    let usage = usageByPrincipal.get(key);
    if (!usage) {
      usage = {
        windowStartedAt: now,
        requestCount: 0,
        inFlight: 0,
        lastSeenAt: now,
      };
      usageByPrincipal.set(key, usage);
    } else if (now - usage.windowStartedAt >= WINDOW_MS) {
      usage.windowStartedAt = now;
      usage.requestCount = 0;
    }

    usage.lastSeenAt = now;
    if (usage.inFlight >= MAX_CONCURRENT_REQUESTS) {
      throw new PublicError(
        429,
        'concurrent_request_limit',
        'Wait for an integration check to finish before starting another.',
      );
    }
    if (usage.requestCount >= MAX_REQUESTS_PER_WINDOW) {
      throw new PublicError(
        429,
        'request_rate_limit',
        'Integration checks are temporarily rate limited. Try again shortly.',
      );
    }

    usage.requestCount += 1;
    usage.inFlight += 1;
    try {
      return await operation();
    } finally {
      usage.inFlight -= 1;
      usage.lastSeenAt = Date.now();
    }
  }

  return { run };
}
