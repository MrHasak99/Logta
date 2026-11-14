/**
 * Server-side LLM client used by the automatic scan pipeline (src/lib/pipeline.ts).
 * Keys come from server-only env vars — the same names as api/extract.ts:
 *   OPENROUTER_API_KEY  >  OPENAI_API_KEY  >  GEMINI_API_KEY   (first one set wins, others are fallbacks)
 * Optional: LOGTA_LLM_MODEL overrides the OpenRouter/OpenAI model id.
 *
 * Two calls, both with fixed server-side prompts from llm-contract.ts:
 *   extract(image)  → ReceiptExtraction   (call 1)
 *   choose(line)    → LlmMatchChoice      (call 2, only for lines the alias cascade could not resolve)
 */
import {
  EXTRACTION_SYSTEM_PROMPT,
  MATCH_SYSTEM_PROMPT,
  buildMatchUserMessage,
  parseLlmMatchChoice,
  parseReceiptExtraction,
  type LlmMatchChoice,
  type ReceiptExtraction,
} from './llm-contract.ts';
import type { MatchCandidate } from './matching.ts';

export interface ChooseInput {
  rawText: string;
  candidates: MatchCandidate[];
  storeName?: string | null;
  categories: { slug: string; nameEn: string }[];
}

/** Anything that can do the two LLM calls. Tests and the demo inject fakes. */
export interface LlmClient {
  readonly name: string;
  extract(imageDataUrl: string): Promise<ReceiptExtraction>;
  choose(input: ChooseInput): Promise<LlmMatchChoice>;
}

const TIMEOUT_MS = 45_000;
const MAX_TOKENS = 4000;

type Provider = { name: 'openrouter' | 'openai' | 'gemini'; key: string };

function providersFromEnv(env: Record<string, string | undefined>): Provider[] {
  const out: Provider[] = [];
  const k = (n: string) => env[n]?.trim() || undefined;
  if (k('OPENROUTER_API_KEY')) out.push({ name: 'openrouter', key: k('OPENROUTER_API_KEY')! });
  if (k('OPENAI_API_KEY')) out.push({ name: 'openai', key: k('OPENAI_API_KEY')! });
  if (k('GEMINI_API_KEY')) out.push({ name: 'gemini', key: k('GEMINI_API_KEY')! });
  return out;
}

type Part = { type: 'text'; text: string } | { type: 'image'; dataUrl: string };

async function callProvider(p: Provider, system: string, parts: Part[], model?: string): Promise<string> {
  if (p.name === 'gemini') {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': p.key },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [
          {
            parts: parts.map((x) => {
              if (x.type === 'text') return { text: x.text };
              const m = /^data:(.+?);base64,(.*)$/.exec(x.dataUrl);
              if (!m) throw new Error('Unsupported image encoding');
              return { inline_data: { mime_type: m[1], data: m[2] } };
            }),
          },
        ],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', maxOutputTokens: MAX_TOKENS },
      }),
    });
    if (!res.ok) throw new Error(`gemini request failed (${res.status})`);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((x) => x.text ?? '').join('');
    if (!text) throw new Error('gemini returned an empty response');
    return text;
  }
  const url = p.name === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}`, ...(p.name === 'openrouter' ? { 'X-Title': 'Logta' } : {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model: model ?? (p.name === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini'),
      temperature: 0,
      max_tokens: MAX_TOKENS,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: parts.map((x) => (x.type === 'text' ? { type: 'text', text: x.text } : { type: 'image_url', image_url: { url: x.dataUrl } })) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${p.name} request failed (${res.status})`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${p.name} returned an empty response`);
  return content;
}

/** Try each configured provider in order; first success wins. */
async function withFallback(providers: Provider[], system: string, parts: Part[], model?: string): Promise<string> {
  let last = '';
  for (const p of providers) {
    try {
      return await callProvider(p, system, parts, model);
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(last || 'No LLM provider configured');
}

/** Build a client from env vars, or null when no key is configured (the pipeline then leaves lines for retry). */
export function createLlmClientFromEnv(env: Record<string, string | undefined> = process.env): LlmClient | null {
  const providers = providersFromEnv(env);
  if (!providers.length) return null;
  const model = env.LOGTA_LLM_MODEL?.trim() || undefined;
  return {
    name: providers.map((p) => p.name).join('>'),
    async extract(imageDataUrl) {
      const text = await withFallback(providers, EXTRACTION_SYSTEM_PROMPT, [
        { type: 'text', text: 'Extract this Kuwait grocery receipt / shelf tag. Return JSON only.' },
        { type: 'image', dataUrl: imageDataUrl },
      ], model);
      return parseReceiptExtraction(text);
    },
    async choose({ rawText, candidates, storeName, categories }) {
      const text = await withFallback(providers, MATCH_SYSTEM_PROMPT, [{ type: 'text', text: buildMatchUserMessage(rawText, candidates, storeName, categories) }], model);
      return parseLlmMatchChoice(text, candidates);
    },
  };
}
