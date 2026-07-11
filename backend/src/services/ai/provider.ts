import { env, requireApiKey } from '../../config/env.js';

/**
 * Minimal, dependency-free clients for the three supported providers.
 * All of them expose the same contract: (system, user) -> raw model text.
 * Using fetch directly keeps the install small and the failure modes obvious.
 */

export interface AiClient {
  name: string;
  complete(system: string, user: string): Promise<string>;
}

class AiHttpError extends Error {
  constructor(
    provider: string,
    public readonly status: number,
    body: string,
  ) {
    super(`${provider} API error ${status}: ${body.slice(0, 300)}`);
    this.name = 'AiHttpError';
  }
}

async function postJson(url: string, headers: Record<string, string>, body: unknown, provider: string) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new AiHttpError(provider, res.status, await res.text());
  }
  return res.json() as Promise<Record<string, any>>;
}

const anthropicClient: AiClient = {
  name: 'anthropic',
  async complete(system, user) {
    const data = await postJson(
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': requireApiKey(), 'anthropic-version': '2023-06-01' },
      {
        model: env.ANTHROPIC_MODEL,
        max_tokens: 8192,
        temperature: 0,
        system,
        messages: [{ role: 'user', content: user }],
      },
      'Anthropic',
    );
    return (data.content ?? [])
      .map((block: { type: string; text?: string }) => (block.type === 'text' ? block.text : ''))
      .join('');
  },
};

const openaiClient: AiClient = {
  name: 'openai',
  async complete(system, user) {
    const data = await postJson(
      'https://api.openai.com/v1/chat/completions',
      { authorization: `Bearer ${requireApiKey()}` },
      {
        model: env.OPENAI_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
      'OpenAI',
    );
    return data.choices?.[0]?.message?.content ?? '';
  },
};

const geminiClient: AiClient = {
  name: 'gemini',
  async complete(system, user) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${requireApiKey()}`;
    const data = await postJson(
      url,
      {},
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      },
      'Gemini',
    );
    return (
      data.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? '')
        .join('') ?? ''
    );
  },
};

export function getAiClient(): AiClient {
  switch (env.AI_PROVIDER) {
    case 'anthropic':
      return anthropicClient;
    case 'openai':
      return openaiClient;
    case 'gemini':
      return geminiClient;
  }
}

/**
 * Extract the first JSON object/array from model output.
 * Tolerates markdown fences and stray prose around the JSON.
 */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    /* fall through to a bracketed scan */
  }
  const start = cleaned.search(/[[{]/);
  if (start === -1) throw new Error('Model response contained no JSON');
  const open = cleaned[start];
  const close = open === '[' ? ']' : '}';
  const end = cleaned.lastIndexOf(close);
  if (end <= start) throw new Error('Model response contained malformed JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}
