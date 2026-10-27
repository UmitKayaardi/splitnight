/**
 * Model names come from environment variables so a deprecated Groq model can be swapped
 * without a code change. Defaults were checked against Groq's /models list on 2026-10-27.
 */
export const DEFAULT_MODELS = {
  vision: 'qwen/qwen3.8-27b',
  text: 'openai/gpt-oss-120b',
  speech: 'whisper-large-v3',
  speechFallback: 'whisper-large-v3-turbo',
} as const;

const env = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
};

export function getConfig() {
  return {
    apiKey: env('GROQ_API_KEY'),
    models: {
      vision: env('GROQ_VISION_MODEL') ?? DEFAULT_MODELS.vision,
      text: env('GROQ_TEXT_MODEL') ?? DEFAULT_MODELS.text,
      speech: env('GROQ_STT_MODEL') ?? DEFAULT_MODELS.speech,
      speechFallback: env('GROQ_STT_FALLBACK_MODEL') ?? DEFAULT_MODELS.speechFallback,
    },
    timeoutsMs: { vision: 45_000, text: 30_000, speech: 30_000 },
    /** Best-effort flood guard per IP. Generous: a real person never gets near it. */
    rateLimit: { max: 60, windowMs: 10 * 60_000 },
  };
}

export type ServerConfig = ReturnType<typeof getConfig>;
