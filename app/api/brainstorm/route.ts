/**
 * Cross-repo Brainstorm — signed-in users select 2+ repos; the agent retrieves
 * knowledge from each, synthesizes ideas that COMBINE them, and pays every
 * selected repo's maintainer $0.02 on-chain. Copilot can't do this: it's a
 * composable, paid, multi-agent economy.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { embed } from "@/lib/agent-loop";
import { withdrawCreatorUsdc } from "@/lib/withdraw-creator";
import { readSession } from "@/lib/session";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const openai = new OpenAI({ apiKey: process.env.GROQ_API_KEY || process.env.LLM_API_KEY, baseURL: process.env.LLM_BASE_URL });
const CHAT_MODEL = process.env.CHAT_MODEL!;
const PER_REPO_FEE = 0.02;
const MAX_REPOS = 5;

export async function POST(req: NextRequest) {
  try {
    // gated: signed-in only
    const session = readSession(req.headers.get("cookie"));
    if (!session) return NextResponse.json({ error: "sign in to brainstorm" }, { status: 401 });

    const { handles, prompt } = await req.json();
    if (!Array.isArray(handles) || handles.length < 2)
      return NextResponse.json({ error: "select at least 2 repos to brainstorm" }, { status: 400 });
    if (handles.length > MAX_REPOS)
      return NextResponse.json({ error: `select up to ${MAX_REPOS} repos` }, { status: 400 });
    if (!prompt?.trim())
      return NextResponse.json({ error: "enter a brainstorm prompt" }, { status: 400 });

    // load the selected repos
    const { data: repos } = await db.from("creators")
      .select("id, handle, name, repo_full_name, agent_label, wallet_address, total_earned_usdc, is_repo")
      .in("handle", handles).eq("is_repo", true);
    if (!repos || repos.length < 2)
      return NextResponse.json({ error: "couldn't find the selected repos" }, { status: 404 });

    // retrieve knowledge from each repo, labeled by repo
    const seed = await embed(prompt);
    const perRepoContext: string[] = [];
    for (const r of repos) {
      const { data: chunks } = await db.rpc("match_creator_chunks", {
        query_embedding: seed, match_count: 5, filter_creator: r.id,
      });
      const text = ((chunks ?? []) as { text: string }[]).map((c) => c.text.slice(0, 900)).join("\n\n");
      perRepoContext.push(`### REPO: ${r.repo_full_name}\n${text || "(no matching context)"}`);
    }

    const synthPrompt = `You are a Brainstorm Agent. A developer wants ideas that COMBINE these repositories. Draw on the real code/knowledge from each. Produce a Markdown brainstorm with:

1. **Combined Ideas** — 3-5 concrete things they could build by combining these specific repos. For each, name which repos it draws on and why.
2. **Integration Notes** — how the repos could technically fit together.
3. **Wildcard** — one ambitious idea.

Be specific to what each repo actually does (from the context). Cite repos by name.

DEVELOPER PROMPT: ${prompt}

${perRepoContext.join("\n\n")}`;

    const r = await openai.chat.completions.create({
      model: CHAT_MODEL, messages: [{ role: "user", content: synthPrompt }], max_tokens: 1600, temperature: 0.6,
    });
    const brainstorm = (r.choices[0].message.content ?? "").trim();
    if (!brainstorm) return NextResponse.json({ error: "brainstorm produced no output — you were not charged", paid: [] }, { status: 500 });

    // pay each selected repo's maintainer $0.02 on-chain
    const paid: { repo: string; amount: number; tx: string }[] = [];
    for (const repo of repos) {
      try {
        const tx = await withdrawCreatorUsdc("", repo.wallet_address as string, PER_REPO_FEE);
        await db.from("creators").update({ total_earned_usdc: Number(repo.total_earned_usdc ?? 0) + PER_REPO_FEE }).eq("id", repo.id);
        await db.from("agent_payments").insert({ from_creator: repo.id, to_agent: "brainstorm-payout", amount_usdc: PER_REPO_FEE, tx_hash: tx.txHash });
        paid.push({ repo: repo.repo_full_name, amount: PER_REPO_FEE, tx: tx.txHash });
      } catch (e) {
        paid.push({ repo: repo.repo_full_name, amount: 0, tx: `failed: ${(e as Error).message.slice(0, 40)}` });
      }
    }

    return NextResponse.json({
      ok: true, brainstorm,
      repos: repos.map((r) => r.repo_full_name),
      paid, total: Number((PER_REPO_FEE * paid.filter((p) => p.amount > 0).length).toFixed(6)),
    });
  } catch (err) {
    return NextResponse.json({ error: "brainstorm failed", message: (err as Error).message }, { status: 500 });
  }
}
