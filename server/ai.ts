/**
 * A thin seam over the Groq SDK. Handlers depend on this interface, so tests (and CI)
 * replace it with a fake and never call Groq.
 */
import Groq, { toFile } from 'groq-sdk';
import type { ServerConfig } from './config';

export type ChatContent =
  | string
  | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: ChatContent;
}

export type ResponseFormat =
  | { type: 'json_object' }
  | {
      type: 'json_schema';
      json_schema: { name: string; schema: Record<string, unknown>; strict: boolean };
    };

export interface ChatJsonRequest {
  model: string;
  messages: ChatMessage[];
  responseFormat: ResponseFormat;
  timeoutMs: number;
  maxTokens?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
}

export interface TranscribeRequest {
  model: string;
  audio: Uint8Array;
  fileName: string;
  mimeType: string;
  prompt: string;
  timeoutMs: number;
}

export interface AiClient {
  /** Returns the raw text content of the first choice. */
  chatJson(request: ChatJsonRequest): Promise<string>;
  transcribe(request: TranscribeRequest): Promise<{ text: string; language: string }>;
}

export function createGroqClient(config: ServerConfig): AiClient {
  const groq = new Groq({ apiKey: config.apiKey, maxRetries: 0 });
  return {
    async chatJson(request) {
      const completion = await groq.chat.completions.create(
        {
          model: request.model,
          // The SDK's message union is stricter than ours but structurally identical.
          messages: request.messages as Groq.Chat.ChatCompletionMessageParam[],
          temperature: 0,
          response_format: request.responseFormat,
          max_completion_tokens: request.maxTokens ?? 4096,
          ...(request.reasoningEffort
            ? { reasoning_effort: request.reasoningEffort, include_reasoning: false }
            : {}),
        },
        { timeout: request.timeoutMs },
      );
      return completion.choices[0]?.message?.content ?? '';
    },
    async transcribe(request) {
      const file = await toFile(request.audio, request.fileName, { type: request.mimeType });
      const result = (await groq.audio.transcriptions.create(
        {
          file,
          model: request.model,
          prompt: request.prompt,
          response_format: 'verbose_json',
          temperature: 0,
        },
        { timeout: request.timeoutMs },
      )) as { text?: string; language?: string };
      return { text: (result.text ?? '').trim(), language: result.language ?? 'unknown' };
    },
  };
}

/** Extracts a JSON object from a model reply, tolerating code fences or stray reasoning. */
export function extractJson(raw: string): unknown {
  const withoutThinking = raw.replace(/<think>[\s\S]*?<\/think>/g, '');
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(withoutThinking);
  const text = (fenced ? fenced[1]! : withoutThinking).trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new SyntaxError('No JSON object in reply');
  return JSON.parse(text.slice(start, end + 1));
}
