import { classifyRpcError, toForkRpcError } from "./errors.js";

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function withRpcRetry<T>(
  operation: string,
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 250;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const classified = classifyRpcError(error);
      if (!classified.retryable || attempt === retries) {
        throw toForkRpcError(error, `${operation} failed`);
      }
      const jitter = Math.floor(Math.random() * 50);
      await sleep(baseDelayMs * 2 ** attempt + jitter);
    }
  }

  throw toForkRpcError(lastError, `${operation} failed`);
}
