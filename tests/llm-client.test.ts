import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLlmClientFromEnv } from '../src/lib/llm-client.ts';
import { EXTRACTION_SYSTEM_PROMPT, MATCH_SYSTEM_PROMPT, parseLlmMatchChoice } from '../src/lib/llm-contract.ts';
import type { MatchCandidate } from '../src/lib/matching.ts';

const cand: MatchCandidate = { productId: 7, slug: 'x', nameEn: 'Head & Shoulders 400ml', nameAr: 'هيد آند شولدرز', brand: 'H&S', sizeLabel: '400ml', score: 0.7, sizeAgrees: null };
const chat = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe('createLlmClientFromEnv', () => {
  it('returns null without keys', () => {
    expect(createLlmClientFromEnv({})).toBeNull();
  });

  it('uses the fixed server prompts and falls back to the next provider on failure', async () => {
    const calls: { url: string; body: { messages?: { role: string; content: unknown }[] } }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      if (url.includes('openrouter')) return new Response('down', { status: 500 });
      return chat('{"store_text":"LULU","purchased_at":null,"total_kwd":1,"lines":[{"raw_text":"MILK","qty":1,"unit_price_kwd":0.4,"line_total_kwd":0.4}]}');
    });
    const llm = createLlmClientFromEnv({ OPENROUTER_API_KEY: 'a', OPENAI_API_KEY: 'b' })!;
    expect(llm.name).toBe('openrouter>openai');
    const ex = await llm.extract('data:image/png;base64,AAAA');
    expect(ex.lines[0]!.raw_text).toBe('MILK');
    // openrouter tried twice? no: once, then openai
    expect(calls.map((c) => new URL(c.url).host)).toEqual(['openrouter.ai', 'api.openai.com']);
    expect(calls[1]!.body.messages![0]).toEqual({ role: 'system', content: EXTRACTION_SYSTEM_PROMPT });
  });

  it('choose() sends the match prompt with candidates + categories and parses the answer', async () => {
    let sent = '';
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { messages: { role: string; content: { text: string }[] | string }[] };
      expect(body.messages[0]!.content).toBe(MATCH_SYSTEM_PROMPT);
      sent = (body.messages[1]!.content as { text: string }[])[0]!.text;
      return chat('{"product_id":7,"confidence":0.93,"proposed_name_en":null,"proposed_name_ar":null,"proposed_brand":null,"proposed_category":null,"proposed_size_value":null,"proposed_size_unit":null}');
    });
    const llm = createLlmClientFromEnv({ OPENAI_API_KEY: 'k' })!;
    const choice = await llm.choose({ rawText: 'H/S SHMP 400', candidates: [cand], storeName: 'Lulu', categories: [{ slug: 'personal_care', nameEn: 'Personal Care' }] });
    expect(choice).toMatchObject({ product_id: 7, confidence: 0.93 });
    expect(sent).toContain('H/S SHMP 400');
    expect(sent).toContain('id 7');
    expect(sent).toContain('personal_care');
  });
});

describe('parseLlmMatchChoice', () => {
  it('drops ids outside the candidate list and keeps a full proposal for unknown items', () => {
    expect(parseLlmMatchChoice('{"product_id":999,"confidence":0.99}', [cand]).product_id).toBeNull();
    const p = parseLlmMatchChoice('```json\n{"product_id":null,"confidence":0,"proposed_name_en":"Zaatar Manakeesh 4 pcs","proposed_name_ar":"مناقيش زعتر","proposed_brand":null,"proposed_category":"bakery","proposed_size_value":4,"proposed_size_unit":"PCS"}\n```', [cand]);
    expect(p).toMatchObject({ product_id: null, proposed_category: 'bakery', proposed_size_value: 4, proposed_size_unit: 'pcs' });
  });
  it('ignores proposals when a product was picked, and invalid sizes', () => {
    const picked = parseLlmMatchChoice('{"product_id":7,"confidence":0.9,"proposed_name_en":"x","proposed_category":"bakery"}', [cand]);
    expect(picked.proposed_name_en).toBeNull();
    const bad = parseLlmMatchChoice('{"product_id":null,"proposed_size_value":-3,"proposed_size_unit":"lbs"}', [cand]);
    expect([bad.proposed_size_value, bad.proposed_size_unit]).toEqual([null, null]);
  });
});
