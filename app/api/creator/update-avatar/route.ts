/**
 * Update a creator's avatar. Authenticated by access key.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { accessKey, avatarUrl } = await req.json();
    const key = accessKey?.trim().toUpperCase();
    if (!key) return NextResponse.json({ error: "access key required" }, { status: 400 });
    if (!avatarUrl?.trim()) return NextResponse.json({ error: "avatarUrl required" }, { status: 400 });

    const { data: creator } = await db.from("creators").select("id").eq("access_key", key).maybeSingle();
    if (!creator) return NextResponse.json({ error: "invalid access key" }, { status: 404 });

    await db.from("creators").update({ avatar_url: avatarUrl.trim() }).eq("id", creator.id);
    return NextResponse.json({ ok: true, avatarUrl: avatarUrl.trim() });
  } catch (err) {
    return NextResponse.json({ error: "update failed", message: (err as Error).message }, { status: 500 });
  }
}
