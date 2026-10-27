/**
 * Browser-side API client. Every response is validated with the shared Zod schemas,
 * and every failure becomes one of a small set of codes the UI knows how to explain.
 */
import type { z } from 'zod';
import {
  ApiErrorBodySchema,
  AssignResponseSchema,
  HealthSchema,
  ParsedReceiptSchema,
  TranscribeResponseSchema,
  type AssignRequest,
  type ErrorCode,
} from '../../shared/schemas';
import { ClientApiError } from './errors';

export { ClientApiError, errorCodeOf, type ClientErrorCode } from './errors';

const STATUS_CODES: Record<number, ErrorCode> = {
  400: 'BAD_INPUT',
  403: 'FORBIDDEN',
  413: 'TOO_LARGE',
  415: 'UNSUPPORTED_TYPE',
  422: 'UNREADABLE',
  429: 'RATE_LIMITED',
  503: 'NOT_CONFIGURED',
  504: 'TIMEOUT',
};

const CLIENT_TIMEOUT_MS = 70_000;

async function request<S extends z.ZodType>(
  path: string,
  init: RequestInit,
  schema: S,
  signal?: AbortSignal,
): Promise<z.infer<S>> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ClientApiError('OFFLINE');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), CLIENT_TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort('cancelled'));

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      signal: controller.signal,
      credentials: 'same-origin',
    });
  } catch (error) {
    if (controller.signal.reason === 'timeout') throw new ClientApiError('TIMEOUT');
    if (controller.signal.aborted) throw error;
    throw new ClientApiError(navigator.onLine === false ? 'OFFLINE' : 'NETWORK');
  } finally {
    clearTimeout(timer);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON error pages (e.g. the platform's own 413) are handled by status below.
  }
  if (!response.ok) {
    const parsed = ApiErrorBodySchema.safeParse(body);
    throw new ClientApiError(
      parsed.success ? parsed.data.error.code : (STATUS_CODES[response.status] ?? 'UPSTREAM'),
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ClientApiError('UPSTREAM');
  return parsed.data;
}

export function parseReceipt(image: Blob, signal?: AbortSignal) {
  const form = new FormData();
  form.append('image', image, 'receipt.jpg');
  return request('/api/parse-receipt', { method: 'POST', body: form }, ParsedReceiptSchema, signal);
}

export function transcribe(audio: Blob, names: string[], items: string[], signal?: AbortSignal) {
  const form = new FormData();
  form.append('audio', audio, 'speech');
  form.append('names', JSON.stringify(names));
  form.append('items', JSON.stringify(items));
  return request(
    '/api/transcribe',
    { method: 'POST', body: form },
    TranscribeResponseSchema,
    signal,
  );
}

export function assign(body: AssignRequest, signal?: AbortSignal) {
  return request(
    '/api/assign',
    { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } },
    AssignResponseSchema,
    signal,
  );
}

export function health(signal?: AbortSignal) {
  return request('/api/health', { method: 'GET' }, HealthSchema, signal);
}
