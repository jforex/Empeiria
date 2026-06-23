/**
 * Creator knowledge marketplace — the ask flow.
 * Parses @handle (direct vs mesh), retrieves relevant creator chunks, synthesizes
 * a tier-appropriate answer, and pays each contributing creator their weighted
 * share in USDC on Arc via x402. Streams every step live (SSE).
 */
import { NextRequest } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { embed } from "@/lib/agent-loop";
import { TIERS, PLATFORM_FEE_RATE, tierFor, parseHandle, type Tier } from "@/lib/creator-pricing";

const openai = new OpenAI({
  baseURL: process.env.LLM_BASE_URL ?? "http://127.0.0.1:11434/v1",
  apiKey: process.env.LLM_API_KEY ?? "ollama",
});
const CHAT_MODEL = process.env.CHAT_MODEL ?? "qwen2.5:3b";
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

let gateway: GatewayClient | null = null;
function getGateway() {
  if (!gateway) gateway = new GatewayClient({ chain: "arcTestnet", privateKey: process.env.BUYER_PRIVATE_KEY as `0x${string}` });
  return gateway;
}

interface Chunk {
  id: string; creator_id: string; text: string; similarity: number;
  creator_name: string; agent_label: string; wallet_address: string;
}

async function synthesize(question: string, chunks: Chunk[], tier: Tier) {
  const list = chunks.map((c, i) => `[${i}] (${c.creator_name} — ${c.agent_label})\n${c.text.slice(0, 1000)}`).join("\n\n");
  const wordCap = TIERS[tier].words;
  const prompt = `A user asked: "${question}"
Using ONLY the creator knowledge below, write a ${tier} answer (under ${wordCap} words, practical and direct).
${list}
Then report how much each [0..${chunks.length - 1}] contributed to the answer, as weights summing to 1.0 (each used one > 0).
Return ONLY JSON: {"answer":"...","contributions":{"0":0.6}}.`;
  const r = await openai.chat.completions.create({ model: CHAT_MODEL, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" } });
  const parsed = JSON.parse(r.choices[0].message.content ?? "{}");
  const contributions: Record<number, number> = {};
  for (const [k, v] of Object.entries(parsed.contributions ?? {})) {
    const idx = Number(k), val = Number(v);
    if (!Number.isNaN(idx) && !Number.isNaN(val) && val > 0) contributions[idx] = val;
  }
  return { answer: parsed.answer ?? "", contributions };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rawQuestion = url.searchParams.get("q");
  const tier = tierFor(url.searchParams.get("tier"));
  if (!rawQuestion) return new Response("q required", { status: 400 });

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));

      try {
        const budget = TIERS[tier].price;
        const { handle, cleaned } = parseHandle(rawQuestion);

        const { data: q } = await db.from("queries").insert({ question: cleaned, budget_usdc: budget }).select().single();
        send({ type: "start", question: cleaned, tier, budget, mode: handle ? "direct" : "mesh", handle });

        // direct mode: resolve the creator by handle
        let filterCreator: string | null = null;
        if (handle) {
          const { data: cr } = await db.from("creators").select("id, name, agent_label").eq("handle", handle).maybeSingle();
          if (!cr) {
            send({ type: "error", message: `No creator found with handle @${handle}.` });
            controller.close(); return;
          }
          filterCreator = cr.id;
          send({ type: "direct_target", name: cr.name, agent_label: cr.agent_label, handle });
        }

        // 1. retrieve relevant creator chunks
        send({ type: "retrieving" });
        const qEmbedding = await embed(cleaned);
        const { data: rawChunks } = await db.rpc("match_creator_chunks", {
          query_embedding: qEmbedding, match_count: 12, filter_creator: filterCreator,
        });
        const chunks = (rawChunks ?? []) as Chunk[];

        // keep only reasonably relevant chunks
        const relevant = chunks.filter((c) => c.similarity >= 0.35);
        if (relevant.length === 0) {
          await db.from("queries").update({ spent_usdc: 0, refunded_usdc: budget, answer: "" }).eq("id", q.id);
          send({ type: "no_match", note: handle ? `@${handle} hasn't shared knowledge on this yet.` : "No creator has shared knowledge on this yet — be the first to contribute." });
          send({ type: "done", answer: "", paid: [], spent: 0, refunded: budget, platformFee: 0 });
          controller.close(); return;
        }

        // which creators surfaced
        const creatorsInvolved = [...new Set(relevant.map((c) => c.creator_id))];
        send({ type: "sources", count: relevant.length, creators: creatorsInvolved.length,
          names: [...new Set(relevant.map((c) => c.creator_name))] });

        // 2. synthesize
        send({ type: "synthesizing" });
        const { answer, contributions } = await synthesize(cleaned, relevant, tier);
        let contribMap = contributions;
        if (Object.keys(contribMap).length === 0) {
          const total = relevant.reduce((s, c) => s + c.similarity, 0) || 1;
          contribMap = {}; relevant.forEach((c, i) => { contribMap[i] = c.similarity / total; });
        }
        send({ type: "answer", answer });

        // 3. aggregate contribution by CREATOR (multiple chunks may belong to one creator)
        const byCreator = new Map<string, { name: string; wallet: string; agent: string; weight: number }>();
        relevant.forEach((c, i) => {
          const w = contribMap[i] ?? 0;
          if (w <= 0) return;
          const prev = byCreator.get(c.creator_id);
          if (prev) prev.weight += w;
          else byCreator.set(c.creator_id, { name: c.creator_name, wallet: c.wallet_address, agent: c.agent_label, weight: w });
        });
        const totalW = [...byCreator.values()].reduce((s, x) => s + x.weight, 0) || 1;

        // 4. pay each creator their weighted share (x402), keep platform fee
        const platformFee = Number((budget * PLATFORM_FEE_RATE).toFixed(6));
        const payable = Number((budget - platformFee).toFixed(6));
        const g = getGateway();
        const bal = await g.getBalances();
        const avail = Number(bal.gateway.formattedAvailable ?? "0");
        if (avail < budget) await g.deposit((budget - avail + 0.5).toFixed(6));

        const paid: Array<{ name: string; agent: string; amount: number; pct: number; tx: string | null }> = [];
        let spent = 0;
        for (const [creatorId, c] of byCreator) {
          const share = c.weight / totalW;
          const amount = Number((payable * share).toFixed(6));
          if (amount <= 0) continue;
          let tx: string | null = null;
          try {
            const payUrl = `${BASE_URL}/api/pay-contributor?payTo=${c.wallet}&amount=${amount.toFixed(6)}`;
            const pr = await g.pay(payUrl, { method: "GET" });
            tx = (pr as { transaction?: string }).transaction ?? (pr as { data?: { transaction?: string } }).data?.transaction ?? null;
            await db.rpc("increment_creator_earnings", { cid: creatorId, amount }).then(() => {}, () => {});
          } catch { /* mark below */ }
          spent = Number((spent + amount).toFixed(6));
          paid.push({ name: c.name, agent: c.agent, amount, pct: Math.round(share * 100), tx });
          send({ type: "creator_paid", name: c.name, agent: c.agent, amount, pct: Math.round(share * 100), tx });
        }

        const refunded = Number((budget - spent - platformFee).toFixed(6));
        await db.from("queries").update({ spent_usdc: spent, platform_fee_usdc: platformFee, refunded_usdc: Math.max(0, refunded), answer }).eq("id", q.id);
        send({ type: "done", answer, paid, spent, platformFee, refunded: Math.max(0, refunded), tier });
      } catch (err) {
        send({ type: "error", message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "Connection": "keep-alive" } });
}
