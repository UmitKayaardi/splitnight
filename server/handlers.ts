/**
 * HTTP handlers for the serverless functions. They use only the Web Request/Response API,
 * so the same code runs on Vercel, inside the Vite dev server and in unit tests.
 */
import { AssignRequestSchema, LIMITS, type Health } from '../shared/schemas';
import { createGroqClient, type AiClient } from './ai';
import { proposeAssignments } from './assign/assign';
import { getConfig, type ServerConfig } from './config';
import { ApiError, errorResponse, json, toApiError } from './errors';
import { RateLimiter, clientIp } from './rateLimit';
import { parseReceiptImage } from './receipt/parse';
import { transcribeAudio, vocabularyHint } from './speech/transcribe';

export interface HandlerDeps {
  config: ServerConfig;
  ai: AiClient | null;
  limiter: RateLimiter;
}

let shared: HandlerDeps | null = null;

/** Lazily built per function instance. The rate limiter lives as long as the instance. */
export function defaultDeps(): HandlerDeps {
  if (!shared) {
    const config = getConfig();
    shared = {
      config,
      ai: config.apiKey ? createGroqClient(config) : null,
      limiter: new RateLimiter(config.rateLimit.max, config.rateLimit.windowMs),
    };
  }
  return shared;
}

/** Rejects cross-site browser requests. Requests without an Origin (curl, tests) pass. */
function assertSameOrigin(request: Request): void {
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') throw new ApiError('FORBIDDEN');
  const origin = request.headers.get('origin');
  if (!origin) return;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError('FORBIDDEN');
  }
  if (!host || originHost !== host) throw new ApiError('FORBIDDEN');
}

function guard(request: Request, deps: HandlerDeps): AiClient {
  assertSameOrigin(request);
  if (!deps.limiter.take(clientIp(request))) throw new ApiError('RATE_LIMITED');
  if (!deps.ai) throw new ApiError('NOT_CONFIGURED');
  return deps.ai;
}

function assertSize(request: Request, maxBytes: number): void {
  const length = Number(request.headers.get('content-length') ?? '0');
  // Multipart adds a little overhead around the file itself.
  if (length > maxBytes + 64 * 1024) throw new ApiError('TOO_LARGE');
}

async function readFile(request: Request, field: string): Promise<{ form: FormData; file: File }> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.startsWith('multipart/form-data')) throw new ApiError('BAD_INPUT');
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError('BAD_INPUT');
  }
  const file = form.get(field);
  if (!file || typeof file === 'string') throw new ApiError('BAD_INPUT');
  return { form, file };
}

/** Checks the real file signature, not just the declared type. */
export function sniffImageType(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b.length > 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function respondWithError(error: unknown): Response {
  const apiError = toApiError(error);
  const extra: Record<string, string> =
    apiError.code === 'RATE_LIMITED' ? { 'retry-after': '20' } : {};
  return errorResponse(apiError.code, extra);
}

export async function handleParseReceipt(
  request: Request,
  deps = defaultDeps(),
): Promise<Response> {
  try {
    const ai = guard(request, deps);
    assertSize(request, LIMITS.imageBytes);
    const { file } = await readFile(request, 'image');
    if (file.size > LIMITS.imageBytes) throw new ApiError('TOO_LARGE');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = sniffImageType(bytes);
    if (!mimeType || !(LIMITS.imageTypes as readonly string[]).includes(mimeType)) {
      throw new ApiError('UNSUPPORTED_TYPE');
    }
    const receipt = await parseReceiptImage(bytes, mimeType, { ai, config: deps.config });
    return json(receipt);
  } catch (error) {
    return respondWithError(error);
  }
}

export async function handleTranscribe(request: Request, deps = defaultDeps()): Promise<Response> {
  try {
    const ai = guard(request, deps);
    assertSize(request, LIMITS.audioBytes);
    const { form, file } = await readFile(request, 'audio');
    if (file.size > LIMITS.audioBytes) throw new ApiError('TOO_LARGE');
    if (file.size < 200) throw new ApiError('BAD_INPUT');
    const mimeType = (file.type || '').split(';')[0]!.trim().toLowerCase();
    if (!(LIMITS.audioTypes as readonly string[]).includes(mimeType)) {
      throw new ApiError('UNSUPPORTED_TYPE');
    }
    const parseList = (key: string) => {
      const value = form.get(key);
      if (typeof value !== 'string') return [];
      try {
        const list: unknown = JSON.parse(value);
        return Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string') : [];
      } catch {
        return [];
      }
    };
    const hint = vocabularyHint(parseList('names'), parseList('items'));
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await transcribeAudio(bytes, mimeType, hint, { ai, config: deps.config });
    return json(result);
  } catch (error) {
    return respondWithError(error);
  }
}

export async function handleAssign(request: Request, deps = defaultDeps()): Promise<Response> {
  try {
    const ai = guard(request, deps);
    assertSize(request, 256 * 1024);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError('BAD_INPUT');
    }
    const parsed = AssignRequestSchema.safeParse(body);
    if (!parsed.success) throw new ApiError('BAD_INPUT');
    const result = await proposeAssignments(parsed.data, { ai, config: deps.config });
    return json(result);
  } catch (error) {
    return respondWithError(error);
  }
}

export function handleHealth(deps = defaultDeps()): Response {
  const body: Health = {
    ok: true,
    aiConfigured: deps.ai !== null,
    models: {
      vision: deps.config.models.vision,
      text: deps.config.models.text,
      speech: deps.config.models.speech,
    },
  };
  return json(body);
}
