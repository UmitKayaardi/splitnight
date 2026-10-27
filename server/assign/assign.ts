import { z } from 'zod';
import {
  AssignResponseSchema,
  type AssignResponse,
  type ProposedAssignment,
  type AssignRequestSchema,
} from '../../shared/schemas.js';
import { extractJson, type AiClient } from '../ai.js';
import type { ServerConfig } from '../config.js';
import { ApiError, logUpstream, toApiError } from '../errors.js';
import { ASSIGN_JSON_SCHEMA, assignSystemPrompt, assignUserPrompt } from './prompt.js';

type AssignInput = z.output<typeof AssignRequestSchema>;

const RawAssignSchema = z.object({
  assignments: z
    .array(
      z.object({
        itemId: z.string(),
        units: z.number().nullable().optional(),
        shares: z.array(z.object({ personId: z.string(), weight: z.number() })),
      }),
    )
    .default([]),
  unmatched: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
});

export interface AssignDeps {
  ai: AiClient;
  config: ServerConfig;
}

/**
 * Asks the text model to map a sentence onto items and people. Ids are replaced by short
 * keys (i1, p1) in the prompt so the model cannot leak or mangle client ids, and anything
 * that does not refer to a real item or person is dropped before the response leaves.
 */
export async function proposeAssignments(
  input: AssignInput,
  deps: AssignDeps,
): Promise<AssignResponse> {
  const itemKeys = input.items.map((item, i) => ({ ...item, key: `i${i + 1}` }));
  const peopleKeys = input.people.map((person, i) => ({ ...person, key: `p${i + 1}` }));
  const itemByKey = new Map(itemKeys.map((i) => [i.key, i]));
  const personByKey = new Map(peopleKeys.map((p) => [p.key, p]));
  const keyOfPerson = new Map(peopleKeys.map((p) => [p.id, p.key]));

  const current: Record<string, Array<{ personKey: string; weight: number }>> = {};
  for (const item of itemKeys) {
    const shares = (input.currentAssignments[item.id] ?? []).flatMap((s) => {
      const personKey = keyOfPerson.get(s.personId);
      return personKey ? [{ personKey, weight: s.weight }] : [];
    });
    if (shares.length > 0) current[item.key] = shares;
  }

  let reply: string;
  try {
    reply = await deps.ai.chatJson({
      model: deps.config.models.text,
      timeoutMs: deps.config.timeoutsMs.text,
      reasoningEffort: 'medium',
      maxTokens: 4096,
      responseFormat: {
        type: 'json_schema',
        json_schema: { name: 'assignments', schema: ASSIGN_JSON_SCHEMA, strict: true },
      },
      messages: [
        { role: 'system', content: assignSystemPrompt(input.language) },
        { role: 'user', content: assignUserPrompt(itemKeys, peopleKeys, current, input.utterance) },
      ],
    });
  } catch (error) {
    logUpstream('assign', error);
    throw toApiError(error);
  }

  let raw: z.infer<typeof RawAssignSchema>;
  try {
    raw = RawAssignSchema.parse(extractJson(reply));
  } catch {
    throw new ApiError('UPSTREAM');
  }

  const assignments: ProposedAssignment[] = [];
  for (const entry of raw.assignments) {
    const item = itemByKey.get(entry.itemId.trim());
    if (!item) continue;
    const weights = new Map<string, number>();
    for (const share of entry.shares) {
      const person = personByKey.get(share.personId.trim());
      if (!person || !Number.isFinite(share.weight) || share.weight <= 0) continue;
      weights.set(person.id, Math.min(1000, (weights.get(person.id) ?? 0) + share.weight));
    }
    if (weights.size === 0) continue;
    const units =
      typeof entry.units === 'number' &&
      Number.isInteger(entry.units) &&
      entry.units >= 1 &&
      entry.units < item.quantity
        ? entry.units
        : undefined;
    assignments.push({
      itemId: item.id,
      ...(units ? { units } : {}),
      shares: [...weights].map(([personId, weight]) => ({ personId, weight })),
    });
  }

  const clean = (list: string[], max: number) =>
    list
      .map((s) => s.trim().slice(0, 200))
      .filter(Boolean)
      .slice(0, max);

  return AssignResponseSchema.parse({
    assignments,
    unmatched: clean(raw.unmatched, 10),
    notes: clean(raw.notes, 3),
  });
}
