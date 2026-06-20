/**
 * Test the full multi-agent flow: router -> specialist -> contributors.
 * Records a query + payout rows. Run with dev server + ollama up.
 * node --experimental-transform-types --no-warnings --env-file=.env.local scripts/route-test.mts "question"
 */
import { createClient } from "@supabase/supabase-js";
import { runRouter } from "../lib/router.ts";
import { settleSplit } from "../lib/pay.ts";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const question = process.argv[2] ?? "My startup is failing and I feel like a failure. How do I get through this?";
  const budget = 0.1;

  console.log(`\nQUESTION: ${question}`);
  console.log(`BUDGET: ${budget} USDC\n`);

  const { data: q } = await db.from("queries").insert({ question, budget_usdc: budget }).select().single();

  const result = await runRouter(question, budget);

  console.log("--- ROUTER + SPECIALIST REASONING ---");
  for (const line of result.trace) console.log(line);

  if (result.scored.length > 0) {
    console.log("\n--- SETTLING CONTRIBUTORS ON ARC ---");
    const paid = await settleSplit(q.id, result.scored);
    for (const p of paid) {
      console.log(`${p.paid ? "✓" : "✗"} ${p.title} — ${p.amount_usdc.toFixed(6)} USDC ${p.gateway_tx ? `(tx ${p.gateway_tx.slice(0,8)}…)` : "(FAILED)"}`);
    }
    await db.from("queries").update({
      spent_usdc: result.spent, refunded_usdc: result.refunded,
      platform_fee_usdc: result.platformFee, answer: result.answer,
    }).eq("id", q.id);
  }

  console.log(`\nDomain: ${result.domain}`);
  console.log(`Specialist fee: ${result.specialistFee} USDC (tx ${result.specialistTx?.slice(0,8) ?? "none"}…)`);
  console.log(`\nAnswer:\n${result.answer}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
