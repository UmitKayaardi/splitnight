import type { TranscribeResponse } from '../../shared/schemas';
import type { AiClient } from '../ai';
import type { ServerConfig } from '../config';
import { logUpstream, toApiError } from '../errors';

/**
 * Whisper's prompt is limited to ~224 tokens. A short list of the people's names and the
 * receipt's item names makes it far more likely to spell "Ayşe" or "Lahmacun" correctly.
 */
export function vocabularyHint(names: string[], items: string[]): string {
  const unique = (list: string[]) => [...new Set(list.map((s) => s.trim()).filter(Boolean))];
  const people = unique(names).slice(0, 20).join(', ');
  const dishes = unique(items).slice(0, 40).join(', ');
  const hint = [people && `Names: ${people}.`, dishes && `Items: ${dishes}.`]
    .filter(Boolean)
    .join(' ');
  return hint.slice(0, 600);
}

const EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};

export function audioFileName(mimeType: string): string {
  return `speech.${EXTENSIONS[mimeType] ?? 'webm'}`;
}

export interface TranscribeDeps {
  ai: AiClient;
  config: ServerConfig;
}

/** Transcribes with the main Whisper model and falls back to the turbo model once. */
export async function transcribeAudio(
  audio: Uint8Array,
  mimeType: string,
  hint: string,
  deps: TranscribeDeps,
): Promise<TranscribeResponse> {
  const { config } = deps;
  const models = [config.models.speech, config.models.speechFallback].filter(
    (m, i, all) => all.indexOf(m) === i,
  );
  let lastError: unknown;
  for (const model of models) {
    try {
      const result = await deps.ai.transcribe({
        model,
        audio,
        mimeType,
        fileName: audioFileName(mimeType),
        prompt: hint,
        timeoutMs: config.timeoutsMs.speech,
      });
      return { text: result.text.trim().slice(0, 1000), language: result.language };
    } catch (error) {
      logUpstream(`transcribe:${model}`, error);
      lastError = error;
      const code = toApiError(error).code;
      if (code !== 'RATE_LIMITED' && code !== 'UPSTREAM') break;
    }
  }
  throw toApiError(lastError);
}
