/**
 * Devs who have connected repos — grouped by GitHub owner, with their repos.
 * Powers the landing "community of maintainers" grid.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET() {
  try {
    // all repo agents with their owner account
    const { data: repos } = await db.from("creators")
     .select("handle, repo_full_name, repo_stars, agent_label, avatar_url, total_earned_usdc, owner_account_id, is_repo, category")
      .eq("is_repo", true);

    const { data: accounts } = await db.from("dev_accounts").select("id, github_owner");
    const ownerById = new Map((accounts ?? []).map((a) => [a.id, a.github_owner]));

    // group repos by dev (owner account)
   const byDev = new Map<string, { owner: string; avatar: string | null; repos: { handle: string; repoFullName: string; repoStars: number; agentLabel: string; earned: number; category: string }[] }>();
    for (const r of repos ?? []) {
      const owner = (r.owner_account_id && ownerById.get(r.owner_account_id)) || (r.repo_full_name?.split("/")[0] ?? "unknown");
      if (!byDev.has(owner)) byDev.set(owner, { owner, avatar: r.avatar_url ?? null, repos: [] });
      byDev.get(owner)!.repos.push({
        handle: r.handle, repoFullName: r.repo_full_name, repoStars: r.repo_stars ?? 0,
        agentLabel: r.agent_label, earned: Number(r.total_earned_usdc ?? 0), category: r.category ?? "Other",
      });
    }

    const devs = [...byDev.values()].sort((a, b) =>
      b.repos.reduce((s, r) => s + r.earned, 0) - a.repos.reduce((s, r) => s + r.earned, 0)
    );

    return NextResponse.json({ ok: true, devs });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
