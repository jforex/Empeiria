/**
 * Documentation Agent — a service agent the repo agent PAYS to generate docs.
 * Demonstrates agent-to-agent commerce: repo agent → x402 payment → doc agent → docs.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { embed } from "@/lib/agent-loop";
import { withdrawCreatorUsdc } from "@/lib/withdraw-creator";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const openai = new OpenAI({ apiKey: process.env.GROQ_API_KEY || process.env.LLM_API_KEY, baseURL: process.env.LLM_BASE_URL });
const CHAT_MODEL = process.env.CHAT_MODEL!;
const DOC_AGENT_FEE = 0.02; // what the repo agent pays the doc agent

export async function POST(req: NextRequest) {
  try {
    const { accessKey, handle } = await req.json();
    const key = accessKey?.trim().toUpperCase();
    if (!key && !handle) return NextResponse.json({ error: "access key or handle required" }, { status: 400 });

    // verify the repo agent + its earnings (by handle from the account dashboard, or by per-repo key)
    const q = db.from("creators").select("id, name, agent_label, repo_full_name, total_earned_usdc, is_repo");
    const { data: creator } = await (handle ? q.eq("handle", handle) : q.eq("access_key", key)).maybeSingle();
    if (!creator) return NextResponse.json({ error: "repo not found" }, { status: 404 });
    if (!creator.is_repo) return NextResponse.json({ error: "documentation agent works on repos only" }, { status: 400 });
    if (Number(creator.total_earned_usdc ?? 0) < DOC_AGENT_FEE)
      return NextResponse.json({ error: `repo agent needs at least $${DOC_AGENT_FEE} in earnings to pay the Documentation Agent (has $${Number(creator.total_earned_usdc ?? 0).toFixed(4)})` }, { status: 402 });

    // retrieve a broad sample of the repo's own knowledge
    const seed = await embed(`overview architecture setup usage of ${creator.repo_full_name}`);
    const { data: rawChunks } = await db.rpc("match_creator_chunks", {
      query_embedding: seed, match_count: 16, filter_creator: creator.id,
    });
    const chunks = (rawChunks ?? []) as { text: string }[];
    if (chunks.length === 0) return NextResponse.json({ error: "no repo knowledge to document" }, { status: 400 });

    const context = chunks.map((c) => c.text.slice(0, 900)).join("\n\n");
    const prompt = `You are a Documentation Agent. From the repository files below, write clean, well-structured Markdown documentation for ${creator.repo_full_name}. Include: a one-paragraph Overview, Key Modules (bullet list referencing real files), Setup/Getting Started (best-effort from what's shown), and the main API/surface. Be concrete and reference actual file paths. Do not invent features not in the files.

${context}`;
    const r = await openai.chat.completions.create({
      model: CHAT_MODEL, messages: [{ role: "user", content: prompt }], max_tokens: 1600, temperature: 0.3,
    });
    const docs = (r.choices[0].message.content ?? "").trim();
    if (!docs) return NextResponse.json({ error: "documentation agent could not generate docs" }, { status: 500 });

    // PAY the doc agent on-chain (repo agent → doc agent), debit repo earnings
    const tx = await withdrawCreatorUsdc("", process.env.DOC_AGENT_ADDRESS as string, DOC_AGENT_FEE);
    await db.from("creators").update({ total_earned_usdc: Number(creator.total_earned_usdc) - DOC_AGENT_FEE }).eq("id", creator.id);
    await db.from("agent_payments").insert({
      from_creator: creator.id, to_agent: "documentation", amount_usdc: DOC_AGENT_FEE, tx_hash: tx.txHash,
    }).select().maybeSingle();

    return NextResponse.json({
      ok: true, repo: creator.repo_full_name, docs,
      paid: { agent: "Documentation Agent", amount: DOC_AGENT_FEE, tx: tx.txHash },
    });
  } catch (err) {
    return NextResponse.json({ error: "documentation failed", message: (err as Error).message }, { status: 500 });
  }
}
