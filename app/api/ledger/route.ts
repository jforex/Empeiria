/**
 * Public ledger: aggregate stats + recent payouts.
 * Powers the "real people, anonymous, getting paid" proof on the landing page.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET() {
  try {
    const [{ data: contributors }, { data: experiences }, { data: queries }, { data: payouts }] =
      await Promise.all([
        db.from("contributors").select("handle, total_earned_usdc"),
        db.from("experiences").select("id", { count: "exact", head: false }),
        db.from("queries").select("id", { count: "exact", head: false }),
        db
          .from("payouts")
          .select("amount_usdc, contribution, reason, created_at, contributors(handle), experiences(title)")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

    const totalPaid = (contributors ?? []).reduce(
      (s, c) => s + Number(c.total_earned_usdc ?? 0),
      0,
    );

    return NextResponse.json({
      stats: {
        contributors: contributors?.length ?? 0,
        experiences: experiences?.length ?? 0,
        queries: queries?.length ?? 0,
        totalPaid,
      },
      recent: (payouts ?? []).map((p) => ({
        handle: (p.contributors as { handle?: string } | null)?.handle ?? "anon",
        title: (p.experiences as { title?: string } | null)?.title ?? "an experience",
        amount: Number(p.amount_usdc),
        contribution: Number(p.contribution),
        reason: p.reason,
        at: p.created_at,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
