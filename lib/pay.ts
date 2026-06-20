/**
 * Settle a weighted split on Arc Testnet via Circle Gateway.
 * For each scored contributor, the agent's buyer wallet pays their computed
 * amount to a per-contributor protected endpoint (payTo = their wallet).
 */
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { createClient } from "@supabase/supabase-js";
import type { Scored } from "./agent-loop.ts";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

export interface PaidResult extends Scored {
  gateway_tx: string | null;
  paid: boolean;
}

let gateway: GatewayClient | null = null;
function getGateway(): GatewayClient {
  if (!gateway) {
    gateway = new GatewayClient({
      chain: "arcTestnet",
      privateKey: process.env.BUYER_PRIVATE_KEY as `0x${string}`,
    });
  }
  return gateway;
}

/**
 * Ensure the agent has enough Gateway balance to cover `total` USDC.
 * Deposits the shortfall (plus a small buffer) if needed.
 */
async function ensureGatewayBalance(total: number) {
  const g = getGateway();
  const balances = await g.getBalances();
  const available = Number(balances.gateway.formattedAvailable ?? "0");
  if (available < total) {
    const need = (total - available + 0.5).toFixed(6); // buffer
    console.log(`Depositing ${need} USDC into Gateway (have ${available}, need ${total})...`);
    await g.deposit(need);
  }
}

/**
 * Pay each contributor in `scored` for a given query.
 * Each payment hits /api/pay-contributor with that contributor's wallet + amount.
 * Records a payouts row per contributor and bumps contributor totals.
 */
export async function settleSplit(
  queryId: string,
  scored: Scored[],
): Promise<PaidResult[]> {
  const g = getGateway();
  const total = scored.reduce((s, x) => s + x.amount_usdc, 0);
  await ensureGatewayBalance(total);

  const results: PaidResult[] = [];

  for (const s of scored) {
    // Look up the contributor's wallet to route payment.
    const { data: contrib, error: cErr } = await db
      .from("contributors")
      .select("wallet_address")
      .eq("id", s.contributor_id)
      .single();
    if (cErr || !contrib) {
      results.push({ ...s, gateway_tx: null, paid: false });
      continue;
    }

    try {
     const payUrl =
        `${BASE_URL}/api/pay-contributor` +
        `?payTo=${contrib.wallet_address}` +
        `&amount=${s.amount_usdc.toFixed(6)}`;
      const payRes = await g.pay(payUrl, { method: "GET" });

      const tx =
        (payRes as { transaction?: string }).transaction ??
        (payRes as { data?: { transaction?: string } }).data?.transaction ??
        null;
        
      await db.from("payouts").insert({
        query_id: queryId,
        experience_id: s.id,
        contributor_id: s.contributor_id,
        relevance: s.relevance,
        contribution: s.contribution,
        weight: s.weight,
        amount_usdc: s.amount_usdc,
        reason: s.reason,
        gateway_tx: tx,
      });

      await db.rpc("increment_contributor_earnings", {
        cid: s.contributor_id,
        amount: s.amount_usdc,
      });

      results.push({ ...s, gateway_tx: tx, paid: true });
      console.log(`PAID ${s.amount_usdc.toFixed(6)} USDC -> ${contrib.wallet_address} (tx ${tx?.slice(0, 10)}...)`);
    } catch (err) {
      console.error(`Payment failed for ${s.id}:`, (err as Error).message);
      results.push({ ...s, gateway_tx: null, paid: false });
    }
  }

  return results;
}