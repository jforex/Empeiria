/**
 * Dev account dashboard — one account key returns ALL the owner's repos + pooled earnings.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { accountKey } = await req.json();
    const key = accountKey?.trim().toUpperCase();
    if (!key) return NextResponse.json({ error: "account key required" }, { status: 400 });

    const { data: account } = await db.from("dev_accounts")
      .select("id, github_owner, wallet_address").eq("account_key", key).maybeSingle();
    if (!account) return NextResponse.json({ error: "invalid account key" }, { status: 404 });

    const { data: repos } = await db.from("creators")
      .select("handle, repo_full_name, repo_url, repo_stars, agent_label, total_earned_usdc, avatar_url")
      .eq("owner_account_id", account.id).order("total_earned_usdc", { ascending: false });

    const list = (repos ?? []).map((r) => ({
      handle: r.handle, repoFullName: r.repo_full_name, repoUrl: r.repo_url,
      repoStars: r.repo_stars ?? 0, agentLabel: r.agent_label,
      earned: Number(r.total_earned_usdc ?? 0), avatarUrl: r.avatar_url,
    }));
    const pooledEarnings = list.reduce((s, r) => s + r.earned, 0);

    return NextResponse.json({
      ok: true,
      owner: account.github_owner,
      repoCount: list.length,
      pooledEarnings: Number(pooledEarnings.toFixed(6)),
      repos: list,
    });
  } catch (err) {
    return NextResponse.json({ error: "dashboard failed", message: (err as Error).message }, { status: 500 });
  }
}
