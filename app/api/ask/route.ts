import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runRouter } from "@/lib/router.ts";
import { settleSplit } from "@/lib/pay.ts";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { question, budget = 0.1 } = await req.json();
    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "question required" }, { status: 400 });
    }

    const { data: q, error: qErr } = await db
      .from("queries")
      .insert({ question, budget_usdc: budget })
      .select()
      .single();
    if (qErr) throw qErr;

    const result = await runRouter(question, budget);

    let paid: Awaited<ReturnType<typeof settleSplit>> = [];
    if (result.scored.length > 0) {
      paid = await settleSplit(q.id, result.scored);
    }

    await db.from("queries").update({
      spent_usdc: result.spent,
      refunded_usdc: result.refunded,
      platform_fee_usdc: result.platformFee,
      answer: result.answer,
    }).eq("id", q.id);

    return NextResponse.json({
      queryId: q.id,
      question,
      budget,
      domain: result.domain,
      answer: result.answer,
      trace: result.trace,
      specialistFee: result.specialistFee,
      specialistTx: result.specialistTx,
      spent: result.spent,
      platformFee: result.platformFee,
      refunded: result.refunded,
      paid: paid.map((p) => ({
        title: p.title,
        amount: p.amount_usdc,
        contribution: p.contribution,
        relevance: p.relevance,
        reason: p.reason,
        tx: p.gateway_tx,
        ok: p.paid,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
