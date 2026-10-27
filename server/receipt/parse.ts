import { z } from 'zod';
import { minorDigits, isValidCurrency } from '../../src/lib/money/format';
import {
  CATEGORIES,
  ParsedReceiptSchema,
  RECEIPT_WARNINGS,
  type Category,
  type ParsedReceipt,
  type ReceiptItem,
  type ReceiptWarning,
} from '../../shared/schemas';
import { extractJson, type AiClient } from '../ai';
import type { ServerConfig } from '../config';
import { ApiError, logUpstream, toApiError } from '../errors';
import { RECEIPT_SYSTEM_PROMPT, RECEIPT_USER_PROMPT, repairPrompt } from './prompt';

/** Numbers sometimes arrive as strings ("4,50", "£4.50"); accept them leniently. */
const looseNumber = z.preprocess((value) => {
  if (typeof value === 'string') {
    const cleaned = value
      .replace(/[^\d.,-]/g, '')
      .replace(/,(?=\d{1,2}$)/, '.')
      .replace(/,/g, '');
    return cleaned === '' ? null : Number(cleaned);
  }
  return value;
}, z.number().finite().nullable());

const looseString = z.preprocess(
  (v) => (typeof v === 'number' ? String(v) : v),
  z.string().nullable().optional(),
);

/** What we accept from the model before normalising. Deliberately forgiving. */
export const RawReceiptSchema = z.object({
  merchant: looseString,
  currency: looseString,
  items: z.array(
    z.object({
      name: looseString,
      quantity: looseNumber.optional(),
      unitPrice: looseNumber.optional(),
      lineTotal: looseNumber.optional(),
      category: z.string().nullable().optional(),
      confidence: looseNumber.optional(),
    }),
  ),
  subtotal: looseNumber.optional(),
  taxLines: z
    .array(
      z.object({
        label: looseString,
        amount: looseNumber,
        includedInPrices: z.boolean().nullable().optional(),
      }),
    )
    .nullable()
    .optional(),
  serviceCharge: z
    .object({ label: looseString, amount: looseNumber, ratePercent: looseNumber.optional() })
    .nullable()
    .optional(),
  tip: looseNumber.optional(),
  discounts: z
    .array(z.object({ label: looseString, amount: looseNumber }))
    .nullable()
    .optional(),
  total: looseNumber.optional(),
  warnings: z.array(z.string()).nullable().optional(),
});

export type RawReceipt = z.infer<typeof RawReceiptSchema>;

const CARD_LIKE =
  /(\d[ -]?){12,19}|\*{3,}\s?\d{3,4}|\b(visa|mastercard|amex|maestro|contactless)\b/i;
const NON_ITEM =
  /^(sub ?total|total|balance|change|cash|card|tender|vat|tax|kdv|mwst|tva|iva|service|tip|gratuity|amount due|to pay)\b/i;

function clampText(value: string | null | undefined, max: number): string | undefined {
  const text = value?.replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : undefined;
}

function guessCurrency(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const text = raw.trim().toUpperCase();
  const symbols: Record<string, string> = {
    '£': 'GBP',
    '€': 'EUR',
    $: 'USD',
    '₺': 'TRY',
    TL: 'TRY',
  };
  if (symbols[text]) return symbols[text];
  return isValidCurrency(text) ? text : undefined;
}

/**
 * Turns the model's decimal JSON into the app's integer-minor-unit receipt, dropping
 * anything that looks like personal data and flagging lines whose maths does not add up.
 */
