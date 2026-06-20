/**
 * Earnings report. A contributor presents their claim key (anonymous, no login)
 * and their Con reports back: total earned, per-experience breakdown, and who
 * represents them. This is the Con's reporting duty to its contributor.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { claimKey } = await req.json();
    if (!claimKey?.trim()) {
      return NextResponse.json({ error: "claim key required" }, { status: 400 });
    }

    const { data: contributor } = await db
      .from("contributors")
      .select("id, total_earned_usdc, con_id, created_at")
      .eq("claim_key", claimKey.trim().toUpperCase())
      .maybeSingle();

    if (!contributor) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    // their Con
    let con: { label: string; fee_rate: number } | null = null;
    if (contributor.con_id) {
      const { data: c } = await db.from("cons").select("label, fee_rate").eq("id", contributor.con_id).single();
      con = c ?? null;
    }

    // their experiences
    const { data: experiences } = await db
      .from("experiences")
      .select("id, title, domain, quality_score, times_surfaced, times_paid")
      .eq("contributor_id", contributor.id);

    // their payout history
    const { data: payouts } = await db
      .from("payouts")
      .select("amount_usdc, reason, gateway_tx, created_at, experience_id")
      .eq("contributor_id", contributor.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      found: true,
      totalEarned: contributor.total_earned_usdc ?? 0,
      con,
      experiences: experiences ?? [],
      payouts: (payouts ?? []).map((p) => ({
        amount: p.amount_usdc, reason: p.reason, tx: p.gateway_tx, when: p.created_at,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
