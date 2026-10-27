// @vitest-environment node
import { ApiErrorBodySchema, AssignResponseSchema, ParsedReceiptSchema } from '../shared/schemas';
import type { AiClient, ChatJsonRequest } from './ai';
import { getConfig } from './config';
import {
  handleAssign,
  handleHealth,
  handleParseReceipt,
  handleTranscribe,
  sniffImageType,
  type HandlerDeps,
} from './handlers';
import { RateLimiter } from './rateLimit';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(64).fill(1)]);

const goodReceipt = {
  merchant: 'Moonlight Grill',
  currency: 'GBP',
  items: [
    {
      name: 'Adana Kebab',
      quantity: 2,
      unitPrice: 15.5,
      lineTotal: 31,
      category: 'main',
      confidence: 0.95,
    },
    {
      name: 'Shepherd Salad',
      quantity: 1,
      unitPrice: 6.5,
      lineTotal: 6.5,
      category: 'side',
      confidence: 0.9,
    },
    {
      name: 'VISA **** 1234',
      quantity: 1,
      unitPrice: null,
      lineTotal: 47.81,
      category: 'other',
      confidence: 0.9,
    },
  ],
  subtotal: 37.5,
  taxLines: [{ label: 'VAT 20%', amount: 6.25, includedInPrices: true }],
  serviceCharge: { label: 'Optional service 12.5%', amount: 4.69, ratePercent: 12.5 },
  tip: null,
  discounts: [],
  total: 42.19,
  warnings: ['blurry', 'something-else'],
};

class FakeAi implements AiClient {
  chatCalls: ChatJsonRequest[] = [];
  transcribeModels: string[] = [];
  constructor(
    private readonly replies: Array<string | Error>,
    private readonly transcripts: Array<{ text: string; language: string } | Error> = [],
  ) {}
  async chatJson(request: ChatJsonRequest): Promise<string> {
    this.chatCalls.push(request);
    const next = this.replies.shift();
    if (next === undefined) throw new Error('no more fake replies');
    if (next instanceof Error) throw next;
    return next;
  }
  async transcribe(request: { model: string }) {
    this.transcribeModels.push(request.model);
    const next = this.transcripts.shift();
    if (!next) throw new Error('no more fake transcripts');
    if (next instanceof Error) throw next;
    return next;
  }
}

function upstreamError(status: number, name = 'APIError'): Error {
  return Object.assign(new Error('upstream said something secret'), { status, name });
}

function deps(ai: AiClient | null, limiter = new RateLimiter(100, 60_000)): HandlerDeps {
  return { config: getConfig(), ai, limiter };
}

function imageRequest(
  bytes: Uint8Array<ArrayBuffer> = JPEG,
  headers: Record<string, string> = {},
): Request {
  const form = new FormData();
  form.append('image', new Blob([bytes], { type: 'image/jpeg' }), 'receipt.jpg');
  return new Request('http://localhost/api/parse-receipt', {
    method: 'POST',
    body: form,
    headers: { host: 'localhost', ...headers },
  });
}

async function errorCode(response: Response): Promise<string> {
  return ApiErrorBodySchema.parse(await response.json()).error.code;
}

describe('health', () => {
  it('reports models but no secrets', async () => {
    const res = handleHealth(deps(null));
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, aiConfigured: false });
    expect(JSON.stringify(body)).not.toMatch(/gsk_/);
  });
});