export function normaliseReceipt(
  raw: RawReceipt,
  makeId: (index: number) => string,
): ParsedReceipt {
  const currency = guessCurrency(raw.currency) ?? 'GBP';
  const factor = 10 ** minorDigits(currency);
  const toMinor = (n: number | null | undefined) =>
    n === null || n === undefined || !Number.isFinite(n) ? undefined : Math.round(n * factor);

  const items: ReceiptItem[] = [];
  const discounts: ParsedReceipt['discounts'] = [];

  raw.items.forEach((rawItem) => {
    const name = clampText(rawItem.name, 80);
    if (!name || CARD_LIKE.test(name) || NON_ITEM.test(name)) return;
    let quantity = rawItem.quantity && rawItem.quantity > 0 ? rawItem.quantity : 1;
    quantity = Math.min(1000, Math.round(quantity * 1000) / 1000);
    let unit = toMinor(rawItem.unitPrice);
    let line = toMinor(rawItem.lineTotal);
    if (line === undefined && unit !== undefined) line = Math.round(unit * quantity);
    if (line === undefined) return;
    if (line < 0) {
      discounts.push({ label: name.slice(0, 60), amountMinor: -line });
      return;
    }
    if (unit === undefined || unit < 0) unit = Math.round(line / quantity);
    let confidence = Math.min(1, Math.max(0, rawItem.confidence ?? 0.5));
    if (Math.abs(Math.round(unit * quantity) - line) > Math.max(1, quantity)) {
      confidence = Math.min(confidence, 0.5);
    }
    const category: Category = (CATEGORIES as readonly string[]).includes(rawItem.category ?? '')
      ? (rawItem.category as Category)
      : 'other';
    items.push({
      id: makeId(items.length),
      name,
      quantity,
      unitPriceMinor: unit,
      lineTotalMinor: line,
      category,
      confidence: Math.round(confidence * 100) / 100,
    });
  });

  for (const d of raw.discounts ?? []) {
    const amount = toMinor(d.amount);
    if (amount)
      discounts.push({
        label: clampText(d.label, 60) ?? 'Discount',
        amountMinor: Math.abs(amount),
      });
  }

  const taxLines = (raw.taxLines ?? []).flatMap((t) => {
    const amount = toMinor(t.amount);
    if (amount === undefined || amount <= 0) return [];
    return [
      {
        label: clampText(t.label, 60) ?? 'Tax',
        amountMinor: amount,
        includedInPrices: t.includedInPrices ?? currency !== 'USD',
      },
    ];
  });

  const serviceAmount = toMinor(raw.serviceCharge?.amount);
  const serviceRate = raw.serviceCharge?.ratePercent;
  const serviceCharge =
    serviceAmount && serviceAmount > 0
      ? {
          label: clampText(raw.serviceCharge?.label, 60) ?? 'Service charge',
          amountMinor: serviceAmount,
          ...(serviceRate && serviceRate > 0 && serviceRate <= 100
            ? { ratePercent: serviceRate }
            : {}),
        }
      : undefined;

  const warnings = [
    ...new Set(
      (raw.warnings ?? []).filter((w): w is ReceiptWarning =>
        (RECEIPT_WARNINGS as readonly string[]).includes(w),
      ),
    ),
  ];
  const nonNegative = (n: number | undefined) => (n !== undefined && n >= 0 ? n : undefined);
  const tip = nonNegative(toMinor(raw.tip));

  return ParsedReceiptSchema.parse({
    merchant: clampText(raw.merchant, 80),
    currency,
    items: items.slice(0, 150),
    subtotalMinor: nonNegative(toMinor(raw.subtotal)),
    taxLines: taxLines.slice(0, 10),
    serviceCharge,
    tipMinor: tip || undefined,
    discounts: discounts.slice(0, 10),
    totalMinor: nonNegative(toMinor(raw.total)),
    warnings,
  });
}

export interface ParseReceiptDeps {
  ai: AiClient;
  config: ServerConfig;
  makeId?: (index: number) => string;
}

function validate(reply: string): { ok: true; raw: RawReceipt } | { ok: false; problem: string } {
  let data: unknown;
  try {
    data = extractJson(reply);
  } catch {
    return { ok: false, problem: 'not valid JSON' };
  }
  const result = RawReceiptSchema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      ok: false,
      problem: `${issue?.path.join('.') || 'root'}: ${issue?.message ?? 'invalid'}`,
    };
  }
  return { ok: true, raw: result.data };
}

/**
 * Reads a receipt image with the vision model. If the reply is not valid JSON it is
 * repaired once by the text model; if that fails too, the receipt is UNREADABLE.
 */
export async function parseReceiptImage(
  image: Uint8Array,
  mimeType: string,
  deps: ParseReceiptDeps,
): Promise<ParsedReceipt> {
  const { ai, config } = deps;
  const makeId = deps.makeId ?? ((i: number) => `r${i + 1}`);
  const dataUrl = `data:${mimeType};base64,${Buffer.from(image).toString('base64')}`;

  let reply: string;
  try {
    reply = await ai.chatJson({
      model: config.models.vision,
      timeoutMs: config.timeoutsMs.vision,
      responseFormat: { type: 'json_object' },
      maxTokens: 6000,
      messages: [
        { role: 'system', content: RECEIPT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: RECEIPT_USER_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    });
  } catch (error) {
    logUpstream('parse-receipt', error);
    throw toApiError(error);
  }

  let checked = validate(reply);
  if (!checked.ok) {
    try {
      const repaired = await ai.chatJson({
        model: config.models.text,
        timeoutMs: config.timeoutsMs.text,
        responseFormat: { type: 'json_object' },
        reasoningEffort: 'low',
        messages: [{ role: 'user', content: repairPrompt(reply, checked.problem) }],
      });
      checked = validate(repaired);
    } catch (error) {
      logUpstream('parse-receipt:repair', error);
      const mapped = toApiError(error);
      if (mapped.code === 'RATE_LIMITED' || mapped.code === 'TIMEOUT') throw mapped;
    }
  }
  if (!checked.ok) throw new ApiError('UNREADABLE');

  const receipt = normaliseReceipt(checked.raw, makeId);
  if (receipt.items.length === 0) throw new ApiError('UNREADABLE');
  return receipt;
}
