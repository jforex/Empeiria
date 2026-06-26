/**
 * Testing Agent — a service agent the repo agent PAYS to analyze test coverage.
 * Reads ingested source, identifies key exports that appear untested, and generates
 * test scaffolding stubs. It SUGGESTS tests (it does not run them). Agent-to-agent payment, on-chain.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { embed } from "@/lib/agent-loop";
import { withdrawCreatorUsdc } from "@/lib/withdraw-creator";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const openai = new OpenAI({ apiKey: process.env.GROQ_API_KEY || process.env.LLM_API_KEY, baseURL: process.env.LLM_BASE_URL });
const CHAT_MODEL = process.env.CHAT_MODEL!;
const TEST_AGENT_FEE = 0.02;

export async function POST(req: NextRequest) {
  try {
    const { accessKey, handle } = await req.json();
    const key = accessKey?.trim().toUpperCase();
    if (!key && !handle) return NextResponse.json({ error: "access key or handle required" }, { status: 400 });

    const q = db.from("creators").select("id, name, repo_full_name, total_earned_usdc, is_repo");
    const { data: creator } = await (handle ? q.eq("handle", handle) : q.eq("access_key", key)).maybeSingle();
    if (!creator) return NextResponse.json({ error: "repo not found" }, { status: 404 });
    if (!creator.is_repo) return NextResponse.json({ error: "testing agent works on repos only" }, { status: 400 });
    if (Number(creator.total_earned_usdc ?? 0) < TEST_AGENT_FEE)
      return NextResponse.json({ error: `repo agent needs at least $${TEST_AGENT_FEE} in earnings to pay the Testing Agent (has $${Number(creator.total_earned_usdc ?? 0).toFixed(4)})` }, { status: 402 });

    // retrieve source chunks (favor code, not docs)
    const seed = await embed("functions exports modules logic implementation handlers");
    const { data: rawChunks } = await db.rpc("match_creator_chunks", {
      query_embedding: seed, match_count: 16, filter_creator: creator.id,
    });
    const all = (rawChunks ?? []) as { text: string }[];
    // skip pure-markdown chunks; prefer code files
    const code = all.filter((c) => {
      const first = (c.text.split("\n")[0] || "").toLowerCase();
      return /\.(ts|tsx|js|jsx|py|go|rs|sol)\b/.test(first);
    });
    const source = (code.length > 0 ? code : all).slice(0, 10);
    if (source.length === 0) return NextResponse.json({ error: "no source code found to analyze" }, { status: 400 });

    const context = source.map((c) => c.text.slice(0, 1400)).join("\n\n");
    const prompt = `You are a Testing Agent for ${creator.repo_full_name}. Based ONLY on the source files below, produce a concise Markdown report:

1. **Coverage Observations** — which key exports/functions/modules appear to lack tests, based on what you see. Be honest that this is inferred from a code read, not a coverage run.
2. **Suggested Test Cases** — a prioritized list of the most valuable tests to add (describe what each should verify).
3. **Scaffolding** — generate starter test stubs (in the repo's apparent test framework, or Jest/Vitest for JS/TS, pytest for Python) with describe/it blocks and TODO comments. Keep stubs realistic to the actual code shown.

Do not claim to have run any tests or measured coverage. Only reference code actually shown.

SOURCE FILES:
${context}`;
    const r = await openai.chat.completions.create({
      model: CHAT_MODEL, messages: [{ role: "user", content: prompt }], max_tokens: 1400, temperature: 0.3,
    });
    const report = (r.choices[0].message.content ?? "").trim();
    if (!report) return NextResponse.json({ error: "testing agent could not produce a report" }, { status: 500 });

    const tx = await withdrawCreatorUsdc("", process.env.TEST_AGENT_ADDRESS as string, TEST_AGENT_FEE);
    await db.from("creators").update({ total_earned_usdc: Number(creator.total_earned_usdc) - TEST_AGENT_FEE }).eq("id", creator.id);
    await db.from("agent_payments").insert({ from_creator: creator.id, to_agent: "testing", amount_usdc: TEST_AGENT_FEE, tx_hash: tx.txHash });

    return NextResponse.json({
      ok: true, repo: creator.repo_full_name, report,
      paid: { agent: "Testing Agent", amount: TEST_AGENT_FEE, tx: tx.txHash },
    });
  } catch (err) {
    return NextResponse.json({ error: "testing analysis failed", message: (err as Error).message }, { status: 500 });
  }
}