describe('parse-receipt', () => {
  it('returns a validated receipt in minor units without card data', async () => {
    const ai = new FakeAi([JSON.stringify(goodReceipt)]);
    const res = await handleParseReceipt(imageRequest(), deps(ai));
    expect(res.status).toBe(200);
    const receipt = ParsedReceiptSchema.parse(await res.json());
    expect(receipt.items.map((i) => i.name)).toEqual(['Adana Kebab', 'Shepherd Salad']);
    expect(receipt.items[0]).toMatchObject({
      quantity: 2,
      unitPriceMinor: 1550,
      lineTotalMinor: 3100,
    });
    expect(receipt.serviceCharge).toEqual({
      label: 'Optional service 12.5%',
      amountMinor: 469,
      ratePercent: 12.5,
    });
    expect(receipt.taxLines[0]!.includedInPrices).toBe(true);
    expect(receipt.totalMinor).toBe(4219);
    expect(receipt.warnings).toEqual(['blurry']);
    const call = ai.chatCalls[0]!;
    expect(call.model).toBe(getConfig().models.vision);
    expect(JSON.stringify(call.messages)).toContain('data:image/jpeg;base64,');
  });

  it('repairs invalid JSON once with the text model', async () => {
    const ai = new FakeAi(['Sure! Here is the receipt: {"items": [', JSON.stringify(goodReceipt)]);
    const res = await handleParseReceipt(imageRequest(), deps(ai));
    expect(res.status).toBe(200);
    expect(ai.chatCalls[1]!.model).toBe(getConfig().models.text);
  });

  it('gives up with UNREADABLE when the repair fails too', async () => {
    const ai = new FakeAi(['nope', 'still nope']);
    const res = await handleParseReceipt(imageRequest(), deps(ai));
    expect(res.status).toBe(422);
    expect(await errorCode(res)).toBe('UNREADABLE');
  });

  it('treats a photo with no items as UNREADABLE', async () => {
    const ai = new FakeAi([
      JSON.stringify({ ...goodReceipt, items: [], warnings: ['not_a_receipt'] }),
    ]);
    expect(await errorCode(await handleParseReceipt(imageRequest(), deps(ai)))).toBe('UNREADABLE');
  });

  it('maps a Groq 429 to RATE_LIMITED and hides the upstream message', async () => {
    const ai = new FakeAi([upstreamError(429, 'RateLimitError')]);
    const res = await handleParseReceipt(imageRequest(), deps(ai));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('20');
    const text = await res.text();
    expect(text).toContain('RATE_LIMITED');
    expect(text).not.toContain('secret');
  });

  it('maps timeouts to TIMEOUT', async () => {
    const ai = new FakeAi([upstreamError(0, 'APIConnectionTimeoutError')]);
    expect(await errorCode(await handleParseReceipt(imageRequest(), deps(ai)))).toBe('TIMEOUT');
  });

  it('maps other failures to UPSTREAM', async () => {
    const ai = new FakeAi([upstreamError(500)]);
    expect(await errorCode(await handleParseReceipt(imageRequest(), deps(ai)))).toBe('UPSTREAM');
  });

  it('rejects files that are not images by their real signature', async () => {
    const res = await handleParseReceipt(
      imageRequest(new Uint8Array(100).fill(65)),
      deps(new FakeAi([])),
    );
    expect(res.status).toBe(415);
  });

  it('rejects files over the size limit', async () => {
    const big = new Uint8Array(4 * 1024 * 1024 + 10);
    big.set(JPEG);
    expect(await errorCode(await handleParseReceipt(imageRequest(big), deps(new FakeAi([]))))).toBe(
      'TOO_LARGE',
    );
  });

  it('rejects requests without a multipart body', async () => {
    const req = new Request('http://localhost/api/parse-receipt', { method: 'POST', body: 'hi' });
    expect(await errorCode(await handleParseReceipt(req, deps(new FakeAi([]))))).toBe('BAD_INPUT');
  });

  it('rejects cross-site requests', async () => {
    const res = await handleParseReceipt(
      imageRequest(JPEG, { origin: 'https://evil.example' }),
      deps(new FakeAi([])),
    );
    expect(res.status).toBe(403);
    const res2 = await handleParseReceipt(
      imageRequest(JPEG, { 'sec-fetch-site': 'cross-site' }),
      deps(new FakeAi([])),
    );
    expect(res2.status).toBe(403);
  });

  it('accepts same-origin requests', async () => {
    const ai = new FakeAi([JSON.stringify(goodReceipt)]);
    const res = await handleParseReceipt(
      imageRequest(JPEG, { origin: 'http://localhost' }),
      deps(ai),
    );
    expect(res.status).toBe(200);
  });

  it('says NOT_CONFIGURED without an API key', async () => {
    const res = await handleParseReceipt(imageRequest(), deps(null));
    expect(res.status).toBe(503);
  });

  it('applies the per-IP flood guard', async () => {
    const limiter = new RateLimiter(1, 60_000);
    const ai = new FakeAi([JSON.stringify(goodReceipt)]);
    expect((await handleParseReceipt(imageRequest(), deps(ai, limiter))).status).toBe(200);
    expect(await errorCode(await handleParseReceipt(imageRequest(), deps(ai, limiter)))).toBe(
      'RATE_LIMITED',
    );
  });
});

