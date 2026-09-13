export type FetchErrorCode = 'TIMEOUT' | 'NETWORK' | 'DNS' | 'UNKNOWN';

export class ResilientFetchError extends Error {
  readonly code: FetchErrorCode;

  constructor(code: FetchErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'ResilientFetchError';
    this.code = code;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

function classifyFetchError(error: unknown): FetchErrorCode {
  if (!error || typeof error !== 'object') {
    return 'UNKNOWN';
  }

  const err = error as { name?: string; code?: string; message?: string };
  if (err.name === 'AbortError' || err.name === 'TimeoutError') {
    return 'TIMEOUT';
  }
  if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
    return 'DNS';
  }
  if (
    err.code === 'ECONNRESET' ||
    err.code === 'ECONNREFUSED' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'EPIPE'
  ) {
    return 'NETWORK';
  }
  if (typeof err.message === 'string' && /timed out|timeout/i.test(err.message)) {
    return 'TIMEOUT';
  }
  return 'UNKNOWN';
}

export interface ResilientFetchOptions extends RequestInit {
  timeoutMs?: number;
}

export async function resilientFetch(
  url: string,
  options: ResilientFetchOptions = {}
): Promise<Response> {
  const { timeoutMs = 15000, ...fetchInit } = options;

  try {
    return await fetch(url, {
      ...fetchInit,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const code = classifyFetchError(error);
    const message =
      code === 'TIMEOUT'
        ? `Request timed out after ${timeoutMs}ms`
        : code === 'DNS'
          ? 'DNS resolution failed'
          : code === 'NETWORK'
            ? 'Network connection failed'
            : 'Fetch failed';
    throw new ResilientFetchError(code, message, error);
  }
}
