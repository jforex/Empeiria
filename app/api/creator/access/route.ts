/**
 * Returning creator access — paste an access key, get the creator's identity
 * back so the UI can load their dashboard and let them add more content.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { accessKey } = await req.json();
    const key = accessKey?.trim().toUpperCase();
    if (!key) return NextResponse.json({ error: "access key required" }, { status: 400 });

    const { data: creator } = await db.from("creators")
      .select("id, handle, name, agent_label, agent_tagline, category, total_earned_usdc")
      .eq("access_key", key).maybeSingle();

    if (!creator) return NextResponse.json({ error: "no creator found for that access key" }, { status: 404 });

    return NextResponse.json({
      ok: true,
      creatorId: creator.id,
      handle: creator.handle,
      name: creator.name,
      agentLabel: creator.agent_label,
      tagline: creator.agent_tagline,
      category: creator.category,
      totalEarned: Number(creator.total_earned_usdc ?? 0),
    });
  } catch (err) {
    return NextResponse.json({ error: "access failed", message: (err as Error).message }, { status: 500 });
  }
}
