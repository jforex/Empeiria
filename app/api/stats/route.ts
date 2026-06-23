/**
 * Public marketplace stats — totals for the CLI and any dashboard.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET() {
  try {
    const [{ count: creatorCount }, { data: earnRows }, { count: chunkCount }, { count: queryCount }, { data: wRows }] = await Promise.all([
      db.from("creators").select("id", { count: "exact", head: true }),
      db.from("creators").select("total_earned_usdc"),
      db.from("creator_chunks").select("id", { count: "exact", head: true }),
      db.from("queries").select("id", { count: "exact", head: true }),
      db.from("creator_withdrawals").select("amount_usdc"),
    ]);

    const totalEarned = (earnRows ?? []).reduce((s, r) => s + Number(r.total_earned_usdc ?? 0), 0);
    const totalWithdrawn = (wRows ?? []).reduce((s, r) => s + Number(r.amount_usdc ?? 0), 0);

    return NextResponse.json({
      ok: true,
      creators: creatorCount ?? 0,
      knowledgeChunks: chunkCount ?? 0,
      questionsAsked: queryCount ?? 0,
      totalEarnedUsdc: Number(totalEarned.toFixed(6)),
      totalPaidOutUsdc: Number(totalWithdrawn.toFixed(6)),
    });
  } catch (err) {
    return NextResponse.json({ error: "stats failed", message: (err as Error).message }, { status: 500 });
  }
}
