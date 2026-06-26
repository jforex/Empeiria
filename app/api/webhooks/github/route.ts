/**
 * GitHub webhook receiver — on push, re-ingest the repo (debounced).
 * Verifies the HMAC signature, acks GitHub immediately (fast 200),
 * then re-ingests in the background via after() so GitHub doesn't time out.
 */
import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { parseRepo, fetchRepoMeta, ingestRepo } from "@/lib/github-ingest";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const DEBOUNCE_MS = 2 * 60 * 1000; // skip if synced in the last 2 min

function verify(payload: string, sig: string | null): boolean {
  if (!sig) return false;
  const hmac = crypto.createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET || "");
  const digest = "sha256=" + hmac.update(payload).digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(sig)); } catch { return false; }
}

async function reingest(repoId: string, fullName: string) {
  try {
    const parsed = parseRepo(fullName);
    if (!parsed) return;
    const meta = await fetchRepoMeta(parsed.owner, parsed.name);
    await db.from("creator_chunks").delete().eq("creator_id", repoId);
    await db.from("creator_content").delete().eq("creator_id", repoId);
    await ingestRepo(repoId, parsed.owner, parsed.name, meta.defaultBranch);
    await db.from("creators").update({ last_synced_at: new Date().toISOString(), repo_stars: meta.stars }).eq("id", repoId);
  } catch (err) {
    console.error("background re-ingest failed for", fullName, (err as Error).message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const sig = req.headers.get("x-hub-signature-256");
    if (!verify(raw, sig)) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

    const event = req.headers.get("x-github-event");
    if (event === "ping") return NextResponse.json({ ok: true, pong: true });
    if (event !== "push") return NextResponse.json({ ok: true, ignored: event });

    const body = JSON.parse(raw);
    const fullName = body.repository?.full_name;
    if (!fullName) return NextResponse.json({ error: "no repo in payload" }, { status: 400 });

    const { data: repo } = await db.from("creators")
      .select("id, last_synced_at").eq("repo_full_name", fullName).maybeSingle();
    if (!repo) return NextResponse.json({ ok: true, note: "repo not connected" });

    // debounce
    if (repo.last_synced_at && Date.now() - new Date(repo.last_synced_at).getTime() < DEBOUNCE_MS) {
      return NextResponse.json({ ok: true, debounced: true });
    }

    // mark sync start immediately (also re-arms the debounce), then re-ingest in the background
    await db.from("creators").update({ last_synced_at: new Date().toISOString() }).eq("id", repo.id);
    after(() => reingest(repo.id, fullName));

    // fast ack so GitHub sees success
    return NextResponse.json({ ok: true, syncing: fullName });
  } catch (err) {
    return NextResponse.json({ error: "webhook failed", message: (err as Error).message }, { status: 500 });
  }
}