/**
 * Router agent with real pricing economics.
 *   1. classify domain
 *   2. specialist QUOTES a price (effort × scarcity × reputation)
 *   3. router DECIDES: pay specialist, or decline and judge itself
 *   4. synthesize + weight + pay contributors
 */
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { embed, type Candidate, type Judged, type Scored } from "./agent-loop";
import { quoteFor, routerDecides, domainSupply } from "./pricing";

const openai = new OpenAI({
  baseURL: process.env.LLM_BASE_URL ?? "http://127.0.0.1:11434/v1",
  apiKey: process.env.LLM_API_KEY ?? "ollama",
});
const CHAT_MODEL = process.env.CHAT_MODEL ?? "qwen2.5:3b";
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const RELEVANCE_FLOOR = 0.5;

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

let gateway: GatewayClient | null = null;
function getGateway() {
  if (!gateway) {
    gateway = new GatewayClient({
      chain: "arcTestnet",
      privateKey: process.env.BUYER_PRIVATE_KEY as `0x${string}`,
    });
  }
  return gateway;
}

const DOMAINS = ["career", "relationships", "general"] as const;

async function classifyDomain(question: string): Promise<string> {
  const prompt = `Classify this question into exactly one domain: career, relationships, or general.
career = work, jobs, business, burnout, professional life.
relationships = love, family, friendship, conflict, loss.
general = anything else.

Question: "${question}"

Return ONLY JSON: {"domain": "career|relationships|general"}.`;
  try {
    const r = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(r.choices[0].message.content ?? "{}");
    const d = String(parsed.domain ?? "general").toLowerCase();
    return DOMAINS.includes(d as typeof DOMAINS[number]) ? d : "general";
  } catch {
    return "general";
  }
}

