/**
 * Dependency Agent — a service agent the repo agent PAYS to analyze its dependencies.
 * Reads ingested manifest files (package.json, requirements.txt, Cargo.toml, etc.),
 * summarizes the dependency landscape. Agent-to-agent payment, on-chain.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { embed } from "@/lib/agent-loop";
import { withdrawCreatorUsdc } from "@/lib/withdraw-creator";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const openai = new OpenAI({ apiKey: process.env.GROQ_API_KEY || process.env.LLM_API_KEY, baseURL: process.env.LLM_BASE_URL });
const CHAT_MODEL = process.env.CHAT_MODEL!;
const DEP_AGENT_FEE = 0.02;

const MANIFEST_HINTS = ["package.json", "requirements.txt", "cargo.toml", "go.mod", "pyproject.toml", "gemfile", "pom.xml", "build.gradle", "composer.json"];

export async function POST(req: NextRequest) {
  try {
    const { accessKey } = await req.json();
    const key = accessKey?.trim().toUpperCase();
    if (!key) return NextResponse.json({ error: "access key required" }, { status: 400 });

    const { data: creator } = await db.from("creators")
      .select("id, name, repo_full_name, total_earned_usdc, is_repo")
      .eq("access_key", key).maybeSingle();
    if (!creator) return NextResponse.json({ error: "invalid access key" }, { status: 404 });
    if (!creator.is_repo) return NextResponse.json({ error: "dependency agent works on repos only" }, { status: 400 });
    if (Number(creator.total_earned_usdc ?? 0) < DEP_AGENT_FEE)
      return NextResponse.json({ error: `repo agent needs at least $${DEP_AGENT_FEE} in earnings to pay the Dependency Agent (has $${Number(creator.total_earned_usdc ?? 0).toFixed(4)})` }, { status: 402 });

    // pull the manifest chunks: semantic seed + path-based filter
    const seed = await embed("dependencies package.json requirements imports libraries versions");
    const { data: rawChunks } = await db.rpc("match_creator_chunks", {
      query_embedding: seed, match_count: 20, filter_creator: creator.id,
    });
    const all = (rawChunks ?? []) as { text: string }[];
    // prefer chunks that look like manifests (text starts with "# <path>")
    const manifests = all.filter((c) => {
      const firstLine = (c.text.split("\n")[0] || "").toLowerCase();
      return MANIFEST_HINTS.some((h) => firstLine.includes(h));
    });
    const source = (manifests.length > 0 ? manifests : all).slice(0, 8);
    if (source.length === 0) return NextResponse.json({ error: "no dependency information found in repo" }, { status: 400 });

    const context = source.map((c) => c.text.slice(0, 1200)).join("\n\n");
    const prompt = `You are a Dependency Agent analyzing ${creator.repo_full_name}. From the manifest/dependency files below, produce a concise Markdown report with: **Stack** (languages/runtimes), **Key Dependencies** (the main libraries and what each is for), and **Observations** (notable choices, heavy or unusual deps, anything a maintainer should know). Only describe dependencies actually present in the files. Do NOT claim specific versions are outdated or vulnerable — you are doing a static read, not a live registry check.

${context}`;
    const r = await openai.chat.completions.create({
      model: CHAT_MODEL, messages: [{ role: "user", content: prompt }], max_tokens: 1200, temperature: 0.3,
    });
    const report = (r.choices[0].message.content ?? "").trim();
    if (!report) return NextResponse.json({ error: "dependency agent could not produce a report" }, { status: 500 });

    const tx = await withdrawCreatorUsdc("", process.env.DEP_AGENT_ADDRESS as string, DEP_AGENT_FEE);
    await db.from("creators").update({ total_earned_usdc: Number(creator.total_earned_usdc) - DEP_AGENT_FEE }).eq("id", creator.id);
    await db.from("agent_payments").insert({ from_creator: creator.id, to_agent: "dependency", amount_usdc: DEP_AGENT_FEE, tx_hash: tx.txHash });

    return NextResponse.json({
      ok: true, repo: creator.repo_full_name, report,
      paid: { agent: "Dependency Agent", amount: DEP_AGENT_FEE, tx: tx.txHash },
    });
  } catch (err) {
    return NextResponse.json({ error: "dependency analysis failed", message: (err as Error).message }, { status: 500 });
  }
}