describe('assign', () => {
  const body = {
    utterance: 'Ahmet had the salad, Ayşe and Can shared the two kebabs',
    items: [
      { id: 'kebab-1', name: 'Adana Kebab', quantity: 2 },
      { id: 'salad-1', name: 'Shepherd Salad', quantity: 1 },
    ],
    people: [
      { id: 'a', name: 'Ahmet' },
      { id: 'b', name: 'Ayşe' },
      { id: 'c', name: 'Can' },
    ],
    currentAssignments: { 'kebab-1': [{ personId: 'c', weight: 1 }] },
  };
  const post = (payload: unknown) =>
    new Request('http://localhost/api/assign', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
    });

  it('maps short keys back to ids and drops anything unknown', async () => {
    const ai = new FakeAi([
      JSON.stringify({
        assignments: [
          { itemId: 'i2', units: null, shares: [{ personId: 'p1', weight: 1 }] },
          {
            itemId: 'i1',
            units: null,
            shares: [
              { personId: 'p2', weight: 1 },
              { personId: 'p3', weight: 1 },
              { personId: 'p9', weight: 1 },
            ],
          },
          { itemId: 'i7', units: null, shares: [{ personId: 'p1', weight: 1 }] },
          { itemId: 'i1', units: 1, shares: [{ personId: 'p1', weight: -2 }] },
        ],
        unmatched: [],
        notes: ['Ahmet gets the salad.'],
      }),
    ]);
    const res = await handleAssign(post(body), deps(ai));
    expect(res.status).toBe(200);
    const result = AssignResponseSchema.parse(await res.json());
    expect(result.assignments).toEqual([
      { itemId: 'salad-1', shares: [{ personId: 'a', weight: 1 }] },
      {
        itemId: 'kebab-1',
        shares: [
          { personId: 'b', weight: 1 },
          { personId: 'c', weight: 1 },
        ],
      },
    ]);
    expect(result.notes).toEqual(['Ahmet gets the salad.']);
    const prompt = JSON.stringify(ai.chatCalls[0]!.messages);
    expect(prompt).toContain('i1: p3×1');
    expect(prompt).not.toContain('kebab-1');
  });

  it('keeps a valid partial-unit split', async () => {
    const ai = new FakeAi([
      JSON.stringify({
        assignments: [{ itemId: 'i1', units: 1, shares: [{ personId: 'p1', weight: 1 }] }],
        unmatched: ['the dog'],
        notes: [],
      }),
    ]);
    const result = AssignResponseSchema.parse(
      await (await handleAssign(post(body), deps(ai))).json(),
    );
    expect(result.assignments[0]).toEqual({
      itemId: 'kebab-1',
      units: 1,
      shares: [{ personId: 'a', weight: 1 }],
    });
    expect(result.unmatched).toEqual(['the dog']);
  });

  it('rejects invalid bodies', async () => {
    expect(await errorCode(await handleAssign(post({ utterance: '' }), deps(new FakeAi([]))))).toBe(
      'BAD_INPUT',
    );
    const bad = new Request('http://localhost/api/assign', { method: 'POST', body: '{' });
    expect(await errorCode(await handleAssign(bad, deps(new FakeAi([]))))).toBe('BAD_INPUT');
  });

  it('reports malformed model output as UPSTREAM', async () => {
    expect(await errorCode(await handleAssign(post(body), deps(new FakeAi(['oops']))))).toBe(
      'UPSTREAM',
    );
  });
});

describe('transcribe', () => {
  const audioRequest = (type = 'audio/webm', size = 4000) => {
    const form = new FormData();
    form.append('audio', new Blob([new Uint8Array(size)], { type }), 'speech');
    form.append('names', JSON.stringify(['Ayşe', 'Can']));
    form.append('items', JSON.stringify(['Lahmacun']));
    return new Request('http://localhost/api/transcribe', { method: 'POST', body: form });
  };

  it('transcribes and falls back to the turbo model when the main one is busy', async () => {
    const ai = new FakeAi(
      [],
      [upstreamError(429), { text: ' Ayşe had the lahmacun ', language: 'english' }],
    );
    const res = await handleTranscribe(audioRequest(), deps(ai));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: 'Ayşe had the lahmacun', language: 'english' });
    expect(ai.transcribeModels).toEqual(['whisper-large-v3', 'whisper-large-v3-turbo']);
  });

  it('does not retry on timeouts', async () => {
    const ai = new FakeAi([], [upstreamError(408)]);
    expect(await errorCode(await handleTranscribe(audioRequest(), deps(ai)))).toBe('TIMEOUT');
    expect(ai.transcribeModels).toHaveLength(1);
  });

  it('rejects unsupported audio types and empty clips', async () => {
    expect(
      await errorCode(await handleTranscribe(audioRequest('video/avi'), deps(new FakeAi([])))),
    ).toBe('UNSUPPORTED_TYPE');
    expect(
      await errorCode(await handleTranscribe(audioRequest('audio/webm', 10), deps(new FakeAi([])))),
    ).toBe('BAD_INPUT');
  });
});

describe('sniffImageType', () => {
  it('recognises JPEG, PNG and WebP', () => {
    expect(sniffImageType(JPEG)).toBe('image/jpeg');
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0]))).toBe('image/png');
    const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
    expect(sniffImageType(webp)).toBe('image/webp');
    expect(sniffImageType(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe('RateLimiter', () => {
  it('allows hits again after the window passes', () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1000, () => now);
    expect(limiter.take('x')).toBe(true);
    expect(limiter.take('x')).toBe(true);
    expect(limiter.take('x')).toBe(false);
    expect(limiter.take('y')).toBe(true);
    now = 1001;
    expect(limiter.take('x')).toBe(true);
  });
});
