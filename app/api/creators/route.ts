/**
 * Public list of creator agents — for the landing grid and discovery.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  try {
    const category = new URL(req.url).searchParams.get("category");
    let query = db.from("creators")
    .select("id, handle, name, agent_label, agent_tagline, category, total_earned_usdc, avatar_url, is_repo, repo_full_name, repo_stars")
      .order("total_earned_usdc", { ascending: false })
      .limit(60);
    if (category && category !== "all") query = query.eq("category", category);

    const { data, error } = await query;
    if (error) throw error;

    // one query for all chunk counts, grouped client-side
    const ids = (data ?? []).map((c) => c.id);
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: chunks } = await db.from("creator_chunks").select("creator_id").in("creator_id", ids);
      (chunks ?? []).forEach((ch) => { counts[ch.creator_id] = (counts[ch.creator_id] ?? 0) + 1; });
    }

    const creators = (data ?? []).map((c) => ({
      handle: c.handle, name: c.name, agentLabel: c.agent_label,
      tagline: c.agent_tagline, category: c.category, avatarUrl: c.avatar_url,
      isRepo: c.is_repo ?? false, repoFullName: c.repo_full_name ?? null, repoStars: c.repo_stars ?? 0,
      earned: Number(c.total_earned_usdc ?? 0), chunks: counts[c.id] ?? 0,
    }));

    return NextResponse.json({ ok: true, creators });
  } catch (err) {
    return NextResponse.json({ error: "failed", message: (err as Error).message }, { status: 500 });
  }
}
