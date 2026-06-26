/**
 * Dependency Agent — a service agent the repo agent PAYS to analyze its dependencies.
 * Reads ingested manifest files, then queries npm + PyPI LIVE to check for outdated
 * packages, and reports real current-vs-latest versions. Agent-to-agent payment, on-chain.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { embed } from "@/lib/agent-loop";
import { withdrawCreatorUsdc } from "@/lib/withdraw-creator";
import { parseRepo, fetchFile } from "@/lib/github-ingest";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const openai = new OpenAI({ apiKey: process.env.GROQ_API_KEY || process.env.LLM_API_KEY, baseURL: process.env.LLM_BASE_URL });
const CHAT_MODEL = process.env.CHAT_MODEL!;
const DEP_AGENT_FEE = 0.02;
const MAX_DEPS = 20;

const MANIFEST_HINTS = ["package.json", "requirements.txt", "cargo.toml", "go.mod", "pyproject.toml", "gemfile", "pom.xml", "build.gradle", "composer.json"];

type DepCheck = { name: string; ecosystem: "npm" | "pypi"; declared: string; latest: string | null; status: "ok" | "outdated" | "unknown" };

/** clean a semver-ish declared range down to comparable numbers */
function cleanVersion(v: string): string {
  return (v || "").replace(/[\^~>=<\s*]/g, "").split(",")[0].trim();
}
function majorOf(v: string): number | null {
  const m = cleanVersion(v).match(/^(\d+)\./);
  return m ? parseInt(m[1], 10) : null;
}

/** extract { name: version } from a package.json body */
function parseNpm(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const jsonStart = text.indexOf("{");
    const obj = JSON.parse(text.slice(jsonStart));
    for (const field of ["dependencies", "devDependencies"]) {
      if (obj[field]) for (const [k, v] of Object.entries(obj[field])) out[k] = String(v);
    }
  } catch { /* not valid json, skip */ }
  return out;
}

/** extract { name: version } from a requirements.txt body */
function parsePyPI(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const l = line.trim();
    if (!l || l.startsWith("#") || l.startsWith("-")) continue;
    const m = l.match(/^([A-Za-z0-9_.\-]+)\s*([=<>!~]+\s*[0-9][^\s;]*)?/);
    if (m) out[m[1]] = (m[2] || "").replace(/[=<>!~\s]/g, "") || "any";
  }
  return out;
}

async function latestNpm(name: string): Promise<string | null> {
  try {
    const r = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const j = await r.json();
    return j.version ?? null;
  } catch { return null; }
}
async function latestPyPI(name: string): Promise<string | null> {
  try {
    const r = await fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const j = await r.json();
    return j.info?.version ?? null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  try {
    const { accessKey, handle } = await req.json();
    const key = accessKey?.trim().toUpperCase();
    if (!key && !handle) return NextResponse.json({ error: "access key or handle required" }, { status: 400 });

    const q = db.from("creators").select("id, name, repo_full_name, repo_branch, total_earned_usdc, is_repo");
    const { data: creator } = await (handle ? q.eq("handle", handle) : q.eq("access_key", key)).maybeSingle();
    if (!creator) return NextResponse.json({ error: "repo not found" }, { status: 404 });
    if (!creator.is_repo) return NextResponse.json({ error: "dependency agent works on repos only" }, { status: 400 });
    if (Number(creator.total_earned_usdc ?? 0) < DEP_AGENT_FEE)
      return NextResponse.json({ error: `repo agent needs at least $${DEP_AGENT_FEE} in earnings to pay the Dependency Agent (has $${Number(creator.total_earned_usdc ?? 0).toFixed(4)})` }, { status: 402 });

// fetch the CURRENT manifests directly from GitHub (more reliable than ingested chunks)
    const parsed = parseRepo(creator.repo_full_name);
    if (!parsed) return NextResponse.json({ error: "bad repo name" }, { status: 400 });
    const branch = creator.repo_branch || "main";
    const [pkgJson, reqTxt] = await Promise.all([
      fetchFile(parsed.owner, parsed.name, "package.json", branch),
      fetchFile(parsed.owner, parsed.name, "requirements.txt", branch),
    ]);

    // extract declared dependencies
    const declared: { name: string; ecosystem: "npm" | "pypi"; version: string }[] = [];
    if (pkgJson) for (const [name, version] of Object.entries(parseNpm(pkgJson))) declared.push({ name, ecosystem: "npm", version });
    if (reqTxt) for (const [name, version] of Object.entries(parsePyPI(reqTxt))) declared.push({ name, ecosystem: "pypi", version });
    if (declared.length === 0) return NextResponse.json({ error: "no package.json or requirements.txt found in this repo" }, { status: 400 });
    // dedupe + cap
    const seen = new Set<string>();
    const toCheck = declared.filter((d) => { const k = d.ecosystem + ":" + d.name; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, MAX_DEPS);

    // query registries live
    const checks: DepCheck[] = await Promise.all(toCheck.map(async (d) => {
      const latest = d.ecosystem === "npm" ? await latestNpm(d.name) : await latestPyPI(d.name);
      let status: DepCheck["status"] = "unknown";
      if (latest) {
        const dMaj = majorOf(d.version), lMaj = majorOf(latest);
        status = (dMaj !== null && lMaj !== null) ? (dMaj < lMaj ? "outdated" : "ok") : "unknown";
      }
      return { name: d.name, ecosystem: d.ecosystem, declared: d.version, latest, status };
    }));

    const outdated = checks.filter((c) => c.status === "outdated");
    const table = checks.map((c) => `- ${c.name} (${c.ecosystem}): declared ${c.declared}, latest ${c.latest ?? "unknown"}${c.status === "outdated" ? " ⚠️ major behind" : ""}`).join("\n");

    const prompt = `You are a Dependency Agent for ${creator.repo_full_name}. Below are its dependencies with LIVE registry data (declared version vs. latest published). Write a concise Markdown report: **Stack** (ecosystems present), **Version Health** (call out which packages are a major version behind, using the real data — there are ${outdated.length} major-behind), and **Recommendations** (what to prioritize updating, any caveats). Use ONLY the data given; do not invent versions.

LIVE DEPENDENCY DATA:
${table}`;
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
      checked: checks.length, outdated: outdated.length,
      paid: { agent: "Dependency Agent", amount: DEP_AGENT_FEE, tx: tx.txHash },
    });
  } catch (err) {
    return NextResponse.json({ error: "dependency analysis failed", message: (err as Error).message }, { status: 500 });
  }
}