/**
 * The streaming orchestrator. Emits every step live via SSE:
 * classify -> quote -> decide -> pay specialist (real tx) -> relay specialist's
 * live judgments -> synthesize -> pay contributors (real tx each) -> done.
 */
import { NextRequest } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { type Judged, type Scored } from "@/lib/agent-loop";
import { quoteFor, routerDecides, domainSupply } from "@/lib/pricing";

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
  if (!gateway) gateway = new GatewayClient({ chain: "arcTestnet", privateKey: process.env.BUYER_PRIVATE_KEY as `0x${string}` });
  return gateway;
}

const DOMAINS = ["career", "relationships", "general"] as const;

async function classifyDomain(question: string): Promise<string> {
  const prompt = `Classify into one domain: career, relationships, or general.
career = work, jobs, business, burnout. relationships = love, family, conflict, loss. general = else.
Question: "${question}"
Return ONLY JSON: {"domain":"career|relationships|general"}.`;
  try {
    const r = await openai.chat.completions.create({ model: CHAT_MODEL, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" } });
    const d = String(JSON.parse(r.choices[0].message.content ?? "{}").domain ?? "general").toLowerCase();
    return DOMAINS.includes(d as typeof DOMAINS[number]) ? d : "general";
  } catch { return "general"; }
}

async function synthesize(question: string, survivors: Judged[]) {
  const list = survivors.map((c, i) => `[${i}] (${c.title})\n${c.body.slice(0, 900)}`).join("\n\n");
  const prompt = `A person asked: "${question}"
Using ONLY these lived experiences, write a direct, practical answer (under 200 words).
${list}
Then report how much each [0..${survivors.length - 1}] contributed, weights summing to 1.0, each used one > 0.
Return ONLY JSON: {"answer":"...","contributions":{"0":0.5}}.`;
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
  const question = url.searchParams.get("q");
  const budget = parseFloat(url.searchParams.get("budget") ?? "0.1");
  if (!question) return new Response("q required", { status: 400 });

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));

      try {
        const { data: q } = await db.from("queries").insert({ question, budget_usdc: budget }).select().single();
        send({ type: "start", question, budget });

        // 1. classify
        const domain = await classifyDomain(question);
        send({ type: "classified", domain });

        // 2. specialist quotes, router decides
        const { data: spec } = await db.from("specialists").select("*").eq("domain", domain).single();
        const supply = await domainSupply(domain);
        const quote = await quoteFor(spec, supply);
        send({ type: "quote", label: spec.label, price: quote.price, breakdown: quote.breakdown });

        const decision = routerDecides(quote, budget);
        send({ type: "decision", accept: decision.accept, threshold: decision.threshold, reason: decision.reason });

        const judged: Judged[] = [];
        let specialistFee = 0;
        let specialistTx: string | null = null;

        if (decision.accept) {
          // 3. pay specialist via gate (real x402)
          const g = getGateway();
          const bal = await g.getBalances();
          const avail = Number(bal.gateway.formattedAvailable ?? "0");
          if (avail < budget) await g.deposit((budget - avail + 0.5).toFixed(6));

          const gateUrl = `${BASE_URL}/api/specialist/${domain}?payTo=${spec.wallet_address}&amount=${quote.price.toFixed(6)}`;
          const payRes = await g.pay(gateUrl, { method: "GET" });
          specialistTx = (payRes as { transaction?: string }).transaction ?? (payRes as { data?: { transaction?: string } }).data?.transaction ?? null;
          specialistFee = quote.price;
          send({ type: "specialist_paid", tx: specialistTx, amount: specialistFee });

          await db.rpc("increment_specialist_earnings", { sid: spec.id, amount: specialistFee }).then(() => {}, () => {});

          // 4. open specialist stream with proof, relay judgments
          const streamUrl = `${BASE_URL}/api/specialist/${domain}/stream?q=${encodeURIComponent(question)}&proof=${specialistTx ?? "paid"}`;
          const sres = await fetch(streamUrl);
          const reader = sres.body!.getReader();
          const dec = new TextDecoder();
          let buf = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const parts = buf.split("\n\n");
            buf = parts.pop() ?? "";
            for (const p of parts) {
              const line = p.replace(/^data: /, "").trim();
              if (!line) continue;
              const evt = JSON.parse(line);
              if (evt.type === "judgment") {
                judged.push({
                  id: evt.id, contributor_id: evt.contributor_id, title: evt.title,
                  body: evt.body, quality_score: evt.quality_score, similarity: 0,
                  relevance: evt.relevance, judge_reason: evt.reason,
                });
                send({ type: "judgment", title: evt.title, relevance: evt.relevance, reason: evt.reason, kept: evt.kept });
              } else if (evt.type === "retrieved") {
                send({ type: "retrieved", count: evt.count });
              }
            }
          }
          const avgRel = judged.length ? judged.reduce((s, p) => s + p.relevance, 0) / judged.length : 0;
          await db.rpc("update_specialist_record", { sid: spec.id, job_avg_relevance: avgRel }).then(() => {}, () => {});
        }

        send({ type: "judging_done" });

        const survivors = judged.filter((j) => j.relevance >= RELEVANCE_FLOOR).sort((a, b) => b.relevance - a.relevance);
        const platformFee = Number((budget * 0.07).toFixed(6));
        const spendable = budget - specialistFee - platformFee;

        if (survivors.length === 0 || spendable <= 0) {
          const spent = Number(specialistFee.toFixed(6));
          await db.from("queries").update({ spent_usdc: spent, platform_fee_usdc: platformFee, refunded_usdc: Number((budget - spent - platformFee).toFixed(6)) }).eq("id", q.id);
          send({ type: "done", answer: "", domain, specialistFee, spent, platformFee, refunded: Number((budget - spent - platformFee).toFixed(6)), paid: [] });
          controller.close(); return;
        }

        // 5. synthesize
        send({ type: "synthesizing" });
        const { answer, contributions } = await synthesize(question, survivors);
        let contribMap = contributions;
        if (Object.keys(contribMap).length === 0) {
          const relTotal = survivors.reduce((s, x) => s + x.relevance, 0) || 1;
          contribMap = {}; survivors.forEach((s, i) => { contribMap[i] = s.relevance / relTotal; });
        }
        send({ type: "answer", answer });

        const rawWeights = survivors.map((s, i) => ({ s, contribution: contribMap[i] ?? 0, w: (contribMap[i] ?? 0) * (s.quality_score ?? 0.5) }));
        const totalW = rawWeights.reduce((sum, x) => sum + x.w, 0) || 1;
        const scored: Scored[] = rawWeights.filter((x) => x.contribution > 0).map((x) => {
          const weight = x.w / totalW;
          return { ...x.s, contribution: x.contribution, weight, amount_usdc: Number((spendable * weight).toFixed(6)), reason: `contributed ${(x.contribution * 100).toFixed(0)}%` };
        }).filter((x) => x.amount_usdc > 0);

        // 6. pay contributors (real tx each)
        const g = getGateway();
        const paid: Array<{ title: string; amount: number; contribution: number; tx: string | null }> = [];
        for (const s of scored) {
          const { data: contrib } = await db.from("contributors").select("wallet_address").eq("id", s.contributor_id).single();
          let tx: string | null = null;
          try {
            const payUrl = `${BASE_URL}/api/pay-contributor?payTo=${contrib!.wallet_address}&amount=${s.amount_usdc.toFixed(6)}`;
            const pr = await g.pay(payUrl, { method: "GET" });
            tx = (pr as { transaction?: string }).transaction ?? (pr as { data?: { transaction?: string } }).data?.transaction ?? null;
            await db.from("payouts").insert({ query_id: q.id, experience_id: s.id, contributor_id: s.contributor_id, relevance: s.relevance, contribution: s.contribution, weight: s.weight, amount_usdc: s.amount_usdc, reason: s.reason, gateway_tx: tx });
            await db.rpc("increment_contributor_earnings", { cid: s.contributor_id, amount: s.amount_usdc }).then(() => {}, () => {});
          } catch { /* mark failed below */ }
          paid.push({ title: s.title, amount: s.amount_usdc, contribution: s.contribution, tx });
          send({ type: "payout", title: s.title, amount: s.amount_usdc, contribution: s.contribution, tx });
        }

        const contribSpent = scored.reduce((sum, x) => sum + x.amount_usdc, 0);
        const spent = Number((specialistFee + contribSpent).toFixed(6));
        const refunded = Number((budget - spent - platformFee).toFixed(6));
        await db.from("queries").update({ spent_usdc: spent, platform_fee_usdc: platformFee, refunded_usdc: refunded, answer }).eq("id", q.id);

        send({ type: "done", answer, domain, specialistFee, specialistTx, spent, platformFee, refunded, paid });
      } catch (err) {
        send({ type: "error", message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "Connection": "keep-alive" } });
}
