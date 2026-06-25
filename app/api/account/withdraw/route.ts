/**
 * Pooled withdrawal — a dev withdraws from the combined earnings of all their repos.
 * Debits the repos (highest-earning first) to cover the amount, pays out on-chain.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withdrawCreatorUsdc } from "@/lib/withdraw-creator";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { accountKey, destination, amount } = await req.json();
    const key = accountKey?.trim().toUpperCase();
    const amt = Number(amount);
    if (!key) return NextResponse.json({ error: "account key required" }, { status: 400 });
    if (!destination?.trim()) return NextResponse.json({ error: "destination required" }, { status: 400 });
    if (!amt || amt <= 0) return NextResponse.json({ error: "valid amount required" }, { status: 400 });

    const { data: account } = await db.from("dev_accounts").select("id").eq("account_key", key).maybeSingle();
    if (!account) return NextResponse.json({ error: "invalid account key" }, { status: 404 });

    // gather the dev's repos + earnings
    const { data: repos } = await db.from("creators")
      .select("id, total_earned_usdc").eq("owner_account_id", account.id)
      .order("total_earned_usdc", { ascending: false });
    const pool = (repos ?? []).reduce((s, r) => s + Number(r.total_earned_usdc ?? 0), 0);
    if (amt > pool + 1e-9) return NextResponse.json({ error: `amount exceeds pooled earnings ($${pool.toFixed(4)})` }, { status: 400 });

    // pay out on-chain (treasury → destination)
    const tx = await withdrawCreatorUsdc("", destination, amt);

    // debit repos highest-first to cover the amount
    let remaining = amt;
    for (const r of repos ?? []) {
      if (remaining <= 1e-9) break;
      const have = Number(r.total_earned_usdc ?? 0);
      const take = Math.min(have, remaining);
      await db.from("creators").update({ total_earned_usdc: have - take }).eq("id", r.id);
      remaining -= take;
    }

    await db.from("creator_withdrawals").insert({
      creator_id: (repos ?? [])[0]?.id ?? null, destination, amount_usdc: amt, tx_hash: tx.txHash,
    });

    return NextResponse.json({ ok: true, txHash: tx.txHash, amount: amt, destination });
  } catch (err) {
    return NextResponse.json({ error: "withdrawal failed", message: (err as Error).message }, { status: 500 });
  }
}
