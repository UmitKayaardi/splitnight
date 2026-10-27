import type { ErrorCode } from '../shared/schemas.js';

const STATUS: Record<ErrorCode, number> = {
  RATE_LIMITED: 429,
  UNREADABLE: 422,
  TOO_LARGE: 413,
  UNSUPPORTED_TYPE: 415,
  BAD_INPUT: 400,
  UPSTREAM: 502,
  TIMEOUT: 504,
  NOT_CONFIGURED: 503,
  FORBIDDEN: 403,
};

/** Safe, generic messages. Raw upstream errors never reach the client. */
const MESSAGES: Record<ErrorCode, string> = {
  RATE_LIMITED: 'The AI is busy right now. Please try again in a moment.',
  UNREADABLE: 'We could not read that receipt.',
  TOO_LARGE: 'That file is too large.',
  UNSUPPORTED_TYPE: 'That file type is not supported.',
  BAD_INPUT: 'The request was not valid.',
  UPSTREAM: 'The AI service had a problem.',
  TIMEOUT: 'The AI took too long to answer.',
  NOT_CONFIGURED: 'AI features are not configured on this server.',
  FORBIDDEN: 'Requests are only accepted from the SplitNight app.',
};

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? MESSAGES[code]);
    this.name = 'ApiError';
  }
}

const SECURITY_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...SECURITY_HEADERS, ...extra },
  });
}

export function errorResponse(code: ErrorCode, extra: Record<string, string> = {}): Response {
  return json({ error: { code, message: MESSAGES[code] } }, STATUS[code], extra);
}

interface UpstreamLike {
  status?: number;
  name?: string;
  code?: string;
}

/** Maps anything thrown by the Groq SDK (or fetch) onto one of our error codes. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const e = (error ?? {}) as UpstreamLike;
  const name = e.name ?? '';
  if (e.status === 429) return new ApiError('RATE_LIMITED');
  if (e.status === 413) return new ApiError('TOO_LARGE');
  if (
    name.includes('Timeout') ||
    name === 'AbortError' ||
    e.code === 'ETIMEDOUT' ||
    e.status === 408
  ) {
    return new ApiError('TIMEOUT');
  }
  return new ApiError('UPSTREAM');
}

/** Logs only the error class and status — never request bodies, images, audio or keys. */
export function logUpstream(where: string, error: unknown): void {
  const e = (error ?? {}) as UpstreamLike;
  console.error(`[${where}] ${e.name ?? 'Error'}${e.status ? ` (${e.status})` : ''}`);
}
