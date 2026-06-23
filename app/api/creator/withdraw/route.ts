/**
 * Creator withdrawal endpoint. Authenticated by access key.
 * Moves earned USDC from the creator's custodied wallet to a destination they own.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withdrawCreatorUsdc, usdcBalance } from "@/lib/withdraw-creator";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { accessKey, destination, amount } = await req.json();
    const key = accessKey?.trim().toUpperCase();
    if (!key) return NextResponse.json({ error: "access key required" }, { status: 400 });
    if (!destination?.trim() || !/^0x[a-fA-F0-9]{40}$/.test(destination.trim())) {
      return NextResponse.json({ error: "a valid destination address (0x...) is required" }, { status: 400 });
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) return NextResponse.json({ error: "amount must be greater than 0" }, { status: 400 });

    // authenticate the creator by access key
    const { data: creator } = await db.from("creators")
      .select("id, name, wallet_address, wallet_private_key, total_earned_usdc")
      .eq("access_key", key).maybeSingle();
    if (!creator) return NextResponse.json({ error: "invalid access key" }, { status: 404 });

    // check the creator's earnings ledger (what the treasury owes them)
    const owed = Number(creator.total_earned_usdc ?? 0);
    if (owed < amt) {
      return NextResponse.json({ error: `insufficient balance — you've earned ${owed.toFixed(6)} USDC` }, { status: 400 });
    }

    // execute the withdrawal from the platform treasury
    const result = await withdrawCreatorUsdc(creator.wallet_private_key, destination.trim(), amt);

    // decrement the ledger + record the withdrawal
    await db.from("creators").update({ total_earned_usdc: owed - amt }).eq("id", creator.id);
    await db.from("creator_withdrawals").insert({
      creator_id: creator.id, amount_usdc: amt, destination: destination.trim(), tx_hash: result.txHash,
    }).then(() => {}, () => {});

    return NextResponse.json({ ok: true, txHash: result.txHash, amount: amt, to: destination.trim() });
  } catch (err) {
    return NextResponse.json({ error: "withdrawal failed", message: (err as Error).message }, { status: 500 });
  }
}
