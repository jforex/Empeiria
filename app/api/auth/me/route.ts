/**
 * Who am I? Reads the session cookie and returns the logged-in dev + their repos.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSession } from "@/lib/session";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const session = readSession(req.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, authed: false });

  const { data: repos } = await db.from("creators")
    .select("handle, repo_full_name, repo_url, repo_stars, agent_label, total_earned_usdc, avatar_url")
    .eq("owner_account_id", session.accountId).order("total_earned_usdc", { ascending: false });

  const list = (repos ?? []).map((r) => ({
    handle: r.handle, repoFullName: r.repo_full_name, repoUrl: r.repo_url,
    repoStars: r.repo_stars ?? 0, agentLabel: r.agent_label,
    earned: Number(r.total_earned_usdc ?? 0), avatarUrl: r.avatar_url,
  }));
  const pooledEarnings = list.reduce((s, r) => s + r.earned, 0);

  return NextResponse.json({
    ok: true, authed: true,
    owner: session.githubOwner, avatar: session.avatar,
    repoCount: list.length, pooledEarnings: Number(pooledEarnings.toFixed(6)), repos: list,
  });
}