// Generalist judging — used when the router declines the specialist.
async function selfJudge(question: string): Promise<Judged[]> {
  const qEmbedding = await embed(question);
  const { data: candidates, error } = await db.rpc("match_experiences", {
    query_embedding: qEmbedding, match_count: 15, filter_domain: null,
  });
  if (error) throw error;
  const cands = (candidates ?? []) as Candidate[];
  if (cands.length === 0) return [];

  const list = cands.map((c, i) => `[${i}] ${c.title}\n${c.body.slice(0, 600)}`).join("\n\n");
  const prompt = `A person asked: "${question}"

For EACH account, score genuine relevance 0.0 to 1.0.

${list}

Return ONLY JSON: {"results": [{"index": n, "relevance": 0.0-1.0, "reason": "<8 words"}]}.`;
  const r = await openai.chat.completions.create({
    model: CHAT_MODEL, messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  const parsed = JSON.parse(r.choices[0].message.content ?? "{}");
  const arr: Array<{ index: number; relevance: number; reason: string }> = parsed.results ?? [];
  return arr.filter((x) => cands[x.index]).map((x) => ({
    ...cands[x.index], relevance: x.relevance, judge_reason: x.reason,
  })).sort((a, b) => b.relevance - a.relevance);
}

async function synthesize(question: string, survivors: Judged[]) {
  const list = survivors.map((c, i) => `[${i}] (${c.title})\n${c.body.slice(0, 900)}`).join("\n\n");
  const prompt = `A person asked: "${question}"

Using ONLY these lived experiences, write a direct, practical answer (under 200 words).

${list}

Then report how much each experience [0..${survivors.length - 1}] contributed, as weights summing to 1.0. Every experience you used must have a weight above 0.

Return ONLY JSON: {"answer": "...", "contributions": {"0": 0.5, "1": 0.5}}.`;
  const r = await openai.chat.completions.create({
    model: CHAT_MODEL, messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  const parsed = JSON.parse(r.choices[0].message.content ?? "{}");
  const contributions: Record<number, number> = {};
  for (const [k, v] of Object.entries(parsed.contributions ?? {})) {
    const idx = Number(k), val = Number(v);
    if (!Number.isNaN(idx) && !Number.isNaN(val) && val > 0) contributions[idx] = val;
  }
  return { answer: parsed.answer ?? "", contributions };
}

export interface RouterResult {
  domain: string; answer: string; trace: string[]; scored: Scored[];
  specialistFee: number; specialistTx: string | null; usedSpecialist: boolean;
  spent: number; platformFee: number; refunded: number;
}

export async function runRouter(question: string, budget: number, feeRate = 0.07): Promise<RouterResult> {
  const trace: string[] = [];

  const domain = await classifyDomain(question);
  trace.push(`Router classified this as a ${domain.toUpperCase()} question.`);

  const { data: spec, error: sErr } = await db.from("specialists").select("*").eq("domain", domain).single();
  if (sErr || !spec) throw new Error(`No specialist for domain ${domain}`);

  // Specialist quotes a price based on its supply + track record.
  const supply = await domainSupply(domain);
  const quote = await quoteFor(spec, supply);
  trace.push(`${spec.label} specialist quotes ${quote.price.toFixed(6)} USDC — ${quote.breakdown}.`);

  // Router decides whether the expertise is worth the price.
  const decision = routerDecides(quote, budget);
  trace.push(`Router: ${decision.reason}.`);

  let picks: Judged[] = [];
  let specialistTx: string | null = null;
  let specialistFee = 0;
  let usedSpecialist = false;

  if (decision.accept) {
    specialistFee = quote.price;
    const g = getGateway();
    const balances = await g.getBalances();
    const available = Number(balances.gateway.formattedAvailable ?? "0");
    if (available < budget) await g.deposit((budget - available + 0.5).toFixed(6));

    const specUrl =
      `${BASE_URL}/api/specialist/${domain}` +
      `?payTo=${spec.wallet_address}&amount=${specialistFee.toFixed(6)}&q=${encodeURIComponent(question)}`;
    try {
      const payRes = await g.pay(specUrl, { method: "GET" });
      specialistTx =
        (payRes as { transaction?: string }).transaction ??
        (payRes as { data?: { transaction?: string } }).data?.transaction ?? null;
      picks = (payRes as { data?: { picks?: Judged[] } }).data?.picks ?? [];
      usedSpecialist = true;
      trace.push(`Specialist paid (tx ${specialistTx?.slice(0, 8) ?? "?"}…). Returned ${picks.length} judged experiences.`);

      // update specialist track record
      const avgRel = picks.length ? picks.reduce((s, p) => s + p.relevance, 0) / picks.length : 0;
      await db.rpc("update_specialist_record", { sid: spec.id, job_avg_relevance: avgRel }).then(() => {}, () => {});
      await db.rpc("increment_specialist_earnings", { sid: spec.id, amount: specialistFee }).then(() => {}, () => {});
    } catch (err) {
      trace.push(`Specialist payment failed: ${(err as Error).message}. Router judges itself.`);
      picks = await selfJudge(question);
      specialistFee = 0; usedSpecialist = false;
    }
  } else {
    // Router declined — judges the full pool itself, no specialist fee.
    picks = await selfJudge(question);
    trace.push(`Router judged ${picks.length} experiences itself (no specialist fee).`);
  }

  const survivors = picks.filter((p) => p.relevance >= RELEVANCE_FLOOR);
  for (const j of picks) {
    const kept = j.relevance >= RELEVANCE_FLOOR;
    trace.push(`${kept ? "KEEP" : "DROP"} "${j.title}" — relevance ${j.relevance.toFixed(2)} (${j.judge_reason})`);
  }

  const platformFee = Number((budget * feeRate).toFixed(6));
  const spendable = budget - specialistFee - platformFee;

  if (survivors.length === 0 || spendable <= 0) {
    trace.push("No experience cleared the bar. Contributors not paid; remainder refunded.");
    const spent = Number(specialistFee.toFixed(6));
    return {
      domain, answer: "", trace, scored: [], specialistFee, specialistTx, usedSpecialist,
      spent, platformFee, refunded: Number((budget - spent - platformFee).toFixed(6)),
    };
  }

  const { answer, contributions } = await synthesize(question, survivors);
  let contribMap = contributions;
  if (Object.keys(contribMap).length === 0) {
    const relTotal = survivors.reduce((s, x) => s + x.relevance, 0) || 1;
    contribMap = {}; survivors.forEach((s, i) => { contribMap[i] = s.relevance / relTotal; });
  }

  const rawWeights = survivors.map((s, i) => {
    const contribution = contribMap[i] ?? 0;
    return { s, contribution, w: contribution * (s.quality_score ?? 0.5) };
  });
  const totalW = rawWeights.reduce((sum, x) => sum + x.w, 0) || 1;

  const scored: Scored[] = rawWeights.filter((x) => x.contribution > 0).map((x) => {
    const weight = x.w / totalW;
    const amount = Number((spendable * weight).toFixed(6));
    return {
      ...x.s, contribution: x.contribution, weight, amount_usdc: amount,
      reason: `contributed ${(x.contribution * 100).toFixed(0)}% of the answer, quality ${(x.s.quality_score ?? 0.5).toFixed(2)}`,
    };
  }).filter((x) => x.amount_usdc > 0);

  const contribSpent = scored.reduce((sum, x) => sum + x.amount_usdc, 0);
  const spent = Number((specialistFee + contribSpent).toFixed(6));
  const refunded = Number((budget - spent - platformFee).toFixed(6));

  trace.push(`Synthesized answer from ${scored.length} experiences.`);
  for (const x of scored) trace.push(`PAY "${x.title}" ${x.amount_usdc.toFixed(6)} USDC — ${x.reason}`);
  trace.push(`Budget ${budget} → specialist ${specialistFee.toFixed(6)}, contributors ${contribSpent.toFixed(6)}, fee ${platformFee.toFixed(6)}, refunded ${refunded.toFixed(6)}.`);

  return { domain, answer, trace, scored, specialistFee, specialistTx, usedSpecialist, spent, platformFee, refunded };
}
