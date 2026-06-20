/**
 * Empeiria agent loop.
 */

import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.LLM_BASE_URL ?? "http://127.0.0.1:11434/v1",
  apiKey: process.env.LLM_API_KEY ?? "ollama",
});
const CHAT_MODEL = process.env.CHAT_MODEL ?? "qwen2.5:3b";
const EMBED_MODEL = process.env.EMBED_MODEL ?? "nomic-embed-text";

const RELEVANCE_FLOOR = 0.5;

export interface Candidate {
  id: string;
  contributor_id: string;
  title: string;
  body: string;
  quality_score: number;
  similarity: number;
}

export interface Judged extends Candidate {
  relevance: number;
  judge_reason: string;
}

export interface Scored extends Judged {
  contribution: number;
  weight: number;
  amount_usdc: number;
  reason: string;
}

export interface LoopResult {
  answer: string;
  scored: Scored[];
  spent: number;
  platform_fee: number;
  refunded: number;
  trace: string[];
}

export async function embed(text: string): Promise<number[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      }),
    },
  );
  if (!res.ok) throw new Error(`Google embed failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.embedding.values as number[];
}

async function judge(question: string, candidates: Candidate[]): Promise<Judged[]> {
  const list = candidates
    .map((c, i) => `[${i}] ${c.title}\n${c.body.slice(0, 600)}`)
    .join("\n\n");

  const prompt = `A person asked: "${question}"

Below are anonymized lived-experience accounts. For EACH, judge how genuinely relevant it is to the person's actual situation — not keyword overlap, but whether this person's experience would truly help. Score 0.0 to 1.0.

${list}

Return ONLY JSON: {"results": [{"index": n, "relevance": 0.0-1.0, "reason": "<8 words"}]}.`;

  const r = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(r.choices[0].message.content ?? "{}");
  const arr: Array<{ index: number; relevance: number; reason: string }> =
    parsed.results ?? [];

  return arr
    .filter((x) => candidates[x.index])
    .map((x) => ({
      ...candidates[x.index],
      relevance: x.relevance,
      judge_reason: x.reason,
    }));
}

async function synthesize(
  question: string,
  survivors: Judged[],
): Promise<{ answer: string; contributions: Record<number, number> }> {
  const list = survivors
    .map((c, i) => `[${i}] (${c.title})\n${c.body.slice(0, 900)}`)
    .join("\n\n");

  const prompt = `A person asked: "${question}"

Using ONLY these lived experiences, write a direct, practical answer (under 200 words). Draw on the ones that genuinely help.

${list}

Then report how much each experience [0..${survivors.length - 1}] contributed to your answer, as weights summing to 1.0. Every experience you used must have a weight above 0.

Return ONLY JSON: {"answer": "...", "contributions": {"0": 0.5, "1": 0.5}}.`;

  const r = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(r.choices[0].message.content ?? "{}");
  const contributions: Record<number, number> = {};
  for (const [k, v] of Object.entries(parsed.contributions ?? {})) {
    const idx = Number(k);
    const val = Number(v);
    if (!Number.isNaN(idx) && !Number.isNaN(val) && val > 0) {
      contributions[idx] = val;
    }
  }
  return { answer: parsed.answer ?? "", contributions };
}

export async function runLoop(
  question: string,
  candidates: Candidate[],
  budget: number,
  feeRate = 0.07,
): Promise<LoopResult> {
  const trace: string[] = [];
  trace.push(`Retrieved ${candidates.length} candidates by similarity.`);

  const judged = await judge(question, candidates);
  const survivors = judged
    .filter((j) => j.relevance >= RELEVANCE_FLOOR)
    .sort((a, b) => b.relevance - a.relevance);

  for (const j of judged) {
    const kept = j.relevance >= RELEVANCE_FLOOR;
    trace.push(
      `${kept ? "KEEP" : "DROP"} "${j.title}" — relevance ${j.relevance.toFixed(2)} (${j.judge_reason})`,
    );
  }

  if (survivors.length === 0) {
    trace.push("No source cleared the relevance floor. Nothing paid; full refund.");
    return { answer: "", scored: [], spent: 0, platform_fee: 0, refunded: budget, trace };
  }

  const { answer, contributions } = await synthesize(question, survivors);

  // Fallback: if the model gave no usable contributions, weight survivors by relevance.
  let contribMap = contributions;
  if (Object.keys(contribMap).length === 0) {
    trace.push("No contribution weights returned; falling back to relevance-based weighting.");
    const relTotal = survivors.reduce((s, x) => s + x.relevance, 0) || 1;
    contribMap = {};
    survivors.forEach((s, i) => { contribMap[i] = s.relevance / relTotal; });
  }

  const spendable = budget * (1 - feeRate);
  const rawWeights = survivors.map((s, i) => {
    const contribution = contribMap[i] ?? 0;
    return { s, contribution, w: contribution * (s.quality_score ?? 0.5) };
  });
  const totalW = rawWeights.reduce((sum, x) => sum + x.w, 0) || 1;

  const scored: Scored[] = rawWeights
    .filter((x) => x.contribution > 0)
    .map((x) => {
      const weight = x.w / totalW;
      const amount = Number((spendable * weight).toFixed(6));
      return {
        ...x.s,
        contribution: x.contribution,
        weight,
        amount_usdc: amount,
        reason: `contributed ${(x.contribution * 100).toFixed(0)}% of the answer, quality ${(x.s.quality_score ?? 0.5).toFixed(2)}`,
      };
    })
    .filter((x) => x.amount_usdc > 0);

  const spent = scored.reduce((sum, x) => sum + x.amount_usdc, 0);
  const platform_fee = Number((budget * feeRate).toFixed(6));
  const refunded = Number((budget - spent - platform_fee).toFixed(6));

  trace.push(`Synthesized answer from ${scored.length} sources.`);
  for (const x of scored) {
    trace.push(`PAY "${x.title}" ${x.amount_usdc.toFixed(6)} USDC — ${x.reason}`);
  }
  trace.push(
    `Budget ${budget} → spent ${spent.toFixed(6)}, fee ${platform_fee.toFixed(6)}, refunded ${refunded.toFixed(6)}.`,
  );

  return { answer, scored, spent, platform_fee, refunded, trace };
}
