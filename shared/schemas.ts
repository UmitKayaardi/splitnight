/**
 * Wire format shared by the browser and the serverless functions.
 * Every API response is validated against these schemas on both sides.
 */
import { z } from 'zod';

export const CATEGORIES = ['starter', 'main', 'side', 'dessert', 'drink', 'other'] as const;
export const CategorySchema = z.enum(CATEGORIES);

const minor = z.number().int().safe();
const nonNegativeMinor = minor.nonnegative();

export const RECEIPT_WARNINGS = [
  'blurry',
  'cropped',
  'handwritten',
  'not_a_receipt',
  'multiple_receipts',
  'partially_readable',
] as const;
export const ReceiptWarningSchema = z.enum(RECEIPT_WARNINGS);

export const ReceiptItemSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  quantity: z.number().positive().max(1000),
  unitPriceMinor: nonNegativeMinor,
  lineTotalMinor: nonNegativeMinor,
  category: CategorySchema,
  confidence: z.number().min(0).max(1),
});

export const TaxLineSchema = z.object({
  label: z.string().max(60),
  amountMinor: nonNegativeMinor,
  includedInPrices: z.boolean(),
});

export const ServiceChargeSchema = z.object({
  label: z.string().max(60),
  amountMinor: nonNegativeMinor,
  ratePercent: z.number().min(0).max(100).optional(),
});

export const DiscountSchema = z.object({
  label: z.string().max(60),
  /** Always a positive number: the amount taken off. */
  amountMinor: nonNegativeMinor,
});

export const ParsedReceiptSchema = z.object({
  merchant: z.string().max(80).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  items: z.array(ReceiptItemSchema).max(150),
  subtotalMinor: nonNegativeMinor.optional(),
  taxLines: z.array(TaxLineSchema).max(10),
  serviceCharge: ServiceChargeSchema.optional(),
  tipMinor: nonNegativeMinor.optional(),
  discounts: z.array(DiscountSchema).max(10),
  totalMinor: nonNegativeMinor.optional(),
  warnings: z.array(ReceiptWarningSchema),
});

export const AssignItemSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  quantity: z.number().positive().max(1000),
});

export const AssignPersonSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(40),
});

export const ShareSchema = z.object({
  personId: z.string().min(1).max(40),
  weight: z.number().positive().max(1000),
});

export const AssignRequestSchema = z.object({
  utterance: z.string().trim().min(1).max(1000),
  items: z.array(AssignItemSchema).min(1).max(150),
  people: z.array(AssignPersonSchema).min(1).max(30),
  currentAssignments: z.record(z.string(), z.array(ShareSchema)).default({}),
  /** UI language for the short notes, e.g. "en". */
  language: z.string().min(2).max(5).default('en'),
});

export const ProposedAssignmentSchema = z.object({
  itemId: z.string(),
  /** How many units of the line this covers; omitted when it covers the whole line. */
  units: z.number().int().positive().optional(),
  shares: z.array(ShareSchema).min(1),
});

export const AssignResponseSchema = z.object({
  assignments: z.array(ProposedAssignmentSchema),
  unmatched: z.array(z.string()),
  notes: z.array(z.string()),
});

export const TranscribeResponseSchema = z.object({
  text: z.string(),
  language: z.string(),
});

export const ERROR_CODES = [
  'RATE_LIMITED',
  'UNREADABLE',
  'TOO_LARGE',
  'UNSUPPORTED_TYPE',
  'BAD_INPUT',
  'UPSTREAM',
  'TIMEOUT',
  'NOT_CONFIGURED',
  'FORBIDDEN',
] as const;
export const ErrorCodeSchema = z.enum(ERROR_CODES);

export const ApiErrorBodySchema = z.object({
  error: z.object({ code: ErrorCodeSchema, message: z.string() }),
});

export const HealthSchema = z.object({
  ok: z.boolean(),
  aiConfigured: z.boolean(),
  models: z.object({ vision: z.string(), text: z.string(), speech: z.string() }),
});

export type Category = z.infer<typeof CategorySchema>;
export type ReceiptWarning = z.infer<typeof ReceiptWarningSchema>;
export type ReceiptItem = z.infer<typeof ReceiptItemSchema>;
export type ParsedReceipt = z.infer<typeof ParsedReceiptSchema>;
export type AssignRequest = z.input<typeof AssignRequestSchema>;
export type AssignResponse = z.infer<typeof AssignResponseSchema>;
export type ProposedAssignment = z.infer<typeof ProposedAssignmentSchema>;
export type TranscribeResponse = z.infer<typeof TranscribeResponseSchema>;
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type Health = z.infer<typeof HealthSchema>;

export const LIMITS = {
  imageBytes: 4 * 1024 * 1024,
  audioBytes: 4 * 1024 * 1024,
  audioSeconds: 60,
  imageTypes: ['image/jpeg', 'image/png', 'image/webp'],
  audioTypes: [
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/aac',
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav',
  ],
} as const;
