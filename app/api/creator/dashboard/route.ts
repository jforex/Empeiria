/**
 * Creator dashboard data — earnings, knowledge, and usage for one creator.
 * Looked up by handle (public profile stats).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  try {
    const handle = new URL(req.url).searchParams.get("handle")?.trim().toLowerCase();
    if (!handle) return NextResponse.json({ error: "handle required" }, { status: 400 });

    const { data: creator } = await db.from("creators")
    .select("id, handle, name, agent_label, agent_tagline, category, bio, total_earned_usdc, created_at, avatar_url, is_repo, repo_full_name, repo_url, repo_stars")
      .eq("handle", handle).maybeSingle();
    if (!creator) return NextResponse.json({ error: "creator not found" }, { status: 404 });

    // content pieces
    const { data: content } = await db.from("creator_content")
      .select("id, source_name, source_type, chunk_count, status, created_at")
      .eq("creator_id", creator.id).order("created_at", { ascending: false });

    // chunk usage totals
    const { data: chunks } = await db.from("creator_chunks")
      .select("times_used, times_paid").eq("creator_id", creator.id);
    const totalChunks = chunks?.length ?? 0;
    const totalUses = (chunks ?? []).reduce((s, c) => s + (c.times_used ?? 0), 0);

    return NextResponse.json({
      ok: true,
      creator: {
       handle: creator.handle, name: creator.name, agentLabel: creator.agent_label,
        isRepo: creator.is_repo ?? false, repoFullName: creator.repo_full_name ?? null,
        repoUrl: creator.repo_url ?? null, repoStars: creator.repo_stars ?? 0,
       tagline: creator.agent_tagline, category: creator.category, bio: creator.bio,
        avatarUrl: creator.avatar_url,
        totalEarned: Number(creator.total_earned_usdc ?? 0), joinedAt: creator.created_at,
      },
      knowledge: {
        contentPieces: content?.length ?? 0,
        totalChunks,
        totalUses,
        content: (content ?? []).map((c) => ({
          name: c.source_name, type: c.source_type, chunks: c.chunk_count, status: c.status, at: c.created_at,
        })),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "dashboard failed", message: (err as Error).message }, { status: 500 });
  }
}
