import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  CORS_ORIGIN: z.string().default('*'),

  AI_PROVIDER: z.enum(['anthropic', 'openai', 'gemini']).default('gemini'),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  OPENAI_API_KEY: z.string().optional().default(''),
  GEMINI_API_KEY: z.string().optional().default(''),

  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-5'),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),

  BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(20),
  MAX_CONCURRENT_BATCHES: z.coerce.number().int().min(1).max(10).default(3),
  MAX_RETRIES: z.coerce.number().int().min(0).max(6).default(3),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(5),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // Fail fast with a readable message instead of undefined behaviour later.
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

/** Returns the API key for the active provider, or throws a clear error. */
export function requireApiKey(): string {
  const key =
    env.AI_PROVIDER === 'anthropic'
      ? env.ANTHROPIC_API_KEY
      : env.AI_PROVIDER === 'openai'
        ? env.OPENAI_API_KEY
        : env.GEMINI_API_KEY;

  if (!key) {
    throw new Error(
      `AI_PROVIDER is set to "${env.AI_PROVIDER}" but no API key was provided. ` +
        `Set ${env.AI_PROVIDER.toUpperCase()}_API_KEY in your environment.`,
    );
  }
  return key;
}
